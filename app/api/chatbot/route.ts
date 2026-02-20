import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { supabaseServer } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

type ChatActionRequest =
  | { lang?: string; action: "help" }
  | { lang?: string; action: "listBookings" }
  | { lang?: string; action: "getVerification" }
  | { lang?: string; action: "cancelBooking"; data: { bookingId: string } }
  | { lang?: string; action: "createTicket"; data: { subject: string; message: string } }
  | { lang?: string; message: string };

type QuickReply = {
  id: string;
  label: string;
  action:
    | { kind: "help" }
    | { kind: "listBookings" }
    | { kind: "getVerification" }
    | { kind: "startTicket" }
    | { kind: "send"; text: string }
    | { kind: "cancelBooking"; bookingId: string };
};

type BotCard = {
  id: string;
  title: string;
  lines?: string[];
  href?: string;
  actions?: Array<{ label: string; action: QuickReply["action"] }>;
};

type ChatbotResponse = {
  messages: Array<{ text: string }>;
  quickReplies?: QuickReply[];
  cards?: BotCard[];
};

type ChatLang = "en" | "zu" | "af";

function pickLang(raw: unknown): ChatLang {
  const v = String(raw ?? "").toLowerCase();
  if (v.startsWith("zu")) return "zu";
  if (v.startsWith("af")) return "af";
  return "en";
}

