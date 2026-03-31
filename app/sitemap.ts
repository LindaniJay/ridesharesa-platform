import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ridesharesa.co.za";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    "",
    "/listings",
    "/cities",
    "/how-it-works",
    "/help-center",
    "/guides",
    "/privacy",
    "/terms",
    "/sign-in",
    "/sign-up",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
