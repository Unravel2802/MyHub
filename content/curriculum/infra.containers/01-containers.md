---
title: Containers
minutes: 18
summary: Namespaces and cgroups — the two Linux kernel features a "container" actually is, underneath the tooling.
---

A container is not a lightweight virtual machine, despite how it's often
described. It's a set of ordinary Linux processes, made to LOOK isolated
using two specific kernel features that already existed before Docker made
them convenient. Understanding those two features explains nearly every
container behavior that otherwise looks like magic.

## What a container actually is

```text
  a VIRTUAL MACHINE virtualizes HARDWARE — a full guest kernel
  boots, on top of virtualized CPU/memory/disk. genuinely
  isolated, at a real cost: booting a kernel, and duplicating
  a full OS's memory footprint per VM.

  a CONTAINER is a NORMAL PROCESS on the HOST kernel — there is
  no guest kernel, no boot. it just LOOKS isolated because of
  two kernel features:

    NAMESPACES    what a process CAN SEE (its own process
                  list, its own filesystem root, its own
                  network interfaces) — the process ISN'T
                  actually alone; it just can't see anything
                  else

    CGROUPS         what a process CAN USE (CPU, memory limits)
                  — enforced by the kernel, not by isolation
```

```text
  → this is WHY a container starts in milliseconds where a VM
    takes seconds to boot — there's no kernel to boot at all,
    just a process starting with a restricted VIEW of an
    already-running kernel. it's also why "containers are less
    secure than VMs" has a real basis: a container shares the
    HOST'S KERNEL — a kernel-level vulnerability can potentially
    escape a container's namespace isolation in a way it
    structurally cannot escape a VM's hardware-level boundary.
```

## Images and layers

```text
  FROM node:18              layer 1: the base OS + Node.js
  COPY package.json .        layer 2: just this file
  RUN npm install             layer 3: node_modules
  COPY . .                     layer 4: your application code

  → each Dockerfile instruction creates a NEW LAYER, and layers
    are CACHED and SHARED — this is why instruction ORDER
    matters for build speed: putting `COPY . .` (your code,
    which changes on every commit) BEFORE `npm install`
    (dependencies, which change rarely) means every single code
    change invalidates the cached npm install layer too,
    forcing a full reinstall on every build — ordering rarely-
    changing layers FIRST is what makes incremental builds fast.
```

```text
  → a "2GB image" is almost always a LAYERING mistake, not an
    unavoidable size: build tools and intermediate artifacts
    left in the final image (a compiler, source files that are
    only needed to PRODUCE a compiled binary), rather than a
    MULTI-STAGE build (compile in one stage, copy only the
    final artifact into a clean, minimal final image) — this is
    the actual, mechanical fix for the "why is my image so
    huge" question, not a vague "optimize it" instruction.
```

## The filesystem: copy-on-write layers

```text
  a running container's filesystem is the IMAGE's layers
  (read-only) plus ONE thin WRITABLE layer on top — any file
  the container modifies gets COPIED into that writable layer
  first (copy-on-write), leaving the underlying image layers
  untouched.

  → this is WHY a container's changes disappear when it's
    removed (the writable layer is deleted with it, the image
    layers underneath were never touched) and why MANY
    containers can run from the SAME image simultaneously
    without interfering with each other — they share the
    identical read-only layers and each gets its own separate
    writable layer.
```

## Registries: distributing images

```text
  docker push myapp:v2.3.1

  → a REGISTRY (Docker Hub, a private ECR/GCR) stores images by
    NAME and TAG — this is content-addressable at the LAYER
    level: pushing a new image only uploads layers that DON'T
    already exist in the registry, and pulling reuses layers
    already present locally — the same "cache at every level"
    principle from the CDN/edge-caching chapter, applied to
    distributing images instead of web content.
```

```text
  → `:latest` is a MUTABLE tag — it can point to a DIFFERENT
    image tomorrow than it does today, which makes it a real
    reproducibility hazard for anything that needs "the exact
    same environment every time" (a production deployment, a
    CI pipeline) — pin to a specific, immutable version (or a
    content digest) for anything where reproducibility actually
    matters, the same lockfile-vs-range-version discipline the
    Build Systems and Dependencies chapter covers for package
    managers.
```

## Resource limits and the OOM killer

```text
  docker run --memory=512m myapp

  → a CGROUP memory limit is ENFORCED by the kernel — a
    container exceeding it doesn't get "slow," it gets its
    process KILLED (an out-of-memory kill, OOMKilled) —
    abruptly and without warning, which is a real operational
    gotcha: a container that "just crashes randomly" under load
    is very often hitting its memory limit, not experiencing an
    application bug, and the fix is raising the limit or fixing
    a memory leak, not debugging application logic that was
    never actually broken.
```

## What to take away

1. A container is a normal process made to look isolated by namespaces
   (what it can see) and cgroups (what it can use) — not a lightweight VM,
   which is why it starts in milliseconds with no kernel to boot.
2. Sharing the host kernel is exactly why containers have a real,
   structural security trade-off against VMs — a kernel vulnerability can
   potentially escape namespace isolation in a way it can't escape a VM's
   hardware boundary.
3. Dockerfile instruction order determines build-cache efficiency — putting
   frequently-changing code before rarely-changing dependencies invalidates
   the dependency-install cache on every single code change.
4. A container's writable layer sits on top of the image's read-only
   layers, which is why removing a container discards its changes and why
   many containers can share one image's layers simultaneously.
5. A container that "randomly crashes" under load is very often hitting its
   cgroup memory limit (an OOM kill), not experiencing an application bug —
   a real, common operational misdiagnosis.
