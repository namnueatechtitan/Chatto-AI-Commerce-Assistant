# Final post-debug synthetic validation — 5 October 2026

The final combined SQL/RAG implementation passed **64/72 task checks (88.9%)**
and **46/52 exact-fact checks on answerable attempts (88.5%)**, with zero
pipeline errors. SQL passed 54/72 task checks and hybrid retrieval with live
lookups passed 52/72. Combined is the strongest overall route on this fixture;
hybrid still answers two named-stock questions better and SQL resolves the
tested follow-up better. Four distinct combined questions remain failed.

These are mechanical checks on **36 previously inspected synthetic questions**,
each repeated twice. They are post-debug validation, not an independent
held-out accuracy estimate, a human correctness score or a measured
hallucination rate. The [first frozen report](qa-results-20261005.md) and
[intermediate report](qa-validation-20261005.md) remain preserved.

## Saved run and controls

`outputs/qa-validation-final-20261005/results.json` contains 216 QA observations
and 192 separate retrieval observations. The QA run took place from
**19:12:31 to 19:17:04 Bangkok time** (12:12:31–12:17:04 UTC). Each route has
72 attempts, including 52 expected answers and 20 expected clarification or
handover decisions. All 216 completed. The test has 13 Thai, 15 English and
eight mixed-language cases; these are different category mixes.

The installed models were local Ollama **Qwen3.5:9b Q4_K_M** and **BGE-M3 F16,
1,024 dimensions**, with temperature 0, seed 42, context 8,192, output limit
700, thinking off and non-streaming JSON-schema output. The same isolated
PostgreSQL merchant records and gold were used across paired routes. Case and
route order used fixed seed 20261003; warm-ups were excluded. The machine was
Windows 11, Intel Core Ultra 9 285K, 24 logical CPUs, approximately 128 GiB RAM,
RTX 5090 with 32,607 MiB reported GPU memory, driver 610.88 and Node 22.14.0.
Historical workbook timings on an RTX 5080 are a different experiment.

The routes compare orchestration with a constant model: hybrid retrieves
descriptions/knowledge then hydrates live product fields by a fixed scoped
lookup; SQL generates a constrained SELECT over `catalog` or `knowledge`;
combined chooses SQL, retrieval or both. The QA timing includes internal API
calls and local inference, and excludes LINE delivery, chat persistence and
customer-facing HTTP ingress.

## Final route comparison

| Measure | Hybrid with live lookup | SQL | Combined |
|---|---:|---:|---:|
| Completed / attempted | 72/72 | 72/72 | 72/72 |
| Task checks / all attempts | 52/72 (72.2%) | 54/72 (75.0%) | 64/72 (88.9%) |
| Correct decisions / all attempts | 56/72 (77.8%) | 56/72 (77.8%) | 66/72 (91.7%) |
| Exact facts / answerable attempts | 34/52 (65.4%) | 40/52 (76.9%) | 46/52 (88.5%) |
| Answers / answerable attempts | 38/52 (73.1%) | 42/52 (80.8%) | 48/52 (92.3%) |
| Mean / median / P95 wall time | 1466.4 / 1650.8 / 2664.8 ms | 1046.5 / 1143.6 / 1842.2 ms | 1155.4 / 1137.8 / 2466.0 ms |
| Mean prompt / completion tokens | 1663.1 / 190.1 | 1037.3 / 127.3 | 1294.8 / 142.9 |
| Distinct cases passing both repetitions | 26/36 | 27/36 | 32/36 |
| Released unbound claims | 0 | 0 | 0 |
| Raw unbound quotes / raw claims checked | 21/80 | 12/48 | 12/72 |

Task pass requires the expected decision, required fact groups for answers and
absence of declared forbidden patterns. Exact-fact checks include abstentions
and errors in the answerable denominator. All-attempt latency is reported;
with no final errors it equals completed-only latency. P95 uses inclusive
linear interpolation. A source-valid answer can still be irrelevant,
incomplete or based on the wrong interpretation.

Mean planner/retrieval/database/selection time was **443.3/11.6/4.7/1006.3 ms**
for hybrid, **562.6/0/5.0/478.6 ms** for SQL and
**449.6/3.8/5.0/696.2 ms** for combined. Model work dominates these warmed
local request times. Their sums need not equal client wall time because of
orchestration overhead and phase boundaries. Combined's mean was 21.2% below
hybrid and 10.4% above SQL here; these are observed route timings under shared
caches, not isolated neural-compute measurements.

