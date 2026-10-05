# Intermediate post-debug validation, 5 October 2026

This is the **intermediate** validation after inspecting the first frozen test's failures. The same 36 questions and unchanged gold were rerun after general prompt, guard and fallback changes. This is not an independent held-out estimate. Preserve it alongside the [first frozen report](qa-results-20261005.md); subsequent source fixes require a separately identified result set.

The combined route's task-check pass improved from **54/72 (75.0%) to 62/72 (86.1%)**, but its exact-fact pass on answerable questions stayed **44/52 (84.6%)**. The aggregate score improvement came from correct safety/escalation decisions. A successful compound answer was offset by a new fabric-care quote-binding failure. Mean combined latency rose from 873.0 to 1103.0 ms and P95 rose from 1459.4 to 2323.2 ms. Do not present the higher task score as a corresponding increase in factual answer correctness.

## Run identity and changes

Source observations are in `outputs/qa-validation-20261005/results.json`, `answers.ndjson` and `retrieval.ndjson`. Metadata explicitly declares `evaluation_phase: post-debug-validation`. The window was **18:54:26–18:58:59 Bangkok time on 5 October 2026**. The run contains 216 QA observations and 192 retrieval observations, using the same Qwen/BGE digests, fixture definitions, controls and gold as the first run.

Changes distinguish product-choice ambiguity from missing facts, restore Thai SARA AM after NFKC for guard matching, improve product-name/variant planning instructions and allow a structurally restricted empty-name SQL fallback in combined mode. A post-render absence-wording gate directs unknown information to staff. The fallback never widens numeric/colour/size predicates or aggregates. No question-specific answer table or gold change was introduced.

The full initial snapshot fingerprint differs from the first run because snapshots also contain changing metadata/dynamic fields; do not claim byte-identical snapshots. The declared dataset and selected-case hashes are identical. All 14 static source texts observed across the two retrieval journals match, and both preparations reported static revision 18. Each paired route still receives its controlled fixture state. Document preparation was 355.8 ms for 14 documents, followed by excluded warm-ups.

## Intermediate route metrics

| Metric | Hybrid RAG + live lookup | Text-to-SQL | Combined |
|---|---:|---:|---:|
| Completed / attempted | 70/72 | 72/72 | 70/72 |
| Error-classified blocked selections | 2 | 0 | 2 |
| Task checks, all attempts | 48/72 (66.7%) | 50/72 (69.4%) | **62/72 (86.1%)** |
| Correct decision, all attempts | 52/72 (72.2%) | 50/72 (69.4%) | **64/72 (88.9%)** |
| Exact facts, all answerable attempts | 30/52 (57.7%) | 36/52 (69.2%) | **44/52 (84.6%)** |
| Answer coverage, answerable attempts | 34/52 (65.4%) | 36/52 (69.2%) | **46/52 (88.5%)** |
| Mean wall time, all attempts | 1505.7 ms | **1062.0 ms** | 1103.0 ms |
| P95 wall time, all attempts | 2963.2 ms | **2276.2 ms** | 2323.2 ms |
| Mean reported prompt tokens, completed only | 1615.8 | **1007.3** | 1238.2 |
| Mean reported completion tokens, completed only | 199.3 | **134.9** | 137.2 |
| Released unbound selected quotes | 0 | 0 | 0 |
| Raw unbound model selection quotes | 15 | 11 | 15 |

The four error observations are T18 in hybrid and combined, each repeated twice. The customer received a safe handover; the evaluation retains the error and gives no fact/task credit. These are quote-binding failures, not transport failures or confirmed factual hallucinations. The selector combined source fragments into a new English/Thai span instead of copying one contiguous passage. The underlying washing facts exist, but the requested exact quote did not. Binding prevented its release.

Repeated responses were identical within each route. There are 36 distinct questions, with 24, 25 and 31 passing all repetitions for hybrid, SQL and combined. The 72 repeated attempts are not independent samples.

### Paired changes from the first run