const I18N: Record<ChatLang, Record<string, string>> = {
  en: {
    greeting_signed_in: "Hello! How can I help you today?",
    greeting_guest:
      "Hello! Ask me anything about bookings, documents, and how the platform works. Sign in to view your bookings and create tickets.",
    menu_bookings: "My bookings",
    menu_docs: "Document status",
    menu_ticket: "Create support ticket",
    menu_assist: "Roadside assist",
    menu_listings: "Browse listings",
    menu_how: "How it works",
    menu_payments: "Payments (Card/EFT)",
    menu_signin: "Sign in",
    assist_title: "Roadside assist",
    assist_line1: "Flat tyre, out of fuel, or you’re stuck?",
    assist_line2: "Open Assist and send your location to request help.",
    recent_bookings: "Here are your most recent bookings (tap one to open):",
    no_bookings: "You don’t have any bookings yet.",
    sign_in_required:
      "Please sign in to use that feature. You can still ask general questions while signed out.",
    cancel_done: "Done — I cancelled that booking.",
    cancel_only_pending:
          "For safety, I can only cancel bookings that are still PENDING_PAYMENT (unpaid). If payment was received (PENDING_APPROVAL) or the booking is confirmed, please create a support ticket.",
    verify_title: "Here’s your current verification status:",
    verify_card: "Documents",
    sign_in_here: "You can sign in here:",
    how_it_works_intro: "Here’s a quick overview of how the platform works:",
    unknown:
      "I can help with bookings, documents, and general questions. Try typing “help”, or choose an option below.",
    support_prompt_signed_in: "I can help with that. Want to create a support ticket?",
    support_prompt_guest:
      "I can help with that. Sign in to create a support ticket, or ask a general question here.",
  },
  zu: {
    greeting_signed_in: "Sawubona! Ngingakusiza ngani namuhla?",
    greeting_guest:
      "Sawubona! Buza mayelana nokubhuka, amadokhumenti, nokuthi kusebenza kanjani. Ngena ukuze ubone okubhukile futhi udale ithikithi lokusekelwa.",
    menu_bookings: "Okubhukile kwami",
    menu_docs: "Isimo samadokhumenti",
    menu_ticket: "Dala ithikithi lokusekelwa",
    menu_assist: "Usizo lomgwaqo",
    menu_listings: "Bheka izimoto",
    menu_how: "Kusebenza kanjani",
    menu_payments: "Izinkokhelo (Ikhadi/EFT)",
    menu_signin: "Ngena",
    assist_title: "Usizo lomgwaqo",
    assist_line1: "Ithayi ephumile umoya, uphelelwe uphethiloli, noma ubambekile?",
    assist_line2: "Vula i-Assist bese uthumela indawo yakho ukuze uthole usizo.",
    recent_bookings: "Nazi okubhukile zakamuva (cindezela ukuvula):",
    no_bookings: "Awunakho okubhukile okwamanje.",
    sign_in_required:
      "Sicela ungene ukuze usebenzise lo msebenzi. Usengabuza imibuzo ejwayelekile ungakangeni.",
    cancel_done: "Kulungile — ngikhansele lokho kubhuka.",
    cancel_only_pending:
          "Ukuze kuphephe, ngingakhansele kuphela okubhukile okusese PENDING_PAYMENT (okungakakhokhwa). Uma inkokhelo isitholiwe (PENDING_APPROVAL) noma ukubhuka sekuqinisekisiwe, sicela udale ithikithi lokusekelwa.",
    verify_title: "Nansi isimo sakho sokuqinisekisa:",
    verify_card: "Amadokhumenti",
    sign_in_here: "Ngena lapha:",
    how_it_works_intro: "Nansi indlela esebenza ngayo kafushane:",
    unknown:
      "Ngingakusiza ngokubhuka, amadokhumenti, nemibuzo ejwayelekile. Thayipha “help”, noma khetha inketho ngezansi.",
    support_prompt_signed_in: "Ngingakusiza. Ufuna ukudala ithikithi lokusekelwa?",
    support_prompt_guest:
      "Ngingakusiza. Ngena ukuze udale ithikithi lokusekelwa, noma buza umbuzo lapha.",
  },
  af: {
    greeting_signed_in: "Hallo! Hoe kan ek jou vandag help?",
    greeting_guest:
      "Hallo! Vra my enigiets oor besprekings, dokumente en hoe die platform werk. Meld aan om jou besprekings te sien en ’n ondersteuningstiket te skep.",
    menu_bookings: "My besprekings",
    menu_docs: "Dokumentstatus",
    menu_ticket: "Skep ondersteuningstiket",
    menu_assist: "Padbystand",
    menu_listings: "Blaai motors",
    menu_how: "Hoe dit werk",
    menu_payments: "Betalings (Kaart/EFT)",
    menu_signin: "Meld aan",
    assist_title: "Padbystand",
    assist_line1: "Pap band, sonder brandstof, of jy sit vas?",
    assist_line2: "Open Assist en stuur jou ligging om hulp te vra.",
    recent_bookings: "Hier is jou mees onlangse besprekings (tik om oop te maak):",
    no_bookings: "Jy het nog geen besprekings nie.",
    sign_in_required:
      "Meld asseblief aan om daardie funksie te gebruik. Jy kan nog algemene vrae vra terwyl jy afgemeld is.",
    cancel_done: "Reg — ek het daardie bespreking gekanselleer.",
    cancel_only_pending:
          "Vir veiligheid kan ek net besprekings kanselleer wat nog PENDING_PAYMENT (onbetaal) is. As betaling reeds ontvang is (PENDING_APPROVAL) of die bespreking bevestig is, skep asseblief ’n ondersteuningstiket.",
    verify_title: "Hier is jou huidige verifikasiestatus:",
    verify_card: "Dokumente",
    sign_in_here: "Jy kan hier aanmeld:",
    how_it_works_intro: "Hier is ’n vinnige oorsig van hoe dit werk:",
    unknown:
      "Ek kan help met besprekings, dokumente en algemene vrae. Tik “help”, of kies ’n opsie hieronder.",
    support_prompt_signed_in: "Ek kan daarmee help. Wil jy ’n ondersteuningstiket skep?",
    support_prompt_guest:
      "Ek kan daarmee help. Meld aan om ’n ondersteuningstiket te skep, of vra hier ’n algemene vraag.",
  },
};

function t(lang: ChatLang, key: string) {
  return I18N[lang][key] ?? I18N.en[key] ?? key;
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function slugifyCity(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function getAuthedDbUserOrNull() {
  const supabase = await supabaseServer();
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user || !user.email) return null;
    const email = user.email.toLowerCase().trim();
    if (!email) return null;

    const name =
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) || null;

    const metadataRoleRaw = user.user_metadata?.role;
    const metadataRole = metadataRoleRaw === "HOST" || metadataRoleRaw === "RENTER" ? metadataRoleRaw : null;

    const dbUser = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        role: metadataRole === "HOST" ? "HOST" : "RENTER",
        status: "ACTIVE",
        idVerificationStatus: "UNVERIFIED",
        driversLicenseStatus: "UNVERIFIED",
      },
      update: {
        ...(name ? { name } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        idVerificationStatus: true,
        driversLicenseStatus: true,
      },
    });

    if (dbUser.status === "SUSPENDED") return null;
    return dbUser;
  } catch {
    return null;
  }
}

