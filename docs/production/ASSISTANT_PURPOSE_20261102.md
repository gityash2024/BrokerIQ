# Assistant property purpose and price

The model card projection previously renamed every listing price to rent and appended /month regardless of the stored purpose. With ordinary Sale enabled this misrepresented a total sale price. The legacy search_rentals tool also omitted its RENT filter, allowing mixed-purpose search once the public feature enabled Sale.

The projection now emits explicit purpose, numeric price and purpose-aware priceText; legacy rent/rentText remain populated only for RENT. Unknown purpose is not inferred. Zero is retained; absent/nonfinite/invalid amounts are not formatted. Web/native cards read the new fields with old-server fallback. A new read-only search_properties tool requires explicit RENT/SALE and forwards it with the requested price range to the existing role-safe public API. search_rentals always sends RENT. No private API boundary or publication action changed.

Two focused source tests verify monthly-versus-total/legacy behavior, numeric normalization, zero/null/invalid values, exact outgoing purpose/range and missing-purpose refusal. They use a tool transport stub and do not claim real listings/provider semantic acceptance. Workspace typechecks pass. Browser/installed Android and capable tool-provider acceptance remain open; source is after Build45.


Release inclusion checkpoint: the above source is included in pinned Build46/e0442ad and its exact public bytes are verified. This supersedes historical not-yet-deployed wording only; unresolved provider/semantic/visual/device/flow gates remain open. See STAGING_ACCEPTANCE_20261102.md.
