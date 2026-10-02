import type { Criterion } from "./workflow";

export type RoleTemplate = {
  id: "customer-success" | "accounts-assistant" | "service-desk";
  version: 1;
  name: string;
  description: string;
  criteria: Omit<Criterion, "id">[];
};

const criterion = (
  section: string,
  title: string,
  points: number,
  essential: boolean,
  full: string,
  partial: string,
): Omit<Criterion, "id"> => ({
  section,
  title,
  points,
  essential,
  full,
  partial,
});

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    id: "customer-success",
    version: 1,
    name: "Customer success manager",
    description: "Account ownership, onboarding, retention and CRM evidence.",
    criteria: [
      criterion("Experience", "Customer account ownership", 30, true, "Direct responsibility for a portfolio of customer accounts and outcomes.", "Supported customer accounts or outcomes with limited ownership."),
      criterion("Experience", "Customer onboarding", 25, false, "Led structured onboarding, adoption or implementation with customers.", "Supported onboarding or adoption activities with customers."),
      criterion("Skills", "Retention and reporting", 25, false, "Interpreted customer trends and acted on retention or renewal risks.", "Produced customer reports or contributed to retention activity."),
      criterion("Skills", "CRM and stakeholder communication", 20, false, "Used a CRM and communicated clearly with internal and external stakeholders.", "Used a CRM or communicated with customers and colleagues."),
    ],
  },
  {
    id: "accounts-assistant",
    version: 1,
    name: "Accounts assistant",
    description: "Transaction accuracy, reconciliations, systems and communication.",
    criteria: [
      criterion("Finance", "Transaction processing", 30, true, "Processed invoices, payments or journals accurately and to deadlines.", "Supported transaction processing with evidence of accuracy."),
      criterion("Finance", "Reconciliation and controls", 25, true, "Completed reconciliations and investigated or resolved discrepancies.", "Assisted with reconciliations or discrepancy checks."),
      criterion("Systems", "Finance systems and spreadsheets", 25, false, "Used accounting software and spreadsheets to maintain reliable records.", "Used finance systems or spreadsheets for routine records."),
      criterion("Working style", "Organisation and communication", 20, false, "Prioritised deadlines and communicated clearly about financial information.", "Managed routine deadlines or communicated financial information."),
    ],
  },
  {
    id: "service-desk",
    version: 1,
    name: "Service desk analyst",
    description: "Incident handling, troubleshooting, documentation and service care.",
    criteria: [
      criterion("Support", "Incident and request handling", 30, true, "Owned support incidents or requests through triage, resolution and closure.", "Handled support tickets or contributed to incident resolution."),
      criterion("Technical", "Troubleshooting", 25, true, "Diagnosed technical problems using a structured troubleshooting approach.", "Followed troubleshooting steps to resolve common technical problems."),
      criterion("Service", "User communication", 25, false, "Explained technical issues clearly and maintained a helpful service experience.", "Communicated progress or basic technical guidance to users."),
      criterion("Operations", "Documentation and escalation", 20, false, "Created useful support documentation and escalated risks with relevant context.", "Updated support records or escalated issues to a more experienced team."),
    ],
  },
] as const;

export function instantiateRoleTemplate(
  id: RoleTemplate["id"],
  idFactory: () => string = () => crypto.randomUUID(),
): Criterion[] {
  const template = ROLE_TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error("Unknown role template.");
  return template.criteria.map((item) => ({ ...item, id: idFactory() }));
}