| Route | Newly passing distinct cases | Newly failing distinct cases | Net distinct task-pass change |
|---|---|---|---:|
| Hybrid | T25, T26, T27, T28, T36 | T06, T18 | +3 |
| SQL | T16, T20, T26, T27, T36 | T14 | +4 |
| Combined | T21, T26, T27, T28, T36 | T18 | +4 |

For combined, the expected clarification/handover subset improved from **10/20 to 18/20 attempts**. That accounts for its eight additional task passes. T21 gained an answer, while T18 lost one; the 44 exact-fact passes did not increase. T05 now returned the correct quantity 10 but omitted the named Sand product, so it still fails the declared identity/completeness check.

### Category and language breakdown

These fractions are intermediate task checks, including all errors and repetitions.

| Category | Hybrid | SQL | Combined |
|---|---:|---:|---:|
| Price | 6/6 | 6/6 | 6/6 |
| Stock | 4/6 | 2/6 | 2/6 |
| Aggregates | 0/12 | 12/12 | 12/12 |
| Changed aggregate | 0/2 | 2/2 | 2/2 |
| Policies | 6/6 | 0/6 | 6/6 |
| FAQ | 4/6 | 4/6 | 4/6 |
| Product specifications | 4/4 | 4/4 | 4/4 |
| Compound | 2/4 | 0/4 | 4/4 |
| Ambiguous product | 2/4 | 0/4 | 2/4 |
| Follow-up | 0/2 | 2/2 | 0/2 |
| Missing information | 6/6 | 4/6 | 6/6 |
| Unseen product | 2/2 | 2/2 | 2/2 |
| Injection/destructive request | 4/4 | 4/4 | 4/4 |
| Cross-merchant request | 2/2 | 2/2 | 2/2 |
| Human request | 2/2 | 2/2 | 2/2 |
| Changed stock | 2/2 | 2/2 | 2/2 |
| Changed price | 2/2 | 2/2 | 2/2 |

| Language | Hybrid task pass | SQL task pass | Combined task pass | Combined exact facts on answerable attempts |
|---|---:|---:|---:|---:|
| Thai | 16/26 (61.5%) | 22/26 (84.6%) | 22/26 (84.6%) | 16/18 (88.9%) |
| English | 24/30 (80.0%) | 20/30 (66.7%) | 28/30 (93.3%) | 18/20 (90.0%) |
| Mixed | 8/16 (50.0%) | 8/16 (50.0%) | 12/16 (75.0%) | 10/14 (71.4%) |

Mixed-language combined exact-fact screening fell from 12/14 to 10/14 because of T18. Language subsets contain different categories and are too small to establish a controlled language effect.

## Residual failures and regressions

Combined still fails **T05, T06, T18, T23 and T31** in both repetitions. T05 needs the trusted named entity alongside the aggregate quantity. T06's name phrase does not match `Night Cotton Cap`, and its colour/ordering predicates deliberately exclude the name-only fallback. T18 needs a valid contiguous source selection. T23 still chooses Ink rather than clarifying between black garments. T31 still misses the explicit Cloud reference in history.

Two additional regressions matter when assessing correctness. In SQL T13/T14, the selector chose the correct domestic delivery-fee/free-threshold passage, but the entire knowledge row was canonicalized into the output, including an unrelated sentence saying international fees were unavailable. The global absence-wording gate then handed over a domestic question with a known answer. In hybrid T06, the selector called authoritative **zero** availability missing information. These are overly broad uncertainty handling and selection errors; the database preserves zero versus unknown correctly.

The combined name fallback fired for T21 and T25 in both repetitions. T21 recovered Cloud and its return policy; the absent Aurora product in T25 still handed over. Four observations cannot establish that fallback resolves every synonym or prevents every entity mistake. Valid source binding also does not establish relevance or completeness. No independent human correctness, naturalness or hallucination ratings have been performed.

## Retrieval ablation: quality tied, timing confounded

All four methods again reached Recall@3, Recall@5 and MRR@5 of **1.000** on the same 16 positive queries, with no errors. Mean/P95 wall times were dense **4.84/34.47 ms**, BM25 **2.07/2.88 ms**, hybrid **4.73/32.65 ms**, and hybrid reranking **4.18/22.23 ms**. No quality gain from reranking was demonstrated.

