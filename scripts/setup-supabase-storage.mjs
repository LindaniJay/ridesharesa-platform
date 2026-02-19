import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureBucket(name, isPublic) {
  const list = await supabase.storage.listBuckets();
  if (list.error) throw new Error(list.error.message);

  const existing = (list.data || []).find((b) => b.name === name);
  if (existing) {
    console.log(`[ok] bucket exists: ${name} (public=${existing.public})`);
    return;
  }

  const created = await supabase.storage.createBucket(name, { public: Boolean(isPublic) });
  if (created.error) throw new Error(created.error.message);
  console.log(`[created] bucket: ${name} (public=${Boolean(isPublic)})`);
}

const listingImagesBucket = process.env.SUPABASE_STORAGE_BUCKET || "listing-images";
const userDocsBucket = process.env.SUPABASE_USER_DOCS_BUCKET || "user-documents";
const bookingPhotosBucket = process.env.SUPABASE_BOOKING_PHOTOS_BUCKET || "booking-photos";
const listingDocsBucket = process.env.SUPABASE_LISTING_DOCS_BUCKET || "listing-documents";

try {
  await ensureBucket(userDocsBucket, false);
  await ensureBucket(listingImagesBucket, true);
  await ensureBucket(bookingPhotosBucket, false);
  await ensureBucket(listingDocsBucket, false);

  console.log("Done.");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
