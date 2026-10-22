import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://rtnweb.netlify.app",
  ),
  title: {
    default: "RTN — Production costing with clarity",
    template: "%s | RTN",
  },
  description:
    "Turn material purchases, production quantities, packaging, and overheads into a clear cost per batch and cost per unit.",
  openGraph: {
    title: "RTN — Know what every product costs before you make it",
    description:
      "Plan materials, batches, and production costs in one clear workspace built for product businesses.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "RTN — Know what every product costs before you make it.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RTN — Know what every product costs before you make it",
    description:
      "Plan materials, batches, and production costs in one clear workspace built for product businesses.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