function helpResponse(lang: ChatLang, params?: { signedIn?: boolean }): ChatbotResponse {
  const signedIn = Boolean(params?.signedIn);

  return {
    messages: [
      {
        text: signedIn ? t(lang, "greeting_signed_in") : t(lang, "greeting_guest"),
      },
    ],
    quickReplies: signedIn
      ? [
          { id: uid(), label: t(lang, "menu_bookings"), action: { kind: "listBookings" } },
          { id: uid(), label: t(lang, "menu_docs"), action: { kind: "getVerification" } },
          { id: uid(), label: t(lang, "menu_ticket"), action: { kind: "startTicket" } },
          { id: uid(), label: t(lang, "menu_assist"), action: { kind: "send", text: "Roadside assist" } },
          { id: uid(), label: t(lang, "menu_listings"), action: { kind: "send", text: "Show me listings" } },
          { id: uid(), label: t(lang, "menu_how"), action: { kind: "send", text: "How it works" } },
        ]
      : [
          { id: uid(), label: t(lang, "menu_listings"), action: { kind: "send", text: "Show me listings" } },
          { id: uid(), label: t(lang, "menu_how"), action: { kind: "send", text: "How it works" } },
          { id: uid(), label: t(lang, "menu_assist"), action: { kind: "send", text: "Roadside assist" } },
          { id: uid(), label: t(lang, "menu_payments"), action: { kind: "send", text: "How do payments work?" } },
          { id: uid(), label: t(lang, "menu_signin"), action: { kind: "send", text: "Sign in" } },
        ],
    cards: [
      {
        id: uid(),
        title: "Quick links",
        lines: ["Browse listings", "Roadside assist", "Learn how it works"],
        actions: [
          { label: "Listings", action: { kind: "send", text: "Show me listings" } },
          { label: "Assist", action: { kind: "send", text: "Roadside assist" } },
          { label: "How it works", action: { kind: "send", text: "How it works" } },
          { label: "Terms", action: { kind: "send", text: "Terms" } },
          { label: "Privacy", action: { kind: "send", text: "Privacy" } },
        ],
      },
    ],
  };
}

function mustSignInResponse(): ChatbotResponse {
  return {
    messages: [
      {
        text: "Please sign in to use that feature. You can still ask general questions while signed out.",
      },
    ],
    cards: [
      {
        id: uid(),
        title: "Sign in",
        lines: ["Sign in to view bookings, cancel bookings, and create tickets."],
        href: "/sign-in",
      },
    ],
    quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
  };
}

async function listBookings(dbUserId: string): Promise<ChatbotResponse> {
  const bookings = await prisma.booking.findMany({
    where: { renterId: dbUserId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      totalCents: true,
      currency: true,
      listing: { select: { title: true, city: true } },
    },
  });

  if (bookings.length === 0) {
    return {
      messages: [{ text: "You don’t have any bookings yet." }],
      quickReplies: [
        { id: uid(), label: "Browse listings", action: { kind: "send", text: "Show me listings" } },
        { id: uid(), label: "Show help", action: { kind: "help" } },
      ],
      cards: [{ id: uid(), title: "Browse cars", href: "/listings" }],
    };
  }

  const cards: BotCard[] = bookings.map((b) => {
    const lines = [
      `${b.listing.title} (${b.listing.city})`,
      `Dates: ${b.startDate.toISOString().slice(0, 10)} → ${b.endDate.toISOString().slice(0, 10)}`,
      `Total: ${(b.totalCents / 100).toFixed(0)} ${b.currency}`,
      `Status: ${b.status}`,
    ];

    const actions: BotCard["actions"] =
      b.status === "PENDING_PAYMENT"
        ? [{ label: "Cancel", action: { kind: "cancelBooking", bookingId: b.id } }]
        : undefined;

    return {
      id: uid(),
      title: `Booking ${b.id.slice(0, 8)}`,
      lines,
      href: `/bookings/${b.id}`,
      actions,
    };
  });

  return {
    messages: [{ text: "Here are your most recent bookings (tap one to open):" }],
    cards,
    quickReplies: [
      { id: uid(), label: "Show help", action: { kind: "help" } },
      { id: uid(), label: "Create support ticket", action: { kind: "startTicket" } },
    ],
  };
}

