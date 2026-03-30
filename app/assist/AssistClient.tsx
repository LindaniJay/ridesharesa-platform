"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";

type AssistKind = "TIRE" | "FUEL" | "BATTERY" | "BREAKDOWN" | "ACCIDENT" | "LOCKOUT" | "MEDICAL" | "SECURITY";

type AssistResult =
  | { ok: true; incidentId: string }
  | { ok: false; error: string; status?: number };

const DEFAULT_CENTER: [number, number] = [-33.9249, 18.4241];

type AssistProvider = {
  id: string;
  name: string;
  type: "tow" | "mechanic" | "ambulance" | "police" | "fuel";
  phone: string;
  position: [number, number];
};

type AssistHub = {
  city: string;
  center: [number, number];
  providers: AssistProvider[];
};

const ASSIST_HUBS: AssistHub[] = [
  {
    city: "Cape Town",
    center: [-33.9249, 18.4241],
    providers: [
      { id: "ct-police", name: "Cape Town SAPS", type: "police", phone: "10111", position: [-33.9257, 18.4232] },
      { id: "ct-ambulance", name: "Metro EMS Cape Town", type: "ambulance", phone: "10177", position: [-33.9188, 18.4256] },
      { id: "ct-tow", name: "Atlantic Tow Response", type: "tow", phone: "+27 21 555 0142", position: [-33.9306, 18.4102] },
      { id: "ct-mech", name: "CBD Quick Mechanics", type: "mechanic", phone: "+27 21 555 0168", position: [-33.9285, 18.4298] },
      { id: "ct-fuel", name: "City Fuel Drop", type: "fuel", phone: "+27 21 555 0189", position: [-33.9321, 18.438] },
    ],
  },
  {
    city: "Johannesburg",
    center: [-26.2041, 28.0473],
    providers: [
      { id: "jhb-police", name: "JHB Central SAPS", type: "police", phone: "10111", position: [-26.2022, 28.0431] },
      { id: "jhb-ambulance", name: "Gauteng EMS", type: "ambulance", phone: "10177", position: [-26.2064, 28.0541] },
      { id: "jhb-tow", name: "Jozi Towline", type: "tow", phone: "+27 11 555 0131", position: [-26.21, 28.06] },
      { id: "jhb-mech", name: "City Core Auto Clinic", type: "mechanic", phone: "+27 11 555 0192", position: [-26.1985, 28.0417] },
      { id: "jhb-fuel", name: "Rapid Fuel Assist", type: "fuel", phone: "+27 11 555 0174", position: [-26.1999, 28.0522] },
    ],
  },
  {
    city: "Durban",
    center: [-29.8587, 31.0218],
    providers: [
      { id: "dbn-police", name: "Durban Central SAPS", type: "police", phone: "10111", position: [-29.857, 31.0244] },
      { id: "dbn-ambulance", name: "KZN EMS", type: "ambulance", phone: "10177", position: [-29.862, 31.028] },
      { id: "dbn-tow", name: "Coastal Tow Services", type: "tow", phone: "+27 31 555 0116", position: [-29.8647, 31.0181] },
      { id: "dbn-mech", name: "Harbour Auto Rescue", type: "mechanic", phone: "+27 31 555 0128", position: [-29.8534, 31.017] },
      { id: "dbn-fuel", name: "Durban Fuel Relay", type: "fuel", phone: "+27 31 555 0154", position: [-29.8663, 31.0333] },
    ],
  },
];

const ASSIST_KIND_OPTIONS: Array<{ kind: AssistKind; label: string; hint: string }> = [
  { kind: "TIRE", label: "Flat tyre", hint: "Puncture, burst, unsafe wheel" },
  { kind: "FUEL", label: "Out of fuel", hint: "Fuel delivery needed" },
  { kind: "BATTERY", label: "Flat battery", hint: "Jump-start assistance" },
  { kind: "BREAKDOWN", label: "Breakdown", hint: "Mechanical failure" },
  { kind: "ACCIDENT", label: "Accident", hint: "Collision support and logging" },
  { kind: "LOCKOUT", label: "Lockout", hint: "Keys locked inside vehicle" },
  { kind: "MEDICAL", label: "Medical", hint: "Immediate health support" },
  { kind: "SECURITY", label: "Security", hint: "Police/security assistance" },
];

