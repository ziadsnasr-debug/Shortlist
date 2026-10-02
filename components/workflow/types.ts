import type {
  Action,
  Application,
  Batch,
  Vacancy,
  Workspace,
} from "@/lib/workflow";
export type PublicApp = Omit<Application, "name"> & {
  name?: string;
  label: string;
  score: number | null;
  blockers: string[];
};
export type PublicBatch = Omit<Batch, "applications"> & {
  applications: PublicApp[];
  ranking: { id: string; score: number; essentials: string[] }[] | null;
};
export type PublicVacancy = Omit<Vacancy, "batches"> & {
  batches: PublicBatch[];
};
export type State = Omit<Workspace, "vacancies" | "audit"> & {
  vacancies: PublicVacancy[];
  role: string;
  mode: string;
  temporaryPublic?: boolean;
  capabilities?: { uploads: boolean; ai: boolean };
};
export type Send = (action: Action, version?: number) => Promise<State | null>;
export const steps = ["Criteria", "Add CVs", "Review", "Shortlist"];
