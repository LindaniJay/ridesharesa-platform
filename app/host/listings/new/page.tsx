import { redirect } from "next/navigation";

import LocationPicker from "@/app/components/LocationPicker";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";
import { uploadListingImage } from "@/app/lib/supabaseAdmin";

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
    const photo = formData.get("photo");

    if (!title || !description || !city) {
      redirect("/host/listings/new?error=missing");
    }
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
      redirect("/host/listings/new?error=rate");
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      redirect("/host/listings/new?error=location");
    }

    let imageUrl: string | undefined;
    if (photo instanceof File && photo.size > 0) {
      try {
        const uploaded = await uploadListingImage({ hostId, file: photo });
        imageUrl = uploaded.publicUrl;
      } catch {
        redirect("/host/listings/new?error=upload");
      }
    }

    await prisma.listing.create({
      data: {
        hostId,
        title,
        description,
        imageUrl,
        city,
        latitude,
        longitude,
        dailyRateCents: Math.round(dailyRate * 100),
        currency: "ZAR",
        status: "ACTIVE",
        // isApproved stays false until admin approval
      },
    });

    redirect("/host");
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
      <form action={createListing} className="space-y-4">
        <div className="text-sm font-medium text-black/70 dark:text-white/70">Basics</div>

        <label className="block">
          <div className="mb-1 text-sm">Title</div>
          <Input
            name="title"
            required
            placeholder="e.g. Toyota Corolla (Automatic)"
          />
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

        <label className="block">
          <div className="mb-1 text-sm">Photo (optional)</div>
          <Input name="photo" type="file" accept="image/*" />
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            JPG/PNG/WebP, up to 5MB.
          </div>
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
