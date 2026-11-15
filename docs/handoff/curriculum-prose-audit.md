# Curriculum prose audit

## Batch C

### Review follow-up

- deep-learning.cnn/01-convolutional-networks.md:80 — Rewrapped the receptive-field paragraph to the chapter’s prose width.
- llm.reasoning/01-reasoning-and-test-time-compute.md:107 and deep-learning.rl/01-reinforcement-learning.md:185 — Restored the link between harder-to-game verifiable rewards and longer reasoning RL runs in both chapters and takeaways. Incomplete tests can still reward wrong answers.

#### data (2 fixes, 3 unsure)

- data.analytics-eng/01-analytics-engineering.md:49 — SQL subtracts every joined refund and the comment says timely refunds are excluded → subtracts total in-window refunds once per order and documents the same policy (summing only amounts dated from the order through day 30 yields $230 in the Apply example, while summing all refunds yields $220)
- data.quality/01-data-quality-and-contracts.md:76 — one duplicate job run exemplifies a 100× row count → uses a 2× row count (one original and one duplicate give two copies)

**Unsure, not changed**

- data.formats/01-file-and-table-formats.md:52 — zero serialization for Arrow interchange → unchanged (depends on shared compatible memory and transport)
- data.ingestion/01-ingestion-and-change-data-capture.md:61 — CDC read path adds essentially no additional query load → unchanged (source and connector overhead depend on deployment)
- data.warehouse/01-warehouses-lakes-and-lakehouses.md:158 — compute spins up only for queries → unchanged (billing and runtime behavior vary by warehouse)

#### engineering (0 fixes, 3 unsure)

No demonstrable fixes in this track.

**Unsure, not changed**

- engineering.career/01-scope-levels-and-growth.md:4 — scope and ambiguity as the primary promotion dimensions → unchanged (organizational policies differ and this is a heuristic)
- engineering.metrics/01-measuring-engineering.md:4 — the stated delivery metric taxonomy → unchanged (names and scope depend on report vintage)
- engineering.process/01-how-software-gets-built.md:27 — the historical characterization of waterfall and Agile → unchanged (accounts differ and the chapter gives no testable contract)

#### ml-foundations (9 fixes, 3 unsure)

- ml-foundations.evaluation/01-model-evaluation.md:81 — 8% precision gives 92 false alarms per true positive → 11.5 false alarms per true positive (FP/TP = 0.92/0.08 = 92/8 = 11.5)
- ml-foundations.evaluation/01-model-evaluation.md:130 — doubling an error gives four times the RMSE → quadruples its squared contribution before the root (10²/5² = 4, but root-mean-square of one error is its absolute magnitude)
- ml-foundations.calculus/01-calculus-and-optimization.md:73 — convexity implies one minimum and successful gradient descent at any step size → any local minimum is global and convergence needs a suitable step size (constant functions are convex with multiple minima, and the gradient update for x² is x ← (1−2η)x, which diverges for η>1)
- ml-foundations.calculus/01-calculus-and-optimization.md:86 — Hessian alone classifies any point; flat directions preclude local minima → gives the second-derivative test at critical points and allows flat directions (x⁴ has a strict minimum with zero second derivative, and x² has a positive Hessian where the gradient is nonzero)
- ml-foundations.probability/01-probability-and-statistics.md:61 — 99% accuracy alone fixes the rare-event posterior → states sensitivity and specificity in the premise and qualifies the recap (the Bayes calculation uses P(+|D)=0.99 and P(+|¬D)=0.01, neither specified by overall accuracy alone)
- ml-foundations.probability/01-probability-and-statistics.md:110 — variance of a sum adds only under independence → zero covariance is sufficient, including the independent case (Var(X+Y)=Var(X)+Var(Y)+2Cov(X,Y))
- ml-foundations.probability/01-probability-and-statistics.md:95 — L2 regularisation strength described as the same as prior variance → strength tracks inverse prior variance (a zero-mean Gaussian adds w²/(2σ²) to the negative log posterior)
- ml-foundations.fairness/01-fairness-and-responsible-ml.md:79 — unequal base rates claimed to preclude equalized odds and predictive parity without qualification → specifies nonzero TPR and FPR (with shared TPR t and FPR f, precision tp/(tp+f(1−p)) varies with base rate p if t and f are positive; perfect classifiers are counterexamples to the original)
- ml-foundations.trees/01-trees-and-ensembles.md:92 — adding a tree fitted to the gradient of the loss → adds a tree fitted to the negative gradient (a positive step in the gradient raises loss to first order, whereas residuals under squared loss are proportional to the negative gradient)

