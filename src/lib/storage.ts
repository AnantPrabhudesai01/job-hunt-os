import { createClient } from "@/lib/supabase/server";

// Central file service: every storage access flows through here.
// Buckets are private; access is always ownership-checked + short-lived signed URLs.

export const BUCKETS = [
  "resumes",
  "interview-preparation",
  "people-research",
  "company-research",
  "job-descriptions",
  "uploads",
  "application-assets",
  "profile-assets",
] as const;

export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_FOR_TYPE: Record<string, Bucket> = {
  RESUME: "resumes",
  TAILORED_RESUME: "resumes",
  MASTER_RESUME: "resumes",
  INTERVIEW_PREP: "interview-preparation",
  PEOPLE_RESEARCH: "people-research",
  COMPANY_RESEARCH: "company-research",
  JOB_DESCRIPTION: "job-descriptions",
  SCREENSHOT: "uploads",
  IMAGE: "uploads",
  EMAIL_DRAFT: "application-assets",
  RESEARCH: "company-research",
};

export const SIZE_LIMITS: Record<string, number> = {
  default: 20 * 1024 * 1024,
  "resumes": 10 * 1024 * 1024,
  "interview-preparation": 20 * 1024 * 1024,
  "uploads": 10 * 1024 * 1024,
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function validateFile(file: File, bucket: string) {
  if (!BUCKETS.includes(bucket as Bucket)) return "Unknown bucket.";
  const limit = SIZE_LIMITS[bucket] ?? SIZE_LIMITS.default;
  if (file.size > limit)
    return `File exceeds ${Math.round(limit / 1024 / 1024)} MB limit for ${bucket}.`;
  if (file.type && !ALLOWED_MIME.has(file.type))
    return `Unsupported file type: ${file.type || "unknown"}.`;
  return null;
}

/** Ownership-verified signed URL. Never store the result — always mint fresh. */
export async function getDocumentUrl(bucket: string, storagePath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!storagePath.startsWith(`${user.id}/`)) return null; // ownership check
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
