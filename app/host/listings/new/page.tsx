import { redirect } from "next/navigation";

import LocationPicker from "@/app/components/LocationPicker";
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
        await uploadPrivateImage({ bucket, path, file, upsert: false });
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
    <main className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create a new listing</CardTitle>
          <CardDescription>Provide details, set a location, and add pricing.</CardDescription>
        </CardHeader>
        <CardContent>
          {err ? (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
              {err}
            </div>
          ) : null}
      <form action={createListing} className="space-y-4" encType="multipart/form-data">
        <div className="text-sm font-medium text-black/70 dark:text-white/70">Basics</div>

        <label className="block">
          <div className="mb-1 text-sm">Title</div>
          <Input
            name="title"
            required
            placeholder="e.g. Toyota Corolla (Automatic)"
          />
        </label>

        <div className="text-sm font-medium text-black/70 dark:text-white/70">Vehicle documents</div>
        <label className="block">
          <div className="mb-1 text-sm">License disk photo</div>
          <Input name="licenseDiskPhoto" type="file" accept="image/*" required />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">Registration document</div>
          <Input name="registrationDoc" type="file" accept="image/*" required />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">License card</div>
          <Input name="licenseCardPhoto" type="file" accept="image/*" required />
        </label>

        <label className="block">
          <div className="mb-1 text-sm">Description</div>
          <Textarea
            name="description"
            required
            rows={5}
            placeholder="Tell renters about the car, rules, pickup notes, etc."
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm">City</div>
          <Input
            name="city"
            required
            placeholder="Cape Town"
          />
        </label>

        <div className="text-sm font-medium text-black/70 dark:text-white/70">Photos</div>
        <label className="block">
          <div className="mb-1 text-sm">Left side</div>
          <Input name="leftPhoto" type="file" accept="image/*" required />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">Right side</div>
          <Input name="rightPhoto" type="file" accept="image/*" required />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">Interior</div>
          <Input name="interiorPhoto" type="file" accept="image/*" required />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">Exterior</div>
          <Input name="exteriorPhoto" type="file" accept="image/*" required />
        </label>
        <label className="block">
          <div className="mb-1 text-sm">Damage (optional)</div>
          <Input name="damagePhoto" type="file" accept="image/*" />
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">Upload only if there is visible damage.</div>
        </label>

        <div className="text-sm font-medium text-black/70 dark:text-white/70">Location</div>
        <LocationPicker latitudeName="latitude" longitudeName="longitude" />

        <div className="text-sm font-medium text-black/70 dark:text-white/70">Pricing</div>
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

        <Button className="w-full">Create listing</Button>

        <div className="text-xs text-black/50 dark:text-white/50">
          New listings require admin approval before showing in public search.
        </div>
      </form>
        </CardContent>
      </Card>
    </main>
  );
}