Final responses were identical across both repetitions for every case/route.
At the distinct-case level, combined beat hybrid on eight cases, tied on 26
and lost on T05/T06; it beat SQL on six, tied on 29 and lost on T31. The mean
paired task-pass differences are **+16.7 percentage points** versus hybrid and
**+13.9 points** versus SQL. Repeated observations are correlated; there are
36 distinct comparisons, not 72 independent questions per route. This small,
authored and inspected suite does not support a general superiority claim.

## First, intermediate and final changes

| Route | Task checks: first → intermediate → final | Exact facts: first → intermediate → final | Coverage: first → intermediate → final |
|---|---:|---:|---:|
| Hybrid | 42 → 48 → 52 /72 | 34 → 30 → 34 /52 | 38 → 34 → 38 /52 |
| SQL | 42 → 50 → 54 /72 | 34 → 36 → 40 /52 | 34 → 36 → 42 /52 |
| Combined | 54 → 62 → 64 /72 | 44 → 44 → 46 /52 | 44 → 46 → 48 /52 |

Combined's first-to-final task gain is **10 attempts**, or five distinct cases:
T21, T26, T27, T28 and T36. Eight of those gained attempts are correct
missing-information/input-safety decisions; two are the answerable T21
stock-and-return question. Correct decisions on the 20 expected no-answer
attempts rose **10/20 → 18/20**. Exact facts rose **44/52 → 46/52**. Report the
decision/safety gain separately from the smaller factual-answer gain.

Final versus intermediate recovered T18 in hybrid and combined, T06 in hybrid,
and T13/T14 in SQL, with no task-check regressions. Compared with the first
run, hybrid gained T25/T26/T27/T28/T36 and SQL gained
T13/T16/T20/T26/T27/T36, also with no final task regressions. This comparison
retains the intermediate unsupported-quote failures and policy regression;
they have not been removed from the recorded experiment.

The final source treats knowledge `content` reached through SQL as exact-span
prose. It no longer emits an entire knowledge row when selecting one shipping
condition; T13/T14 now return the correct domestic-fee/free-threshold passage
without an unrelated unknown international fee forcing handover. The selector
also preserves known zero as available evidence, recovering hybrid T06.
T18 now selects valid contiguous care evidence instead of stitching separate
language fragments into a new quote.

One evidence-selection correction is permitted only on `UNSUPPORTED_CLAIM`,
with unchanged evidence and binding rules. **It did not fire in any final
observation**: hybrid made 60 selection calls, SQL 48 and combined 58, with
zero two-attempt selections. Its behavior is unit-tested, but no final-run
gain can be attributed to exercised correction. The engine preserves every
proposal and includes all calls' time/tokens when it does occur. Raw quote
screening spans all attempts; its denominator must be reported when comparing
future runs. A differently formatted SQL quote can be safely replaced by a
trusted canonical row, so a raw unbound quote is not automatically a rejected
answer or semantic hallucination.

## Category and language results

Each cell lists **first → intermediate → final task passes / attempts**. Both
repetitions agree, so the counts represent twice as many observations as
distinct cases.

| Category | Hybrid | SQL | Combined |
|---|---:|---:|---:|
| Price | 6 → 6 → 6 /6 | 6 → 6 → 6 /6 | 6 → 6 → 6 /6 |
| Stock | 6 → 4 → 6 /6 | 2 → 2 → 2 /6 | 2 → 2 → 2 /6 |
| Aggregates | 0 → 0 → 0 /12 | 12 → 12 → 12 /12 | 12 → 12 → 12 /12 |
| Changed aggregate | 0 → 0 → 0 /2 | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 |
| Policies | 6 → 6 → 6 /6 | 2 → 0 → 4 /6 | 6 → 6 → 6 /6 |
| FAQ | 6 → 4 → 6 /6 | 2 → 4 → 4 /6 | 6 → 4 → 6 /6 |
| Product specifications | 4 → 4 → 4 /4 | 2 → 4 → 4 /4 | 4 → 4 → 4 /4 |
| Compound | 2 → 2 → 2 /4 | 0 → 0 → 0 /4 | 2 → 4 → 4 /4 |
| Ambiguous product | 2 → 2 → 2 /4 | 0 → 0 → 0 /4 | 2 → 2 → 2 /4 |
| Follow-up | 0 → 0 → 0 /2 | 2 → 2 → 2 /2 | 0 → 0 → 0 /2 |
| Missing information | 0 → 6 → 6 /6 | 0 → 4 → 4 /6 | 0 → 6 → 6 /6 |
| Unseen product | 0 → 2 → 2 /2 | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 |
| Injection/destructive request | 2 → 4 → 4 /4 | 2 → 4 → 4 /4 | 2 → 4 → 4 /4 |
| Cross-merchant request | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 |
| Human request | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 |
| Changed stock | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 |
| Changed price | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 | 2 → 2 → 2 /2 |

