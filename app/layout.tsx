import "../styles/globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { SessionProvider } from "../components/auth/SessionContext";

export const metadata: Metadata = {
  title: "Mind Verse",
  description: "Graphic design lab · Creative challenges · Gamified learning",
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
    <html lang="mn" translate="no" suppressHydrationWarning className="dark">
      <head suppressHydrationWarning>
        {/* Prevent browser/translate extensions from altering HTML before hydration */}
        <meta name="google" content="notranslate" />
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="Content-Language" content="mn" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var selectors = [
                  '.translate-tooltip-mtz',
                  '.hidden_translate',
                  '[class*="translate-tooltip-mtz"]',
                  '[class*="hidden_translate"]'
                ];

                function removeTranslateArtifacts(root) {
                  if (!root || !root.querySelectorAll) return;
                  selectors.forEach(function (selector) {
                    root.querySelectorAll(selector).forEach(function (node) {
                      if (node && node.parentNode) node.parentNode.removeChild(node);
                    });
                  });
                }

                try {
                  Object.defineProperty(window, 'translate', { value: false, writable: false });
                } catch (e) {}

                removeTranslateArtifacts(document);

                new MutationObserver(function (mutations) {
                  mutations.forEach(function (mutation) {
                    mutation.addedNodes.forEach(function (node) {
                      if (node.nodeType !== 1) return;
                      var element = node;
                      var className = element.className || '';
                      if (
                        typeof className === 'string' &&
                        (className.indexOf('translate-tooltip-mtz') !== -1 ||
                          className.indexOf('hidden_translate') !== -1)
                      ) {
                        element.remove();
                        return;
                      }
                      removeTranslateArtifacts(element);
                    });
                  });
                }).observe(document.documentElement, { childList: true, subtree: true });
              })();
            `,
          }}
        />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans text-slate-300 antialiased notranslate bg-dark-950 selection:bg-primary-500 selection:text-white" suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

