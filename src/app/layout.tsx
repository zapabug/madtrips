import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/layout/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MadTrips - Bitcoin-Friendly Travel",
  description: "Discover and book Bitcoin-friendly travel experiences",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-sand text-ocean`} suppressHydrationWarning>
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <main className="flex-grow bg-white">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