`run.ts` uses the same engine and `EmbeddingsService` throughout QA and retrieval ablations. Modes are shuffled and called sequentially for each question/repetition, without resetting their shared query-embedding cache. A raw question may already be cached by QA; otherwise the first embedding-using method can incur the computation and subsequent methods can reuse it. Across the 48 query/repetition groups, dense was the first embedding method 20 times, hybrid nine and reranking 19; in the first repetition the counts were seven, five and four. Later repetitions reuse warmed queries. Revision, lexical-cache and queue state also contribute to wall time.

These differences are observed application timings under shared caches, not isolated neural-compute or reranker-overhead measurements. Do not interpret a smaller reranked mean as a reranker speedup. The paired same-corpus quality comparison remains valid within this tiny labelled corpus; it still excludes negative/ambiguous, changed-state, aggregate and pronoun-resolution questions. A neural reranker or fine-tuning expense is not supported by these tied results.

## Intermediate finite-workload load experiment

`outputs/qa-load-20261005/results.json` used this same intermediate source/runtime manifest after fixtures returned to baseline. It ran from **18:59:38 to 19:00:23 Bangkok time**, with three development questions D01/D02/D03, four copies of each per level, identical shuffled order and concurrency 1, 2 and 4. Every request invoked the full combined route. There was no application answer cache; document/query caches were warm. Batches had a barrier before the next batch, so this was not sustained open-loop traffic.

| Concurrency | Completed / attempts | Exact facts | Mean / P95 | Completed throughput | Sampled GPU memory peak | Request RSS peak |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 12/12 | 12/12 | 1171.1 / 1311.3 ms | 0.854/s | 11,054 MiB | 74.0 MiB |
| 2 | 12/12 | 12/12 | 1932.9 / 2401.7 ms | 0.892/s | 11,051 MiB | 64.8 MiB |
| 4 | 12/12 | 12/12 | 3454.9 / 4397.8 ms | 0.918/s | 11,050 MiB | 66.4 MiB |

Throughput rose only **7.5%** from one to four concurrent requests while P95 rose **3.35×**, consistent with inference queueing. More simultaneous customers did not yield a comparable capacity increase. The three easy development questions passing is not a 100% correctness estimate for customer inquiries.

GPU utilization peaks were 77% at all levels in one-second observations; the already-loaded baseline used 11,054 MiB and reported 69% utilization. These are whole-GPU sampled observations, not additional per-request VRAM or guaranteed maxima. After-request RSS describes only the Node process hosting `QaEngine`; it excludes the API, PostgreSQL and Ollama processes and is affected by garbage collection. One-second sampled RSS peaks were 73.7/64.8/66.4 MiB. Each level reported 17,292 prompt and 1,728 completion tokens, totaling 51,876/5,184 across 36 requests.

The intended Ollama daemon parallelism was two, but metadata explicitly says it was not verified through an API; the client process environment was unset. Use the observations as local finite-workload behavior, not proof of a particular effective server parallelism or production service capacity. HTTP ingress, chat persistence and LINE delivery remain outside these request timings.

## Provenance and interpretation

The dataset hash remains `f526d298e5bac241f8b9477e8d613863314c6bfb516553096261c083ff4a54b0`, and selected-case hash remains `eecf460581e447819e402657ea6fd46e31f09a6a59a233c3fcb230b4fe836d80`. The intermediate QA/load manifest is `37cf06b961766d130bef35ffedcc35c2f9a95abdd326a33fa806a5992b773d81`; the initial snapshot hash is `573c1e193b347390d39400bd2c0a41dcf7fe4ae28857c73899043947e5e26566`.

Metric denominators and inclusive P95 interpolation follow the [experiment protocol](qa-architecture-comparison.md). Exact facts and source binding are mechanical screening, not full human accuracy. Zero released unbound quotes is not a measured zero hallucination rate. Use the independent atomic-claim review described in the first report, and preserve uncertain/unreviewed ratings as such. Further fixes should be reported in a new run, followed by genuinely new multilingual questions with multiple variants and difficult policy conditions.
