import https from "node:https";
import type { TLSSocket } from "node:tls";
import { NextResponse } from "next/server";

function getSupabaseHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function certSummary(cert: any) {
  if (!cert || typeof cert !== "object") return null;
  return {
    subject: cert.subject ?? null,
    issuer: cert.issuer ?? null,
    valid_from: cert.valid_from ?? null,
    valid_to: cert.valid_to ?? null,
    fingerprint256: cert.fingerprint256 ?? null,
    serialNumber: cert.serialNumber ?? null,
  };
}

function flattenChain(peer: any) {
  const out: any[] = [];
  const seen = new Set<string>();
  let cur = peer;
  while (cur && typeof cur === "object") {
    const fp = String(cur.fingerprint256 ?? cur.fingerprint ?? "");
    if (fp && seen.has(fp)) break;
    if (fp) seen.add(fp);
    out.push(certSummary(cur));
    cur = cur.issuerCertificate;
    if (!cur || cur === peer) break;
  }
  return out.filter(Boolean);
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const host = getSupabaseHost();
  if (!host) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  }

  const env = {
    NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS ?? null,
  };

  const result = await new Promise((resolve) => {
    const req = https.request(
      {
        host,
        servername: host,
        method: "GET",
        path: "/auth/v1/health",
        timeout: 10_000,
        rejectUnauthorized: false,
      },
      (res) => {
        const tlsSocket = res.socket as TLSSocket;
        const peer = (tlsSocket as any).getPeerCertificate?.(true);
        const chain = flattenChain(peer);
        res.resume();
        resolve({
          ok: true,
          statusCode: res.statusCode ?? null,
          headers: {
            server: res.headers.server ?? null,
            via: res.headers.via ?? null,
          },
          peerCertificate: certSummary(peer),
          certificateChain: chain,
          note: "This endpoint disables TLS verification to inspect the presented certificate chain. Dev only.",
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("TLS probe timeout"));
    });

    req.on("error", (error: unknown) => {
      resolve({
        ok: false,
        error: String((error as any)?.message ?? error),
      });
    });

    req.end();
  });

  return NextResponse.json({ host, env, result });
}
