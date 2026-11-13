# BGV design QA — verdict (2026-11-13, design system v2.4.3)

**Overall: FAIL.** Static gate clean; automated DOM audit 99 PASS / 7 FAIL; independent visual review found blockers in every page group, and part of the captures show the wrong state (fixtures expired or lost the API session during the run). Per-group detail: `verdict-{play,account,profile,chat,table,time}.md` (local, git-ignored).

## Gates
| Gate | Result |
| --- | --- |
| `ds-check --strict` (app code) | PASS (0 errors in strict zones; 221 legacy-token errors remain in the game-art zone) |
| tokens.css / bundle.css vs design/system | byte-identical |
| DS components | 102/102 from the generated bgv.js (1:1 with bundle.js) |
| `ds-check-ignore` | 1: `apps/web/src/lib/prefs.tsx` meta theme-color hex (LOGO-USAGE.md) |
| Automated audit | 99 PASS, 7 FAIL (DS quick-chat chip: emoji overhangs the chip ~5px — DS bundle.css), 1 TODO (OS push lock-screen) |

## Visual review (independent reviewers, one per group)
| Group | PASS | FAIL | Not judgeable (wrong state / stale capture) |
| --- | --- | --- | --- |
| play | 7 | 20 | 9 |
| account | 2 | 13 | 10 |
| profile | 2 | 16 | 1 (spec) |
| chat | 0 | 10 | 3 |
| table | 0 | 8 | 0 (2 show the wrong state) |
| time | 0 | 6 | 4 |

Reviewer notes rejected as v2.4 owner decisions: «header cream with amber line instead of white» and «1440 search is an icon» (v2.4: coloured light header, expanding search); «no «بازی سریع» in the header» on /, /games, /games/:id.

## Blockers (fix first)
1. **Game page on phones** — grids never collapse at 390 (one word per line, ~10,400px page): late `gd-*` rules in `home-ref.css` without a phone override. Hero covers the breadcrumb; «بازی کن» cut by the sticky tabs (negative margins). Empty «نظر بازیکنان» shows with no reviews.
2. **Avatars without initials** — table chat (other players), club/group members show «۱», result podium/rematch initials white on white (`ChatPanel.tsx`, `Communities.tsx MemberRow`, result/rematch).
3. **Table frame** — no pink «ترک میز» in the game bar; game-bar meta overflows (hides «قطع»); connection-lost banner far down the page; lobby: «آماده‌ام»/«ترک میز» touch, invite-link card missing, oversized box in the page head, phone sticky bar overlaps its card; guest sees a lock screen instead of the lobby + LoginSheet.
4. **Chat** — long-press menu pinned to the screen corner (no lifted message, no reaction strip); chat sheets without scrim; table speech bubble overlaps the top bar/player card; DM thread back arrow centred; DM-Desktop title + tabs missing.
5. **Profile** — own profile appends the whole Studio editor; phone tab strip overflows; «ویرایش پروفایل» should be primary; public profile actions («پیام» + framed overflow), segmented tabs; Studio/Avatar builder on phone should be full-screen tasks; shop/wardrobe art blank (emotes, seat rings, bundle avatar).
6. **Account** — clubs: membership options overflow the «ساخت باشگاه» card; login phone field Latin digits / no icon; onboarding tour without scrim, target highlight or pointer; person/club names as amber underlined links.
7. **Play** — OpenTables rows use amber «پیوستن» (should be neutral «بشین»); Tournaments broken images on finished rows; QuickMatch searching layout single column (no side card); page tabs clip at 390.
8. **Time** — Alert-Settings-Desktop missing tabs, permission banner, thresholds card, quiet-hours range, «آزمایش صدا» button frame; My-Tables urgency structure (tabs, «دعوت‌ها», «فوری‌ترین اول»).
9. **DS (report upstream)** — `.bgv-chip img.bgv-emoji` overhangs the chip in the quick-chat tray (bundle.css).

## Capture fixes needed before re-review
Home-Guest captured signed in; QuickMatch phone states identical; Shell-Phone at `/` (reference `/tables`); turn/clock screens and chat menus need a live table seeded right before capture; account screens after ~13:47 lost the API session (Plans, Settings, Wallet, Support, Wiki, Login steps, Payment results); club chat screens need membership; Messages-Guest signed out; 1000px widths not captured this round.
