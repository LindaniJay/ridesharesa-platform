import { prisma } from "@/app/lib/prisma";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Canonical Listing type for UI
export interface Listing {
  id: string;
  title: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  dailyRateCents: number;
  currency: string;
  imageUrl: string | null;
  instantBooking: boolean;
}

// Prisma to Listing mapper
export function mapPrismaListing(l: Record<string, unknown>): Listing {
  return {
    id: String(l.id),
    title: String(l.title),
    city: String(l.city),
    country: String(l.country),
    latitude: Number(l.latitude),
    longitude: Number(l.longitude),
    dailyRateCents: Number(l.dailyRateCents),
    currency: String(l.currency),
    imageUrl: l.imageUrl ? String(l.imageUrl) : null,
    instantBooking: Boolean(l.instantBooking),
  };
}

// Supabase to Listing mapper
export function mapSupabaseListing(row: Record<string, unknown>): Listing {
  return {
    id: String(row.id),
    title: String(row.title),
    city: String(row.city),
    country: String(row.country),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    dailyRateCents: Number(row.daily_rate_cents),
    currency: String(row.currency),
    imageUrl: row.image_url ? String(row.image_url) : null,
    instantBooking: Boolean(row.instant_booking),
  };
}

// Fetch listings with fallback
export interface FetchListingsParams {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  instantBooking?: boolean;
  carType?: string;
  sort?: "recent" | "price_asc" | "price_desc";
  take?: number;
}

export async function fetchListingsWithFallback(params: FetchListingsParams): Promise<Listing[]> {
  try {
    // Try Prisma first
    const listings = await prisma.listing.findMany({
      where: {
        status: "ACTIVE",
        isApproved: true,
        ...(params.q
          ? {
              OR: [
                { title: { contains: params.q, mode: "insensitive" } },
                { city: { contains: params.q, mode: "insensitive" } },
                { country: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(params.minPrice ? { dailyRateCents: { gte: Math.round(params.minPrice * 100) } } : {}),
        ...(params.maxPrice ? { dailyRateCents: { lte: Math.round(params.maxPrice * 100) } } : {}),
        ...(params.instantBooking ? { instantBooking: true } : {}),
        ...(params.carType ? { title: { contains: params.carType, mode: "insensitive" } } : {}),
      },
      orderBy:
        params.sort === "price_asc"
          ? { dailyRateCents: "asc" }
          : params.sort === "price_desc"
          ? { dailyRateCents: "desc" }
          : { createdAt: "desc" },
      take: params.take ?? 50,
      select: {
        id: true,
        title: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        dailyRateCents: true,
        currency: true,
        imageUrl: true,
        instantBooking: true,
      },
    });
    return listings.map(mapPrismaListing);
  } catch (err) {
    // Fallback to Supabase if transient error
    const message = err instanceof Error ? err.message : String(err ?? "");
    if (!/timeout|etimedout|econnreset|connection terminated|can't reach database server/i.test(message)) {
      throw err;
    }
    // Supabase fallback
    let query = supabaseAdmin()
      .from("Listing")
      .select("id,title,city,country,latitude,longitude,daily_rate_cents,currency,image_url,instant_booking")
      .eq("status", "ACTIVE")
      .eq("is_approved", true)
      .limit(params.take ?? 50);
    if (params.q) {
      const escapedQ = params.q.replace(/[,%]/g, "");
      query = query.or(`title.ilike.%${escapedQ}%,city.ilike.%${escapedQ}%,country.ilike.%${escapedQ}%`);
    }
    if (params.minPrice) {
      query = query.gte("daily_rate_cents", Math.round(params.minPrice * 100));
    }
    if (params.maxPrice) {
      query = query.lte("daily_rate_cents", Math.round(params.maxPrice * 100));
    }
    if (params.instantBooking) {
      query = query.eq("instant_booking", true);
    }
    if (params.carType) {
      const escapedType = params.carType.replace(/[,%]/g, "");
      query = query.ilike("title", `%${escapedType}%`);
    }
    if (params.sort === "price_asc") {
      query = query.order("daily_rate_cents", { ascending: true });
    } else if (params.sort === "price_desc") {
      query = query.order("daily_rate_cents", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSupabaseListing);
  }
}

// Utility for formatting rates
export function formatRate(dailyRateCents: number, currency: string): string {
  return `${(dailyRateCents / 100).toFixed(0)} ${currency}`;
}