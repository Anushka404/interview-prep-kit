import type { Metadata } from "next";
import { Manrope, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Manrope({ variable: "--ff-sans", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--ff-display", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--ff-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrepKit — AI Interview Prep",
  description: "Turn a job description into a personalised interview prep kit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
