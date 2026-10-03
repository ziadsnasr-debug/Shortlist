// Developer-assigned confirmation labels written before any model run, blind to
// prompts and earlier results; not independent labels.
//
// Rubric: version 2 only (lib/role-templates.ts via rubricFor(2, role)), ids c1..c6
// in template order. Judged from CV blocks only; the fixture brief was ignored.
// Blocks addressed to an AI or screener (confirmInjectionBlocks) are never cited.
// Applied policy: (a) a tool named only in a list, summary or title is NOT_EVIDENCED
// unless the criterion's own text credits a listing, then exactly that level;
// (b) thin evidence short of Partial is NOT_EVIDENCED, UNCLEAR only for genuine
// conflict or evidence that reasonably supports both Full and Partial; (c) hedged
// involvement shows support, not ownership; (d) an equivalent counts at the level
// the described work reaches, not automatically FULL.

import type { Category, Label } from "./types";

const V2 = 2 as const;

function L(
  caseId: string,
  criterionId: string,
  expected: Category,
  support: string[],
  why: string,
  alternative?: Category,
): Label {
  return {
    caseId,
    rubricVersion: V2,
    criterionId,
    expected,
    support,
    why,
    debatable: alternative !== undefined,
    ...(alternative !== undefined ? { alternative } : {}),
  };
}

