import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import { ThemeProvider } from "@/src/components/vibes/theme-provider";
import { AppErrorBoundary } from "@/src/components/error-boundary";
import { PerformanceMonitor } from "@/src/components/PerformanceMonitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skitso - AI-Assisted Collaborative Performance Platform",
  description: "Create, perform, and share theatrical skits with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AppErrorBoundary>
            {children}
          </AppErrorBoundary>
        </ThemeProvider>
        <PerformanceMonitor />
      </body>
    </html>
  );
}
