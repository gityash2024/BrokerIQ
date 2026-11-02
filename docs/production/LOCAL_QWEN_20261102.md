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