async function cancelBooking(dbUserId: string, bookingId: string): Promise<ChatbotResponse> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, renterId: true, status: true },
  });

  if (!booking || booking.renterId !== dbUserId) {
    return {
      messages: [{ text: "I couldn’t find that booking under your account." }],
      quickReplies: [{ id: uid(), label: "My bookings", action: { kind: "listBookings" } }],
    };
  }

  if (booking.status !== "PENDING_PAYMENT") {
    return {
      messages: [
        {
          text:
            "For safety, I can only cancel bookings that are still PENDING_PAYMENT (unpaid). If payment was received (PENDING_APPROVAL) or the booking is confirmed, please create a support ticket.",
        },
      ],
      quickReplies: [
        { id: uid(), label: "Create support ticket", action: { kind: "startTicket" } },
        { id: uid(), label: "My bookings", action: { kind: "listBookings" } },
      ],
    };
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });

  return {
    messages: [{ text: "Done — I cancelled that booking." }],
    cards: [{ id: uid(), title: "View booking", href: `/bookings/${bookingId}` }],
    quickReplies: [{ id: uid(), label: "My bookings", action: { kind: "listBookings" } }],
  };
}

async function getVerification(dbUser: {
  idVerificationStatus: string;
  driversLicenseStatus: string;
}): Promise<ChatbotResponse> {
  return {
    messages: [
      {
        text: "Here’s your current verification status:",
      },
    ],
    cards: [
      {
        id: uid(),
        title: "Documents",
        lines: [`ID verification: ${dbUser.idVerificationStatus}`, `Driver’s license: ${dbUser.driversLicenseStatus}`],
        href: "/renter",
      },
    ],
    quickReplies: [
      { id: uid(), label: "Upload documents", action: { kind: "send", text: "How do I upload documents?" } },
      { id: uid(), label: "Show help", action: { kind: "help" } },
    ],
  };
}

async function createTicket(dbUserId: string, subject: string, message: string): Promise<ChatbotResponse> {
  const cleanSubject = subject.trim().slice(0, 120);
  const cleanMessage = message.trim().slice(0, 5000);

  if (!cleanSubject || !cleanMessage) {
    return {
      messages: [{ text: "Please provide both a subject and a message." }],
      quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
    };
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: dbUserId,
      subject: cleanSubject,
      message: cleanMessage,
      status: "OPEN",
    },
    select: { id: true },
  });

  return {
    messages: [
      {
        text: `Thanks — your support ticket is created (ID: ${ticket.id.slice(0, 8)}). We’ll get back to you soon.`,
      },
    ],
    quickReplies: [
      { id: uid(), label: "My bookings", action: { kind: "listBookings" } },
      { id: uid(), label: "Show help", action: { kind: "help" } },
    ],
  };
}

function normalizeText(message: string) {
  return message.toLowerCase().trim().replace(/\s+/g, " ");
}

