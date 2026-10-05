# Phase 2 retrieval and embeddings

`modules/embeddings` defaults to local Ollama `bge-m3` (1024 dimensions). Set
`AI_EMBEDDING_PROVIDER=gemini` explicitly to use Google's embedding endpoint, or
`none` for offline lexical operation. `OLLAMA_EMBEDDING_MODEL`,
`OLLAMA_EMBEDDING_DIMENSIONS`, `OLLAMA_BASE_URL` and `AI_EMBEDDING_TIMEOUT_MS`
configure the local backend. Configuration checks do not prove that the daemon
or model is available; inference failures are reported to the caller.

Document vectors are reusable only when provider, model, dimension and a hash
of normalized title/text match. Changed text/model requires refresh. Failed
refresh clears the obsolete vector instead of silently comparing embeddings
from different models. Requests are deduplicated in flight and cached in a
bounded 256-entry memory cache. Ollama truncation is disabled.

Product indexing contains descriptions, categories, brands, variant names,
colors, sizes and SKUs. It deliberately excludes generated price and quantity
fields. Fetch authoritative prices and availability after selecting product
IDs; do not use a vector snapshot as their source. Stock-only and price-only
edits therefore leave the indexed text hash unchanged.

`modules/retrieval` provides four controlled modes: `dense`, `bm25`, `hybrid`,
and `hybrid_rerank`. BM25 uses ICU word segmentation for Thai/English, keeps
compound SKU tokens, and applies Okapi term-frequency/document-length
normalization. Dense search uses cosine similarity. Hybrid search combines
the two ranked lists with reciprocal rank fusion (RRF, k=60), rather than
adding incompatible raw scores. The optional reranker is a bounded,
deterministic combination of RRF rank, token coverage and exact SKU/title
matches. It is **not** a neural reranker or fact checker.

Scope and active status are applied before corpus statistics/search. Each
ranking has at most 40 candidates by default (configurable up to 200); their
union is reduced to that same bound before reranking. Return at most 10 chunks.
`lexical_score` is query-token coverage, `semantic_score` is cosine similarity;
raw BM25/RRF scores and mode/reranker names live in metadata. None is a
calibrated probability of answer correctness. Dense mode without a query
vector returns no hits; hybrid modes can fall back to BM25 explicitly.

The compatibility `RagService` accepts `retrieval_mode` and `candidate_limit`
in addition to the existing request shape. `AI_RETRIEVAL_MODE` sets its default
(otherwise `hybrid_rerank`). The legacy response `mode` field remains compatible;
per-chunk metadata identifies the actual chosen method.

`KnowledgeIndex.refresh(merchantId, loader)` atomically replaces one merchant's
full active corpus, removes obsolete sources, coalesces concurrent refreshes
and keeps the previous corpus if loading fails. Tenant snapshots are bounded
to 32 by default. Copies returned to callers prevent accidental mutation.
Scheduling, database revision checks and disk persistence belong to the caller;
the index itself performs no database or model calls. This in-memory cosine
baseline still scans vectors; it is not an ANN/pgvector database index.

Run `pnpm --filter @chatto/ai-service build`, then
`node --test apps/ai-service/scripts/retrieval.test.cjs` from the repository root.
The suite uses mocked embedding responses and performs no model/network calls.
