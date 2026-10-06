# Merchant AI context settings

## Database and service

Database is authoritative. The existing `AiSetting` / `ai_settings` model already has a unique `merchantId`; it is extended rather than replaced or duplicated. `assistantName` maps to legacy `botName`, and `rememberCustomerInterest` maps to legacy `memoryEnabled`. Tone remains the existing nullable string column and is normalized/validated against four allowed values to preserve legacy records without a destructive enum conversion.

`MerchantAiRule` / `merchant_ai_rules` belongs to one settings row. Rules have stable UUIDs, enabled flags, sort order and timestamps. The additive migration `20261006000000_merchant_ai_context_settings` adds the new fields, `AiResponseLength`, `AiFallbackBehavior`, and the rules table. Existing legacy `storeRules` JSON is preserved. It remains readable until a deliberate rules save switches `rulesConfigured` on; no migration rewrites old rule JSON.

`MerchantAiSettingsService.getSettingsForMerchant()` normalizes the row and ordered enabled rules. A missing row returns `DEFAULT_MERCHANT_AI_SETTINGS` from one backend file without inserting anything. Frontend and Gemini consume the resulting profile rather than maintaining their own defaults. Settings are read for every response; no settings cache is added.

## Authenticated API

| Route | Behavior |
| --- | --- |
| `GET /merchants/:merchantId/ai-settings` | Authenticated active membership, normalized settings/defaults, `canEdit`, no-store, no writes |
| `PATCH /merchants/:merchantId/ai-settings` | Authenticated active Owner membership on an ACTIVE/TRIAL merchant, same Web origin, strict validated payload, transactional upsert/rule synchronization |

This project has no active-merchant field on its session. It already uses the merchant path selector plus authenticated membership for secure settings APIs. The path selects a candidate; authority comes exclusively from the existing `chatto_session` and ACTIVE `merchant_users` lookup performed inside the settings transaction. No body/query merchant or user ID is accepted. Missing/foreign/inactive membership receives the existing concealed 404; Staff can read but cannot save (403). Authentication precedes validation (401).

Validation rejects unknown top-level/nested fields before the application's global whitelist can strip them. Names/pronouns are bounded to 80 characters, rules to 20 rows and 500 characters, and capabilities require eight booleans. Rules are trimmed, nonblank, and server IDs must be UUIDs. Language is `th`/`en`; tone, length and fallback accept only the frontend's allowed values. SQL/Prisma details are not returned or logged by the settings service.

Writes take a merchant advisory transaction lock, authorize again, and validate every existing rule ID against that merchant's settings before writing. Duplicate/foreign IDs fail. Only the current settings' removed rules are deleted; existing IDs are preserved, new IDs are server-generated, and supplied order becomes sequential sort order. Settings and rules commit together or roll back together.

## Step 5 frontend

`/onboarding/context?merchantId=<id>` keeps the existing authenticated server/onboarding resolution. Server GET populates the four existing sections. The same-origin `/api/merchants/...` rewrite carries cookie authentication and PATCH to Nest. It never returns provider credentials to this page.

Save validates, prevents synchronous double submission, disables editing while waiting and shows safe errors while retaining unsaved input. Only a confirmed PATCH response replaces local rows with stable server IDs. It then navigates to Step 6 with the same merchantId; readiness is evaluated by that server-rendered review rather than blocking navigation behind a second progress request. A failed or timed-out save stays on Step 5 and is not claimed as confirmed success.

The onboarding rules require earlier steps plus valid saved AI context before marking Step 5 complete. Products and FAQ remain optional under the [activation backend](merchant-ai-activation.md) rules. Skip/Back return to the overview and do not PATCH. The old memory-only draft provider and `preview=context` bypass are removed. Step 6 now reads dedicated activation readiness and sends the authenticated activation command after explicit confirmation. Existing styling, sticky desktop branding, responsive controls and the `#22994A` save button are preserved.

The [Step 6 frontend](activation-onboarding.md) expands this summary into the final-review layout. An accessible current Step 5 may open the review while AI-context readiness is incomplete; earlier store/LINE gates remain enforced. Backend readiness controls the four badges and activation eligibility. Confirmation invokes real activation and refetches persisted state/progress; merely viewing the page never completes Step 6.

## Runtime

The established path remains signed LINE webhook → verified encrypted internal channel → merchant/customer/conversation → `AiIntegrationService` → authenticated AI service → RAG/Gemini → existing channel-bound LINE reply adapter. Settings use the already resolved merchant, not any webhook-supplied merchant ID.

`InternalAiService.exportMerchantSettings()` uses the central service. `AiPolicyResolver` runs before context exports. The normalized profile travels with the existing authenticated AI contract. API checks returned request, merchant and conversation identities; AI rejects a mismatched merchant settings identity. RAG retains existing exact tenant filtering.

Behavior preferences are structured JSON beneath fixed platform/security instructions. Merchant custom rules are separate untrusted user-context JSON, never promoted to provider system roles. Gemini receives only the current merchant profile/rules and allowed context. Language, name/pronoun, tone and length guide generation; emoji removal when disabled is deterministic. Rules cannot authorize a tool, another tenant's data or a commerce action.

### Actual capability enforcement

| Setting | Current enforcement and limits |
| --- | --- |
| `answerFaq` | Off prevents knowledge-base and stored mixed-vector export; only permitted live catalog documents can enter RAG. History is suppressed to avoid old FAQ answers. |
| `showPrices`, `checkStock`, `showPromotions` | Off prevents catalog/FAQ/vector/history context exports because existing untyped documents may contain these facts. Matching requests use safe policy fallback. This is conservative withholding, not fine-grained redaction. |
| `recommendProducts`, `compareProducts`, `recommendRelatedProducts` | Disabled matching Thai/English requests are denied before exports and generation. Conversation history is withheld when any is disabled. No dedicated recommendation/comparison/related-product engine is created. Keyword intent gating is not a formal semantic classifier. |
| `rememberCustomerInterest` | Off skips the existing memory loader. The loader currently returns an empty list; no customer-interest persistence exists. The toggle does not claim otherwise. |

Filtered per-message context never synchronizes/deletes the persistent full vector index. No inventory, promotion, payment, order or subscription tools are added. Arbitrary natural-language facts/custom rules and generated text are not a formal capability-proof system; future typed sources/tool policies are needed for finer-grained semantic enforcement.

### Fallback

Missing trusted context or a denied request produces a deterministic store-contact response for `notify_and_handoff`/`handoff_immediately`, with a `handover_required` signal. Neither option creates a ticket or claims an admin was contacted: operational routing is absent from the current runtime.

`general_knowledge` permits LLM use only for recognizable genuinely general questions without store-factual keywords. Price, stock, promotions, orders, delivery, store opening/address/contact/policy and similar facts still require trusted merchant context. This deliberately conservative gate can decline some legitimate general questions. Provider outages retain the existing safe fallback and generation evidence.

## Verification

See [implementation and validation report](../validation/merchant-ai-context-settings.md). Browser fixtures and synthetic signed database-backed LINE tests are clearly separate from real LINE/Gemini delivery evidence.