async function answerMessage(
  message: string,
  dbUser: Awaited<ReturnType<typeof getAuthedDbUserOrNull>>,
  lang: ChatLang,
): Promise<ChatbotResponse> {
  const text = normalizeText(message);

  // Greetings
  if (
    text === "hi" ||
    text === "hello" ||
    text === "hey" ||
    text === "good day" ||
    text === "greetings" ||
    text === "sawubona" ||
    text === "molo" ||
    text === "dumelang" ||
    text === "hallo"
  ) {
    // language will be applied by caller via helpResponse
    return { messages: [{ text: "help" }] };
  }

  // NOTE: actual language injected by POST handler below
  if (!text || text === "help" || text.includes("menu")) return { messages: [{ text: "help" }] };

  // Auth-aware shortcuts: make common phrases "just work"
  if (dbUser) {
    if (text === "my bookings" || text === "bookings" || text.includes("recent bookings")) {
      return await listBookings(dbUser.id);
    }

    if (
      text === "document status" ||
      text === "documents" ||
      text.includes("verification status") ||
      text.includes("document status")
    ) {
      return await getVerification(dbUser);
    }

    const cancelMatch = /^(cancel booking|cancel)\s+([a-z0-9_-]{6,})$/.exec(text);
    if (cancelMatch) {
      return await cancelBooking(dbUser.id, cancelMatch[2]);
    }
  }

  if (
    text.includes("assist") ||
    text.includes("roadside") ||
    text.includes("flat") ||
    text.includes("tyre") ||
    text.includes("tire") ||
    text.includes("puncture") ||
    text.includes("petrol") ||
    text.includes("fuel") ||
    text.includes("out of fuel") ||
    text.includes("out of petrol")
  ) {
    return {
      messages: [
        {
          text: `${t(lang, "assist_line1")} ${t(lang, "assist_line2")}`,
        },
      ],
      cards: [
        {
          id: uid(),
          title: t(lang, "assist_title"),
          lines: [t(lang, "assist_line1"), t(lang, "assist_line2")],
          href: "/assist",
        },
      ],
      quickReplies: [
        { id: uid(), label: "Show help", action: { kind: "help" } },
      ],
    };
  }

  // Support ticket intent (guided flow handled by the client widget)
  if (text.includes("support") || text.includes("help") || text.includes("ticket")) {
    return {
      messages: [
        {
          text: dbUser
            ? "I can help with that. Want to create a support ticket?"
            : "I can help with that. Sign in to create a support ticket, or ask a general question here.",
        },
      ],
      quickReplies: dbUser
        ? [
            { id: uid(), label: "Create support ticket", action: { kind: "startTicket" } },
            { id: uid(), label: "My bookings", action: { kind: "listBookings" } },
            { id: uid(), label: "Show help", action: { kind: "help" } },
          ]
        : [
            { id: uid(), label: "Sign in", action: { kind: "send", text: "Sign in" } },
            { id: uid(), label: "Show help", action: { kind: "help" } },
          ],
    };
  }

  if (text.includes("how it works")) {
    return {
      messages: [{ text: "Here’s a quick overview of how the platform works:" }],
      cards: [
        {
          id: uid(),
          title: "How it works",
          lines: ["Renters browse cars and book instantly.", "Hosts list cars and manage bookings.", "Admins approve listings and verify documents."],
          href: "/how-it-works",
        },
      ],
      quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
    };
  }

  if (text.includes("sign in") || text === "login" || text === "log in") {
    return {
      messages: [{ text: "You can sign in here:" }],
      cards: [{ id: uid(), title: "Sign in", href: "/sign-in" }],
      quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
    };
  }

  if (text.includes("terms")) {
    return {
      messages: [{ text: "You can read the Terms here:" }],
      cards: [{ id: uid(), title: "Terms", href: "/terms" }],
      quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
    };
  }

  if (text.includes("privacy")) {
    return {
      messages: [{ text: "You can read the Privacy Policy here:" }],
      cards: [{ id: uid(), title: "Privacy", href: "/privacy" }],
      quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
    };
  }

  if (text.includes("listing") || text.includes("listings") || text.includes("browse")) {
    return {
      messages: [{ text: "Sure — here are the listings:" }],
      cards: [{ id: uid(), title: "Browse listings", href: "/listings" }],
      quickReplies: [{ id: uid(), label: "Search by city", action: { kind: "send", text: "I want a car in Cape Town" } }],
    };
  }

  if (text.includes("eft") || text.includes("instant eft") || text.includes("pay")) {
    return {
      messages: [
        {
          text:
            "Payments can be made by card (Stripe) or Instant EFT (manual). Stripe bookings move to PENDING_APPROVAL after payment and require an admin to approve before they become CONFIRMED. EFT bookings stay PENDING_PAYMENT until an admin confirms payment.",
        },
      ],
      quickReplies: [
        { id: uid(), label: "Show help", action: { kind: "help" } },
        { id: uid(), label: "Browse listings", action: { kind: "send", text: "Show me listings" } },
      ],
    };
  }

  // City hint: try to suggest a matching city route from active listings
  if (text.includes("in ") || text.includes("cape") || text.includes("johannes") || text.includes("durban")) {
    const q = text.replace(/^.*\bin\b/, "").trim();
    const query = (q.length >= 3 ? q : text).slice(0, 50);

    const cities = await prisma.listing.findMany({
      where: { status: "ACTIVE", isApproved: true, city: { contains: query, mode: "insensitive" } },
      select: { city: true },
      take: 5,
      distinct: ["city"],
    });

    if (cities.length > 0) {
      return {
        messages: [{ text: "Here are cities with approved listings:" }],
        cards: cities.map((c) => ({
          id: uid(),
          title: c.city,
          href: `/cities/${slugifyCity(c.city)}`,
        })),
        quickReplies: [{ id: uid(), label: "All listings", action: { kind: "send", text: "Show me listings" } }],
      };
    }
  }

  if (text.includes("document") || text.includes("verification") || text.includes("verify") || text.includes("license")) {
    return {
      messages: [
        {
          text:
            "If you’re signed in, I can show your current verification status. Otherwise, you can upload documents from your renter profile.",
        },
      ],
      cards: [{ id: uid(), title: "Renter profile", href: "/renter" }],
      quickReplies: [
        { id: uid(), label: "Document status", action: { kind: "getVerification" } },
        { id: uid(), label: "Show help", action: { kind: "help" } },
      ],
    };
  }

  if (text.includes("booking") || text.includes("cancel")) {
    if (dbUser) return await listBookings(dbUser.id);

    return {
      messages: [
        {
          text:
            "If you sign in, I can show your recent bookings and help cancel bookings that are still pending payment.",
        },
      ],
      quickReplies: [
        { id: uid(), label: "Sign in", action: { kind: "send", text: "Sign in" } },
        { id: uid(), label: "Show help", action: { kind: "help" } },
      ],
    };
  }

  return {
    messages: [
      {
        text:
          "I can help with bookings, documents, and general questions. Try typing “help”, or choose an option below.",
      },
    ],
    quickReplies: [
      { id: uid(), label: "Show help", action: { kind: "help" } },
      { id: uid(), label: "Browse listings", action: { kind: "send", text: "Show me listings" } },
      { id: uid(), label: "Create support ticket", action: { kind: "startTicket" } },
    ],
  };
}

