import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinCoach — Smart Finance Ledger",
  description: "AI-powered personal finance tracker with bank reconciliation",
  manifest: "/manifest.json",
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

