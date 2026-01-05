import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Mind Verse",
  description: "Graphic design lab · Creative challenges · Gamified learning",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn" translate="no" suppressHydrationWarning className="dark">
      <head>
        {/* Prevent browser/translate extensions from altering HTML before hydration */}
        <meta name="google" content="notranslate" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans text-slate-300 antialiased notranslate bg-dark-950 selection:bg-primary-500 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
