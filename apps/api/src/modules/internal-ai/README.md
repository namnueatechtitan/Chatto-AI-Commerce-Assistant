# Internal AI data boundary

All routes require `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`. Use a private
service token in deployed environments. The development fallback is for local use.
The trusted API caller selects the merchant; generated SQL cannot change tenant scope.
Version, snapshot and generated-SQL routes also reject missing, inactive or
suspended merchants; only ACTIVE/TRIAL merchant records are readable.

## Read-only generated SQL

`POST /internal/ai/query` accepts:

```json
{"merchant_id":"10000000-0000-4000-8000-000000000001","sql":"SELECT product_id, name, price, available_qty FROM catalog WHERE color ILIKE '%black%' AND price < 500 ORDER BY price ASC LIMIT 5"}
```

It returns `{columns: string[], rows: Record<string, unknown>[], truncated: boolean}`.
The server parses and recompiles one SELECT, binds the merchant and all literal
values as parameters, and injects two scoped CTEs:

- `catalog`: `product_id`, `variant_id`, `name`, `description`, `category`, `brand`,
  `sku`, `variant_name`, `color`, `size`, `price`, `currency`, `available_qty`, `status`.
  Only active products and active variants belonging to the same merchant appear.
  A product without an active variant is retained with nullable variant fields.
  Unknown stock yields `available_qty: null`; it is not reported as zero.
  The catalog has one row per active variant (or one nullable row for a product
  without an active variant). `COUNT(*)` counts catalog rows; use
  `COUNT(DISTINCT product_id)` to count products. All exposed IDs are text so
  parameter-bound ID equality and single/multiple-item `IN` work consistently.
- `knowledge`: `id`, `type`, `title`, `content`, from active merchant documents.

Allowed SQL includes field projections, `*`, aliases, `DISTINCT`, comparisons,
`AND`/`OR`/`NOT`, `LIKE`/`ILIKE`, `IN`, `BETWEEN`, null checks, `GROUP BY`,
`HAVING`, `ORDER BY`, and `COUNT`/`SUM`/`MIN`/`MAX`/`AVG`. Aggregate calls accept
one field; `COUNT(*)` is supported. LIMIT and OFFSET must be bounded literals.
Plain fields retain their original names. Aggregate result keys are generated
from the validated operation: `count_catalog_rows`, `count_knowledge_rows`,
`count_distinct_product_id`, `sum_price`, `avg_price`, and other
`<function>[_distinct]_<field>` keys. Model-provided aliases remain internal
references for ORDER BY/HAVING; they never label returned facts. Thus
`SUM(price) AS total_units` returns `sum_price`, rather than describing money as
units. Aggregate aliases also cannot reuse catalog/knowledge field names.
HAVING in this supported parser dialect requires GROUP BY.
Joins, user CTEs, subqueries, unions, casts, schema names, SQL parameters, locks,
other functions/operators, private/system tables and all writes are rejected.

The transaction is read-only with a two-second statement timeout and a 500ms
lock timeout. At most 50 rows are returned (a 51st row detects server truncation).
The caller's smaller LIMIT is respected. Database error bodies are not exposed.
Counts are JSON-safe numbers when representable, otherwise decimal strings.
This endpoint reads catalog facts; it implements no inventory, order or payment writes.

## Index refresh

- `GET /internal/ai/knowledge-version?merchant_id=<UUID>` returns
  `{merchant_id, version, revision: string, updated_at}`. Version is
  `<merchant UUID>:<revision>`. A primary-key lookup reads the durable merchant
  revision; it does not scan or count the corpus. Missing, inactive or suspended
  merchants are rejected. New merchants without a revision row start at zero.
- Database triggers advance the revision for product name, description, category,
  brand or status changes; variant parent, tenant, name, SKU, colour, size or status
  changes; and knowledge type, title, content or status changes. Inserts/deletes
  also advance it. A tenant move advances both old and new merchants; no-op field
  assignments do not. Triggered updates work with Prisma and direct SQL writers.
- Price, currency, stock, reservations, low-stock threshold and `updated_at` do
  not change the static revision. Read those facts live through `catalog`.
  Frequent stock changes therefore do not download another full snapshot or
  re-embed unchanged search text. Triggers skip merchants during cascade deletion.
- `GET /internal/ai/knowledge-snapshot?merchant_id=<UUID>` returns
  `{products: ProductExportResponse, knowledge_base: KnowledgeBaseExportResponse}`.
  Fetch this only to refresh an index, rather than attaching the entire corpus to
  every chat. Snapshot and version are separate reads; callers should recheck the
  version if a source update occurs while refreshing.
  Unknown stock is preserved as `stock_qty: null` and `available_qty: null` in
  snapshots and compatibility exports. Missing reserved quantity defaults to zero.

Existing compatibility routes remain available:

```text
GET /internal/ai/products/export?merchant_id=<merchantId>
GET /internal/ai/knowledge-base/export?merchant_id=<merchantId>
GET /internal/ai/vector-documents/export?merchant_id=<merchantId>
POST /internal/ai/vector-documents/sync
GET /internal/ai/merchant-settings/<merchantId>
```

Deploy migration `20261003133000_static_knowledge_revision` to install the revision
table and triggers before using the backend retrieval mode, then generate Prisma.
No PostgreSQL extension is required. The query compiler uses `pgsql-ast-parser`,
while the database connection remains owned by Prisma.

## Isolated integration verification

`scripts/qa-api-integration.cjs` runs only with `RUN_QA_API_INTEGRATION=1` and
explicit `QA_API_BASE_URL`, `QA_DATABASE_URL`, and `QA_INTERNAL_TOKEN` values.
It requires the loopback experiment API on port 4400 and the separate
`chatto_qa_experiment` PostgreSQL database on port 55432; it refuses other targets.
It checks live SQL, tenant isolation, disabled-merchant access, unknown stock,
injection rejection and revision triggers.
Temporary fixture edits are restored, including timestamps; test merchants and
documents are deleted while durable revisions remain monotonic. Its LINE
persistence check uses synthetic signatures and a stub AI provider,
with no LINE token and no external delivery, then removes its own temporary chat
records. Build the API first and seed the experiment's two fixture merchants.
