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
  | { kind: "listHostBookings" }
  | { kind: "listHostListings" }
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
  context?: ChatbotContext;
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

type ChatbotContext =
  | null
  | {
      pending?: {
        kind: "pickCity";
        for: "listings";
      };
    };

type PersistedChatState = {
  lang: ChatLang | null;
  messages: ChatMessage[];
  quickReplies: QuickReply[];
  cards: BotCard[];
  pendingTicket: PendingTicket;
  context: ChatbotContext;
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
  const [context, setContext] = useState<ChatbotContext>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length, cards.length, quickReplies.length]);

  // Load persisted chat state once.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("rs_chat_state_v2");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedChatState>;
      if (parsed.lang === "en" || parsed.lang === "zu" || parsed.lang === "af") setLang(parsed.lang);
      if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
      if (Array.isArray(parsed.quickReplies)) setQuickReplies(parsed.quickReplies);
      if (Array.isArray(parsed.cards)) setCards(parsed.cards);
      if (parsed.pendingTicket === null || typeof parsed.pendingTicket === "object") setPendingTicket(parsed.pendingTicket as PendingTicket);
      if (parsed.context === null || typeof parsed.context === "object") setContext(parsed.context as ChatbotContext);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist chat state.
  useEffect(() => {
    try {
      const state: PersistedChatState = {
        lang,
        messages,
        quickReplies,
        cards,
        pendingTicket,
        context,
      };
      window.localStorage.setItem("rs_chat_state_v2", JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [lang, messages, quickReplies, cards, pendingTicket, context]);

  async function appendBot(resp: ChatbotResponse) {
    const newMessages: ChatMessage[] = resp.messages.map((m) => ({
      id: uid(),
      role: "bot",
      text: m.text,
    }));
    setMessages((prev) => [...prev, ...newMessages]);
    setQuickReplies(resp.quickReplies ?? []);
    setCards(resp.cards ?? []);
    if (typeof resp.context !== "undefined") setContext(resp.context ?? null);
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
        const resp = await callChatbot({ lang: lang ?? "en", action: "createTicket", data: action, context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "help") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "help", context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "listBookings") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "listBookings", context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "listHostBookings") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "listHostBookings", context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "listHostListings") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "listHostListings", context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "getVerification") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "getVerification", context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "cancelBooking") {
        const resp = await callChatbot({ lang: lang ?? "en", action: "cancelBooking", data: action, context });
        await appendBot(resp);
        return;
      }

      if (action.kind === "send") {
        const resp = await callChatbot({ lang: lang ?? "en", message: action.text, context });
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
      const resp = await callChatbot({ lang, action: "help", context });
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
    if (lang) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("rs_chat_lang") : null;
    if (saved === "en" || saved === "zu" || saved === "af") {
      setLang(saved);
      return;
    }

    const browser = typeof navigator !== "undefined" ? navigator.language : "en";
    if (browser.toLowerCase().startsWith("af")) setLang("af");
    else if (browser.toLowerCase().startsWith("zu")) setLang("zu");
    else setLang("en");
  }, [lang]);

  function resetChat() {
    setMessages([]);
    setQuickReplies([]);
    setCards([]);
    setPendingTicket(null);
    setContext(null);
    setNeedsLangPick(false);
    try {
      window.localStorage.removeItem("rs_chat_state_v2");
    } catch {
      // ignore
    }

    // Re-run the welcome flow if the widget is open.
    if (open) setTimeout(() => void ensureWelcome(), 0);
  }

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
    <div
      className={cn(
        "fixed z-50",
        open
          ? "inset-x-0 bottom-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:inset-auto sm:bottom-4 sm:right-4 sm:px-0 sm:pb-0"
          : "bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4",
      )}
    >
      {open ? (
        <div className="mx-auto w-full max-w-[520px] sm:mx-0 sm:w-[420px] sm:max-w-[420px]">
          <Card className="flex h-[70dvh] max-h-[640px] w-full flex-col overflow-hidden p-0 sm:h-[560px]">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="truncate text-base">Help & Support</CardTitle>
                <div className="text-xs text-foreground/60">
                  {busy ? "Assistant is typing…" : "Ask about bookings, listings, payments, documents."}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={resetChat}
                  aria-label="Reset chat"
                  disabled={busy}
                  className="px-2.5"
                >
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="px-2.5"
                >
                  Close
                </Button>
              </div>
            </CardHeader>

            <CardContent className="mt-0 flex min-h-0 flex-1 flex-col gap-3 bg-background px-4 py-3">
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-muted/40 p-3"
              >
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "ml-auto bg-accent text-accent-foreground"
                          : "border border-border bg-card text-foreground",
                      )}
                    >
                      {m.text}
                    </div>
                  ))}

                  {busy ? (
                    <div className="max-w-[70%] rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground/70">
                      Typing…
                    </div>
                  ) : null}

                  {cards.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {cards.map((c) => (
                        <div key={c.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
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
                <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                  {quickReplies.map((q) => (
                    <Button
                      key={q.id}
                      variant="secondary"
                      className="shrink-0 px-3 py-1.5 text-xs"
                      onClick={() => void handleAction(q.action)}
                      disabled={busy}
                    >
                      {q.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {needsLangPick ? (
                <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                  {(Object.keys(LANG_LABEL) as ChatLang[]).map((code) => (
                    <Button
                      key={code}
                      variant="secondary"
                      className="shrink-0 px-3 py-1.5 text-xs"
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
                  enterKeyHint="send"
                  autoComplete="off"
                />
                <Button type="submit" disabled={!canSend} className="shrink-0">
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