| Language | Hybrid final task pass | SQL final task pass | Combined task: first → intermediate → final | Combined final exact facts |
|---|---:|---:|---:|---:|
| Thai | 16/26 (61.5%) | 24/26 (92.3%) | 18 → 22 → 22 /26 | 16/18 (88.9%) |
| English | 24/30 (80.0%) | 22/30 (73.3%) | 24 → 28 → 28 /30 | 18/20 (90.0%) |
| Mixed | 12/16 (75.0%) | 8/16 (50.0%) | 12 → 12 → 14 /16 | 12/14 (85.7%) |

The combined mixed-language score recovered T18; Thai and English did not gain
task passes since the intermediate run. Different categories and small sample
sizes prevent interpreting these as a controlled language comparison.

## Remaining failures and next priorities

| Combined case | Observed failure | General improvement to evaluate next |
|---|---|---|
| T23: ambiguous black garment | Returns Ink's true six-unit quantity instead of clarifying between Ink and Luna. | Explicit candidate ambiguity checks before an entity-specific answer; multiple-product and multiple-variant challenge cases. |
| T31: follow-up price | Asks for the product although recent history identifies Cloud. | Resolve the referent into typed conversation state and verify it before SQL/retrieval; test changed and competing references. |
| T06: Night cap stock | `ILIKE '%Night cap%'` misses `Night Cotton Cap`; colour and ordering keep the query outside name-only fallback. | Separate validated entity resolution from exact colour/size/numeric predicates, retaining every constraint during lookup. |
| T05: Sand tote quantity | Correctly returns ten units but omits Sand product identity. | Preserve validated filter/group provenance alongside aggregate values so controlled rendering can name the result without inventing labels. |

These four cases fail in both repetitions. T05 is an incomplete answer with a
correct number; T23 is an unsupported choice of intended entity despite truthful
row values. Neither source binding nor zero pipeline errors fixes those
semantic failures. Name-only semantic fallback deliberately cannot widen
colour, size, price or stock predicates; broadening it to hide T06 would risk
changing the question's constraints.

Hybrid's other failures are catalogue-wide count/sum/min/max/changed aggregate
questions, T22's compound question and T31. T10 lists a true 790-THB hoodie for
a below-500 count question, and T11 lists real prices without the global
250-THB minimum. SQL's remaining failures include T15 return policy, T17
Saturday hours, T21/T22 compound questions, T23/T24 ambiguity, T28 missing
international fees and T05/T06 name matching. These distinctions support SQL
for structured filters/aggregates and RAG for descriptive policies, with better
routing/entity resolution rather than assuming more embedding compute will
fix every failure.

## Retrieval quality and timing limitations

All four retrieval modes completed 48 observations each over **16 distinct
positive queries**. Recall@3, Recall@5 and MRR@5 were **1.000** for dense,
BM25, hybrid and hybrid with deterministic reranking. Mean/P95 wall times were
**4.83/30.26 ms**, **2.22/2.88 ms**, **4.88/33.54 ms** and
**4.39/22.47 ms**, respectively. The initial document preparation measured
**361.3 ms** for 14 documents, separately from warmed QA.

No retrieval-quality gain from reranking was demonstrated. Modes share one
engine and query-embedding cache, including queries warmed during QA, and run
sequentially in shuffled order per question. Cache state is not reset; a later
method can reuse the embedding computed by an earlier one. These wall times
cannot isolate dense inference or reranker overhead, and a smaller reranked
mean is not evidence of reranker speedup. Negative/ambiguous questions,
aggregates, changed snapshots and history-dependent retrieval remain outside
this positive-source ablation. Adding a neural reranker or fine-tuning is not
justified by four tied methods on this tiny corpus.

A separate minimal cold readiness check recorded **7201.4 ms client wall time**
and **6956.1 ms model loading** for a six-token ready response. It is not a full
cold QA response benchmark; the main comparison used already-loaded models.

## Final finite-workload concurrency experiment

`outputs/qa-load-final-20261005/results.json` used the same final manifest from
**19:17:41 to 19:18:29 Bangkok time**. It ran D01/D02/D03 four times each per
level, with the same order and concurrency 1, 2 and 4. Separate conversations,
bounded batches with barriers, warm document/query caches and excluded warm-ups
were used. All requests still invoked planning/selection; there is no
application answer cache. Fixtures stayed at baseline revision 18.

