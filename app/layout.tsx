import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pacana — Cozy Focus & Time Journal",
  description: "Focus on what you are doing. Remember where your time went.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
