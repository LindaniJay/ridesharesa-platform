import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import Providers from "@/app/providers";
import Footer from "@/app/components/Footer";
import ChatWidget from "@/app/components/ChatWidget.client";
import PwaInit from "@/app/components/PwaInit.client";

export const metadata: Metadata = {
  title: "RideShare Platform",
  description: "Peer-to-peer car rental marketplace (Host / Renter / Admin)",
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
          <div className="relative min-h-dvh bg-background text-foreground">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
              <div className="absolute -bottom-48 right-[-160px] h-[640px] w-[640px] rounded-full bg-foreground/10 blur-3xl" />
              <div className="absolute -bottom-40 left-[-160px] h-[560px] w-[560px] rounded-full bg-foreground/5 blur-3xl" />
            </div>

            <div className="relative">
              <Navbar />
              <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
              <Footer />
              <ChatWidget />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