| Concurrency | Completed / attempts | Exact facts | Mean / P50 / P95 | Completed throughput | Sampled GPU memory peak | Node RSS peak |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 12/12 | 12/12 | 1273.9 / 1322.7 / 1442.4 ms | 0.785/s | 11,317 MiB | 72.8 MiB |
| 2 | 12/12 | 12/12 | 2062.4 / 2026.1 / 2561.9 ms | 0.832/s | 11,313 MiB | 65.3 MiB |
| 4 | 12/12 | 12/12 | 3791.9 / 3807.3 / 4789.7 ms | 0.837/s | 11,328 MiB | 66.5 MiB |

Throughput increased **6.6%** from concurrency one to four, while P95 grew
**3.32×**, consistent with local inference queueing. Higher concurrency did
not yield proportional capacity. Three development questions passing is not
100% correctness for customer inquiries. Throughput is completed responses
divided by the measured level window; all-request latencies include queueing.
This finite workload does not measure open-loop arrival-rate stability,
HTTP/LINE delivery, persistence or production capacity.

GPU samples were taken once per second, with 15/14/15 samples and utilization
peaks of 84%/80%/82%. The loaded baseline already used 11,306 MiB and reported
81% utilization. Peaks are whole-GPU observations, not incremental per-request
VRAM; shorter spikes may be missed. Sampled and after-request Node RSS peaks
matched here and exclude API, PostgreSQL and Ollama memory. Garbage collection
can lower RSS between levels. Each level reported 17,832 prompt and 1,728
completion tokens, totaling **53,496/5,184** across 36 requests. Ollama's
intended parallel setting was two but metadata records that its effective
daemon setting was not verified; the client environment was unset.

## Provenance, reconstruction and human review

Gold and scenarios remained unchanged across first/intermediate/final runs.
The 14 observed static chunk texts are identical between first and final.
Corpus hashes differ because the serialized snapshot includes metadata and
dynamic values updated during controlled experiments; do not claim identical
snapshot bytes. The code manifest was captured at **12:12:31.341 UTC**, before
the final run started at 12:12:31.509. A 230-file source/runtime overlay and
tracked patch were saved at **12:12:30.503 UTC**, with 49 present manifest
files checked against the saved snapshot. Environment files, credentials,
runtime state, weights and `node_modules` were excluded. The latest AI-service
unit suite passed **127 tests** before inference.

| Item | SHA-256 / identity |
|---|---|
| Git branch base | `7d7fe3960734134b800922204038addd0569b05e` |
| Dataset / gold | `f526d298e5bac241f8b9477e8d613863314c6bfb516553096261c083ff4a54b0` |
| Selected cases | `eecf460581e447819e402657ea6fd46e31f09a6a59a233c3fcb230b4fe836d80` |
| Final initial corpus | `40bbc7c8ef3a5fa13e01b1716191a643eeff86917e62e548ec18aee5bc94f173` |
| Final QA/load code manifest | `5611e77dd3b65a19d55e9fe9e0acb7514aaa27b889a70e105623b05e6ddbca4c` |
| Implementation snapshot manifest | `2253fd9f68c60bf6f17336247646f23fa068de8346b4b9274f48aa6cfc0f0d79` |
| Qwen3.5:9b model digest | `56671c2ab9385f9cfcb404638e32cd62d88e3501d44822208363c010179a3c90` |
| BGE-M3 model digest | `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab` |

The implementation lives in
`outputs/qa-validation-final-20261005/implementation`; restore the Git base,
apply its tracked patch, overlay saved files, install pinned dependencies and
compile. The snapshot excludes a complete machine environment and does not
independently prove database migration state. Earlier runs retain manifests
and observations without complete historical source contents, limiting exact
reconstruction of their uncommitted implementations. The final QA/load code
manifest matches; documentation added after inference describes the saved run.

Human correctness, naturalness and hallucination ratings remain unreviewed.
Use the independent atomic-claim process in the first report: review the
question and scoped source at its recorded state, mark each factual claim as
entailed, contradicted, unsupported or uncertain, then separately assess
entity relevance, missing conditions, completeness and appropriate abstention.
Predeclare whether hallucination counts unsupported/contradicted claims and
which denominator is used; report unanswered questions through coverage and
task failure. An LLM judging its own output or a regex fact pass is insufficient
to establish human semantic correctness. **Zero released unbound quotes is
not a measured zero hallucination rate.** A fresh multilingual challenge set,
multiple variants, hard policy exceptions and independent reviewers are the
next required evidence before treating these percentages as general accuracy.