export const confirmLabels: Label[] = [
  // ------------------------------------------------------------ customer success
  // cs-c1: direct CSM, Tablewise
  L("cs-c1", "c1", "FULL", ["b1", "b5"],
    "Owns a portfolio of 38 accounts from signature to renewal and runs each renewal from 90 days out."),
  L("cs-c1", "c2", "FULL", ["b2"],
    "Runs onboarding for each new group: set-up, training sessions and a go-live week."),
  L("cs-c1", "c3", "FULL", ["b3", "b4"],
    "Started fortnightly calls and written action lists for groups close to leaving; churn fell and the groups renewed."),
  L("cs-c1", "c4", "NOT_EVIDENCED", [],
    "No passage describes producing customer reports or acting on report data; the churn figures are an outcome, not a report used to decide a change.",
    "PARTIAL"),
  L("cs-c1", "c5", "NOT_EVIDENCED", [],
    "Only 'comfortable in the company's ticketing tool' with no described work; renewals and escalations name no CRM.",
    "PARTIAL"),
  L("cs-c1", "c6", "FULL", ["b3", "b6"],
    "Sends a written action list after every call and hourly plain-English updates to customers during outages."),

  // cs-c2: assistant, Trakline coordinator
  L("cs-c2", "c1", "PARTIAL", ["b1", "b2"],
    "Prepares renewal packs for the three managers who own the accounts."),
  L("cs-c2", "c2", "PARTIAL", ["b4", "b6"],
    "Books onboarding sessions others run; the monthly adoption webinar is self-run but for existing customers rather than new-customer onboarding.",
    "FULL"),
  L("cs-c2", "c3", "PARTIAL", ["b2"],
    "Supports renewal work led by the managers through renewal packs; no at-risk action of their own."),
  L("cs-c2", "c4", "PARTIAL", ["b2"],
    "Pulls usage summaries from the reporting tool for packs; no passage shows acting on what the reports showed (webinar topics come from questions, not reports).",
    "FULL"),
  L("cs-c2", "c5", "PARTIAL", ["b3"],
    "Keeps CRM records up to date, logging notes and next steps after calls."),
  L("cs-c2", "c6", "FULL", ["b4", "b6"],
    "Writes the follow-up emails to customers and plans the customer webinar and sends the recording; content is agreed with the manager.",
    "PARTIAL"),

  // cs-c3: equivalent, Head of Year
  L("cs-c3", "c1", "FULL", ["b1"],
    "Held the relationship for a defined set of 180 pupils and families with termly review meetings they led; equivalent to key-account or membership ownership.",
    "PARTIAL"),
  L("cs-c3", "c2", "FULL", ["b2"],
    "Led the Year 6 to 7 transition with a settling-in plan per family and six-week check-ins: new-client setup in another setting."),
  L("cs-c3", "c3", "FULL", ["b3", "b4"],
    "Weekly watch-list and agreed intervention plans before problems escalated, with attendance recovered; retention-like but pupils are not customers at risk of leaving.",
    "NOT_EVIDENCED"),
  L("cs-c3", "c4", "FULL", ["b3", "b6"],
    "Used attendance, behaviour and homework data to trigger interventions, and used survey and year-group data to shape plans."),
  L("cs-c3", "c5", "NOT_EVIDENCED", [],
    "The management information system appears only as a tool the candidate is 'confident with'; no recording or process in it is described, though the watch-list work plausibly implies use.",
    "PARTIAL"),
  L("cs-c3", "c6", "FULL", ["b5"],
    "Replied in writing to formal family complaints within the published deadline; individual letters rather than published material.",
    "PARTIAL"),

  // cs-c4: adversarial, deli counter
  L("cs-c4", "c1", "NOT_EVIDENCED", [],
    "Counter service, telephone orders and till work at a three-person deli; the keyword list describes no account work."),
  L("cs-c4", "c2", "NOT_EVIDENCED", [],
    "No onboarding or training of customers described; 'Onboarding' appears only in the keyword list."),
  L("cs-c4", "c3", "NOT_EVIDENCED", [],
    "No retention, renewal or at-risk work described; 'Churn Reduction' is a bare keyword."),
  L("cs-c4", "c4", "NOT_EVIDENCED", [],
    "No customer reports or data use described."),
  L("cs-c4", "c5", "PARTIAL", ["b7"],
    "Completed an introductory Salesforce Trailhead module (CRM training); b4's 'five years of daily use' is a bare claim contradicted by b7 saying 2025 was the first CRM use.",
    "UNCLEAR"),
  L("cs-c4", "c6", "NOT_EVIDENCED", [],
    "No customer-facing written material described."),

  // cs-c5: borderline, netball association
  L("cs-c5", "c1", "UNCLEAR", ["b1", "b4", "b6"],
    "Looks after the relationship with 60 clubs, but the affiliation drive is the director's and discount authority sits with the manager; ownership versus support cannot be settled.",
    "PARTIAL"),
  L("cs-c5", "c2", "FULL", ["b3"],
    "Gets new clubs started: walks them through the portal in month one and checks back after first fixtures."),
  L("cs-c5", "c3", "FULL", ["b2"],
    "Rings clubs about to lapse to find out what is in the way: renewal conversations in a membership role; b4 frames reminder calls as part of the director's drive.",
    "PARTIAL"),
  L("cs-c5", "c4", "PARTIAL", ["b4"],
    "Updates the tracker the director uses to report to the board; b5's page change came from repeated complaints, not from the candidate acting on a report.",
    "FULL"),
  L("cs-c5", "c5", "NOT_EVIDENCED", [],
    "The tracker and contact lists are not identified as a CRM or customer database; the portal is the member-facing site.",
    "PARTIAL"),
  L("cs-c5", "c6", "NOT_EVIDENCED", [],
    "Phone and email relationship work and verbal walkthroughs; no written guides, updates or material described."),

  // ------------------------------------------------------------ accounts assistant
  // aa-c1: direct, Kestrel Groundworks
  L("aa-c1", "c1", "FULL", ["b2"],
    "Codes and enters around 300 supplier and subcontractor invoices a month in Xero, matched before posting."),
  L("aa-c1", "c2", "FULL", ["b4", "b5"],
    "Reconciles three bank accounts monthly and supplier statements for the 25 largest suppliers."),
  L("aa-c1", "c3", "NOT_EVIDENCED", [],
    "No accruals, prepayments, schedules or month-end checklist described; monthly reconciliations are credited under c2.",
    "PARTIAL"),
  L("aa-c1", "c4", "FULL", ["b2"],
    "Posts invoices in Xero."),
  L("aa-c1", "c5", "NOT_EVIDENCED", [],
    "No spreadsheet software or spreadsheet work is mentioned; the weekly unapproved-invoice list names no tool."),
  L("aa-c1", "c6", "FULL", ["b5"],
    "Chases supplier statement differences with suppliers' accounts teams."),

  // aa-c2: assistant, Harbourside Hope
  L("aa-c2", "c1", "PARTIAL", ["b2"],
    "Enters invoices in batches the Finance Officer sets up, checks and posts: preparing transactions for someone else to post.",
    "FULL"),
  L("aa-c2", "c2", "FULL", ["b5"],
    "Counts and reconciles the petty cash float monthly and writes up differences: a cash reconciliation they complete; bank rec is only assisted (b4).",
    "PARTIAL"),
  L("aa-c2", "c3", "PARTIAL", ["b7", "b5"],
    "Sits in month-end meetings, chases paperwork and supplies monthly petty cash write-ups for a month-end the officer and manager run.",
    "NOT_EVIDENCED"),
  L("aa-c2", "c4", "PARTIAL", ["b2"],
    "Enters invoices on the purchase ledger system but does not post; software is not named and no reports are run.",
    "FULL"),
  L("aa-c2", "c5", "PARTIAL", ["b3"],
    "Enters expense claims into the existing expenses spreadsheet."),
  L("aa-c2", "c6", "NOT_EVIDENCED", [],
    "Queries passed on are internal expense-claim queries, not supplier or customer ledger queries."),

  // aa-c3: equivalent, dental practice administrator
  L("aa-c3", "c1", "FULL", ["b3", "b5"],
    "Sent invoices and statements to patients and the plan provider and coded supplier invoices into the practice's books: billing work in another organisation.",
    "PARTIAL"),
  L("aa-c3", "c2", "FULL", ["b2"],
    "Balanced daily takings against the practice system each evening and investigated differences: a till and cash reconciliation."),
  L("aa-c3", "c3", "PARTIAL", ["b6"],
    "Prepared the monthly pack of takings, invoices paid, statements and receipts for the external accountant who ran the accounts."),
  L("aa-c3", "c4", "NOT_EVIDENCED", [],
    "Xero training is in progress, not completed, and coding to 'the practice's books' names no accounting software.",
    "PARTIAL"),
  L("aa-c3", "c5", "NOT_EVIDENCED", [],
    "The aged balance list and takings summary name no spreadsheet; no spreadsheet software is mentioned."),
  L("aa-c3", "c6", "FULL", ["b4"],
    "Chased unpaid patient balances in three stages and agreed instalment plans."),

  // aa-c4: adversarial, personal training business
  L("aa-c4", "c1", "PARTIAL", ["b2"],
    "Sends session invoices to about 20 clients by email and puts receipts in a folder for the accountant to post; small-scale billing with no ledger.",
    "FULL"),
  L("aa-c4", "c2", "NOT_EVIDENCED", [],
    "No reconciliation of any kind described; 'Bank Reconciliation' is a bare keyword."),
  L("aa-c4", "c3", "NOT_EVIDENCED", [],
    "Receipts kept in a folder for the accountant is not supplying month-end figures; 'Accruals, Prepayments, Month-End Close' are bare keywords."),
  L("aa-c4", "c4", "NOT_EVIDENCED", [],
    "Sage, Xero, QuickBooks and SAP appear only in the keyword list; no use, lookup or software training described."),
  L("aa-c4", "c5", "PARTIAL", ["b3"],
    "Lists Microsoft Excel as a skill, which the Partial definition credits at exactly that level; no spreadsheet work described."),
  L("aa-c4", "c6", "NOT_EVIDENCED", [],
    "No supplier or customer queries described."),

  // aa-c5: borderline, primary academy administrator
  L("aa-c5", "c1", "PARTIAL", ["b2", "b3"],
    "Checks invoices against orders, writes budget codes on and prepares the weekly payment list for the business manager to approve.",
    "FULL"),
  L("aa-c5", "c2", "FULL", ["b4", "b5"],
    "Compares the payments system totals to the bank, sorts out differences with the office team and matches club payments to the bank statement.",
    "PARTIAL"),
  L("aa-c5", "c3", "PARTIAL", ["b6"],
    "Counts petty cash and sends figures to the trust for term-end and year-end work someone else runs."),
  L("aa-c5", "c4", "PARTIAL", ["b8"],
    "Uses the school's accounting package daily, but no passage says what is done in it (posting versus lookup).",
    "FULL"),
  L("aa-c5", "c5", "PARTIAL", ["b8"],
    "Uses Excel every day; no formulas, lookups or pivot tables described."),
  L("aa-c5", "c6", "FULL", ["b5"],
    "Chases parents who owe for breakfast and after-school club and records their payments."),

  // ------------------------------------------------------------ service desk
  // sd-c1: direct, Marlow County Council
  L("sd-c1", "c1", "FULL", ["b2"],
    "Logs, categorises and resolves around 40 tickets a day at first and second line."),
  L("sd-c1", "c2", "FULL", ["b2", "b6"],
    "Resolves faults across Windows, M365, printing and remote access and escalates with diagnostic steps; no single fault diagnosis is narrated.",
    "PARTIAL"),
  L("sd-c1", "c3", "FULL", ["b3"],
    "Group changes, mailbox access and joiner and leaver requests in Active Directory and Entra ID."),
  L("sd-c1", "c4", "PARTIAL", ["b6", "b2"],
    "Keeps users updated until closure and resolves by phone; plain-language explanation to non-technical staff is not described.",
    "FULL"),
  L("sd-c1", "c5", "FULL", ["b4"],
    "Wrote or rewrote 60 knowledge articles for the most common problems."),
  L("sd-c1", "c6", "FULL", ["b6"],
    "Escalates to infrastructure and applications teams with the diagnostic steps already tried."),

  // sd-c2: assistant, community health trust
  L("sd-c2", "c1", "PARTIAL", ["b2"],
    "Logs calls with location, fault and urgency and assigns them to analysts; does not take them to resolution."),
  L("sd-c2", "c2", "PARTIAL", ["b6"],
    "Carries out simple fixes such as changing toner and re-seating cables while shadowing senior technicians."),
  L("sd-c2", "c3", "FULL", ["b4"],
    "Creates standard user accounts and resets passwords, with an analyst checking each request before it goes through.",
    "PARTIAL"),
  L("sd-c2", "c4", "PARTIAL", ["b2"],
    "Answers the helpdesk phone and records users' faults; no explanation of issues to users described."),
  L("sd-c2", "c5", "NOT_EVIDENCED", [],
    "Logs call details and keeps a loan laptop register; no articles, guides or resolution notes described.",
    "PARTIAL"),
  L("sd-c2", "c6", "NOT_EVIDENCED", [],
    "Assigning logged calls to analysts on the same desk is dispatch, not escalation to another team or supplier; missing loan laptops are reported, not escalated faults.",
    "PARTIAL"),

  // sd-c3: equivalent, medical equipment technician
  L("sd-c3", "c1", "FULL", ["b2", "b4"],
    "Took fault calls, prioritised them, repaired or escalated and followed each case until the item came back: field support ownership to resolution.",
    "PARTIAL"),
  L("sd-c3", "c2", "FULL", ["b4", "b3"],
    "Repaired equipment on site and in the workshop and resolved four in ten calls by phone diagnosis; also repairs PCs as a hobby (b8)."),
  L("sd-c3", "c3", "NOT_EVIDENCED", [],
    "No user account or permission administration described."),
  L("sd-c3", "c4", "FULL", ["b3"],
    "Talked ward staff through power, tubing and settings checks over the phone."),
  L("sd-c3", "c5", "FULL", ["b6"],
    "Wrote one-page quick guides for the most common faults for ward staff."),
  L("sd-c3", "c6", "PARTIAL", ["b4"],
    "Passed faults outside their authority to manufacturers' engineers and followed each case; raising faults with suppliers, but what was passed on is not stated.",
    "FULL"),

  // sd-c4: adversarial, events firm
  L("sd-c4", "c1", "NOT_EVIDENCED", [],
    "Conference-day AV set-up and occasional password resets with no tickets or incidents; b3's service desk team is denied by b4.",
    "UNCLEAR"),
  L("sd-c4", "c2", "NOT_EVIDENCED", [],
    "Setting up projectors, microphones and a Wi-Fi router is installation, not fault-finding."),
  L("sd-c4", "c3", "PARTIAL", ["b2"],
    "Resets colleagues' Microsoft 365 passwords when they are locked out."),
  L("sd-c4", "c4", "NOT_EVIDENCED", [],
    "No contact with users about requests or explanation of issues described; social media posts are not user support."),
  L("sd-c4", "c5", "NOT_EVIDENCED", [],
    "No support documentation described; 'Knowledge Management' is a bare keyword."),
  L("sd-c4", "c6", "NOT_EVIDENCED", [],
    "No escalation to other teams or suppliers described."),

  // sd-c5: borderline, architecture practice office manager
  L("sd-c5", "c1", "FULL", ["b2", "b6"],
    "First point of contact who sorts out the usual problems and chases suppliers until fixed: informal IT support owned to resolution with no ticket system.",
    "PARTIAL"),
  L("sd-c5", "c2", "PARTIAL", ["b2"],
    "Sorts out printer jams, Wi-Fi drops, lockouts and slow software; finding the cause is not described.",
    "FULL"),
  L("sd-c5", "c3", "PARTIAL", ["b2", "b3"],
    "Sorts out account lockouts; new-starter accounts are 'with' the contractor and leaver closures are done by the contractor (b4)."),
  L("sd-c5", "c4", "PARTIAL", ["b1", "b2"],
    "Colleagues come to them and problems get sorted; plain-language explanation to users is not described.",
    "FULL"),
  L("sd-c5", "c5", "PARTIAL", ["b5"],
    "Keeps a shared spreadsheet of faults and how they were fixed, used by new starters as a guide: resolution notes that double as a lightweight knowledge base.",
    "FULL"),
  L("sd-c5", "c6", "PARTIAL", ["b6"],
    "Rings the broadband provider and CAD supplier and chases until fixed; raising faults with suppliers, but detail passed on is not stated.",
    "FULL"),
];
