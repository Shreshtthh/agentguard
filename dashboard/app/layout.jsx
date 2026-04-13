import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "AgentGuard — AI Security Watchdog for Stellar Agents",
  description:
    "Real-time anomaly detection, AI-powered risk scoring, and on-chain policy enforcement for autonomous Stellar agents. Built for Stellar Hacks: Agents 2026.",
  keywords: ["Stellar", "Soroban", "x402", "AI", "Security", "Agents", "Blockchain"],
  openGraph: {
    title: "AgentGuard — AI Security Watchdog",
    description: "Monitors, detects, and blocks rogue autonomous agents on Stellar.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
