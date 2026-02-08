import https from "node:https";
import type { TLSSocket } from "node:tls";
import { NextResponse } from "next/server";

function errorToJson(err: unknown) {
  const e = err as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown; cause?: unknown };
  const cause = e?.cause as { name?: unknown; code?: unknown; message?: unknown } | undefined;

  return {
    name: typeof e?.name === "string" ? e.name : null,
    code: typeof e?.code === "string" ? e.code : null,
    message: typeof e?.message === "string" ? e.message : String(err),
    stack: typeof e?.stack === "string" ? e.stack : null,
    cause: cause
      ? {
          name: typeof cause.name === "string" ? cause.name : null,
          code: typeof cause.code === "string" ? cause.code : null,
          message: typeof cause.message === "string" ? cause.message : null,
        }
      : null,
  };
}

function getSupabaseHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function readNodeExtraCaInfo() {
  const value = process.env.NODE_EXTRA_CA_CERTS ?? null;
  return {
    NODE_EXTRA_CA_CERTS: value,
  };
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const host = getSupabaseHost();
  if (!host) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  }

  const env = readNodeExtraCaInfo();

  const result = await new Promise((resolve) => {
    const req = https.request(
      {
        host,
        method: "GET",
        path: "/auth/v1/health",
        timeout: 10_000,
      },
      (res) => {
        const tlsSocket = res.socket as TLSSocket;
        const peer = tlsSocket.getPeerCertificate?.(true);
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => {
          resolve({
            ok: true,
            statusCode: res.statusCode ?? null,
            headers: {
              server: res.headers.server ?? null,
              via: res.headers.via ?? null,
            },
            peerCertificate: peer
              ? {
                  subject: peer.subject,
                  issuer: peer.issuer,
                  valid_from: peer.valid_from,
                  valid_to: peer.valid_to,
                  fingerprint256: peer.fingerprint256,
                }
              : null,
            bodyPreview: Buffer.concat(chunks).toString("utf8").slice(0, 500),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("TLS probe timeout"));
    });

    req.on("error", (error: unknown) => {
      resolve({
        ok: false,
        error: errorToJson(error),
      });
    });

    req.end();
  });

  return NextResponse.json({ host, env, result });
}
