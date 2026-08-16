import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BUSINESS_NAME, BUSINESS_TAGLINE } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${BUSINESS_NAME} — Buy Data Bundles`,
  description: BUSINESS_TAGLINE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1565c0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
