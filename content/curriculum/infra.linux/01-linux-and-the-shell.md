---
title: Linux and the shell
minutes: 18
summary: The filesystem, permissions, and processes — the mental model underneath every terminal command you'll ever run in production.
---

The Operating Systems chapter covered processes, permissions, and the kernel
in the abstract. This chapter is the same concepts made concrete — the
specific commands and files that Linux exposes them through, since that
interface is what you actually touch when something is broken at 3am.

## Everything is a file

```text
  /proc/1234/status     a RUNNING PROCESS's state, exposed as
                        a readable file
  /dev/sda1               a DISK, exposed as a device file
  /sys/class/thermal        HARDWARE sensors, exposed as files

  → Linux's design philosophy: as much as reasonably possible
    is represented as a file in a hierarchical namespace,
    readable/writable with the SAME basic tools (cat, echo, a
    file descriptor) that work on an ordinary text file —
    "cat /proc/cpuinfo" reads live hardware info the same way
    "cat notes.txt" reads a text file, because to the OS,
    they're both just files.
```

## Permissions

```text
  -rw-r--r--  1 alice  staff  1024 Jan 1 12:00 file.txt
  |‾‾‾||‾‾‾||‾‾‾|
   |    |    +-- OTHER: read only
   |    +------- GROUP: read only
   +------------ OWNER (alice): read, write

  chmod 644 file.txt     — same permissions, numeric form:
                            6 (rw-) 4 (r--) 4 (r--)
```

```text
  → the EXECUTE bit on a DIRECTORY means something different
    from what it means on a file — it controls whether you can
    ENTER/traverse the directory (cd into it, or open a file
    inside it by path) at all, separate from whether you can
    LIST its contents (the read bit). a directory with read but
    no execute lets you see filenames but not actually access
    anything inside them — a common source of "permission
    denied" confusion that looks contradictory until you know
    the two bits mean genuinely different things.
```

## Processes and signals

```text
  ps aux                  list running processes
  kill -TERM 1234           ask process 1234 to terminate
                            GRACEFULLY (it can catch this and
                            clean up first)
  kill -KILL 1234 (-9)       terminate IMMEDIATELY — the kernel
                            force-kills it; the process gets NO
                            chance to run its own cleanup code
```

```text
  → SIGTERM vs SIGKILL is a real, meaningful distinction, not
    "two ways to kill something": SIGTERM is a REQUEST a
    process can catch and respond to (close database
    connections cleanly, finish an in-flight write, then exit)
    — SIGKILL cannot be caught, blocked, or ignored AT ALL, by
    design, which is exactly why it's the last resort: it
    guarantees termination but guarantees NO graceful cleanup,
    which can leave data in an inconsistent state if the
    process was mid-write.

  → this is precisely why a container orchestrator (Kubernetes,
    Docker) sends SIGTERM FIRST, waits a grace period, THEN
    sends SIGKILL only if the process hasn't exited — giving a
    well-behaved process a real chance to shut down cleanly
    before resorting to the guaranteed-but-unclean option.
```

## Pipes and composability

```text
  cat access.log | grep "500" | wc -l

  → each command's STDOUT is connected DIRECTLY to the next
    command's STDIN — this is the actual mechanism (a kernel-
    level pipe, not a temp file or copy) behind Unix's
    "small tools that compose" philosophy: three simple,
    single-purpose tools chained together solve "how many 500
    errors are in this log" without any of the three needing to
    know about the other two, or about the specific problem
    being solved.
```

```text
  → this composability is why shell one-liners remain a
    genuinely useful debugging tool decades later — grep,
    sort, uniq, awk, and sed each do ONE thing, and the pipe
    is what lets you combine them ad hoc into exactly the tool
    you need for THIS specific investigation, without writing
    and compiling a custom program for it.
```

## systemd and service management

```text
  systemctl status nginx         is it running, and what
                                 happened recently
  systemctl restart nginx          restart it
  journalctl -u nginx -f            follow its logs LIVE

  → systemd manages SERVICES (long-running processes meant to
    stay up) — it handles STARTING them at boot, RESTARTING
    them if they crash (with a configurable backoff, so a
    crash-looping service doesn't consume 100% CPU in a tight
    restart loop), and CAPTURING their logs centrally (via
    journald) rather than each service managing its own log
    file independently.
```

## Debugging tools you reach for under pressure

```text
  top / htop        what's consuming CPU/memory RIGHT NOW
  df -h                disk space, per filesystem
  du -sh *               which DIRECTORY is actually using
                        the space (disk usage, summarized)
  lsof -i :8080            what PROCESS is listening on port
                        8080 — invaluable when "address
                        already in use" gives no other clue
  strace -p 1234            trace every SYSCALL a running
                        process makes — the tool of last
                        resort when a process is hanging and
                        you genuinely don't know why
```

```text
  → these tools map DIRECTLY onto the Operating Systems
    chapter's concepts — lsof is literally listing OPEN FILE
    DESCRIPTORS (which include network sockets, not just
    files); strace is watching the SYSCALL boundary that
    chapter covers abstractly, made concrete and observable in
    real time on a real running process.
```

## What to take away

1. Linux exposes hardware, running processes, and kernel state as files in
   one namespace — the same basic tools work on all of them, which is a
   deliberate design choice, not a coincidence.
2. A directory's execute bit controls traversal, separate from its read
   bit's control over listing contents — the two mean genuinely different
   things, which explains a common category of confusing permission errors.
3. SIGTERM is a catchable request allowing graceful cleanup; SIGKILL cannot
   be caught at all and guarantees termination with no cleanup chance —
   which is exactly why an orchestrator sends TERM first and KILL only as a
   last resort.
4. Unix pipes connect one command's stdout directly to the next's stdin at
   the kernel level, which is the actual mechanism behind small composable
   tools solving ad hoc problems without any of them knowing about the
   others.
5. Debugging tools like lsof and strace are the Operating Systems chapter's
   abstract concepts (file descriptors, the syscall boundary) made concrete
   and observable on a real running process.
