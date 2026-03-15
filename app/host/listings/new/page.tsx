import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import LocationPicker from "@/app/components/LocationPicker";
import FileDropInput from "@/app/components/FileDropInput.client";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import { uploadListingImage, uploadPrivateImage } from "@/app/lib/supabaseAdmin";

function safeExtFromFileName(name: string) {
  const ext = (name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

function errorMessage(code?: string) {
  switch (code) {
    case "missing":
      return "Please fill in title, description, and city.";
    case "rate":
      return "Please enter a valid daily rate.";
    case "location":
      return "Please select a location on the map.";
    case "upload":
      return "Photo upload failed. Please try a smaller image.";
    default:
      return null;
  }
}

export default async function NewListingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { dbUser } = await requireRole("HOST");
  const hostId = dbUser.id;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const err = errorMessage(resolvedSearchParams?.error);

  async function createListing(formData: FormData) {
    "use server";

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const dailyRate = Number(formData.get("dailyRate") ?? 0);
    const latitude = Number(formData.get("latitude") ?? NaN);
    const longitude = Number(formData.get("longitude") ?? NaN);
    const leftPhoto = formData.get("leftPhoto");
    const rightPhoto = formData.get("rightPhoto");
    const interiorPhoto = formData.get("interiorPhoto");
    const exteriorPhoto = formData.get("exteriorPhoto");
    const damagePhoto = formData.get("damagePhoto");
    const licenseDiskPhoto = formData.get("licenseDiskPhoto");
    const registrationDoc = formData.get("registrationDoc");
    const licenseCardPhoto = formData.get("licenseCardPhoto");

    if (!title || !description || !city) {
      redirect("/host/listings/new?error=missing");
    }
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
      redirect("/host/listings/new?error=rate");
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      redirect("/host/listings/new?error=location");
    }

    const leftPhotoFile = leftPhoto instanceof File ? leftPhoto : null;
    const rightPhotoFile = rightPhoto instanceof File ? rightPhoto : null;
    const interiorPhotoFile = interiorPhoto instanceof File ? interiorPhoto : null;
    const exteriorPhotoFile = exteriorPhoto instanceof File ? exteriorPhoto : null;
    const damagePhotoFile = damagePhoto instanceof File ? damagePhoto : null;
    const licenseDiskFile = licenseDiskPhoto instanceof File ? licenseDiskPhoto : null;
    const registrationFile = registrationDoc instanceof File ? registrationDoc : null;
    const licenseCardFile = licenseCardPhoto instanceof File ? licenseCardPhoto : null;

    if (!leftPhotoFile || !rightPhotoFile || !interiorPhotoFile || !exteriorPhotoFile) {
      redirect("/host/listings/new?error=missing");
    }
    if (!licenseDiskFile || !registrationFile || !licenseCardFile) {
      redirect("/host/listings/new?error=missing");
    }

    const listing = await prisma.listing.create({
      data: {
        hostId,
        title,
        description,
        city,
        latitude,
        longitude,
        dailyRateCents: Math.round(dailyRate * 100),
        currency: "ZAR",
        status: "ACTIVE",
        imageUrl: null,
        licenseDiskImageUrl: null,
        registrationImageUrl: null,
        licenseCardImageUrl: null,
        // isApproved stays false until admin approval
      },
      select: { id: true },
    });

    try {
      const uploadPhoto = async (key: string, file: File | null) => {
        if (!(file instanceof File) || file.size <= 0) return null;
        const uploaded = await uploadListingImage({ hostId, listingId: listing.id, key, file });
        return uploaded.publicUrl;
      };

      const uploadListingDoc = async (key: string, file: File) => {
        const bucket = process.env.SUPABASE_LISTING_DOCS_BUCKET || "listing-documents";
        const ext = safeExtFromFileName(file.name);
        const path = `${listing.id}/${key}-${crypto.randomUUID()}.${ext}`;
        await uploadPrivateImage({ bucket, path, file, upsert: false, allowPdf: true });
        return path;
      };

      const [
        leftPhotoUrl,
        rightPhotoUrl,
        interiorPhotoUrl,
        exteriorPhotoUrl,
        damagePhotoUrl,
        licenseDiskPath,
        registrationPath,
        licenseCardPath,
      ] = await Promise.all([
        uploadPhoto("left", leftPhotoFile),
        uploadPhoto("right", rightPhotoFile),
        uploadPhoto("interior", interiorPhotoFile),
        uploadPhoto("exterior", exteriorPhotoFile),
        uploadPhoto("damage", damagePhotoFile),
        uploadListingDoc("license-disk", licenseDiskFile),
        uploadListingDoc("registration", registrationFile),
        uploadListingDoc("license-card", licenseCardFile),
      ]);

      const primaryImageUrl =
        leftPhotoUrl || rightPhotoUrl || interiorPhotoUrl || exteriorPhotoUrl || damagePhotoUrl || null;

      // Required photos must upload successfully.
      if (!leftPhotoUrl || !rightPhotoUrl || !interiorPhotoUrl || !exteriorPhotoUrl) {
        throw new Error("Required photo upload failed");
      }

      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          imageUrl: primaryImageUrl,
          licenseDiskImageUrl: licenseDiskPath,
          registrationImageUrl: registrationPath,
          licenseCardImageUrl: licenseCardPath,
        },
      });

      redirect("/host");
    } catch {
      // Avoid leaving half-created listings if uploads fail.
      try {
        await prisma.listing.delete({ where: { id: listing.id } });
      } catch {
        // ignore
      }
      redirect("/host/listings/new?error=upload");
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 backdrop-blur supports-[backdrop-filter]:bg-card/40 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-accent/16 blur-3xl" />
          <div className="absolute -right-24 -bottom-28 h-72 w-72 rounded-full bg-foreground/8 blur-3xl" />
        </div>

        <div className="relative grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/35 px-3 py-1 text-xs text-foreground/70">
              <span className="inline-flex h-2 w-2 rounded-full bg-accent/80" />
              Host listing wizard
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create a premium listing that converts</h1>
              <p className="text-sm text-foreground/60">Add complete vehicle details, upload photos and docs, then send for approval in one flow.</p>
            </div>

            <Card className="border-border bg-background/35">
              <CardHeader>
                <CardTitle>Before you submit</CardTitle>
                <CardDescription>These details help approval happen faster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground/70">
                <div className="rounded-lg border border-border bg-card/70 px-3 py-2">1. Required car photos: left, right, interior, exterior.</div>
                <div className="rounded-lg border border-border bg-card/70 px-3 py-2">2. Required docs: license disk, registration, license card.</div>
                <div className="rounded-lg border border-border bg-card/70 px-3 py-2">3. Vehicle docs accept images or PDF (max 8MB each).</div>
                <div className="rounded-lg border border-border bg-card/70 px-3 py-2">4. Set the map pickup location precisely for better bookings.</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-background/30">
            <CardHeader>
              <CardTitle>Create new listing</CardTitle>
              <CardDescription>Complete all sections to publish for admin review.</CardDescription>
            </CardHeader>
            <CardContent>
              {err ? (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                  {err}
                </div>
              ) : null}

              <form action={createListing} className="space-y-4" encType="multipart/form-data">
                <div className="rounded-xl border border-border bg-card/65 p-4">
                  <div className="mb-3 text-sm font-semibold text-foreground/85">Step 1: Listing basics</div>
                  <div className="space-y-3">
                    <label className="block">
                      <div className="mb-1 text-sm">Title</div>
                      <Input name="title" required placeholder="e.g. Toyota Corolla (Automatic)" />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm">Description</div>
                      <Textarea
                        name="description"
                        required
                        rows={4}
                        placeholder="Tell renters about the car condition, rules, pickup process, and features."
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm">City</div>
                      <Input name="city" required placeholder="Cape Town" />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/65 p-4">
                  <div className="mb-3 text-sm font-semibold text-foreground/85">Step 2: Vehicle compliance docs</div>
                  <div className="mb-2 text-xs text-foreground/60">Accepted formats: images or PDF. Each file max 8MB.</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FileDropInput
                      name="licenseDiskPhoto"
                      label="License disk"
                      accept="image/*,application/pdf"
                      required
                    />
                    <FileDropInput
                      name="registrationDoc"
                      label="Registration"
                      accept="image/*,application/pdf"
                      required
                    />
                    <FileDropInput
                      name="licenseCardPhoto"
                      label="License card"
                      accept="image/*,application/pdf"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/65 p-4">
                  <div className="mb-3 text-sm font-semibold text-foreground/85">Step 3: Vehicle photos</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FileDropInput
                      name="leftPhoto"
                      label="Left side"
                      accept="image/*"
                      required
                    />
                    <FileDropInput
                      name="rightPhoto"
                      label="Right side"
                      accept="image/*"
                      required
                    />
                    <FileDropInput
                      name="interiorPhoto"
                      label="Interior"
                      accept="image/*"
                      required
                    />
                    <FileDropInput
                      name="exteriorPhoto"
                      label="Exterior"
                      accept="image/*"
                      required
                    />
                    <div className="sm:col-span-2">
                      <FileDropInput
                        name="damagePhoto"
                        label="Existing damage (optional)"
                        accept="image/*"
                        helper="Upload only if there is visible damage before trip start."
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/65 p-4">
                  <div className="mb-3 text-sm font-semibold text-foreground/85">Step 4: Location and pricing</div>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-sm">Pickup location</div>
                      <LocationPicker latitudeName="latitude" longitudeName="longitude" />
                    </div>
                    <label className="block">
                      <div className="mb-1 text-sm">Daily rate (ZAR)</div>
                      <Input
                        name="dailyRate"
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        placeholder="450"
                      />
                    </label>
                  </div>
                </div>

                <Button className="h-11 w-full text-base">Create listing</Button>

                <div className="text-center text-xs text-foreground/60">
                  New listings require admin approval before showing in public search.
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
