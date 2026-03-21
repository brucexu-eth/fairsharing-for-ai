import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButtonClient } from "@/components/ConnectButtonClient";

export const metadata: Metadata = {
  title: "FairSharing AI",
  description: "On-chain contribution tracking and incentive distribution for AI Agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="text-lg font-bold text-indigo-600 tracking-tight">
                FairSharing AI
              </a>
              <div className="flex items-center gap-3">
                <a href="/demo" className="text-sm text-gray-500 hover:text-gray-900 font-medium">
                  Demo
                </a>
                <ConnectButtonClient />
              </div>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
