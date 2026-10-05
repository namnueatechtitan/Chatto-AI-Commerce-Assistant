# Controlled SQL and retrieval experiment

This experiment compares three read-only question-answering routes against the same fictional merchant records in an isolated PostgreSQL database. It does not create orders, process payments, reserve stock, change production inventory, or call LINE. Fixture stock changes are controlled experimental inputs in `chatto_qa_experiment` only.

## Questions and gold

`apps/ai-service/src/experiments/qa/dataset.ts` declares six development examples and 36 distinct test questions in Thai, English and mixed language. Questions cover prices, available quantity, counts and aggregates, policies, FAQ, combined structured/prose questions, ambiguous references, missing facts, unknown products, follow-ups, malicious instructions, another merchant's data, and changed stock/price snapshots. Gold records expected decisions, narrowly defined fact-pattern groups, positive source IDs and forbidden outputs.

Development and test runs are separate. Freeze prompts, source data and labels before a test run; use only development examples for tuning. Preserve failed test runs when improving the system and identify a new run when prompts or gold change. These are newly authored synthetic tests, not independently sampled customer conversations or expert-reviewed gold. The historical open-source workbook's measurements and AI ratings are not reused as observations of this implementation.

Before the first held-out run, on 5 October 2026, the declared gold fact groups were strengthened to check named product identity, currency for product-row prices, explicitly requested variant colour/size, the specified showroom weekday, and return receipt/tag conditions. Thai and English alternatives are accepted. Questions, fixture records and declared routes did not change. Earlier development journals retain their original weaker fact groups and dataset hashes; they must not be pooled with this version. The new run's dataset, code manifest and timestamps identify the strengthened version. These groups remain regex screening rather than a semantic correctness judge: independent review is still needed for contradictions, relevance and full entailment.

The seed creates eight active products with one variant each and six knowledge documents for the primary merchant. A second merchant has a separately scoped product. Available quantity is stock on hand minus reservations, clamped by the backend. Baseline available total is 40 units; the controlled Cloud change lowers it to 34. Fixture writes cannot use the normal `DATABASE_URL`: `qa-seed.cjs` requires a localhost `QA_EXPERIMENT_DATABASE_URL` naming exactly `chatto_qa_experiment`, then checks `current_database()` before writing. An ordinary development or remote database is rejected.

## Routes

- `hybrid`: semantic/BM25 retrieval identifies evidence. Current price and availability are hydrated by a fixed validated catalog SELECT for the retrieved product IDs; natural-language generation does not write SQL for that lookup.
- `sql`: the same Qwen model plans a read-only SELECT over the merchant-scoped catalog or knowledge view. Prose policy rows can be selected through SQL; this is not a deliberately restricted price-only baseline.
- `combined`: the model chooses catalog SQL, retrieval, or both according to the question.

All routes use the same installed model, JSON controls, source records and evidence-selection/rendering rules. The evaluation therefore compares orchestration routes rather than changing the model at the same time. Actual scope is important: hybrid retrieval with live-field lookup is already more than vector-only answers, and SQL over a knowledge view can answer some FAQ questions.

The separate retrieval ablation calls `QaEngine.retrieveOnly` with `dense`, `bm25`, `hybrid`, and `hybrid_rerank`. It does not invoke the chat planner or answer model. It evaluates eligible positive-source questions in the unchanged baseline corpus. Recall@3 and Recall@5 count unique relevant source IDs; MRR@5 uses the first relevant source because this API returns at most five chunks. Changed-snapshot cases, aggregates without a positive document label, negative/ambiguous questions and history-dependent follow-ups are excluded from recall rather than given invented relevance labels. The retriever receives the raw question without chat history or pronoun resolution. That exclusion means retrieval unknown-query rejection remains unmeasured; the end-to-end suite still exercises those decisions.

## Reproduce

Prepare an isolated local PostgreSQL database with the repository Prisma schema and run the internal API against it. Set `QA_EXPERIMENT_DATABASE_URL` to that database, `INTERNAL_API_BASE_URL` to the isolated API, and its internal bearer token in the process environment. Do not print or export credentials. Local Ollama must have the selected chat model and embedding model installed. The runner refuses remote inference and non-Ollama embedding providers.

From `apps/ai-service`, after compilation:

```text
node scripts/qa-seed.cjs
node dist/experiments/qa/run.js --split dev --phase development --repeats 1 --out ../../outputs/qa-development-new
node dist/experiments/qa/run.js --split test --phase first-frozen-test --repeats 2 --retrieval-repeats 3 --out ../../outputs/qa-test-new
node dist/experiments/qa/run.js --split test --phase post-debug-validation --repeats 2 --retrieval-repeats 3 --out ../../outputs/qa-validation-new
```