export async function POST(req: Request) {
  let body: ChatActionRequest;
  try {
    body = (await req.json()) as ChatActionRequest;
  } catch {
    return NextResponse.json(helpResponse("en", { signedIn: false }));
  }

  const lang = pickLang(body.lang);

  const dbUser = await getAuthedDbUserOrNull();

  if ("action" in body) {
    if (body.action === "help") return NextResponse.json(helpResponse(lang, { signedIn: Boolean(dbUser) }));

    if (body.action === "listBookings") {
      if (!dbUser) return NextResponse.json(mustSignInResponse());
      const resp = await listBookings(dbUser.id);
      // translate top-level message + quick reply labels
      return NextResponse.json({
        ...resp,
        messages: [{ text: t(lang, "recent_bookings") }],
        quickReplies: resp.quickReplies?.map((q) =>
          q.label === "Show help" ? { ...q, label: "Help" } : q,
        ),
      });
    }

    if (body.action === "getVerification") {
      if (!dbUser) return NextResponse.json(mustSignInResponse());
      const resp = await getVerification(dbUser);
      return NextResponse.json({
        ...resp,
        messages: [{ text: t(lang, "verify_title") }],
        cards: resp.cards?.map((c) => (c.title === "Documents" ? { ...c, title: t(lang, "verify_card") } : c)),
      });
    }

    if (body.action === "cancelBooking") {
      if (!dbUser) return NextResponse.json(mustSignInResponse());
      const bookingId = body.data?.bookingId;
      if (!bookingId) return NextResponse.json({ messages: [{ text: "Missing booking id." }] });
      const resp = await cancelBooking(dbUser.id, bookingId);
      // best-effort translation of common responses
      const first = resp.messages[0]?.text ?? "";
      const mapped =
        first === "Done — I cancelled that booking."
          ? t(lang, "cancel_done")
          : first.startsWith("For safety")
            ? t(lang, "cancel_only_pending")
            : first;
      return NextResponse.json({ ...resp, messages: [{ text: mapped }] });
    }

    if (body.action === "createTicket") {
      if (!dbUser) return NextResponse.json(mustSignInResponse());
      return NextResponse.json(
        await createTicket(dbUser.id, body.data?.subject ?? "", body.data?.message ?? ""),
      );
    }
  }

  if ("message" in body) {
    try {
      const resp = await answerMessage(body.message, dbUser, lang);

      // Special-case: greeting/help placeholder emitted above
      if (resp.messages.length === 1 && resp.messages[0]?.text === "help") {
        return NextResponse.json(helpResponse(lang, { signedIn: Boolean(dbUser) }));
      }

      // Translate a few common top-level prompts for support intent
      if (resp.messages[0]?.text === "I can help with that. Want to create a support ticket?") {
        return NextResponse.json({
          ...resp,
          messages: [{ text: dbUser ? t(lang, "support_prompt_signed_in") : t(lang, "support_prompt_guest") }],
        });
      }

      // Fallback: return as-is
      return NextResponse.json(resp);
    } catch {
      return NextResponse.json({
        messages: [{ text: "Sorry — I couldn’t process that. Try “help”." }],
        quickReplies: [{ id: uid(), label: "Show help", action: { kind: "help" } }],
      });
    }
  }

  return NextResponse.json(helpResponse(lang, { signedIn: Boolean(dbUser) }));
}
