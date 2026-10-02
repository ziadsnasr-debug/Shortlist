# Jev feasibility comparison — 2 October 2026

Recommendation: keep OpenAI active. Jev is authenticated and potentially useful for cheap bounded classification, but is not proven to improve recruitment accuracy or source support. The adapter is developer-only under scripts/benchmark, absent from application routes and deployment configuration.

Seven fictional developer-labelled cases compared two fresh calls per model. All 28 calls returned valid contract outputs. OpenAI gpt-6-luna matched 6/7 expected guarded categories; Jev jev-1.13.0 matched 5/7. Both matched the expected source set in 5/7. The ambiguous example differed from developer expectations for both. Jev abstained on a criterion requiring two passages; OpenAI combined them. These are observations on tiny constructed fixtures, not an accuracy estimate or held-out pilot result.

| Observation                                         |     OpenAI |          Jev |
| --------------------------------------------------- | ---------: | -----------: |
| Median elapsed time for two passes                  |   3,762 ms |       501 ms |
| Estimated total standard token cost for seven cases | $0.0008625 | $0.000492408 |

Different provider prompts, response shapes and pass timeouts (45s versus 15s) limit the comparison. Timing includes network and both calls, measured sequentially on one local run. Costs use actual returned tokens with published standard uncached rates on this date, exclude regional premiums/taxes, and are not invoices. Missing usage leaves cost unknown. The instruction-injection case is a smoke check, not an exact clean/altered pair or the mandatory 20-pair evaluation.

Jev Choice returns a fixed option, distribution and confidence; it does not generate the existing 25-word rationale or arbitrary multi-source references. The experiment creates a fixed human-verification rationale and uses NONE/MULTIPLE_REQUIRED/CONFLICT options, abstaining when a single choice cannot represent support. It refuses source sets above 252 instead of silently omitting passages. Strict pinned-model, exact-option and existing source validation remain required. A valid source identifier still does not prove semantic support. Confidence measures model distribution concentration, not independently calibrated correctness.

Run explicitly with fictional-only confirmation and private credentials already in process: `BENCHMARK_SYNTHETIC_CONFIRM='FICTIONAL ONLY' node --env-file=.env.local --conditions=react-server --import tsx scripts/benchmark/run.ts`. On macOS the script reads the existing TypeSafe Keychain service first; otherwise it accepts TYPESAFE_API_KEY. It never prints or saves keys. Results under ignored work/ contain fictional outputs only. No production key/provider variable is changed.

Adoption requires independently labelled representative criteria, source-semantic audit, exact clean/altered pairs, repeatability, approved thresholds and supplier/data-route approval. The existing two same-model passes test repeatability, not independent corroboration. Do not tune against the held-out set before freezing the evaluation protocol.

Primary documentation: [TypeSafe API](https://docs.typesafe.ai/api), [Choice](https://docs.typesafe.ai/primitives/choice), [models and published token pricing](https://docs.typesafe.ai/models), [confidence](https://docs.typesafe.ai/confidence), [OpenAI gpt-6-luna pricing](https://developers.openai.com/api/docs/models/gpt-6-luna).
