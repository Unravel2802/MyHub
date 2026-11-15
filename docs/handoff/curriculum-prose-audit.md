# Curriculum prose audit

## audit-a

### Review follow-up

- systems-design.case-video/01-video-streaming.md:38 — Replaced the stale egress-cost comparison with ~$16.2M/month at the case-storage rate (202,500,000 GB × $0.08/GB), with CDN delivery cheaper per GB.
- systems-design.case-storage/01-object-storage-and-cdn.md:177 — Clarified that the ~$120,000/month origin estimate has an additional, unpriced CDN delivery bill.

### distributed

- distributed.failure/01-how-systems-actually-fail.md:101 — N+1 failover used N/(N−1) → (N+1)/N, with 60% before the failure (the N survivors share the same total load from N+1 servers).
- distributed.failure/01-how-systems-actually-fail.md:118 — Three-replica independent availability was 99.9999997% → 99.9999999% (1 − 0.001³ = 0.999999999).
- distributed.coordination/02-locks-and-leases.md:161 — Lease expired at 40s and the job retried before stopping → expiry at 50s and stop on the first failed renewal at 30s (last success 20s + TTL 30s; the rule requires an immediate stop).
- distributed.fundamentals/02-the-eight-fallacies.md:93 — An exact 400 ms for 201 round trips → about 400 ms (201 × 2 = 402 ms).
- distributed.fundamentals/04-latency-and-physics.md:211 — The total latency multiplier was labelled queue waiting time → distinguished total from waiting in the explanation and takeaway (subtracting one service time from 1/(1−ρ) leaves ρ/(1−ρ)).
- distributed.messaging/03-consumers-and-offsets.md:83 — Commit of offset 200 supposedly lost records through 200 → commit offset 201 (the returned batch ends at 200, so the next position auto-commits 200 + 1).
- distributed.messaging/06-operating-a-log.md:145 — Binary 2,048-byte message size labelled 2 KB → 2 KiB (2 × 1,024 B; total is still about 24 TB in decimal units).
- distributed.messaging/06-operating-a-log.md:151 — Three days was called half of seven → three and a half days, scoped to storage (7 ÷ 2 = 3.5 days).
- distributed.membership/01-failure-detection.md:112 — φ=1 was labelled a false-suspicion probability → 10% heartbeat-interval tail probability (10⁻¹ is the probability of waiting this long under the heartbeat model, not the posterior probability that the node is healthy).
- distributed.rpc/06-client-design.md:27 — 2–3 ms on 5 ms was given as a single 50% overhead → 40–60% (2/5 = 0.4 and 3/5 = 0.6).
- distributed.scheduling/02-fairness-and-multitenancy.md:30 — The equal-CPU allocation purportedly left CPU available → it fits CPU but exceeds RAM (50 + 50 = 100 CPUs; 200 + 1,000 = 1,200 GB > 1,000 GB).
- distributed.time/02-happens-before-and-lamport.md:146 — The trace listed sends after separate events at timestamps 2 and 4 → made each send itself the event at that timestamp (a distinct send would increment the counter again).
- distributed.time/04-hybrid-clocks-and-truetime.md:57 — The same wall clock was labelled 100 and 99 → 99 (the receive step uses B’s local wall reading of 99).
- distributed.replication/05-leaderless-and-quorums.md:130 — Diagram assigned three responses to two replicas in each quorum → two of three responses on each pair’s edge (the third in each set is the shared replica 3).
- distributed.fundamentals/06-tail-latency.md:55 — Tail probabilities multiplied request success rates without specifying independence → stated independence for the page, session and fan-out examples, with a common p99 threshold in the page example (P(all fast) = 0.99ⁿ under independence).
- distributed.partitioning/03-consistent-hashing.md:296 — Modulo hashing was said to remap 80–99% for any change in N → used N/(N+1) for one added node (4/5 = 80%, 99/100 = 99%; doubling N only moves half).
- distributed.fundamentals/01-why-distribute.md:166 — Five serial services were given an exact 0.995 combined availability → marked the original rounded number as approximate (0.999⁵ = 0.995009990004999).
- distributed.partitioning/03-consistent-hashing.md:42 — Consistent hashing was said to remap exactly 1/(N+1) of keys → described that share as an average (random placements give unequal arcs, while the N+1 nodes have equal expected shares).
- distributed.partitioning/03-consistent-hashing.md:133 — The 3-by-8 virtual-node diagram had 16 nodes → displayed eight arcs for each of the three owners (the original counts were 6 + 5 + 5; the corrected total is 3 × 8 = 24).

#### Unsure, not changed

- distributed.batch-stream/04-windows-and-watermarks.md:204 — The example uses a 30-second measured p99 after a 45-second example → unchanged (the chapter can be read as using two separate latency distributions).
- distributed.partitioning/03-consistent-hashing.md:148 — Approximate worst-node overload of 1/√V → unchanged (the approximation gives the per-node spread scale, but the worst-node magnitude depends on the number of physical nodes and token placement).

### systems-design

- systems-design.estimation/01-back-of-envelope.md:78 — Binary powers were given as exact decimal storage units → marked decimal figures approximate and used exact binary units (2¹⁰ = 1,024, versus 10³ = 1,000).
- systems-design.estimation/01-back-of-envelope.md:119 — Feed read:write by item was 100:1 → 200:1 (2B feed loads × 20 posts per load ÷ 200M written posts).
- systems-design.estimation/01-back-of-envelope.md:147 — CDN-to-origin arrow equated 40 TB/day of media uploads with cache-miss traffic → labelled the path cache misses (20M × 2 MB is upload volume; a 95% hit rate does not send all delivered media to the origin).
- systems-design.case-metrics/01-metrics-and-timeseries.md:142 — All rollups were described as 30× smaller → 30×, 12× and 24× fewer samples over equal spans (300/10, 3600/300, 86400/3600).
- systems-design.case-video/01-video-streaming.md:36 — Monthly video egress was 6.75 EB → about 202.5 PB (5M viewer-hours/day × 3,600 s/hour × 3 Mbps ÷ 8 × 30 days = 202.5 PB).
- systems-design.case-storage/01-object-storage-and-cdn.md:34 — Direct egress was $80M/month and the chart compared it with an unpriced CDN bill → $2.4M/month direct and roughly $120,000/month in origin charges with CDN hits (1 PB/day × 30 × 10⁶ GB/PB × $0.08; 5% origin traffic at the same rate).

#### Unsure, not changed

- systems-design.case-search/01-search-and-autocomplete.md:122 — Describes the shard p99 as typical for a 50-shard query → unchanged (under independence it is approximately the parent p60.5, and typical has no specified threshold).
- systems-design.estimation/01-back-of-envelope.md:224 — The CDN total of $10,000–20,000 per month has no tariff in the example → unchanged (95% byte hits would leave $4,800 in same-rate origin egress; edge rates are unspecified).
