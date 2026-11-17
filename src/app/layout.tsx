import type { Metadata } from "next";
import localFont from "next/font/local";
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
  title: "NÓS Studio",
  description: "Marketing, conteúdo e audiovisual. Sua história, nosso olhar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
