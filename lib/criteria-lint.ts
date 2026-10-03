// Advisory wording checks for the criteria builder. Pure and dependency-free so
// client components can import it. Hints never block saving or publishing.
import type { Criterion } from "./rules";

export type CriterionHint = { code: string; message: string };

const VAGUE = [
  "clearly",
  "strong",
  "strongly",
  "good",
  "excellent",
  "solid",
  "proven",
  "extensive",
  "significant",
  "exceptional",
  "outstanding",
  "great",
];
const vagueWord = new RegExp(`\\b(?:${VAGUE.join("|")})\\b`, "i");

// Phrase forms only, so "React Native" or "a degree of accuracy" stay quiet.
// Longer phrases come first, so "native speaker" wins over a shorter match.
const PROXIES = [
  "digital native",
  "native[ -](?:english|level|speaker)",
  "mother tongue",
  "russell group",
  "employment gaps?",
  "career gaps?",
  "culture fit",
  "passionate",
  "personality",
  "university (?:educated|graduate)",
  "top university",
  "youthful",
  "energetic",
  "oxbridge",
  "degrees?(?! of\\b)",
  "young(?! people| person| adults?| children)",
  "age limit",
  "aged under",
  "aged over",
  "under the age",
];
const proxyPhrase = new RegExp(
  `\\b\\d+\\+?\\s*(?:years?|yrs)\\b|\\b(?:${PROXIES.join("|")})\\b`,
  "i",
);

const STOPWORDS = new Set(
  "a an the of to and or in for with on at by as is are be this that their its from".split(
    " ",
  ),
);

// Fixed phrases that join two words without bundling two requirements.
const FIXED_PAIRS =
  /\b(?:health and safety|profit and loss|research and development|terms and conditions|learning and development)\b|\ba\/b\b|\band\/or\b/gi;

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word && !STOPWORDS.has(word)),
  );
}

function similar(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / union.size >= 0.8;
}

function firstMatch(pattern: RegExp, fields: string[]) {
  for (const field of fields) {
    const match = field.match(pattern);
    if (match) return match[0].toLowerCase().replace(/\s+/g, " ");
  }
  return null;
}

export function lintCriterion(
  c: Criterion,
  rubric: Criterion[],
): CriterionHint[] {
  if (!c.title.trim()) return [];
  const hints: CriterionHint[] = [];
  const fields = [c.title, c.full, c.partial, c.equivalents ?? ""];

  if (/\s(?:and|&)\s|\//i.test(c.title.replace(FIXED_PAIRS, " ")))
    hints.push({
      code: "compound",
      message:
        "Covers more than one requirement. Say in Partial what counts when only one is shown, or split it.",
    });

  const vague = firstMatch(vagueWord, fields);
  if (vague)
    hints.push({
      code: "vague",
      message: `“${vague}” is open to interpretation. Name what the CV would show instead.`,
    });

  const proxy = firstMatch(proxyPhrase, fields);
  if (proxy)
    hints.push({
      code: "proxy",
      message: `“${proxy}” can exclude equivalent experience. Describe the skill or outcome instead.`,
    });

  if (c.full.trim() && c.partial.trim() && similar(c.full, c.partial))
    hints.push({
      code: "overlap",
      message: "Full and Partial read almost the same. Say what Partial lacks.",
    });

  const title = normalise(c.title);
  if (rubric.some((o) => o.id !== c.id && normalise(o.title) === title))
    hints.push({
      code: "duplicate",
      message: "Another criterion has the same requirement.",
    });

  if (c.essential && c.points < 5)
    hints.push({
      code: "essential-points",
      message:
        "Essential but worth under 5 points. Check the weight reflects how much it matters.",
    });

  return hints;
}

export function lintRubric(rubric: Criterion[]): CriterionHint[] {
  const hints: CriterionHint[] = [];
  if (rubric.length > 0 && rubric.length < 6)
    hints.push({
      code: "count",
      message:
        "Fewer than six criteria: one CV detail can swing the score. Six to eight usually works best.",
    });
  else if (rubric.length > 8)
    hints.push({
      code: "count",
      message:
        "More than eight criteria adds review time. Six to eight usually works best.",
    });

  const essentials = rubric.filter((c) => c.essential).length;
  if (rubric.length >= 2 && essentials > rubric.length / 2)
    hints.push({
      code: "essentials",
      message:
        "Most criteria are essential. Keep essentials for true must-haves; each one needs full evidence or a written exception.",
    });
  return hints;
}
