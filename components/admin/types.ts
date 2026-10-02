export type AdminMember = { user_id: string; active: boolean; role: string };

export type AdminDocument = {
  id: string;
  status: string;
  safe_error_code: string | null;
  deletion_state: string;
  application_key?: string;
  attempts?: number;
  stage?: string;
  reserved_at?: string;
  reservation_age_seconds?: number | null;
  safe_error_message?: string | null;
};

export type ProcessingSummary = {
  total: number;
  awaiting_upload: number;
  queued_or_processing: number;
  ready: number;
  attention: number;
};

export type ProcessingAllowance = {
  period: string;
  used: number;
  limit: number;
  remaining: number;
  state: "normal" | "near_limit" | "exhausted";
  capturedAt?: string;
};

export type Admin = {
  settings: {
    paused: boolean;
    retentionDays: number | null;
    incidentOwner: string;
  };
  members: AdminMember[];
  documents: AdminDocument[];
  deletions: {
    id: string;
    entity_id?: string;
    ready_after?: string;
    completed_at: string | null;
  }[];
  processing?: ProcessingSummary;
  /** Omitted by older API responses; the UI must show unavailable, never zero. */
  allowance?: ProcessingAllowance;
};

/** Sends an administration action. Resolves true when the server accepted it. */
export type SendAction = (body: unknown, done?: string) => Promise<boolean>;

/** Which control is working, so only its button shows a spinner. */
export type Busy =
  null | "invite" | "member" | "settings" | "process" | "delete" | "refresh";

export const shortId = (id: string) => id.slice(0, 8);
