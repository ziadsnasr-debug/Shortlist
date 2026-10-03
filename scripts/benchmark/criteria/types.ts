import type { Application, Category } from "../../../lib/workflow";

export type { Category };
export type Role = "customer-success" | "accounts-assistant" | "service-desk";
export type Profile =
  "direct" | "assistant" | "equivalent" | "adversarial" | "borderline";
export type ArmId = "A" | "B" | "C" | "D";

/** Contract satisfied by fixtures.ts (fictional CVs only). */
export type CriteriaCase = {
  id: string;
  role: Role;
  profile: Profile;
  brief: string;
  app: Application;
};

/** Contract satisfied by labels.ts (developer labels, one per case x rubric x criterion). */
export type Label = {
  caseId: string;
  rubricVersion: 1 | 2;
  criterionId: string;
  expected: Category;
  support: string[];
  why: string;
  debatable: boolean;
  alternative?: Category;
};

/** One guarded result cell: one case, one criterion, one arm, one repeat. */
export type Result = {
  arm: ArmId;
  repeat: number;
  caseId: string;
  rubricVersion: 1 | 2;
  criterionId: string;
  essential: boolean;
  pass1Category: Category | null;
  pass2Category: Category | null;
  pass1Evidence: string[];
  pass2Evidence: string[];
  guardedCategory: Category;
  guardedEvidence: string[];
};
