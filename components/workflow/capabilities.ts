// What the navigation offers. Administrators can create vacancies in every
// mode, but administration needs a signed-in hosted workspace, so the open
// pilot hides it (the server refuses it there too).
export function navCapabilities(
  state?: {
    role?: string;
    temporaryPublic?: boolean;
  } | null,
) {
  const isAdmin = state?.role === "administrator";
  return {
    canCreate: isAdmin,
    canAdminister: isAdmin && !state?.temporaryPublic,
  };
}
