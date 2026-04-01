"use client";

import { useState } from "react";

import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

type PickupPhoto = { name: string; signedUrl: string };

export default function PickupWorkflow(props: {
  bookingId: string;
  vehicleTitle: string;
  startDateISO: string;
  viewerRole: "RENTER" | "HOST" | "ADMIN";
  hostHandoverPhotos: PickupPhoto[];
  renterPickupPhotos: PickupPhoto[];
}) {
  const startDate = new Date(props.startDateISO);
  const now = new Date();
  const daysUntilPickup = Math.max(0, Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isPickupDay = daysUntilPickup === 0;

  const isRenter = props.viewerRole === "RENTER";
  const isHost = props.viewerRole === "HOST" || props.viewerRole === "ADMIN";

  const [checklist, setChecklist] = useState({
    reviewDates: false,
    bringLicense: false,
    contactHost: false,
    inspectVehicle: false,
  });

  const allChecked = checklist.reviewDates && checklist.bringLicense && checklist.contactHost && checklist.inspectVehicle;
  const hasHostPhotos = props.hostHandoverPhotos.length > 0;
  const hasRenterPhotos = props.renterPickupPhotos.length > 0;

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
              <path d="M12 15l4 4-4 4" />
            </svg>
          </div>
          <div>
            <CardTitle>Pickup workflow</CardTitle>
            <CardDescription>
              {isPickupDay
                ? "Today is pickup day — complete these steps to collect your vehicle."
                : `${daysUntilPickup} day${daysUntilPickup === 1 ? "" : "s"} until pickup on ${startDate.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}.`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Timeline */}
        <div className="relative pl-6">
          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />

          {/* Step 1: Pre-pickup preparation */}
          <div className="relative pb-5">
            <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${allChecked ? "border-green-500 bg-green-500" : "border-blue-500 bg-card"}`} />
            <div className="text-sm font-semibold">Pre-pickup preparation</div>
            <div className="mt-1 text-xs text-foreground/60">Complete before arriving at the vehicle.</div>
            <div className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-2">
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-blue-500"
                  checked={checklist.reviewDates}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, reviewDates: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Review booking dates & location</div>
                  <div className="text-xs text-foreground/50">Confirm pickup date matches {startDate.toLocaleDateString("en-ZA")}.</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-blue-500"
                  checked={checklist.bringLicense}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, bringLicense: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Bring valid driver&apos;s license & ID</div>
                  <div className="text-xs text-foreground/50">The host may ask to verify your identity at handover.</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-blue-500"
                  checked={checklist.contactHost}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, contactHost: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Confirm pickup details with host</div>
                  <div className="text-xs text-foreground/50">Use the booking chat to agree on time and exact meetup point.</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-blue-500"
                  checked={checklist.inspectVehicle}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, inspectVehicle: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-foreground/90">Plan vehicle inspection</div>
                  <div className="text-xs text-foreground/50">Walk around the vehicle and note any existing damage before driving off.</div>
                </div>
              </label>

              {allChecked && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Pre-pickup checklist complete. You&apos;re ready to go!
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Host handover photos */}
          <div className="relative pb-5">
            <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${hasHostPhotos ? "border-green-500 bg-green-500" : "border-border bg-card"}`} />
            <div className="text-sm font-semibold">Host handover photos</div>
            <div className="mt-1 text-xs text-foreground/60">The host uploads proof of vehicle condition before handover.</div>
            {isHost && (
              <form
                action={`/api/bookings/${encodeURIComponent(props.bookingId)}/photos`}
                method="post"
                encType="multipart/form-data"
                className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-2"
              >
                <input type="hidden" name="kind" value="host_handover" />
                <label className="block text-sm font-medium">Upload handover photo</label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-500/20"
                />
                <Button type="submit" variant="secondary">Upload</Button>
              </form>
            )}
            {hasHostPhotos && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {props.hostHandoverPhotos.map((p) => (
                  <a key={p.name} href={p.signedUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.signedUrl} alt="Host handover" className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                    <div className="border-t border-border p-1.5 text-xs text-foreground/50">Handover photo</div>
                  </a>
                ))}
              </div>
            )}
            {!hasHostPhotos && !isHost && (
              <div className="mt-2 text-xs text-foreground/50">Waiting for host to upload handover photos.</div>
            )}
          </div>

          {/* Step 3: Renter pickup photos */}
          <div className="relative">
            <div className={`absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 ${hasRenterPhotos ? "border-green-500 bg-green-500" : "border-border bg-card"}`} />
            <div className="text-sm font-semibold">Renter pickup photos</div>
            <div className="mt-1 text-xs text-foreground/60">Take photos when you receive the vehicle — exterior, interior, fuel, odometer.</div>
            {isRenter && (
              <form
                action={`/api/bookings/${encodeURIComponent(props.bookingId)}/photos`}
                method="post"
                encType="multipart/form-data"
                className="mt-3 rounded-xl border border-border bg-card/80 p-3 space-y-2"
              >
                <input type="hidden" name="kind" value="renter_pickup" />
                <label className="block text-sm font-medium">Upload pickup photo</label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-500/20"
                />
                <Button type="submit" variant="secondary">Upload</Button>
              </form>
            )}
            {hasRenterPhotos && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {props.renterPickupPhotos.map((p) => (
                  <a key={p.name} href={p.signedUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.signedUrl} alt="Renter pickup" className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                    <div className="border-t border-border p-1.5 text-xs text-foreground/50">Pickup photo</div>
                  </a>
                ))}
              </div>
            )}
            {!hasRenterPhotos && !isRenter && (
              <div className="mt-2 text-xs text-foreground/50">Waiting for renter to upload pickup photos.</div>
            )}
          </div>
        </div>

        {/* Completion status */}
        {allChecked && hasHostPhotos && hasRenterPhotos ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
            <Badge variant="success">Complete</Badge>
            <div className="text-sm text-green-700 dark:text-green-400">
              Pickup is complete. {props.vehicleTitle} is now in the renter&apos;s hands. Enjoy the trip!
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Badge variant="warning">In progress</Badge>
            <div className="text-sm text-amber-700 dark:text-amber-400">
              {!allChecked ? "Complete the pre-pickup checklist." : !hasHostPhotos ? "Waiting for host handover photos." : "Renter needs to upload pickup photos."}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
