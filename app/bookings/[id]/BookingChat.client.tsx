"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Textarea from "@/app/components/ui/Textarea";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; email: string; name: string | null; role: "ADMIN" | "HOST" | "RENTER" };
};

export default function BookingChat(props: {
  bookingId: string;
  viewerId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const endpoint = useMemo(() => `/api/bookings/${encodeURIComponent(props.bookingId)}/messages`, [props.bookingId]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as null | { messages?: Message[]; error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to load messages");
      setMessages(Array.isArray(json?.messages) ? json!.messages : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => null)) as null | { message?: Message; error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to send message");

      setDraft("");
      if (json?.message) {
        setMessages((prev) => [...prev, json.message!]);
      } else {
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Chat between renter, host, and admin for this booking.</CardDescription>
          </div>
          <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border bg-card p-3 text-sm">
          {loading ? (
            <div className="text-foreground/60">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-foreground/60">No messages yet.</div>
          ) : (
            messages.map((m) => {
              const you = m.sender.id === props.viewerId;
              const name = (m.sender.name && m.sender.name.trim()) || m.sender.email;
              return (
                <div key={m.id} className={you ? "text-right" : "text-left"}>
                  <div className="text-xs text-foreground/60">
                    {you ? "You" : name} • {m.sender.role} • {new Date(m.createdAt).toLocaleString()}
                  </div>
                  <div
                    className={
                      "mt-1 inline-block max-w-[90%] rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground"
                    }
                  >
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Type a message…"
          />
          <div className="flex items-center justify-end">
            <Button type="button" onClick={send} disabled={sending || !draft.trim()}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