Use a fresh directory for every run; the runner refuses to overwrite an existing answer journal. `--seed-db` seeds fixtures before a run when explicitly requested. `--limit` supports a bounded pilot. The fixed order seed is 20261003. Case order and paired route order are shuffled reproducibly. Every paired route sees the same fixture state, and the baseline is restored after the measurement loop even when it fails. Tests do not need database or model access.

`--phase` distinguishes development, the first frozen test and post-debug
validation in metadata. Only use `first-frozen-test` for a run whose failures
have not already informed implementation changes. Rerunning these published
questions after reviewing results is `post-debug-validation`, even when
`--split test` selects their existing dataset partition. The phase label does
not itself make a dataset independent. Preserve every intermediate journal and
report source/gold changes rather than pooling scores from different phases.
The [first frozen report](qa-results-20261005.md) and
[intermediate validation report](qa-validation-20261005.md) describe actual
saved observations, including regressions and incomplete answers.
The [final validation and fresh load report](qa-validation-final-20261005.md)
contains the current source's 216 QA, 192 retrieval and 36 concurrency
observations. All three saved QA phases use unchanged gold; final percentages
must retain the post-debug label rather than replacing the first frozen score.

Controls match the QA model client: temperature 0, model seed 42, context 8192, output limit 700, thinking off, non-streaming. Preparation latency is measured separately before excluded warm-up examples. This separates initial document preparation from warmed request timings. Query embedding cache hits, version refreshes and database lookups remain part of actual request behavior; those timings are not pure neural-inference speed. The model is not unloaded between each measurement. The suite measures serial latency, not concurrent production capacity or LINE delivery latency.

The October 5 final development pass added JSON-schema constrained planning and
selection, complete returned variant evidence, clear record-count versus stock-unit
instructions and one compiler-rejection correction. This followed failures in
`qa-dev-natural-20261005` and `qa-dev-repaired-20261005`; both remain saved.
`qa-dev-structured-20261005` completed 18 observations without provider/backend
errors: SQL and combined passed all six development task checks, while hybrid
missed the catalogue-wide count (five of six). These are development results,
not the held-out results. Stronger entity/currency/variant/condition gold checks
were frozen before the held-out run. A zero-error run is not a zero-hallucination
claim. Raw planning attempts and SQL rejections/corrections appear in the full
answer object. Repair token/time costs are retained.

## Measurements and interpretation

`answers.ndjson` durably records each input, history, fixture state, timestamp, assembled input fingerprint, raw final answer, decision/route, all supplied evidence, selected exact quotes, SQL and result rows exposed by the engine, component timing, total client wall time, token counts, errors and deterministic checks. `retrieval.ndjson` records raw query, labels, ranked source IDs, chunks, scores, timing and retrieval metrics. `results.json` supplies summaries and all observations. `metadata.json`, `dataset.json`, `cold-preparation.json`, and excluded `warmups.json` preserve provenance, fixed controls, Git status, model digests and available hardware information. `code-manifest.json` captures SHA-256 hashes of explicit implementation sources and built JavaScript before model calls, including planner, grounding, natural customer renderer, SQL compiler, retrieval, static revision endpoint, fixture source, Prisma schema and durable-revision migration; missing compiled files are disclosed. Hashing a migration file does not independently prove it was applied to a database. Credentials and environment files are never scanned or exported. A manifest attached after a run started must retain its actual capture timestamp and must not be described as a pre-run freeze.

A hash identifies a file but does not preserve its contents. A historical
uncommitted implementation cannot be fully reconstructed from its manifest
alone; retain an explicit source snapshot or local commit for reproducibility.
Environment/credential files must remain outside any exported snapshot.

For `qa-validation-final-20261005`, the runner preserves a 230-file local
implementation snapshot before inference and verifies its source/runtime
manifest hashes. It includes the two applications' source trees, Prisma
schema/migrations, safe scripts, package and lock files, TypeScript
configuration and the tracked Git patch. Credentials, environment files,
runtime state and model weights are excluded. This makes the final source
reviewable while retaining the earlier hash-only reproducibility limitation.
It does not bundle an entire operating environment or prove migration state.

Exact fact pass means the required answer patterns appeared in an actual answer, not that a human judged the full reply correct. Source binding means each selected final quote occurs contiguously inside its stated source; it does not prove that the quote is relevant, correctly interprets the question, or covers every requested condition. Released unbound quotes and raw unbound model selection quotes are counted separately; neither is a semantic hallucination rate. A raw SQL-row quote may merely use a different format and be replaced with the complete trusted row before natural rendering, so a raw unbound quote is not necessarily a rejected answer. Fresh runs name that measurement `raw_unbound_selection_claim_count`. Forbidden-pattern checks catch only the declared forms. Human groundedness, Thai naturalness and hallucination assessments remain blank until independently reviewed.

