import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Mind Verse",
  description: "Graphic design lab · Creative challenges · Gamified learning",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn" translate="no" suppressHydrationWarning>
      <head>
        {/* Prevent browser/translate extensions from altering HTML before hydration */}
        <meta name="google" content="notranslate" />
      </head>
      <body className="font-sans text-nc-ink antialiased notranslate" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
