import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import Providers from "@/app/providers";
import Footer from "@/app/components/Footer";
import ChatWidget from "@/app/components/ChatWidget.client";
import PwaInit from "@/app/components/PwaInit.client";
import BackgroundVideo from "@/app/components/BackgroundVideo.client";

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
          <div className="relative min-h-dvh text-foreground">
            <BackgroundVideo />

            {/* Background overlay for legibility over video */}
            <div className="fixed inset-0 z-10 bg-black/30 backdrop-blur-sm" />
            
            {/* Additional dark overlay for more contrast */}
            <div className="fixed inset-0 z-10 bg-gradient-to-br from-black/20 via-black/25 to-black/30" />

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
