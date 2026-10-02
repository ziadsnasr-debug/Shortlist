export type AdminMember = { user_id: string; active: boolean; role: string };

export type AdminDocument = {
  id: string;
  status: string;
  safe_error_code: string | null;
  deletion_state: string;
  application_key?: string;
  attempts?: number;
};

export type Admin = {
  settings: {
    paused: boolean;
    retentionDays: number | null;
    incidentOwner: string;
  };
  members: AdminMember[];
  documents: AdminDocument[];
  deletions: { id: string; completed_at: string | null }[];
};

/** Sends an administration action. Resolves true when the server accepted it. */
export type SendAction = (body: unknown, done?: string) => Promise<boolean>;

/** Which control is working, so only its button shows a spinner. */
export type Busy =
  null | "invite" | "member" | "settings" | "process" | "delete" | "refresh";

export const shortId = (id: string) => id.slice(0, 8);
