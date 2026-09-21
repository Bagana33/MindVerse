import "../styles/globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { SessionProvider } from "../components/auth/SessionContext";
import { MATERIAL_SYMBOLS_STYLESHEET } from "../lib/materialIconNames";

const notoSans = Noto_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mind Verse",
  description: "Дизайн сурч, бүтээлээ хуваалцаж, хамтдаа хөгжих сурагчдын орон зай.",
  icons: {
    icon: "/mind-verse-logo.png",
    apple: "/mind-verse-logo.png",
  },
  other: {
    "google": "notranslate",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn" translate="no" suppressHydrationWarning className={`dark ${notoSans.variable}`}>
      <head suppressHydrationWarning>
        {/* Prevent browser/translate extensions from altering HTML before hydration */}
        <meta name="google" content="notranslate" />
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="Content-Language" content="mn" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={MATERIAL_SYMBOLS_STYLESHEET} rel="stylesheet" />
      </head>
      <body className={`${notoSans.className} font-sans text-slate-300 antialiased notranslate bg-dark-950 selection:bg-primary-500 selection:text-white`} suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

