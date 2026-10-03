# Criteria benchmark — 3 October 2026

Recommendation: keep the version 2 role templates. Do not claim the evidence-v3 prompt is an improvement. Under the rule fixed before the run, the shipped combination (v3 prompt, v2 templates) does not beat the previous one (v2 prompt, v1 templates). It credited no points without evidence and cited evidence more precisely, but it sent more criteria to "Needs your judgement", mostly on padded keyword CVs. Its one essential false positive was on a debatable label. Every difference is within run-to-run noise, so none is established.

Fifteen fictional CVs (five per role) were assessed by four arms: the v2 and v3 evidence prompts crossed with the v1 and v2 role templates. The CVs were written from role-neutral career briefs by an agent that never saw either rubric. A separate reviewer assigned 150 labels (60 for v1, 90 for v2) and committed them before any model call (`28ff78b`); 68 are marked debatable with an alternative. Every pass returned valid output (180 of 180 calls, gpt-6-luna, about $0.05 at published standard rates).

| Arm | Prompt + templates | UNCLEAR | of which pass disagreement | Strict agreement | Excl. debatable | Accept either | Evidence exact | Unsupported credit |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A (old, 2 runs) | v2 + v1 | 17.5% | 12.5% | 70.0% | 72.6% | 80.8% | 51.7% | 18.2% |
| B (shipped, 2 runs) | v3 + v2 | 30.6% | 16.1% | 63.3% | 75.5% | 73.9% | 66.7% | 0% |
| C (1 run) | v3 + v1 | 26.7% | 10.0% | 70.0% | 74.2% | 81.7% | 48.3% | 0% |
| D (1 run) | v2 + v2 | 12.2% | 7.8% | 68.9% | 86.3% | 76.7% | 63.3% | 0% |

The pre-registered rule required all five conditions. B failed two: UNCLEAR from pass disagreement was not lower in both runs (21.1% and 11.1% against 13.3% and 11.7%), and the essential FULL false-positive rate rose from 0 of 50 to 1 of 60. That case (cs-5, account ownership) is labelled debatable. B passed the other three: strict agreement stayed within A's noise floor, unsupported credit fell from 18.2% to 0%, and no arm ever cited the planted instruction. Between two runs of the same arm, 20–22% of cells changed category, so a 15-CV set cannot detect differences smaller than that.

What the arms suggest, not prove:

- **Templates help.** With the prompt held at v2 (A against D), version 2 templates lowered UNCLEAR from 17.5% to 12.2%, raised agreement on non-debatable cells from 72.6% to 86.3% and removed unsupported credit. The cost was under-crediting: 10 of 30 cells labelled PARTIAL came back NOT_EVIDENCED.
- **The v3 prompt raises flags.** With the templates held (A against C, D against B), v3 raised UNCLEAR by 9 to 18 points. Most of the rise is the model itself asserting UNCLEAR on the adversarial CVs: keyword lists, a contradicted claim and a planted instruction. The reviewer labelled those NOT_EVIDENCED. Sending a contradictory, padded CV to human judgement is defensible under the specification, but it adds review work. The likely driver is the new clause routing evidence that "falls short of Partial while suggesting the ability" to UNCLEAR.
- **Evidence is cited more precisely with v2 templates**: exact source-set matches rose from about 50% to 61–72%.

Limitations: labels are the developer's, not independent, and 45% are debatable. Fifteen constructed CVs are not representative. The rubric versions have different criterion counts (4 and 6), so rates are compared, not counts. Both passes use the same model, so agreement measures repeatability, not correctness. C and D ran once and only explain the result. Four CV passages ended up close to template wording (sd-1 b3, aa-2 b3, cs-4 b3, sd-1 b4); they were kept because editing CVs after labelling would void the pre-registration. The held-out pilot set was not used, and no threshold or gate in `lib/evaluation-gates.ts` changed. Nothing here is an accuracy, fairness or time-saving claim.

Next step, if wanted: try a prompt variant that treats a bare keyword list with no described work as NOT_EVIDENCED, and narrows the below-Partial clause. Confirm it on newly written CVs, not this set, so the prompt isn't tuned to these fifteen.

Run explicitly with fictional-only confirmation and private credentials already in the process environment: `BENCHMARK_SYNTHETIC_CONFIRM='FICTIONAL ONLY' AI_ENABLED=true node --env-file=.env.local --conditions=react-server --import tsx scripts/benchmark/criteria/run.ts`. The script refuses real-data mode, any model other than gpt-6-luna, unlabelled cells and more than 240 calls. Results, including raw passes, are saved under the ignored `work/criteria-benchmark/` directory.
