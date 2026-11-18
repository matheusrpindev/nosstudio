import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { env } from "@/lib/env";
import "./globals.css";

const montserrat = localFont({
  src: [
    { path: "../fonts/montserrat-latin-wght-normal.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/montserrat-latin-wght-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: "NÓS Studio",
  description: "Marketing, conteúdo e audiovisual. Sua história, nosso olhar.",
  applicationName: "NÓS Studio",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#3B1F8E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
