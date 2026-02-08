"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";

type AssistKind = "TIRE" | "FUEL";

type AssistResult =
  | { ok: true; incidentId: string }
  | { ok: false; error: string; status?: number };

const DEFAULT_CENTER: [number, number] = [-33.9249, 18.4241];

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

  const helpTitle = kind === "TIRE" ? "Flat tyre" : "Out of petrol";
  const marker: [number, number] | null =
    typeof lat === "number" && typeof lng === "number" ? [lat, lng] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={kind === "TIRE" ? "primary" : "secondary"}
          onClick={() => setKind("TIRE")}
        >
          Flat tyre
        </Button>
        <Button
          type="button"
          variant={kind === "FUEL" ? "primary" : "secondary"}
          onClick={() => setKind("FUEL")}
        >
          Out of petrol
        </Button>
        <div className="text-sm text-foreground/60">Selected: {helpTitle}</div>
      </div>

      <AssistMap
        center={center}
        marker={marker}
        onPick={(a, b) => {
          setLat(a);
          setLng(b);
          setAccuracy(null);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
        <div className="space-y-0.5">
          <div className="text-foreground/70">Current location</div>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-sm text-foreground/70">Contact number (optional)</div>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. +27 72 000 0000" />
        </label>
        <div className="flex items-end">
          <div className="text-xs text-foreground/60">
            Tip: you can click the map to adjust the marker.
          </div>
        </div>
      </div>

      <label className="block">
        <div className="mb-1 text-sm text-foreground/70">Notes (optional)</div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={kind === "TIRE" ? "Wheel damaged, unsafe location, etc." : "Empty tank, nearest landmark, etc."}
          rows={4}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Request assistance"}
        </Button>
        <Link className="text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground" href="/how-it-works">
          How it works
        </Link>
      </div>

      {result ? (
        result.ok ? (
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="font-medium">Request sent</div>
            <div className="mt-1 text-foreground/70">Incident ID: {result.incidentId}</div>
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
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
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