function distanceKm(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function nearestAssistHub(point: [number, number]) {
  return ASSIST_HUBS
    .map((hub) => ({ hub, dist: distanceKm(point, hub.center) }))
    .sort((a, b) => a.dist - b.dist)[0]?.hub ?? ASSIST_HUBS[0];
}

const AssistMap = dynamic(() => import("@/app/assist/AssistMap.client"), { ssr: false });

export default function AssistClient() {
  const [kind, setKind] = useState<AssistKind>("TIRE");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [notes, setNotes] = useState("");
  const [contact, setContact] = useState("");

  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssistResult | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (typeof lat === "number" && typeof lng === "number") return [lat, lng];
    return DEFAULT_CENTER;
  }, [lat, lng]);

  const nearestHub = useMemo(() => nearestAssistHub(center), [center]);
  const nearbyProviders = nearestHub.providers;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }

    setGeoStatus("requesting");
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null);
        setGeoStatus("ready");
      },
      (err) => {
        setGeoStatus("error");
        setGeoError(err.message || "Could not get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, []);

  async function submit() {
    setResult(null);

    if (typeof lat !== "number" || typeof lng !== "number") {
      setResult({ ok: false, error: "Please set your location on the map first." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          latitude: lat,
          longitude: lng,
          notes,
          contact,
          accuracy,
        }),
      });

      const json = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "error" in (json as Record<string, unknown>)
            ? String((json as Record<string, unknown>).error)
            : "Request failed.";
        setResult({ ok: false, error: msg, status: res.status });
        return;
      }

      if (!json || typeof json !== "object" || !("incidentId" in (json as Record<string, unknown>))) {
        setResult({ ok: false, error: "Unexpected response from server." });
        return;
      }

      setResult({ ok: true, incidentId: String((json as Record<string, unknown>).incidentId) });
    } catch {
      setResult({ ok: false, error: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedOption = ASSIST_KIND_OPTIONS.find((item) => item.kind === kind);
  const helpTitle = selectedOption?.label ?? "Roadside assistance";
  const marker: [number, number] | null =
    typeof lat === "number" && typeof lng === "number" ? [lat, lng] : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/60 p-3 sm:p-4">
        <div className="mb-2 text-sm font-medium">What do you need help with?</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ASSIST_KIND_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => setKind(option.kind)}
              className={[
                "rounded-xl border px-3 py-2 text-left transition-colors",
                kind === option.kind
                  ? "border-accent/40 bg-accent-soft"
                  : "border-border bg-card hover:bg-muted/50",
              ].join(" ")}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-xs text-foreground/60">{option.hint}</div>
            </button>
          ))}
        </div>
        <div className="mt-2 text-sm text-foreground/60">Selected: {helpTitle}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CardEmergencyContact title="Police" phone="10111" description="National emergency police line" />
        <CardEmergencyContact title="Ambulance" phone="10177" description="National emergency medical line" />
      </div>

      <AssistMap
        center={center}
        marker={marker}
        providers={nearbyProviders}
        onPick={(a, b) => {
          setLat(a);
          setLng(b);
          setAccuracy(null);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
        <div className="space-y-0.5">
          <div className="text-foreground/70">Current location ({nearestHub.city} response zone)</div>
          <div className="font-medium">
            {typeof lat === "number" && typeof lng === "number" ? (
              <>
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </>
            ) : (
              "Not set"
            )}
          </div>
          {typeof accuracy === "number" ? (
            <div className="text-xs text-foreground/60">Accuracy: ~{Math.round(accuracy)}m</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setGeoStatus("requesting");
              setGeoError(null);
              setResult(null);

              if (!navigator.geolocation) {
                setGeoStatus("error");
                setGeoError("Geolocation is not supported in this browser.");
                return;
              }

              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setLat(pos.coords.latitude);
                  setLng(pos.coords.longitude);
                  setAccuracy(typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null);
                  setGeoStatus("ready");
                },
                (err) => {
                  setGeoStatus("error");
                  setGeoError(err.message || "Could not get your current location.");
                },
                { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
              );
            }}
          >
            Use my GPS
          </Button>
        </div>
      </div>

      {geoStatus === "requesting" ? <div className="text-sm text-foreground/60">Requesting location permission…</div> : null}
      {geoStatus === "error" && geoError ? <div className="text-sm text-destructive">{geoError}</div> : null}

      <div className="grid gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:grid-cols-2 sm:p-4">
        <label className="block">
          <div className="mb-1 text-sm text-foreground/70">Contact number (optional)</div>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. +27 72 000 0000" />
        </label>
        <div className="flex items-end">
          <div className="text-xs text-foreground/60">
            Tip: tap anywhere on the map to fine-tune your pin before submitting.
          </div>
        </div>
      </div>

      <label className="block">
        <div className="mb-1 text-sm text-foreground/70">Notes (optional)</div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            kind === "TIRE"
              ? "Wheel damaged, unsafe location, etc."
              : kind === "FUEL"
                ? "Empty tank, nearest landmark, etc."
                : kind === "ACCIDENT"
                  ? "Vehicle condition, injuries, traffic obstruction, etc."
                  : kind === "MEDICAL"
                    ? "Symptoms and urgency (if safe to share)."
                    : "Share details that can speed up assistance."
          }
          rows={4}
        />
      </label>

      <div className="rounded-2xl border border-border bg-card/60 p-3 sm:p-4">
        <div className="mb-2 text-sm font-medium">Nearby service providers</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nearbyProviders.map((provider) => (
            <div key={provider.id} className="rounded-lg border border-border bg-background/40 p-2 text-xs">
              <div className="font-medium">{provider.name}</div>
              <div className="text-foreground/60">{provider.type.toUpperCase()}</div>
              <a className="mt-1 inline-block underline" href={`tel:${provider.phone.replace(/\s+/g, "")}`}>
                {provider.phone}
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/50 p-3 sm:p-4">
        <Button type="button" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Request assistance"}
        </Button>
        <Link className="text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/how-it-works">
          How it works
        </Link>
        <div className="text-xs text-foreground/60">This report creates an incident ticket for operations.</div>
      </div>

      {result ? (
        result.ok ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">
            <div className="font-medium">Request sent successfully</div>
            <div className="mt-1 text-foreground/70">Incident ID: {result.incidentId}</div>
            <div className="mt-3 rounded-lg border border-border bg-card p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Status timeline</div>
              <ol className="mt-2 space-y-2">
                {[
                  { label: "Received", active: true },
                  { label: "Assigned", active: false },
                  { label: "In progress", active: false },
                  { label: "Resolved", active: false },
                ].map((step) => (
                  <li key={step.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={[
                        "inline-flex h-2.5 w-2.5 rounded-full",
                        step.active ? "bg-green-500" : "bg-foreground/25",
                      ].join(" ")}
                    />
                    <span className={step.active ? "font-medium text-foreground" : "text-foreground/60"}>{step.label}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2 text-xs text-foreground/60">
                Next status updates appear in your dashboard support and incident views.
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link className="text-sm underline" href="/renter">
                Open renter dashboard
              </Link>
              <Link className="text-sm underline" href="/host">
                Open host dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
            <div className="font-medium text-destructive">Could not submit</div>
            <div className="mt-1 text-foreground/70">{result.error}</div>
            {result.status === 401 ? (
              <div className="mt-2">
                <Link className="text-sm underline" href="/sign-in">
                  Sign in to request assistance
                </Link>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

function CardEmergencyContact({ title, phone, description }: { title: string; phone: string; description: string }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-foreground/70">{description}</div>
      <a className="mt-2 inline-flex rounded-md border border-border bg-card px-2 py-1 text-xs font-medium underline" href={`tel:${phone}`}>
        Call {phone}
      </a>
    </div>
  );
}
