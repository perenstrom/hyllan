import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Named `--font-sans` to match the CSS variable globals.css's `@theme inline`
// expects — the prior Geist setup exported `--font-geist-sans` instead, which
// left `--font-sans` unset and silently fell back to the browser default font.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hyllan",
  description: "Hyllan is a multi-tenant pantry inventory app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
