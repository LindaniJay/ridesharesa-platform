import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import Providers from "@/app/providers";
import Footer from "@/app/components/Footer";
import ChatWidget from "@/app/components/ChatWidget.client";
import PwaInit from "@/app/components/PwaInit.client";
import BackgroundVideo from "@/app/components/BackgroundVideo.client";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.ridesharesaplatform.co.za";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RideShare SA | Rent Cars From Local Hosts",
    template: "%s | RideShare SA",
  },
  description:
    "Book verified cars from local hosts across South Africa with secure checkout, clear pricing, and fast support.",
  applicationName: "RideShare SA",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "RideShare SA",
    title: "RideShare SA | Rent Cars From Local Hosts",
    description:
      "Book verified cars from local hosts across South Africa with secure checkout, clear pricing, and fast support.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RideShare SA | Rent Cars From Local Hosts",
    description:
      "Book verified cars from local hosts across South Africa with secure checkout, clear pricing, and fast support.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <PwaInit />
          <div className="relative min-h-dvh text-foreground">
            <BackgroundVideo />

            {/* Theme-aware overlays for legibility over video without fully hiding it. */}
            <div className="fixed inset-0 z-10 bg-white/72 backdrop-blur-sm dark:bg-black/30" />
            <div className="fixed inset-0 z-10 bg-gradient-to-br from-white/52 via-white/42 to-white/32 dark:from-black/20 dark:via-black/25 dark:to-black/30" />

            <div className="relative z-20">
              <Navbar />
              <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-4 sm:py-8 mobile-tight">{children}</div>
              <Footer />
              <ChatWidget />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
