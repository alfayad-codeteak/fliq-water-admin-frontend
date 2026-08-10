import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { AuthPersistence } from "@/components/providers/auth-persistence";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Neerbottle Admin",
    template: "%s · Neerbottle Admin",
  },
  description: "Production-ready admin panel built with Next.js 15.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-svh font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>
            <AuthPersistence />
            <QueryProvider>
              {children}
              <Toaster richColors position="top-right" closeButton />
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
