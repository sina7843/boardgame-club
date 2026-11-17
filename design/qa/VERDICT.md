# BGV design QA — verdict (2026-11-17, design system v2.4.3, after commit 1902d0d7)

**Overall: FAIL.** Static gate clean, automated DOM audit 106 PASS / 0 FAIL, but the independent visual review found blockers in every page group, and 20 captures show the wrong state. Per-group detail: `verdict-{play,account,profile,chat,table,time}.md` (local, git-ignored).

## Gates
| Gate | Result |
| --- | --- |
| `ds-check --strict` (app code) | PASS (0 errors) |
| tokens.css / bundle.css vs design/system | byte-identical |
| DS components | 101/101 bundle.js components present in `packages/ui/src/bgv/bgv.js` |
| Old theme files (`theme.css`, `styles.css`, `vf/**`) | gone |
| `ds-check-ignore` | 1: `apps/web/src/lib/prefs.tsx` meta theme-color hex (LOGO-USAGE.md) |
| Automated audit (`ds-qa-report`) | 106 PASS, 0 FAIL, 1 TODO (Push-Lockscreen: OS lock screen, not capturable in a browser), 12 spec-only |

The automated audit passes screens that the visual review fails or cannot judge; it is not a sign-off on its own.

## Visual review (independent reviewers, one per group)
| Group | PASS | FAIL (blocker / polish only) | Not judgeable (wrong state) | Not captured / spec |
| --- | --- | --- | --- | --- |
| play | 2 | 26 (8 / 18) | 7 | 1 |
| account | 4 | 17 | 4 | 1 spec |
| profile | 1 | 16 (7 / 9) | 1 | 1 spec |
| chat | 0 | 10 (7 / 3) | 3 | 1 spec |
| table | 0 | 7 | 1 | 0 |
| time | 0 | 3 (2 / 1) | 4 | 3 (2 spec, lock screen) |
| **Total** | **7** | **79** | **20** | |

Owner decisions not counted as defects: Peyda font, comma thousands separator, box art only, v2.4 coloured header with expanding search, no «بازی سریع» in the header on / /games /games/:id, data-dependent blocks hidden when empty.

## Confirmed fixed since 2026-11-13
Game page one column on phones; empty reviews hidden; neutral «بشین» in open tables; tournament thumbnails; quick-chat emoji inside the chip; avatar initials (chat, members, podium); scrim behind chat sheets; DM title/tabs and back arrow; compact lobby head; ready/leave gap; leave token and banner position on the table; guest LoginSheet; spectator state; public profile loads, segmented phone tabs, framed overflow; Home-Guest captured signed out.

## Blockers (fix first)
1. **Phone game bar (table, time, chat)** — for a seated player the game title shrinks to one glyph and «قطع» is hidden: six controls (emoji, fullscreen, chat, leave, kebab…) at 390. Reference: chat · leave · kebab. Move emoji/fullscreen into the kebab below 900px. `apps/web/src/pages/Table.tsx` (~653–660).
2. **Renderer chrome inside the felt (rule 12)** — chess/uno draw their own turn bar, player bars and move table inside `.bgv-felt__stage`; the turn is announced 2–3 times. On phones the move log is passed into the HUD strip as a third "player card". `Table.tsx` (~668–670) + renderer hide hooks.
3. **Result screens** — the result card sits over the full board (page 1919/2260px vs 928px); «بعد از بازی» before the felt on phones; «میز تازه» is a second amber primary (`Table.tsx:295`); rewards tinted rows instead of white tiles.
4. **Critical clock** — red countdown bar outside the action dock, missing its second line; time shown in four places.
5. **GameDetail spacing (all 8 screens)** — `GameDetail.tsx` lost the `gd-main--r3` wrapper, so the r3 fixes in `home-ref.css` (1569–1571, 1633–1634) don't apply and the old negative margins (1386, 1475) still do: hero over breadcrumb, «بازی کن» under the tab bar, breadcrumb visible on phones. Empty «برترین‌ها» leaderboard card shows.
6. **Profile-Own** — still carries the display-name editor card («نام و آواتار» / «ذخیره پروفایل») and invite card: three amber buttons. Move them into Studio. Phone Studio tabs clipped; Wardrobe «پوشیده» badge covers the preview; «شما» preview row amber instead of navy; phone Studio/Avatar Builder lack the TopBar.
7. **Chat** — Messages-Guest shows the error block (401 treated as error) instead of the guest StateBlock; own-message menu covers the message, no lift / reaction bar; speech bubble drawn over the player card status row; DM-Desktop: no tab selected, tabs above the title.
8. **Lobby** — «کپی» inside the link field covers the URL; rules items are tinted boxes; phone ready bar runs under the dock; phone lobby lacks the compact game card; guest has no lobby behind the LoginSheet (needs a public lobby endpoint — backend gap).
9. **Account** — «مالک» uses the amber premium badge + crown (`Communities.tsx:49`; roles = neutral + shield); «درخواست عضویت» touches the banner; Plans table premium column filled amber; phone login shows footer links.
10. **Settings — reference conflict (owner decision needed)**: Settings-Desktop/Mobile references show a card dashboard / hub list, Alert-Settings-Desktop shows a tab bar with one section. The app now uses tabs. Pick one.

## Owner questions
- Settings layout (blocker 10).
- Copy: app «فروشگاه کازمتیک» / «استودیو پروفایل» vs v2.4 references and `COPY-FINAL.md` «فروشگاه اسکین» / «شخصی‌سازی پروفایل» (`CLAUDE.design-system.md` still lists «فروشگاه کازمتیک»).

## Capture fixes needed before re-review (harness, not product)
QuickMatch searching/found/joining states (all show the idle form); Shell-Phone route `/tables`; Tournament with a running tournament; 1000px widths; Turn-Start toast and Turn-Timeout after the auto-move; Alert-Settings at `/settings?tab=alerts`; My-Tables-Urgency with seeded turn tables; Table-OpponentOffline with a dropped opponent socket; Club chat screens as a member/moderator; Msg-Menu-Others on a fully visible message; Avatar-Builder-Mobile-Buy with a locked item selected; login steps 2–3; payment success/failure; Settings-Mobile dark; admin/moderation detail panels; Offline on its own route; lazy box art in full-page shots.

## How this run was captured
Fresh fixtures (`e2e/qa-setup.spec.ts`, `qa-setup2.spec.ts`, new `qa-setup3.spec.ts`: moderator/admin, group, DM) right before capture; capture via `design/qa/pw.noworker.config.ts` (no deadline worker) per page group with a fresh session. Harness changes: guest screens captured signed out, Postgres container name from `BGV_QA_PG_CONTAINER`, per-screen storage from `tables.json`, catalog variants routed to `/games`; report treats `/me/studio` and `/me/avatar` at <900px as full-screen tasks (reference).
