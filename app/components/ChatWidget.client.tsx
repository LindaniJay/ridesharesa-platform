"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { cn } from "@/app/lib/cn";

type ChatRole = "user" | "bot";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type ChatAction =
  | { kind: "send"; text: string }
  | { kind: "help" }
  | { kind: "listBookings" }
  | { kind: "getVerification" }
  | { kind: "cancelBooking"; bookingId: string }
  | { kind: "startTicket" }
  | { kind: "createTicket"; subject: string; message: string };

type QuickReply = {
  id: string;
  label: string;
  action: ChatAction;
};

type BotCard = {
  id: string;
  title: string;
  lines?: string[];
  href?: string;
  actions?: Array<{ label: string; action: ChatAction }>;
};

type ChatbotResponse = {
  messages: Array<{ text: string }>;
  quickReplies?: QuickReply[];
  cards?: BotCard[];
};

type ChatLang = "en" | "zu" | "af";

const LANG_LABEL: Record<ChatLang, string> = {
  en: "English",
  zu: "isiZulu",
  af: "Afrikaans",
};

type PendingTicket =
  | null
  | {
      step: "subject" | "message";
      subject?: string;
    };

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function callChatbot(payload: unknown): Promise<ChatbotResponse> {
  const res = await fetch("/api/chatbot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      messages: [
        {
          text: "Sorry — something went wrong. Please try again in a moment.",
        },
      ],
    };
  }

  return (await res.json()) as ChatbotResponse;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [cards, setCards] = useState<BotCard[]>([]);
  const [pendingTicket, setPendingTicket] = useState<PendingTicket>(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<ChatLang | null>(null);
  const [needsLangPick, setNeedsLangPick] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length, cards.length, quickReplies.length]);

  async function appendBot(resp: ChatbotResponse) {
    const newMessages: ChatMessage[] = resp.messages.map((m) => ({
      id: uid(),
      role: "bot",
      text: m.text,
    }));
    setMessages((prev) => [...prev, ...newMessages]);
    setQuickReplies(resp.quickReplies ?? []);
    setCards(resp.cards ?? []);
  }

  async function handleAction(action: ChatAction) {
    setBusy(true);
    try {
      if (action.kind === "startTicket") {
        setPendingTicket({ step: "subject" });
        setQuickReplies([]);
        setCards([]);
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "bot", text: "Sure — what’s the subject for your support ticket?" },
        ]);
        return;
      }

      if (action.kind === "createTicket") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "createTicket", data: action });
        await appendBot(resp);
        return;
      }

      if (action.kind === "help") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "help" });
        await appendBot(resp);
        return;
      }

      if (action.kind === "listBookings") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "listBookings" });
        await appendBot(resp);
        return;
      }

      if (action.kind === "getVerification") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "getVerification" });
        await appendBot(resp);
        return;
      }

      if (action.kind === "cancelBooking") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "cancelBooking", data: action });
        await appendBot(resp);
        return;
      }

      if (action.kind === "send") {
        const resp = await callChatbot({ lang: lang ?? "en", message: action.text });
        await appendBot(resp);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendText(text: string) {
    const clean = text.trim();
    if (!clean) return;

    const lower = clean.toLowerCase();
    const isCancel = lower === "cancel" || lower === "stop" || lower === "back";

    setMessages((prev) => [...prev, { id: uid(), role: "user", text: clean }]);
    setInput("");
    setQuickReplies([]);
    setCards([]);

    if (pendingTicket) {
      if (isCancel) {
        setPendingTicket(null);
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "bot", text: "No problem — I cancelled that. What would you like to do instead?" },
        ]);
        await handleAction({ kind: "help" });
        return;
      }

      if (pendingTicket.step === "subject") {
        setPendingTicket({ step: "message", subject: clean });
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "bot", text: "Got it. What happened? Please include as much detail as you can." },
        ]);
        return;
      }

      if (pendingTicket.step === "message") {
        const subject = pendingTicket.subject ?? "Support request";
        setPendingTicket(null);
        await handleAction({ kind: "createTicket", subject, message: clean });
        return;
      }
    }

    await handleAction({ kind: "send", text: clean });
  }

  async function ensureWelcome() {
    if (messages.length > 0) return;

    if (!lang) {
      setNeedsLangPick(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          text: "Choose your language / Khetha ulimi / Kies jou taal",
        },
      ]);
      setQuickReplies([]);
      setCards([]);
      return;
    }

    setBusy(true);
    try {
      const resp = await callChatbot({ lang, action: "help" });
      await appendBot(resp);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void ensureWelcome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("rs_chat_lang") : null;
    if (saved === "en" || saved === "zu" || saved === "af") {
      setLang(saved);
      return;
    }

    const browser = typeof navigator !== "undefined" ? navigator.language : "en";
    if (browser.toLowerCase().startsWith("af")) setLang("af");
    else if (browser.toLowerCase().startsWith("zu")) setLang("zu");
    else setLang("en");
  }, []);

  async function pickLang(next: ChatLang) {
    setLang(next);
    setNeedsLangPick(false);
    try {
      window.localStorage.setItem("rs_chat_lang", next);
    } catch {
      // ignore
    }
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: LANG_LABEL[next] },
    ]);
    await handleAction({ kind: "help" });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[92vw] max-w-[420px]">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Help & Support</CardTitle>
              <Button variant="ghost" onClick={() => setOpen(false)} aria-label="Close chat">
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                ref={listRef}
                className="h-[340px] overflow-auto rounded-xl border border-border bg-background/40 p-3"
              >
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[88%] rounded-xl px-3 py-2 text-sm",
                        m.role === "user"
                          ? "ml-auto bg-accent text-accent-foreground"
                          : "bg-card text-foreground",
                      )}
                    >
                      {m.text}
                    </div>
                  ))}

                  {cards.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {cards.map((c) => (
                        <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                          <div className="text-sm font-medium">{c.title}</div>
                          {c.lines?.length ? (
                            <div className="mt-1 space-y-0.5 text-xs text-foreground/70">
                              {c.lines.map((l, idx) => (
                                <div key={idx}>{l}</div>
                              ))}
                            </div>
                          ) : null}
                          {c.href ? (
                            <div className="mt-2 text-sm">
                              <Link className="underline" href={c.href}>
                                Open
                              </Link>
                            </div>
                          ) : null}
                          {c.actions?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.actions.map((a) => (
                                <Button
                                  key={a.label}
                                  variant="secondary"
                                  className="px-3 py-1.5 text-xs"
                                  onClick={() => void handleAction(a.action)}
                                  disabled={busy}
                                >
                                  {a.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {quickReplies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((q) => (
                    <Button
                      key={q.id}
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => void handleAction(q.action)}
                      disabled={busy}
                    >
                      {q.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {needsLangPick ? (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(LANG_LABEL) as ChatLang[]).map((code) => (
                    <Button
                      key={code}
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => void pickLang(code)}
                      disabled={busy}
                    >
                      {LANG_LABEL[code]}
                    </Button>
                  ))}
                </div>
              ) : null}

              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendText(input);
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pendingTicket ? "Type your answer…" : "Ask a question…"}
                  disabled={busy}
                />
                <Button type="submit" disabled={!canSend}>
                  Send
                </Button>
              </form>

              <div className="text-xs text-foreground/50">
                Guests can browse FAQs. Sign in to view bookings and create tickets.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-full p-0 shadow-sm"
          aria-label="Open chat"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M7.5 18.5a4.5 4.5 0 0 1-4.5-4.5V8.5A4.5 4.5 0 0 1 7.5 4h6A4.5 4.5 0 0 1 18 8.5v.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 18.5 6.5 21v-2.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.5 20a4.5 4.5 0 0 1-4.5-4.5v-3A4.5 4.5 0 0 1 13.5 8h3A4.5 4.5 0 0 1 21 12.5v3a4.5 4.5 0 0 1-4.5 4.5h-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 20 17.5 22.5V20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      )}
    </div>
  );
}
