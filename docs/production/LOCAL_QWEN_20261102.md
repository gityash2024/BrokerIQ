# Local Qwen capability checkpoint — not extraction sign-off

Read-only discovery found the existing loopback llama.cpp service at127.0.0.1:18080 with model `qwen2.5-1.5b-instruct`, Q4_K_M,4,096 serving context. Health/models returned successfully and a real34-token prompt/completion returned `OK`. No service, model, other product configuration or credentials were changed. No raw client chats were sent by this health check.

BrokerIQ previously supported only hosted providers. Its new optional platform integration uses the fixed loopback endpoint, requires an explicit loaded model ID and resolves an optional existing service key through encrypted Settings. It is not implicitly enabled by defaults. Configured local text runs first; Broker-first hosted fallback still admits only OpenRouter `:free`/`openrouter/free` models. There is no paid-model failover.

The adapter permits one concurrent BrokerIQ generation per API process, no unbounded waiting queue, at most30 seconds per request and a60-second local cooldown after request failure. UTF-8 message bytes are bounded to2,500, reserving the4K model context for its template and <=768 output tokens. Oversized input is not silently truncated. Prompt caching is disabled on the local shared service; BrokerIQ's optional response cache is scoped to provider, model, firm, user and generation options. This process limit is not a cross-product service reservation and does not prove production load capacity.

The current loaded model is text-only. Capability checks prevent it being treated as vision, audio or tool-execution support; image imports no longer attempt a fake vision call merely because text AI is configured. Provider availability, parsing correctness, semantic quality and autonomous actions are separate gates.

Focused tests cover fixed endpoint, local-first ordering, free-only launch fallback, capability denial, UTF-8/context/output bounds, concurrent busy behavior, slot release, cooldown and firm/user cache isolation. Workspace typechecks pass. These source changes are not in published Build42 until the next pinned release. TXT/ZIP semantic extraction, associated-photo OCR/vision,100 manually labelled real Rahul records, separate holdout and the required precision/recall thresholds remain OPEN.

The original Rahul ZIP was re-downloaded by the user and its Downloads access restored. Its checksum/private evaluation copy and counts are recorded in WORKSPACE_RECOVERY_20261102.md. The initial quick message grouping had joined system lines onto preceding posts; the corrected parser separates543 system events from1,354 user messages. Do not treat system phone-change/join records as property contacts.100 manually labelled real records and a separate holdout are still pending. The earlier legacy ai-eval script's three sample cases are not launch acceptance.

Protocol reference: https://github.com/ggml-org/llama.cpp/tree/master/tools/server . This documents compatible chat endpoints and constrained JSON features; actual model capabilities were checked independently.

## Real capture capability probes and constrained-output correction

Two bounded real probes of the first manually inspected Rahul text sample did not complete extraction: the application schema-validation/repair path failed after56,547ms; a direct llama.cpp constrained-JSON probe timed out at30,011ms. Each probe stopped at its first failure. No CRM import, training, outreach or semantic-accuracy acceptance occurred. A successful tiny health completion is not evidence that this model can extract production group posts.

The next adapter correction sends a representable Zod JSON schema to the local llama.cpp `response_format` contract, capped at16KB grammar size; unsupported schemas fail safely and independent Zod validation/repair remains mandatory. Cache identity includes the grammar. Focused adapter tests pass; this correction is NOT in public Build43 and has not passed a live structured-extraction probe. A capable configured free provider and the full independently labelled holdout remain release gates.

The generic description, lead-insight and assistant context still declared RENT-only/no-sales after ordinary Sale support was implemented elsewhere. Those contexts now preserve explicit RENT/SALE/unknown, distinguish monthly rent from total sale price/rates and state the actual human/role publication rule. The specifically labelled legacy rental-draft scanner contract remains rental-specific; this wording correction does not prove semantic extraction or enable an unqualified model for automated imports.


## Input grammar and reused definitions

A later actual-schema check found the default output conversion throws on capture phone-normalization transforms. Input conversion alone produced19,303 bytes, above the unchanged16KB grammar bound. The adapter now uses io:input and reused:ref: the actual capture contract produces12,666 bytes without relaxing the budget or replacing unsupported fields with any. Output normalization and all Zod refinements still run independently after generation; malformed/inconsistent output still fails and can use only the configured eligible fallback. The first added test incorrectly inspected an inline property after enabling references; it was corrected to resolve its definition. All16 adapter tests pass, including actual capture schema, transformed phone input and rejected post-transform refinement. These are protocol/validation tests with stubbed transport, not live extraction quality. Build45 does not contain this correction; live structured-model acceptance and100 manually labelled real records remain open.

Reference: https://zod.dev/json-schema (input/output and reused reference options), checked against the installed Zod source. llama.cpp schema features: https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md .


Release inclusion checkpoint: the above source is included in pinned Build46/e0442ad and its exact public bytes are verified. This supersedes historical not-yet-deployed wording only; unresolved provider/semantic/visual/device/flow gates remain open. See STAGING_ACCEPTANCE_20261102.md.


## Real semantic failure and structured quality gate

A bounded actual46 application probe classified original Rahul source278 (explicit Main Road Plot for Sale) as intent OFFER but purpose RENT, versus manually inspected OFFER/SALE. It returned valid constrained JSON in10,945ms. This is a semantic failure, not a grammar or timeout success, and disqualifies the current model from structured property extraction. No CRM rows, training or outreach were created. Tiny health and16 grammar adapter tests did not detect this semantic error.

Local JSON generation now requires a separate explicit platform quality approval: structuredTextApprovedModel must exactly match the configured textModel and structuredEvaluationSha256 must contain the64-hex digest of the approved real evaluation report. Both default empty. A basic connection test never populates them. Changing model ID invalidates its matching approval; the loaded current model has no approval and is excluded before any structured request/cache hit. Where a configured eligible free hosted provider exists it can be tried; otherwise the normal settings-linked INTEGRATION_NOT_CONFIGURED error appears. Local reviewed plain-text drafts remain distinct, and voice/vision/tools are still unsupported. Admin instructions state the100-real-label/separate-holdout95% precision/90% recall/no-invented-critical-facts requirement before entering approval. A digest is explicit operator attestation, not an automatically proven benchmark; no automatic acceptance is claimed.

The original candidate set contained source539 already used for a classifier fix and near-duplicate reposts (for example347/408). A new text-only candidate holdout groups normalized exact/near-duplicates by3-token shingle Jaccard≥0.75 with transitive groups, excludes25 reviewed/development sources and all149 posts in their groups, and reserves100 groups from283 eligible independent groups. Those100 groups represent417 raw posts; overlap with reviewed sources is zero under this declared policy. Candidate SHA256 is53cc65391aa73732e7666734d6b08cd2952ebcffb1e37b59fd39d6e84343b219. They are not manually labelled or scored. Human review of grouping,100 gold records, a separate development set, attachment evaluation and actual provider metrics remain OPEN. The old candidate file is not an accepted holdout. Raw text stays private.

The first47 artifact pinned2c9241f was built before this quality gate and has NOT been advertised/activated. Final47 must be rebuilt from a new exact pin including this correction. Build46 remains the accepted staging release until final47 verification.
