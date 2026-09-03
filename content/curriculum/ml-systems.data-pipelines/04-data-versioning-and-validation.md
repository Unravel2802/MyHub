---
title: Data versioning and validation
minutes: 19
summary: Making a dataset an identifiable artifact, and catching the upstream change before it trains a model.
---

Code has git. Data mostly has "the table, as of whenever you looked". That gap is
why ML systems are hard to reproduce and why bad data reaches models unnoticed.
Both problems have practical answers that do not require a platform.

## Why versioning data is different

```text
  CODE                               DATA
  ────                               ────
  small, text, diffable              large, binary, not diffable
  changes are deliberate             changes continuously, on its own
  a commit is a snapshot             a "snapshot" is a definition
                                     you must construct
```

You cannot commit a terabyte to git, and you would not want the diff. Four
approaches, in increasing order of what they give you:

```text
  1. IMMUTABLE PARTITIONS
       data/events/dt=2026-09-01/...
       never rewritten; a version is a set of partitions
       + trivially simple, works with any storage
       - late-arriving data means a partition is not final
         when it looks final

  2. A QUERY PLUS A TIMESTAMP
       "the result of THIS SQL against the warehouse as of T"
       + no data copied
       - requires the warehouse to support time travel, and the
         upstream tables to be append-only

  3. TABLE FORMATS WITH SNAPSHOTS
       Iceberg, Delta — every write produces a snapshot id you
       can read from
       + real point-in-time reads, no copying, ACID
       + the right answer if you already run one
       - requires the table format

  4. CONTENT-ADDRESSED DATASETS
       DVC, LakeFS: hash the contents, store a pointer in git
       + git-like semantics for data
       - another system; storage cost for materialised versions
```

**Table snapshots (3) are the best answer for most teams**, because the
capability comes free with the storage layer they already want for other reasons.
The point is not which mechanism you choose; it is that a training run records
**an identifier that can be resolved back to exactly the rows it saw**.

## What a reproducible training run records

```text
  □  dataset version        snapshot id, partition list, or hash
  □  the query / filters     including any sampling and its SEED
  □  feature definitions     their version, not just their names
  □  code version           git commit of the training repo
  □  config                  every hyperparameter, in full
  □  environment            library versions, CUDA version,
                            container image digest
  □  random seeds           and the framework's determinism flags
  □  hardware               GPU model — numerics differ across them
```

Missing any one makes "rebuild last month's model" fail, and the ones people omit
are usually the last three. Two experiments with different results and no
recorded environment cannot be compared, and the difference is often a library
minor version.

## Data validation

The higher-value half of this chapter, because it catches problems *before* they
become models.

```text
  raw data ──▶ [ VALIDATE ] ──▶ features ──▶ [ VALIDATE ] ──▶ train
                    │                             │
                 fail fast                    fail fast

  a pipeline without these gates trains on whatever arrives,
  and the corruption is baked into a model that then ships.
```

### Schema validation

```text
  □  expected columns present, no unexpected ones
  □  types as declared
  □  categorical values within the known set
  □  numeric values within plausible bounds
  □  required fields non-null
```

Schemas should be **inferred from a known-good dataset and then reviewed**, not
hand-written — a hand-written schema encodes what someone remembers, and an
inferred one encodes what is actually there. Then it is version-controlled and
changes go through review, which converts a silent upstream change into a pull
request.

### Statistical validation

Schema checks pass on data that is structurally fine and semantically broken:

```text
  □  row count within expected range for the period
  □  null rate per column, versus history
  □  distribution shift versus the previous run
       (KS test, PSI, or simply comparing quantiles)
  □  cardinality of categoricals
  □  duplicate rate
  □  freshness — the max timestamp is recent
```

```text
  the classic silent break:

    upstream changes a currency field from dollars to CENTS.

    schema check:  numeric, non-null, within bounds  ✓ PASSES
    distribution:  mean jumps 84.2 → 8420            ✗ CAUGHT
```

That example is worth remembering because it is the canonical case for why
statistical validation is not optional. Unit changes, timezone changes, encoding
changes and precision changes all pass schema validation and all destroy a model.

### Relational validation

```text
  □  referential integrity — every user_id in events exists in users
  □  the label rate is plausible (a fraud rate of 40% is a bug)
  □  train/test have no overlapping entities
  □  the number of rows per entity is within range
```

## What to do when validation fails

The decision matters as much as the check:

```text
  BLOCK                              WARN
  ─────                              ────
  schema violation                   a mild distribution shift
  row count off by >50%              a small null-rate increase
  a required column missing          a new categorical value
  the label rate is impossible       row count off by 5%

  → fail the pipeline. do not train.  → train, and alert a human
```

**Failing loudly beats training on bad data**, because the model trained on the
corrupted feature will pass its own evaluation — the corruption is in both the
training and the evaluation set — and ship. That is the case where an automated
pipeline actively causes the harm it was meant to prevent, and the validation gate
is the only thing standing in the way.

## Validating what production sends

The same checks belong at serving time, on live requests:

```text
  serving request ──▶ [ validate ] ──▶ model
                           │
                           ├─ out of range?
                           ├─ unexpected category?
                           └─ null in a required field?
                                  │
                                  ▼
                     what should happen?
                       reject the request?
                       impute and flag?
                       fall back to a default prediction?
```

That question needs an answer written down. A model receiving an out-of-range
feature will produce a number, and it will be nonsense. The usual answer —
**impute, log, and increment a counter** — keeps the service up while making the
problem visible, and pairs with the degradation hierarchy from the resilience
topic.

## Tooling, briefly

```text
  Great Expectations   expressive, mature, Python
  Pandera              lightweight, schema-as-code for dataframes
  TFDV                 schema inference plus drift, TF ecosystem
  dbt tests            if transformations already live in dbt
  Soda / Monte Carlo   managed data-quality monitoring
```

Any of them beats none. The most common failure is not choosing the wrong tool —
it is having validation that logs a warning nobody reads, which is the same
failure as an unwatched dead-letter queue.

## What to take away

1. A training run must record a dataset identifier that resolves back to exactly
   the rows it saw; table snapshots are the most practical mechanism.
2. Reproducibility also needs environment, hardware and seeds — the fields people
   omit are the ones that explain unreproducible results.
3. Validate between every stage, and infer schemas from good data rather than
   writing them from memory.
4. Statistical validation catches what schema validation cannot — a currency field
   switching to cents passes every type check.
5. Block on structural and impossible violations; warn on mild shifts. Training on
   bad data produces a model that passes its own evaluation and ships.
6. Validate at serving too, with a written decision about what happens when a
   feature is out of range.

Next: labelling — where training data actually comes from, and why its quality
caps everything.
