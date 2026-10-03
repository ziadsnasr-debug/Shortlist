import type { Criterion } from "./workflow";

export type RoleTemplate = {
  id: "customer-success" | "accounts-assistant" | "service-desk";
  version: 2;
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
  equivalents: string,
): Omit<Criterion, "id"> => ({
  section,
  title,
  points,
  essential,
  full,
  partial,
  equivalents,
});

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    id: "customer-success",
    version: 2,
    name: "Customer success manager",
    description: "Account ownership, onboarding, retention, reporting and CRM use.",
    criteria: [
      criterion("Experience", "Customer account ownership", 25, true, "Held responsibility for a defined set of customer accounts, shown by renewals, account reviews or account plans the candidate ran.", "Worked on accounts that someone else owned, for example preparing updates or joining account reviews.", "Owning client relationships in an agency, consultancy, key account or membership role."),
      criterion("Experience", "Customer onboarding", 20, true, "Ran onboarding or implementation for new customers, for example delivering sessions or owning adoption plans.", "Helped with onboarding that someone else ran, for example preparing materials or joining introductory calls.", "Leading user training, product rollouts or new-client setup in another setting."),
      criterion("Skills", "Retention risk handling", 15, false, "Took action to keep a customer at risk of leaving, such as a recovery plan, renewal conversation or win-back offer.", "Flagged at-risk customers to others, or supported retention work that someone else led.", "Churn reduction, renewal or win-back work in sales, subscription or membership roles."),
      criterion("Skills", "Customer reporting", 15, false, "Used customer reports or data to recommend or make a change, such as an account action, upsell or process fix.", "Produced or updated customer reports with no mention of acting on what they showed.", "Dashboards, account health scores or usage analysis in any tool."),
      criterion("Skills", "CRM use", 10, false, "Ran a process in a CRM, such as a renewal pipeline, account health tracking or task workflows.", "Recorded notes or activity in a CRM, or completed CRM training.", "Any CRM or customer database, for example Salesforce, HubSpot, Zendesk or a bespoke system."),
      criterion("Communication", "Written customer communication", 15, false, "Wrote customer-facing material such as guides, release notes, help articles or account updates.", "Edited or reviewed customer-facing material that someone else wrote.", "Newsletters, training materials or knowledge base content in another role."),
    ],
  },
  {
    id: "accounts-assistant",
    version: 2,
    name: "Accounts assistant",
    description: "Ledger posting, reconciliations, month-end, systems and supplier queries.",
    criteria: [
      criterion("Finance", "Transaction processing", 25, true, "Posted invoices, payments, expenses or journals to a ledger.", "Prepared transactions for someone else to post, such as checking, coding or batching invoices.", "Payroll, billing or purchase ledger work in any organisation."),
      criterion("Finance", "Account reconciliation", 20, true, "Completed reconciliations of bank, supplier, customer or control accounts.", "Checked or investigated reconciliation differences for someone else to clear.", "Till, cash or stock count reconciliations, or matching statements in a non-finance role."),
      criterion("Finance", "Month-end support", 15, false, "Prepared month-end items such as accruals, prepayments or balance sheet schedules.", "Supplied figures or completed checklists for a month-end that someone else ran.", "Year-end, audit or management accounts preparation."),
      criterion("Systems", "Accounting software", 15, false, "Posted transactions or ran reports in accounting software.", "Used accounting software only to look up information, or completed training on one.", "Any ledger or ERP system, for example Xero, Sage, QuickBooks or SAP."),
      criterion("Systems", "Spreadsheet skills", 15, false, "Built or changed spreadsheets using formulas, lookups or pivot tables.", "Lists spreadsheet software as a skill, or entered data into existing spreadsheets.", "Comparable work in Google Sheets or database reporting tools."),
      criterion("Finance", "Ledger queries", 10, false, "Resolved supplier or customer queries, such as statement differences, missing invoices or payment chasing.", "Logged or passed on supplier or customer queries for someone else to resolve.", "Customer service or order processing roles handling invoice or payment questions."),
    ],
  },
  {
    id: "service-desk",
    version: 2,
    name: "Service desk analyst",
    description: "Ticket handling, troubleshooting, account administration, documentation and escalation.",
    criteria: [
      criterion("Support", "Ticket handling", 25, true, "Owned support tickets or incidents through to resolution.", "Logged, triaged or updated tickets without taking them to resolution.", "Help desk, IT support, technical customer support or field support roles."),
      criterion("Technical", "Troubleshooting", 20, true, "Found the cause of technical faults, for example in hardware, software, networks or user accounts.", "Fixed common problems by following scripts or knowledge base steps.", "Repairing hardware, networks or software in home lab, volunteer or hobby settings."),
      criterion("Technical", "User account administration", 15, false, "Created, changed or removed user accounts or permissions, for example in Active Directory, Microsoft 365 or Google Workspace.", "Reset passwords or unlocked accounts.", "Administering accounts in any directory, school or small business system."),
      criterion("Service", "User communication", 15, false, "Explained a technical issue or fix to a non-technical user in plain language, by phone, ticket or written guide.", "Contacted users by phone, email or chat about their requests.", "Teaching, training or customer service roles explaining technical products."),
      criterion("Operations", "Support documentation", 15, false, "Wrote knowledge base articles, how-to guides or runbooks.", "Updated existing articles or wrote resolution notes in tickets.", "Technical writing, training materials or internal wiki content."),
      criterion("Operations", "Escalation", 10, false, "Escalated issues to second line, specialist teams or suppliers with the steps already tried or the diagnosis included.", "Escalated or referred issues to other teams with no detail of what was passed on.", "Raising faults with suppliers, landlords or external contractors in a non-IT role."),
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
