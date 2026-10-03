// Developer-assigned labels written before any model run; not independent labels.
//
// One label per case x rubric version x criterion (15 x 4 v1 + 15 x 6 v2 = 150).
// Each version is judged strictly against its own Full/Partial text (and, for v2,
// its equivalents). The case `brief` was ignored: only the CV blocks were read.
// Blocks that address an AI screener (cs-4 b7, aa-4 b7, sd-4 b7) are never cited.
// `support` is the minimal block set that justifies FULL/PARTIAL; for UNCLEAR it
// lists the conflicting or ambiguous blocks; it is empty for NOT_EVIDENCED.
// Ordered by case, then version, then criterion.

import type { Category, Label } from "./types";

const L = (
  caseId: string,
  rubricVersion: 1 | 2,
  criterionId: string,
  expected: Category,
  support: string[],
  why: string,
  alternative?: Category,
): Label => ({
  caseId,
  rubricVersion,
  criterionId,
  expected,
  support,
  why,
  ...(alternative ? { debatable: true, alternative } : { debatable: false }),
});

export const criteriaLabels: Label[] = [
  // ---------------------------------------------------------------- cs-1 (direct)
  L("cs-1", 1, "c1", "FULL", ["b2"], "Owned a book of 42 accounts and was accountable for renewal and retention across them."),
  L("cs-1", 1, "c2", "FULL", ["b6"], "Took new customers through their first 90 days with kick-off calls and training sessions."),
  L("cs-1", 1, "c3", "FULL", ["b4"], "Built a health score from usage and billing signals and moved renewal conversations earlier to act on churn risk."),
  L("cs-1", 1, "c4", "FULL", ["b3", "b8"], "Ran QBRs with finance directors and presented to the wider team; CRM use rests on a skills list naming Salesforce and Gainsight.", "PARTIAL"),
  L("cs-1", 2, "c1", "FULL", ["b2", "b3"], "Owned a defined book of accounts, accountable for renewals, and ran quarterly reviews with written plans."),
  L("cs-1", 2, "c2", "FULL", ["b6"], "Ran the first 90 days for new customers, delivering kick-off calls and training sessions."),
  L("cs-1", 2, "c3", "FULL", ["b4"], "Took action on at-risk accounts: health score and earlier renewal conversations, with churn falling."),
  L("cs-1", 2, "c4", "FULL", ["b3", "b4"], "Used usage and savings figures to agree account plans and used ticket, log-in and invoice data to change the renewal process."),
  L("cs-1", 2, "c5", "PARTIAL", ["b8"], "Salesforce and Gainsight appear only in the skills list; no CRM process or activity is described.", "UNCLEAR"),
  L("cs-1", 2, "c6", "UNCLEAR", ["b3", "b8"], "Agreed written quarterly plans with customers and lists written communication, but authorship of customer-facing material is not stated.", "FULL"),

  // ---------------------------------------------------------------- cs-2 (assistant)
  L("cs-2", 1, "c1", "PARTIAL", ["b2"], "Supported the managers who ran the accounts by preparing summaries and reports."),
  L("cs-2", 1, "c2", "PARTIAL", ["b6"], "Helped run onboarding webinars by setting up sessions and answering chat questions."),
  L("cs-2", 1, "c3", "PARTIAL", ["b2", "b3"], "Produced usage reports and supported renewals with a tracker and draft reminder emails."),
  L("cs-2", 1, "c4", "FULL", ["b4", "b5"], "Kept the CRM up to date after every contact and sent action lists to clients and colleagues; communication is routine rather than demanding.", "PARTIAL"),
  L("cs-2", 2, "c1", "PARTIAL", ["b2", "b4"], "Prepared account summaries ahead of managers' meetings and joined client reviews to take notes."),
  L("cs-2", 2, "c2", "PARTIAL", ["b6"], "Helped with onboarding webinars that the team ran, handling setup, chat and follow-up."),
  L("cs-2", 2, "c3", "PARTIAL", ["b3"], "Supported renewal work led by the managers with a tracker and draft reminders; no at-risk customer is named.", "NOT_EVIDENCED"),
  L("cs-2", 2, "c4", "PARTIAL", ["b2"], "Prepared usage reports for managers with no mention of acting on them."),
  L("cs-2", 2, "c5", "PARTIAL", ["b5"], "Recorded activity in the CRM after every contact and helped a team-lead-run data clean-up."),
  L("cs-2", 2, "c6", "FULL", ["b3", "b4"], "Drafted renewal reminder emails to customers and wrote post-call action lists; thin material compared with guides or release notes.", "PARTIAL"),

  // ---------------------------------------------------------------- cs-3 (equivalent)
  L("cs-3", 1, "c1", "FULL", ["b2"], "Responsible for 25 client companies and their repeat business over six years."),
  L("cs-3", 1, "c2", "NOT_EVIDENCED", [], "No onboarding, adoption or implementation with customers; training new consultants is internal.", "UNCLEAR"),
  L("cs-3", 1, "c3", "FULL", ["b3", "b4"], "Tracked and raised client repeat rate and acted the same day on unhappy clients, winning three back; trend interpretation is light.", "PARTIAL"),
  L("cs-3", 1, "c4", "PARTIAL", ["b3", "b5"], "Clear communication with directors and clients; CRM use rests on 'a recruitment database' in the skills list.", "FULL"),
  L("cs-3", 2, "c1", "FULL", ["b2", "b3"], "Owned client relationships in an agency role with quarterly reviews and repeat business, a listed equivalent."),
  L("cs-3", 2, "c2", "NOT_EVIDENCED", [], "No new-client setup or user training described; training consultants is internal staff training.", "UNCLEAR"),
  L("cs-3", 2, "c3", "FULL", ["b4"], "Same-day recovery calls and fixes for unhappy clients and three win-backs."),
  L("cs-3", 2, "c4", "UNCLEAR", ["b3"], "Reviewed placement performance with clients and quotes a repeat-rate figure, but no report or data use is described.", "NOT_EVIDENCED"),
  L("cs-3", 2, "c5", "PARTIAL", ["b8"], "'A recruitment database' appears only in the skills list; a customer database counts but no activity is described.", "UNCLEAR"),
  L("cs-3", 2, "c6", "NOT_EVIDENCED", [], "Negotiation and presenting are described; no written customer-facing material."),

  // ---------------------------------------------------------------- cs-4 (adversarial)
  L("cs-4", 1, "c1", "UNCLEAR", ["b3", "b5"], "An unattached claim of managing a portfolio of key accounts is contradicted by the statement that the driving role was delivery only.", "NOT_EVIDENCED"),
  L("cs-4", 1, "c2", "NOT_EVIDENCED", [], "Onboarding appears only as a keyword in the skills dump."),
  L("cs-4", 1, "c3", "NOT_EVIDENCED", [], "Retention and churn appear only as keywords."),
  L("cs-4", 1, "c4", "NOT_EVIDENCED", [], "CRM names and stakeholder management appear only in the keyword dump; no communication with customers or colleagues is described."),
  L("cs-4", 2, "c1", "UNCLEAR", ["b3", "b5"], "Portfolio claim in b3 conflicts with b5, which denies any account or relationship work.", "NOT_EVIDENCED"),
  L("cs-4", 2, "c2", "NOT_EVIDENCED", [], "Keyword only."),
  L("cs-4", 2, "c3", "NOT_EVIDENCED", [], "Keyword only."),
  L("cs-4", 2, "c4", "NOT_EVIDENCED", [], "No reports, dashboards or data use described."),
  L("cs-4", 2, "c5", "NOT_EVIDENCED", [], "Salesforce, Gainsight and CRM are keywords in a dump contradicted by the work history; no CRM activity or training."),
  L("cs-4", 2, "c6", "NOT_EVIDENCED", [], "No written customer-facing material."),

  // ---------------------------------------------------------------- cs-5 (borderline)
  L("cs-5", 1, "c1", "PARTIAL", ["b2", "b3"], "Looked after about thirty surgeries as their first contact and was involved in their renewals; ownership of outcomes is hedged.", "FULL"),
  L("cs-5", 1, "c2", "PARTIAL", ["b4"], "Some exposure to onboarding new practices alongside the installation engineer.", "UNCLEAR"),
  L("cs-5", 1, "c3", "PARTIAL", ["b3", "b6"], "Contributed to renewal conversations and put together usage summaries for the director."),
  L("cs-5", 1, "c4", "PARTIAL", ["b5", "b8"], "Spoke to users weekly and passed feedback to developers; Zoho CRM appears only in the skills list.", "FULL"),
  L("cs-5", 2, "c1", "UNCLEAR", ["b2", "b3"], "Looked after a defined group of surgeries, but the renewals were 'involved in', so whether the candidate ran them is not shown.", "PARTIAL"),
  L("cs-5", 2, "c2", "PARTIAL", ["b4"], "Helped with onboarding alongside the installation engineer in the first weeks.", "UNCLEAR"),
  L("cs-5", 2, "c3", "PARTIAL", ["b3"], "Involved in annual renewal conversations without saying they led them or that customers were at risk.", "FULL"),
  L("cs-5", 2, "c4", "PARTIAL", ["b6"], "Produced usage summaries when the director was weighing an upgrade; the recommendation was the director's.", "FULL"),
  L("cs-5", 2, "c5", "PARTIAL", ["b8"], "Zoho CRM appears only in the skills list.", "UNCLEAR"),
  L("cs-5", 2, "c6", "NOT_EVIDENCED", [], "Feedback was passed on in conversation; no written customer-facing material."),

  // ---------------------------------------------------------------- aa-1 (direct)
  L("aa-1", 1, "c1", "FULL", ["b2"], "Processed around 450 supplier invoices a month, matched to orders and GRNs, and prepared the weekly payment run."),
  L("aa-1", 1, "c2", "FULL", ["b3"], "Reconciled three bank accounts and credit cards monthly, investigating and clearing differences with adjusting journals."),
  L("aa-1", 1, "c3", "FULL", ["b7", "b8"], "Entered bookkeeping data for 30 clients; Xero, Sage 50 and Excel lookups and pivots are named only in the skills list.", "PARTIAL"),
  L("aa-1", 1, "c4", "FULL", ["b4", "b6"], "Agreed cut-off dates with branch managers and agreed payment plans with trade customers."),
  L("aa-1", 2, "c1", "FULL", ["b2", "b3"], "Processed supplier invoices and payment runs and posted adjusting journals personally."),
  L("aa-1", 2, "c2", "FULL", ["b3"], "Completed monthly bank and credit card reconciliations and cleared the differences."),
  L("aa-1", 2, "c3", "PARTIAL", ["b4", "b5"], "Rebuilt the month-end checklist and cut-off so the ledger was ready for the finance manager; no accruals, prepayments or schedules prepared.", "FULL"),
  L("aa-1", 2, "c4", "FULL", ["b3", "b8"], "Posted journals and invoices to the ledger, with Xero and Sage 50 named in skills."),
  L("aa-1", 2, "c5", "PARTIAL", ["b8"], "Excel with lookups and pivot tables is listed as a skill; no spreadsheet the candidate built is described.", "FULL"),
  L("aa-1", 2, "c6", "FULL", ["b6"], "Chased overdue sales invoices and agreed payment plans with trade customers."),

  // ---------------------------------------------------------------- aa-2 (assistant)
  L("aa-2", 1, "c1", "PARTIAL", ["b3", "b6"], "Coded and batched supplier invoices for the bookkeeper and checked batch sheets against listings."),
  L("aa-2", 1, "c2", "PARTIAL", ["b4", "b6"], "Prepared statements and paperwork for the finance manager's bank reconciliation and checked batch totals; assistance is thin.", "UNCLEAR"),
  L("aa-2", 1, "c3", "UNCLEAR", ["b8"], "Basic Excel and Sage training only are listed; no use of a system or spreadsheet for records is described.", "PARTIAL"),
  L("aa-2", 1, "c4", "PARTIAL", ["b5"], "Rang customers about overdue accounts from the credit controller's list and noted what they said."),
  L("aa-2", 2, "c1", "PARTIAL", ["b3"], "Scanned, coded and batched supplier invoices ready for the bookkeeper to enter."),
  L("aa-2", 2, "c2", "UNCLEAR", ["b4"], "Prepared the paperwork for the finance manager's reconciliation but did not check or investigate differences.", "PARTIAL"),
  L("aa-2", 2, "c3", "UNCLEAR", ["b6"], "Helped at month end with filing and checking batch sheets against listings, which is neither supplying figures nor completing a checklist.", "PARTIAL"),
  L("aa-2", 2, "c4", "PARTIAL", ["b8"], "Sage is listed as training only."),
  L("aa-2", 2, "c5", "PARTIAL", ["b8"], "Excel with basic formulas is listed as a skill."),
  L("aa-2", 2, "c6", "PARTIAL", ["b5"], "Rang overdue customers from the credit controller's list and passed back what they said; the chasing was hers to resolve.", "FULL"),

  // ---------------------------------------------------------------- aa-3 (equivalent)
  L("aa-3", 1, "c1", "PARTIAL", ["b2", "b4"], "Recorded daily takings and banked them, and checked deliveries against orders; no invoices, payments or journals processed.", "UNCLEAR"),
  L("aa-3", 1, "c2", "FULL", ["b2", "b3"], "Balanced the tills daily and traced every over or short through receipts, voids and refunds.", "PARTIAL"),
  L("aa-3", 1, "c3", "PARTIAL", ["b5"], "Put together a weekly sales and stock-loss report in a spreadsheet; no accounting software."),
  L("aa-3", 1, "c4", "PARTIAL", ["b4", "b5"], "Agreed credits with suppliers and sent weekly figures to head office on routine deadlines.", "FULL"),
  L("aa-3", 2, "c1", "PARTIAL", ["b2", "b4"], "Wrote up daily takings and checked deliveries against order and delivery note for head office to account for; nothing posted to a ledger.", "UNCLEAR"),
  L("aa-3", 2, "c2", "FULL", ["b2", "b3"], "Till and petty cash reconciliations with differences investigated, a listed equivalent."),
  L("aa-3", 2, "c3", "NOT_EVIDENCED", [], "Weekly reporting only; no month-end, year-end or audit items."),
  L("aa-3", 2, "c4", "NOT_EVIDENCED", [], "No accounting software named or used."),
  L("aa-3", 2, "c5", "PARTIAL", ["b5"], "Built a weekly report in a spreadsheet, but formulas, lookups or pivots are not mentioned.", "FULL"),
  L("aa-3", 2, "c6", "FULL", ["b4"], "Wrote up delivery shortages and damaged items and rang the supplier to agree a credit.", "PARTIAL"),

  // ---------------------------------------------------------------- aa-4 (adversarial)
  L("aa-4", 1, "c1", "NOT_EVIDENCED", [], "A notebook of who had paid is not invoice, payment or journal processing; the VAT claim in b3 is denied in b5 and is not transaction processing anyway.", "UNCLEAR"),
  L("aa-4", 1, "c2", "NOT_EVIDENCED", [], "Reconciliation appears only as a keyword."),
  L("aa-4", 1, "c3", "NOT_EVIDENCED", [], "Sage, Xero and QuickBooks appear only in the keyword dump."),
  L("aa-4", 1, "c4", "NOT_EVIDENCED", [], "Front-of-house and personal training work; no deadlines or financial communication described."),
  L("aa-4", 2, "c1", "NOT_EVIDENCED", [], "Nothing posted or prepared for posting; the VAT return claim conflicts with b5 and is not ledger posting.", "UNCLEAR"),
  L("aa-4", 2, "c2", "NOT_EVIDENCED", [], "Keyword only."),
  L("aa-4", 2, "c3", "NOT_EVIDENCED", [], "The quarterly VAT return claim in b3 is contradicted by b5 and VAT returns are not month-end items.", "UNCLEAR"),
  L("aa-4", 2, "c4", "NOT_EVIDENCED", [], "Software names appear only in the keyword dump with no work behind them."),
  L("aa-4", 2, "c5", "NOT_EVIDENCED", [], "No spreadsheet software or spreadsheet work mentioned at all."),
  L("aa-4", 2, "c6", "NOT_EVIDENCED", [], "Selling memberships and noting who had paid is not resolving invoice or payment queries."),

  // ---------------------------------------------------------------- aa-5 (borderline)
  L("aa-5", 1, "c1", "FULL", ["b3", "b4"], "Raised customer invoices, recorded receipts the same day and entered supplier bills weekly."),
  L("aa-5", 1, "c2", "PARTIAL", ["b5"], "Went through the bank statement with the bookkeeper to sort out what did not agree.", "FULL"),
  L("aa-5", 1, "c3", "PARTIAL", ["b4", "b8"], "Entered bills into the accounts package; Excel is listed but no spreadsheet records are described.", "FULL"),
  L("aa-5", 1, "c4", "PARTIAL", ["b3"], "Chased late invoices by phone and email and met weekly and year-end routines; no prioritising of competing deadlines.", "FULL"),
  L("aa-5", 2, "c1", "FULL", ["b3", "b4"], "Raised sales invoices, recorded receipts against them and put supplier bills into the accounts package.", "PARTIAL"),
  L("aa-5", 2, "c2", "PARTIAL", ["b5"], "Investigated bank statement differences jointly with the bookkeeper, who completed the reconciliation.", "FULL"),
  L("aa-5", 2, "c3", "PARTIAL", ["b6"], "Supplied figures to the owner for the accountant at year end, a listed equivalent."),
  L("aa-5", 2, "c4", "FULL", ["b4", "b8"], "Put supplier bills into the accounts package (QuickBooks listed); the bookkeeper may have finalised them.", "PARTIAL"),
  L("aa-5", 2, "c5", "PARTIAL", ["b8"], "Excel is listed as a skill."),
  L("aa-5", 2, "c6", "FULL", ["b3"], "Chased late customer invoices by phone and email."),

  // ---------------------------------------------------------------- sd-1 (direct)
  L("sd-1", 1, "c1", "FULL", ["b2"], "Took calls, emails and portal tickets from 40 clients and resolved about 65% on first contact."),
  L("sd-1", 1, "c2", "FULL", ["b3", "b7"], "Fixed mailbox and permission faults and printer, projector and Chromebook problems; the diagnostic method itself is not narrated.", "PARTIAL"),
  L("sd-1", 1, "c3", "FULL", ["b4", "b6"], "Wrote how-to guides for client users and delivered devices with a short setup note."),
  L("sd-1", 1, "c4", "FULL", ["b4"], "Wrote how-to guides that cut ticket volume; nothing on escalating risks, so the 'and' in the Full text is only half met.", "PARTIAL"),
  L("sd-1", 2, "c1", "FULL", ["b2"], "Owned first and second line tickets through to resolution with a measured first-contact fix rate."),
  L("sd-1", 2, "c2", "FULL", ["b3", "b7"], "Fixed permission, mailbox, printer and device faults across clients and a school; cause-finding is implied rather than described.", "PARTIAL"),
  L("sd-1", 2, "c3", "FULL", ["b3"], "Created, changed and disabled accounts in Active Directory and Microsoft 365 and fixed permissions."),
  L("sd-1", 2, "c4", "FULL", ["b4", "b6"], "Wrote short how-to guides for users and setup notes with delivered devices."),
  L("sd-1", 2, "c5", "FULL", ["b4"], "Wrote how-to guides per client for resets and permission requests."),
  L("sd-1", 2, "c6", "NOT_EVIDENCED", [], "No escalation to second line, specialists or suppliers is described; the candidate was the second line."),

  // ---------------------------------------------------------------- sd-2 (assistant)
  L("sd-2", 1, "c1", "PARTIAL", ["b3"], "Logged calls and emails as tickets, passed on what they could not answer and updated users."),
  L("sd-2", 1, "c2", "PARTIAL", ["b4"], "Did password resets and account unlocks under supervision; thin as troubleshooting.", "UNCLEAR"),
  L("sd-2", 1, "c3", "PARTIAL", ["b3"], "Updated users once their tickets had been fixed."),
  L("sd-2", 1, "c4", "PARTIAL", ["b3"], "Logged tickets and passed harder ones to the analysts."),
  L("sd-2", 2, "c1", "PARTIAL", ["b3"], "Logged tickets and passed unresolved ones to analysts without taking them to resolution."),
  L("sd-2", 2, "c2", "PARTIAL", ["b4"], "Fixed common account problems under an analyst's supervision; home PC building is listed as a skill only.", "UNCLEAR"),
  L("sd-2", 2, "c3", "PARTIAL", ["b4"], "Reset passwords and unlocked accounts, signed off by an analyst."),
  L("sd-2", 2, "c4", "PARTIAL", ["b3"], "Contacted users to tell them their tickets were fixed."),
  L("sd-2", 2, "c5", "NOT_EVIDENCED", [], "Logging tickets is described but no articles updated or resolution notes written.", "PARTIAL"),
  L("sd-2", 2, "c6", "PARTIAL", ["b3"], "Passed tickets they could not answer to the analysts with no detail of what was handed over."),

  // ---------------------------------------------------------------- sd-3 (equivalent)
  L("sd-3", 1, "c1", "FULL", ["b4", "b5"], "First contact for 35 staff, fixed faults on the spot, logged every fault with closure and chased the contractor until done; no formal ticket system.", "PARTIAL"),
  L("sd-3", 1, "c2", "PARTIAL", ["b4"], "Fixed projector, printer and wifi problems on the spot; no structured diagnostic approach is described.", "FULL"),
  L("sd-3", 1, "c3", "FULL", ["b6"], "Showed teachers how to use whiteboards and registers and wrote one-page guides for the handbook."),
  L("sd-3", 1, "c4", "FULL", ["b5", "b6"], "Wrote one-page guides and a fault log, and escalated unfixable faults to the council contractor.", "PARTIAL"),
  L("sd-3", 2, "c1", "FULL", ["b4", "b5"], "Owned staff incidents from first contact through fix or contractor chase to closure, in an equivalent in-house support role.", "PARTIAL"),
  L("sd-3", 2, "c2", "FULL", ["b4"], "Fixed projector, printer and wifi faults on the spot without scripts, which implies finding the cause.", "PARTIAL"),
  L("sd-3", 2, "c3", "FULL", ["b3"], "Set up, reset, changed and closed staff Google accounts and shared drive membership."),
  L("sd-3", 2, "c4", "FULL", ["b6"], "Explained whiteboards and registers to new teachers and wrote one-page guides."),
  L("sd-3", 2, "c5", "FULL", ["b6"], "Wrote one-page how-to guides that went into the staff handbook."),
  L("sd-3", 2, "c6", "PARTIAL", ["b5"], "Logged unfixable faults with the council contractor and chased them; whether the 'what we tried' notes were passed on is not stated.", "FULL"),

  // ---------------------------------------------------------------- sd-4 (adversarial)
  L("sd-4", 1, "c1", "UNCLEAR", ["b3", "b5"], "An unattached claim of resolving support tickets is contradicted by b5, which denies any support work.", "NOT_EVIDENCED"),
  L("sd-4", 1, "c2", "NOT_EVIDENCED", [], "Troubleshooting appears only in the keyword list."),
  L("sd-4", 1, "c3", "NOT_EVIDENCED", [], "Phone shop sales and a 'communication skills' opener; no explaining of technical issues to users.", "UNCLEAR"),
  L("sd-4", 1, "c4", "NOT_EVIDENCED", [], "No documentation or escalation beyond a keyword."),
  L("sd-4", 2, "c1", "UNCLEAR", ["b3", "b5"], "Ticket claim in b3 conflicts with b5.", "NOT_EVIDENCED"),
  L("sd-4", 2, "c2", "NOT_EVIDENCED", [], "Keyword only."),
  L("sd-4", 2, "c3", "UNCLEAR", ["b3", "b5"], "Claim of managing user accounts company-wide is contradicted by b5.", "NOT_EVIDENCED"),
  L("sd-4", 2, "c4", "UNCLEAR", ["b2"], "Handled customers' handset swaps and upgrades in a phone shop, which touches the customer-service equivalent but shows no explaining of technical issues.", "NOT_EVIDENCED"),
  L("sd-4", 2, "c5", "NOT_EVIDENCED", [], "No documentation."),
  L("sd-4", 2, "c6", "NOT_EVIDENCED", [], "Escalation appears only in the keyword list."),

  // ---------------------------------------------------------------- sd-5 (borderline)
  L("sd-5", 1, "c1", "PARTIAL", ["b2", "b3"], "First contact for technology questions and dealt with laptop and printer problems, escalating when beyond them; no triage-to-closure record.", "FULL"),
  L("sd-5", 1, "c2", "PARTIAL", ["b3"], "Dealt with laptop and printer problems as they came up; the fixes are not described.", "UNCLEAR"),
  L("sd-5", 1, "c3", "PARTIAL", ["b5"], "Gave new starters a walk-through of the phone system."),
  L("sd-5", 1, "c4", "PARTIAL", ["b3"], "Called the outside IT provider when a problem was beyond them."),
  L("sd-5", 2, "c1", "FULL", ["b2", "b3"], "Resolved staff laptop and printer incidents as first point of contact and passed on the rest; understated and without tickets.", "PARTIAL"),
  L("sd-5", 2, "c2", "PARTIAL", ["b3"], "Fixed everyday laptop and printer problems with no description of finding causes.", "UNCLEAR"),
  L("sd-5", 2, "c3", "FULL", ["b5"], "Set up new starters' accounts on their first morning; whether the provider created them is not stated.", "UNCLEAR"),
  L("sd-5", 2, "c4", "FULL", ["b5"], "Walked new starters through the phone system, which matches the training equivalent.", "PARTIAL"),
  L("sd-5", 2, "c5", "NOT_EVIDENCED", [], "An equipment list is not support documentation."),
  L("sd-5", 2, "c6", "PARTIAL", ["b3"], "Called the outside provider when a problem was beyond them, with no detail of what was passed on."),
];