**Unsure, not changed**

- ml-foundations.tuning/01-hyperparameter-optimization.md:35 — random search strictly better at equal budget → unchanged (the chapter illustrates its advantage in a sparse effective search space, but the empirical ranking across workloads lacks a specified objective/distribution)
- ml-foundations.calculus/01-calculus-and-optimization.md:77 — most high-dimensional critical points are saddles → unchanged (depends on the objective and what is sampled)
- ml-foundations.bandits/01-multi-armed-bandits.md:64 — Thompson sampling is usually the best empirical choice → unchanged (depends on benchmark, reward distribution and priors)

#### deep-learning (5 fixes, 3 unsure)

- deep-learning.representation/01-embeddings-and-representation.md:78 — InfoNCE denominator excludes the positive example → positive and negative scores are normalized together (with all scores equal the positive probability must be 1/(1 + number of negatives))
- deep-learning.generative/01-generative-models.md:149 — noise-prediction loss asserted to decrease monotonically → regression objective can still fluctuate (stochastic steps can improve the current minibatch while increasing another minibatch loss or full objective)
- deep-learning.cnn/01-convolutional-networks.md:80 — 3×3 convolution sees 3 pixels, two see 5, with no stride assumptions → unit-stride undilated receptive fields are 3×3 and 5×5 (each ordinary unit-stride 3×3 layer adds 2 positions per spatial axis)
- deep-learning.rl/01-reinforcement-learning.md:84 — PPO clips the update and guarantees a single step cannot move a policy too far → clips the objective incentive without a hard bound on an update (the ratio is an input to clipping and is not itself constrained by that expression)
- deep-learning.rl/01-reinforcement-learning.md:178 — verifiable tests cannot be reward-hacked and a KL penalty bounds movement → tests can miss failures and a soft penalty discourages movement (a test suite covers its assertions only and a finite penalty can be outweighed by reward)

**Unsure, not changed**

- deep-learning.compression/01-pruning-distillation-nas.md:104 — a distilled model that meets the bar is 10× cheaper → unchanged (depends on the student, workload and achieved serving utilization)
- deep-learning.attention/01-attention-and-transformers.md:146 — FlashAttention does more arithmetic → unchanged (depends on implementation and whether forward or training recomputation is counted)
- deep-learning.regularization/01-regularization.md:96 — modern LLM training is approximately one epoch → unchanged (depends on corpus repetition and training mixture)

#### llm (12 fixes, 4 unsure)

