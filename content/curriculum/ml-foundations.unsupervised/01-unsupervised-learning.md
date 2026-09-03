---
title: Unsupervised learning
minutes: 18
summary: Finding structure without labels, and the evaluation problem that follows.
---

Unsupervised learning finds structure in unlabelled data. Its central difficulty
is not the algorithms — most are simple — but evaluation: with no ground truth,
"is this good?" has no direct answer, and that shapes how it should be used.

## Clustering

```text
  k-MEANS
    assign points to the nearest of k centroids; recompute
    centroids; repeat.

    ✓ fast, simple, scales
    ✗ you must choose k
    ✗ assumes spherical, similar-sized clusters
    ✗ sensitive to initialisation (use k-means++)
    ✗ every point is assigned, including outliers
```

```text
  DBSCAN
    density-based: cluster dense regions, label sparse
    points as NOISE.
    ✓ finds arbitrary shapes; no k needed; handles outliers
    ✗ struggles with varying density; two parameters to tune

  HIERARCHICAL
    build a tree of nested clusters.
    ✓ no k needed up front; the dendrogram is informative
    ✗ O(n²) or worse

  GAUSSIAN MIXTURES
    soft assignment with a probabilistic model.
    ✓ probabilities, elliptical clusters, a likelihood to
      compare
    ✗ more parameters; can be unstable
```

```text
  choosing k, and why it is unsatisfying

    ELBOW        plot within-cluster variance against k; look
                 for a bend — often ambiguous
    SILHOUETTE   how well each point fits its cluster vs the
                 next best
    GAP STATISTIC compare against a null reference
    DOMAIN       the number that is useful to the business
```

**The last is usually the right answer.** If clustering feeds a product decision —
five customer segments a marketing team can act on — then five is the right k
regardless of what the silhouette score prefers. Clustering is more often a
communication tool than a discovery one.

## Dimensionality reduction

```text
  PCA
    project onto the directions of greatest variance.
    → the eigenvectors of the covariance matrix; SVD of the
      centred data

    ✓ linear, fast, deterministic, invertible
    ✓ components are interpretable as variance directions
    ✗ LINEAR only; needs centring and usually scaling
```

```text
  t-SNE / UMAP
    preserve LOCAL neighbourhood structure for visualisation.

    ✓ excellent 2D plots that reveal cluster structure
    ✗ VISUALISATION ONLY — do not feed them to a model
    ✗ distances BETWEEN clusters are meaningless
    ✗ cluster SIZES are meaningless
    ✗ stochastic; different runs give different pictures
```

```text
  the warning that matters:

    people read t-SNE plots as maps. they are not.

    two clusters far apart in a t-SNE plot are not
    necessarily far apart in the data, and a tight cluster
    is not necessarily dense.
```

UMAP preserves more global structure than t-SNE and is faster, which makes it the
better default — but the same caution applies. Use these to *generate hypotheses*,
then verify in the original space.

```text
  AUTOENCODERS
    a neural bottleneck: compress and reconstruct.
    ✓ non-linear; a learned representation
    ✗ needs training; the latent space has no guaranteed
      structure without a VAE-style prior
```

## Anomaly detection

```text
  the framing question first:

    do you have SOME labelled anomalies?
      → supervised, or semi-supervised. use them.
    none at all?
      → unsupervised, and evaluation will be hard.
```

```text
  ISOLATION FOREST     anomalies are easier to ISOLATE by
                       random splits — they need fewer splits
                       → fast, effective, few parameters
  ONE-CLASS SVM        learn a boundary around normal data
  LOCAL OUTLIER FACTOR density relative to neighbours
  RECONSTRUCTION       train an autoencoder on normal data;
                       high reconstruction error = anomaly
  STATISTICAL          z-scores, quantiles — often sufficient
                       and always worth trying first
```

```text
  the hard parts, which are not the algorithm

  □  anomalies are RARE, so you have almost no examples to
     validate against
  □  the definition of "anomalous" drifts
  □  a false positive rate that seems tiny is enormous at
     volume: 0.1% of 10M events is 10,000 alerts per day
  □  novel anomalies differ from historical ones by
     definition
```

**Compute the alert volume before deploying an anomaly detector.** A detector with
a 0.1% false-positive rate on a high-volume stream produces more alerts than any
team can triage, and the system is then ignored — which is worse than not having
it.

## Matrix factorisation

```text
  approximate a sparse matrix as a product of two low-rank
  factors.

    R [users × items]  ≈  U [users × k] · Vᵀ [k × items]

  → the classic collaborative-filtering method
  → and it is the same low-rank idea as SVD, PCA and LoRA
```

## The evaluation problem

```text
  with no ground truth:

  INTRINSIC     silhouette, reconstruction error, likelihood
                → measure the objective, not usefulness

  EXTRINSIC     does it improve a DOWNSTREAM task?
                → the only measure that matters

  HUMAN         do the clusters mean something to a domain
                expert?
```

```text
  the practical rule:

    evaluate unsupervised methods by what they ENABLE, not
    by their internal metrics.

    a clustering with a worse silhouette that produces
    segments a marketing team can act on is the better
    clustering.
```

## What to take away

1. k-means assumes spherical similar-sized clusters and assigns every point;
   DBSCAN handles arbitrary shapes and outliers at the cost of two parameters.
2. Choosing k by domain usefulness is usually better than by an internal metric —
   clustering is more often a communication tool than a discovery one.
3. PCA is linear, fast and interpretable; t-SNE and UMAP are for visualisation only,
   and inter-cluster distances and cluster sizes in their plots are meaningless.
4. For anomaly detection, use labels if you have any, and compute the alert volume
   before deploying — an ignored detector is worse than none.
5. Matrix factorisation is the same low-rank idea as SVD, PCA and LoRA.
6. Evaluate unsupervised methods by what they enable downstream, not by internal
   metrics.

Next: feature engineering, which usually matters more than the model.
