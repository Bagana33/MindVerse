# Poster brief generator

The public `/poster-brief` page gives students a complete Mongolian poster assignment with one click. The home callout and desktop/mobile navigation link to it.

## Behavior

- 24 curated fictional briefs, four in each of six categories: school, culture, environment, sport, music, technology. An all-category choice selects from the full collection. Consecutive generations do not repeat the previous template.
- Beginner, standard and advanced tasks have actual complexity differences and steps totaling 30, 45 and 60 minutes respectively.
- A4, A3, square and story formats update the dimensions, delivery requirement and final checklist.
- Each brief includes an audience, goal, fictional client, poster headline/body/call to action, concept starter, palette, requirements, timed steps and interactive checklist.
- Generation uses local curated content; it requires no AI request, account or database write. Existing shared layout requests are unchanged.
- Up to eight briefs can be saved in this browser. The last generated brief is restored on reload. Storage is validated, deduplicated and bounded; failed writes leave a retryable state. Saved briefs do not sync between devices or accounts, and checklist ticks reset when opening a brief.
- Plain-text copy has a manual selection fallback if the clipboard fails or stays pending for three seconds. TXT export uses UTF-8 with a BOM for Mongolian text.

## Verification

On 2026-09-22:

- Production build and TypeScript passed; `/poster-brief` is prerendered.
- Full test suite: 114 passed, including 12 generator tests and 14 UI behavior tests. The 26 generator/UI tests also passed after the final layout adjustment.
- Browser checks on the production-mode local server: generation, category/level/format selection, save and reload restoration, copy success feedback, TXT action, checklist interaction, home link and mobile navigation.
- No horizontal document/main overflow at 320, 390, 1024, 1280, 1440 and 1920 pixels. Visually inspected desktop/laptop and narrow mobile states. Result focus accounts for the fixed mobile header; copy/download feedback also appears next to the action buttons.
- No browser warning/error logs during the feature checks.
- Existing production feed, single-post lookup, pagination, empty search, leaderboard, lessons and contests passed the read-only verification script.

The UI tests use the real component and generator/text validator with a controlled hook environment. They cover malformed/unavailable storage, quota errors, full saved lists, clipboard denial/absence/timeout, stale asynchronous completion, unmount and TXT object URL cleanup. These complement the browser checks; they are not a cross-browser certification.
