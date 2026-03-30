import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/require";

function csvEscape(v: string) {
  if (/[\n\r,"]/g.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function iso(d: Date | null) {
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : "";
}

export async function GET() {
  await requireRole("ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      role: true,
      status: true,
      idVerificationStatus: true,
      driversLicenseStatus: true,
      createdAt: true,
    },
  });

  const header = [
    "id",
    "email",
    "name",
    "surname",
    "role",
    "status",
    "id_verification",
    "drivers_license",
    "created_at",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const u of users) {
    lines.push(
      [
        u.id,
        u.email,
        u.name ?? "",
        u.surname ?? "",
        u.role,
        u.status,
        u.idVerificationStatus,
        u.driversLicenseStatus,
        iso(u.createdAt),
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(","),
    );
  }

  const csv = lines.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="users-export.csv"`,
      "cache-control": "no-store",
    },
  });
}
