import "../styles/globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "../components/auth/SessionContext";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

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
    <html lang="mn" translate="no" suppressHydrationWarning className={`dark ${plusJakartaSans.variable}`}>
      <head suppressHydrationWarning>
        {/* Prevent browser/translate extensions from altering HTML before hydration */}
        <meta name="google" content="notranslate" />
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="Content-Language" content="mn" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
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
                  for (var s = 0; s < selectors.length; s++) {
                    var nodes = root.querySelectorAll(selectors[s]);
                    for (var n = 0; n < nodes.length; n++) {
                      if (nodes[n] && nodes[n].parentNode) nodes[n].parentNode.removeChild(nodes[n]);
                    }
                  }
                }

                try {
                  Object.defineProperty(window, 'translate', { value: false, writable: false });
                } catch (e) {}

                if (typeof window !== 'undefined') {
                  window.addEventListener('DOMContentLoaded', function() {
                    removeTranslateArtifacts(document.body);
                    var observer = new MutationObserver(function (mutations) {
                      for (var m = 0; m < mutations.length; m++) {
                        var added = mutations[m].addedNodes;
                        for (var i = 0; i < added.length; i++) {
                          var node = added[i];
                          if (node.nodeType !== 1) continue;
                          var cl = node.className || '';
                          if (typeof cl === 'string' && (cl.indexOf('translate-tooltip-mtz') !== -1 || cl.indexOf('hidden_translate') !== -1)) {
                            node.remove();
                            continue;
                          }
                          if (node.childElementCount > 0) {
                            removeTranslateArtifacts(node);
                          }
                        }
                      }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${plusJakartaSans.className} font-sans text-slate-300 antialiased notranslate bg-dark-950 selection:bg-primary-500 selection:text-white`} suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