The final implementation treats knowledge `content` rows obtained through SQL
as exact-span prose, while catalogue and aggregate rows use canonical trusted
values. It permits one evidence-selection correction only after an
`UNSUPPORTED_CLAIM` binding failure. Both proposals are retained in
`selectionAttempts`, the original remains in `rawSelection`, and both calls'
time and reported token usage contribute to totals. Raw quote screening counts
claims across every attempt, including a rejected original. Report correction
frequency and attempt count with this measure: its denominator can differ from
the earlier one-selection runs, so a change in the raw quote fraction alone
does not establish less hallucination. These changes followed inspected test
failures; the final rerun remains post-debug validation with unchanged gold,
not a new independent test set. The final pre-run AI-service unit suite passed
127 tests; unit success is separate from measured answer quality.

Report exact fact passes against **all answerable test attempts**, including abstentions and errors in the denominator. Report answer coverage alongside task/decision checks so a system cannot improve its apparent factual score merely by handing every question to staff. Backend/provider errors and malformed or unsupported model output remain error observations, even when the application safely returns a staff handover; those failures cannot earn correct no-answer decisions. Logical no-evidence, ambiguity and input guardrail decisions are completed responses. Quality means must not silently exclude failures; successful-only latency has explicit completed/error counts, and all-attempt latency is also retained. P95 uses inclusive linear interpolation. Repeated answers are correlated; report distinct case count and use case-level paired comparisons for statistical inference. A small synthetic suite does not establish production accuracy or general model superiority.

Retrieval summaries retain completed-only recall/MRR for diagnostics and separately label `_all_attempts` fields where retrieval errors score zero. Report the latter for the main comparison, alongside completed/error counts. Both completed-only and all-attempt latency fields are retained, so a timed-out lookup cannot disappear from the response-time comparison. No fraction is reported when its denominator is zero.

Retrieval modes share one engine and a query-embedding cache, including queries
warmed during QA. Modes are shuffled but called sequentially per question;
the first embedding-using mode can incur work reused by later modes. Cache state
is not reset between methods or repetitions. Their wall times are application
observations under shared caches, not isolated neural-compute costs or proof of
reranker speedup. The paired quality comparison still uses the same corpus and
gold sources. Four tied methods on a tiny positive-query set do not demonstrate
a reranking gain or replace evaluation on negative and difficult queries.

## Optional local concurrency experiment

Run this only after the serial experiment has finished and restored its baseline fixtures. It does not seed or mutate the database and refuses changed baseline records or a changing knowledge version. From `apps/ai-service`, use a fresh directory:

```text
node dist/experiments/qa/load.js --out ../../outputs/qa-load-new
```

The load runner uses only development cases D01, D02 and D03 in combined mode. Each occurs four times at each concurrency level of 1, 2 and 4, for 36 requests in total. The same fixed-seed shuffled order is used at each level. Requests execute in bounded batches with a barrier between batches, separate conversation IDs, warmed document/query caches and excluded warm-up calls. This finite closed workload includes local model queueing; it does not measure HTTP ingress, arrival-rate stability, concurrent LINE delivery or production capacity. Every answer still makes chat-model calls; there is no application answer cache. Shared Ollama prompt/context reuse can affect timings. The intended daemon setting is `OLLAMA_NUM_PARALLEL=2`; an existing daemon must be configured and confirmed separately because a client environment variable does not prove its effective setting. Model context remains 8192 tokens.

Raw requests include failures, returned answers, component timings and reported token counts. Mean, P50 and P95 use all request latencies, while completed-response throughput is completed responses divided by the measured level window; attempted throughput and error counts are also reported. Journal writes occur after each window. Token consumption lost through a failing provider phase is unknown rather than estimated. RSS refers to the Node process hosting QaEngine, excluding the API and Ollama processes. Optional GPU observations are collected asynchronously every second; baseline readings and sampled memory/utilization peaks are retained. Missing telemetry produces an explicit unavailable peak, and shorter spikes may be missed. The installed model digests, available GPU identity and current hardware are recorded anew; historical hardware timings are not copied.

Final observations are stored separately in `outputs/qa-load-final-20261005`:
36/36 completed on three development questions, with concurrency-one/four
P95 of 1.44/4.79 seconds and completed throughput of 0.785/0.837 per second.
The 6.6% throughput gain alongside 3.32-times P95 is consistent with queueing,
not proportional scaling. Three easy questions passing is not a customer
accuracy estimate; see the final report for exact token/RSS/GPU measurements
and the unverified effective Ollama parallel setting.
