---
title: Supply chain security
minutes: 18
summary: Dependency risk and CI as an attack surface — securing not just your code, but everything your code trusts implicitly.
---

Modern software depends on hundreds, often thousands, of transitive
dependencies — and every one of them is code that runs with your
application's own privileges. Supply chain security is the discipline of
treating that dependency tree, and the pipeline that builds and ships it,
as a genuine attack surface rather than an implicitly trusted given.

## The transitive dependency problem

```text
  your package.json declares maybe 20-30 DIRECT dependencies —
  the ACTUAL install, including every dependency's OWN
  dependencies, can easily be several HUNDRED packages, most
  of which nobody on your team has ever read a single line of.

  → this is the Build Systems and Dependencies chapter's
    dependency graph, viewed specifically as a SECURITY surface
    rather than a build-mechanics one: a vulnerability (or
    deliberately malicious code) in ANY of those several hundred
    packages runs WITH your application's full privileges, and
    "we didn't choose that dependency directly" provides
    exactly zero actual protection — it's still running, either
    way.
```

## The recurring attack pattern: compromising a trusted maintainer

```text
  the actual, repeatedly observed pattern behind several REAL,
  major incidents: an attacker doesn't need to write NEW
  malicious code from scratch and somehow get widespread
  adoption — they compromise an EXISTING, already-trusted,
  already-widely-used package (a maintainer's credentials
  phished, a maintainer account taken over, a new "co-
  maintainer" added who then publishes a malicious update) and
  publish a malicious VERSION of something thousands of
  projects already depend on and update to routinely.

  → this is exactly why "it's a popular, widely-used package"
    is not, by itself, a safety guarantee — popularity is a
    LARGER, more valuable TARGET for exactly this attack, not
    inherent protection against it.
```

## SBOMs: knowing what you actually ship

```text
  a SOFTWARE BILL OF MATERIALS is a complete, structured
  INVENTORY of every component (direct AND transitive) in a
  given build — every package, every version, precisely.

  → the practical value shows up specifically WHEN a new
    vulnerability is disclosed in some widely-used library: with
    an SBOM, answering "are WE affected, and exactly WHERE" is a
    QUERY against a known inventory — without one, it's a
    genuinely manual, error-prone search across every
    project's dependency tree, under real time pressure, while
    a disclosed vulnerability is actively being exploited in
    the wild by attackers who read the same disclosure you did.
```

## Signing and verification: proving a package wasn't tampered with

```text
  → a package SIGNED by its publisher, with a signature a
    consumer can VERIFY before installing, is the Applied
    Cryptography chapter's signature mechanism applied to
    software DISTRIBUTION specifically — it proves the package
    genuinely came from who it claims to (assuming their
    signing key itself wasn't ALSO compromised) and wasn't
    tampered with in transit or on a compromised registry
    mirror between publication and your install.
```

```text
  → npm's/most registries' package integrity hashes (in the
    lockfile — the Build Systems and Dependencies chapter's
    reproducibility mechanism) provide a RELATED but distinct
    guarantee: that you get the EXACT SAME bytes you got last
    time, or explicitly first pinned — this protects against a
    registry silently serving DIFFERENT content for the same
    version LATER, but doesn't, by itself, verify the ORIGINAL
    publisher's identity the way a genuine signature does.
```

## Reproducible builds: verifying the artifact matches the source

```text
  the Build Systems and Dependencies chapter already covered
  WHY reproducibility matters as a supply-chain property, not
  merely tidiness — here's the concrete THREAT it defends
  against specifically: a compromised BUILD SERVER (not the
  source code repository itself) that injects malicious code
  ONLY during the build step, leaving the source code in git
  looking completely clean and legitimate to any reviewer.

  → a reproducible build lets ANYONE rebuild from the SAME
    source and verify they get BIT-IDENTICAL output to what was
    actually published — a mismatch reveals tampering happened
    somewhere in the BUILD PROCESS itself, even when the source
    code under review never contained anything suspicious at
    all.
```

## CI as an attack surface

```text
  → a CI pipeline has REAL, often broad privileges: it can push
    to a package registry, deploy to production, access
    deployment secrets — which makes CI CONFIGURATION itself a
    genuine, direct attack target, not merely a build-automation
    concern.

  → the CONCRETE risk pattern: a pull request from an EXTERNAL
    contributor that modifies the CI CONFIGURATION FILE itself
    (not just application code) can potentially run arbitrary
    commands WITH the pipeline's existing, elevated privileges
    and secrets — the SAME code-review discipline the code-
    review chapter covers needs to apply with PARTICULAR
    scrutiny to changes touching CI config specifically, since
    the blast radius of a compromised CI pipeline (production
    deploy access, registry publish access) is dramatically
    larger than a typical application code change.
```

## What to take away

1. A dependency you didn't choose directly still runs with your
   application's full privileges — "we didn't choose it" provides no actual
   protection, and a several-hundred-package transitive tree is a real
   attack surface.
2. Compromising an existing, widely-trusted maintainer's package is a
   repeatedly observed attack pattern — popularity is a larger target, not
   inherent protection.
3. An SBOM turns "are we affected by this newly-disclosed vulnerability"
   into a query against a known inventory instead of a manual search under
   real time pressure while the vulnerability is actively being exploited.
4. A package signature proves publisher identity and integrity; a lockfile
   integrity hash proves you get the same bytes as before — related but
   distinct guarantees, neither substituting for the other.
5. A reproducible build defends specifically against a compromised build
   server injecting malicious code during the build step while the source
   in git stays clean — a mismatch between rebuild and published artifact
   reveals tampering the source review would never catch.