- llm.scaling-laws/01-scaling-laws.md:130 — each tenfold compute increase buys the same absolute reduction and a shrinking absolute reduction → same fraction of the reducible loss and shrinking absolute gains (if reducible loss is aC^−α, multiplying C by 10 multiplies loss by fixed 10^−α)
- llm.finetuning/01-finetuning-and-peft.md:71 — dense ΔW is described as containing only the low-rank parameter count → the learned factors are the small part (for square W, A and B store 2rd values while formed BA still has d² entries)
- llm.multimodal/01-multimodal-models.md:69 — 73 full 14-pixel patches described as covering a 1024-pixel side → 5,329 patches for complete patches only (73×14=1,022; keeping the unpadded remainder requires a different policy, and 73²=5,329)
- llm.reasoning/01-reasoning-and-test-time-compute.md:93 — programmatic verification said to remove the ceiling from reward hacking → removes reliance on a preference model while depending on check coverage (a program can accept an answer that meets its test cases and fails an untested case)
- llm.structured-output/01-structured-output.md:37 — grammar stated to guarantee parsing even though the chapter shows truncated valid prefixes → syntax guarantee is for completed outputs (a valid prefix such as an opening brace cannot be parsed as a complete object)
- llm.structured-output/01-structured-output.md:110 — a schema-valid date is assumed to be inherently a real date → calendar validity depends on the enforced constraint (a string that matches a YYYY-MM-DD pattern can still encode February 31)
- llm.structured-output/01-structured-output.md:238 — allowed citation IDs described as preventing fabricated citations outright → prevents unknown IDs but still permits incorrect attribution (a permitted ID can name a passage that does not support the claim)
- llm.tokenization/01-why-tokenization-exists.md:128 — Thai example implies exact 4× and generalizes it to all translations → Thai uses about 4× the tokens of the English example (45/12 = 3.75, compared with 18/12 = 1.5 and 30/12 = 2.5)
- llm.tokenization/02-embeddings-and-vocabulary.md:30 — one 128k × 4096 table is ~15% of 7B parameters → one table is ~7.5%, both untied tables ~15% (128,000×4,096=524,288,000 and 524,288,000/7,000,000,000≈0.0749)
- llm.tokenization/02-embeddings-and-vocabulary.md:197 — masking described as guaranteeing every output parses → guarantee applies to completed output (a prefix can satisfy the mask while still being incomplete)
- llm.memory/01-memory-and-context.md:33 — quadratic total cost asserted without a growth assumption → quadratic cumulative input tokens for uncompressed history with constant tokens added per turn (a fixed increment k yields k times the sum from 1 through n = k n(n+1)/2)
- llm.agents/01-agents-and-tool-use.md:44 — context grows monotonically even with compaction → uncompacted context grows monotonically (the memory chapter replaces raw history with a shorter summary)

**Unsure, not changed**

- llm.architecture/01-the-transformer-block.md:218 — 8 experts top-2 imply ~4× parameters and ~1.3× FLOPs → unchanged (no dense baseline, expert width or shared block cost is specified)
- llm.scaling-laws/01-scaling-laws.md:244 — models are deliberately over-trained by 50–100× → unchanged (training recipes and deployment objectives vary)
- llm.frontier/01-reading-the-frontier.md:197 — architecture stability and unresolved problems are time-sensitive → unchanged (requires a historical definition and dated evidence)
- llm.evaluation/01-llm-evaluation.md:190 — confidence interval width for n=50 → unchanged (roughly 14 percentage points is the worst-case normal approximation, but the actual interval depends on sampling and method)

#### ml-systems (23 fixes, 6 unsure)

