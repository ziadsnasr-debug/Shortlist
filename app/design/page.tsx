import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignGallery } from "@/components/design-gallery";
import { configuration } from "@/lib/config";

export const metadata: Metadata = {
  title: "Design gallery · Shortlist",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Reachable only in local synthetic mode; hosted and Supabase-backed environments get a 404. */
function galleryEnabled() {
  if (process.env.VERCEL) return false;
  try {
    return configuration().mode === "local-synthetic";
  } catch {
    return false;
  }
}

export default function DesignPage() {
  if (!galleryEnabled()) notFound();
  return <DesignGallery />;
}
