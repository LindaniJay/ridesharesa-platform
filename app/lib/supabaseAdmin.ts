import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || requireEnv("SUPABASE_URL");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function uploadListingImage(params: {
  hostId: string;
  listingId?: string;
  key?: string;
  file: File;
}) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "listing-images";

  if (!params.file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported");
  }

  const maxBytes = 8 * 1024 * 1024;
  if (params.file.size > maxBytes) {
    throw new Error("Image too large (max 8MB)");
  }

  const ext = (params.file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const safeExt = ext || "png";
  const folder = params.listingId || params.hostId;
  const name = params.key
    ? `${params.key}-${crypto.randomUUID()}.${safeExt}`
    : `${crypto.randomUUID()}.${safeExt}`;
  const path = `${folder}/${name}`;

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const client = supabaseAdmin();

  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    contentType: params.file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return {
    bucket,
    path,
    publicUrl: data.publicUrl,
  };
}

export async function uploadPrivateImage(params: {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  allowPdf?: boolean;
}) {
  const isImage = params.file.type.startsWith("image/");
  const isPdf = params.file.type === "application/pdf";
  if (!isImage && !(params.allowPdf && isPdf)) {
    throw new Error(params.allowPdf ? "Only image or PDF uploads are supported" : "Only image uploads are supported");
  }

  const maxBytes = 8 * 1024 * 1024;
  if (params.file.size > maxBytes) {
    throw new Error("File too large (max 8MB)");
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const client = supabaseAdmin();

  const { error } = await client.storage.from(params.bucket).upload(params.path, bytes, {
    contentType: params.file.type,
    upsert: params.upsert === true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { bucket: params.bucket, path: params.path };
}