- ml-systems.cost/02-capacity-planning.md:184 — 50% capacity increase → 100% capacity increase (2C − C = C at fixed hardware).
- ml-systems.cost/02-capacity-planning.md:242 — 50% capacity increase → 100% capacity increase (2C − C = C at fixed hardware).
- ml-systems.evaluation-infra/02-online-testing.md:100 — 300,000 users per arm and 60 days → about 3 million and 600 days (two-sided two-proportion approximation: 2 × 0.05 × 0.95 × (1.96 + 0.84)² ÷ 0.0005² ≈ 2.98 million per arm).
- ml-systems.gpu/02-arithmetic-intensity.md:43 — Compute-bound arrow on rising roofline → compute-bound label beyond the ridge (min(peak, bandwidth × intensity) rises only below the ridge).
- ml-systems.gpu/02-arithmetic-intensity.md:186 — A few percent utilization → below 1% (14 GFLOP ÷ 0.007 s ÷ 312 TFLOP/s ≈ 0.64%, as in the inference chapter).
- ml-systems.vector-search/01-ann-algorithms.md:28 — 7.7 GFLOP → 7.7G multiply-adds or about 15.4 GFLOP (each multiply-add counts as two FLOPs in the curriculum’s convention).
- ml-systems.inference-optimization/01-the-inference-bottleneck.md:118 — 512 KB → 512 KiB (524,288 bytes ÷ 1,024 = 512).
- ml-systems.inference-optimization/01-the-inference-bottleneck.md:157 — Full output length multiplied by TPOT → output length minus one (TTFT already includes token one).
- ml-systems.inference-optimization/01-the-inference-bottleneck.md:142 — FP8 or INT8 makes KV 2–4× smaller → halves the BF16 payload (8 bits ÷ 16 bits = 0.5, before quantization metadata).
- ml-systems.inference-optimization/02-memory-and-attention.md:222 — 2–4× sequence capacity from 8-bit KV → half the BF16 payload (8 bits ÷ 16 bits; realized concurrency also depends on other memory).
- ml-systems.training-infra/01-keeping-the-accelerator-busy.md:31 — Work divided by peak rate → model work rate divided by peak rate (MFU is dimensionless).
- ml-systems.training-infra/01-keeping-the-accelerator-busy.md:50 — Single-GPU peak as denominator for a job → combined peak (with N equal GPUs, divide the job’s total FLOP/s by N × per-GPU peak).
- ml-systems.training-infra/01-keeping-the-accelerator-busy.md:288 — Optimizer alone takes 16P → model and optimizer state total 16P (2P weights + 2P gradients + 4P master weights + 8P moments).
- ml-systems.labeling/01-labeling-quality.md:4 — Annotator agreement as a model ceiling → a signal of label quality (agreement measures consistency between raters).
- ml-systems.labeling/01-labeling-quality.md:9 — Agreement sets a hard ceiling → agreement can expose label ambiguity (a model matching either deterministic rater can exceed their pairwise agreement against that rater).
- ml-systems.labeling/01-labeling-quality.md:25 — 75% agreement proves 25% ambiguity and caps accuracy at 75% → 25% disagreement warrants investigation (1 − 0.75 = 0.25; no bound against an individual rater follows).
- ml-systems.labeling/01-labeling-quality.md:33 — Achievable ceiling → label consistency (pairwise agreement alone cannot determine achievable accuracy).
- ml-systems.labeling/01-labeling-quality.md:41 — All-negative annotators agree 95% → 100% (both produce the identical label on every item).
- ml-systems.labeling/01-labeling-quality.md:279 — Ceiling in the recap → label consistency (agreement of two labels is not a mathematical bound on prediction accuracy).
- ml-systems.cost/01-where-the-money-goes.md:99 — Formula gave cost per request → multiply by 1,000 (dollars/hour ÷ requests/hour cancels to dollars/request).
- ml-systems.serving/03-scaling-and-operations.md:197 — Formula gave cost per prediction → multiply by 1,000 (the raw quotient is dollars per prediction).
- ml-systems.serving/02-batching-and-throughput.md:29 — A 32× throughput guarantee from shared weight reads → 32 predictions per read (throughput also depends on batch time, as the next table shows).
- ml-systems.serving/01-serving-architectures.md:178 — A service p99 is typical after several requests → the chance of a tail call can rise with fan-out (for five independent calls, 1 − 0.99⁵ ≈ 4.9%, below 50%).

**Unsure, not changed**

- ml-systems.cost/01-where-the-money-goes.md:182 — a 2% conversion lift on $100M of revenue is obviously worth $50k/month → unchanged (the revenue period, incremental margin and relationship between conversion and revenue are unspecified).
- ml-systems.edge/01-on-device-inference.md:225 — 90% of requests handled locally implies 90% lower serving cost → unchanged (the estimate depends on how much cost is variable and whether fallback requests cost the same).
- ml-systems.inference-optimization/03-model-compression-and-speculation.md:168 — speedup approximates acceptance rate times draft length → unchanged (the approximation depends on what acceptance rate counts, the bonus token, rejection position and draft/verification costs).
- ml-systems.monitoring/02-drift.md:102 — a 0.1% shift gives p < 0.001 → unchanged (the result depends on sample size, variance and test assumptions).
- ml-systems.distributed-training/04-communication-and-debugging.md:93 — selected transport silently halves inter-node bandwidth → unchanged (effective throughput depends on network configuration and baseline).
- ml-systems.vector-search/01-ann-algorithms.md:138 — probing two of 1,000 IVF lists scans 1/500 of the corpus → unchanged (this is a reasonable equal-list-size approximation and an individual query can see uneven lists).
