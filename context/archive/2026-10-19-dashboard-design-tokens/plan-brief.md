# Dashboard design tokens — Plan Brief

> Full plan: `context/changes/dashboard-design-tokens/plan.md`
> Research: `context/changes/dashboard-design-tokens/research.md`

## What & Why

Aplikacja wygląda spójnie tylko dlatego, że każdy widok kopiuje te same literalne klasy ciemnej palety startera („cosmic”). Tokeny shadcn w `src/styles/global.css` istnieją, ale żaden widok ich nie czyta (50 trafień literałów, 0 użyć tokenów na dashboardzie). Zmiana przenosi wszystkie strony na **jasne, neutralne tokeny** i komponenty `src/components/ui`, naprawia widoczny fokus i semantykę błędów oraz zostawia kontrolę, która nie pozwoli wrócić do literałów.

## Starting Point

Ciemne tło `bg-cosmic` (hex) + literały `text-white`, `bg-white/10`, `purple-*`, `red-*` na 6 stronach i we współdzielonych komponentach formularzy; komponenty shadcn (`Button`, `AlertDialog`) są nadpisywane literałami, żeby pasowały. Fokus na „Delete” ≈1.2:1, pola bez `aria-invalid`, trzy różne pudełka błędu.

## Desired End State

Każda strona jest jasna, zbudowana z `Card`, `Input`, `Label`, `Alert`, `Button` i ról tokenów; `bg-cosmic` nie istnieje. Każda kontrolka ma widoczny fokus w `--ring`, błędy pól są ogłaszane, akcje wiersza mówią, której subskrypcji dotyczą. `/dev/dashboard-states` (tylko dev) pokazuje 7 stanów dashboardu, a `npm run lint` failuje na literalnym kolorze w widoku.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Motyw | Jasny: `:root`, `.dark` nieużywany | Wybór uczestnika („zrób jasny layout”); jasne tokeny już istnieją i obejmują portal dialogu bez dodatkowej klasy | Plan |
| Zasięg | Wszystkie 6 stron w tej zmianie | Współdzielone komponenty stają się jasne, więc strony auth/edit/`/` muszą przejść razem, inaczej są nieczytelne | Plan |
| Akcent | Neutralne shadcn, zmieniony tylko `--ring` → `oklch(0.556 0 0)` | Brak koloru marki; `--ring` musi dać ≥3:1 na białym (≈4.7:1 zamiast ≈1.9:1) | Plan + Research (C3) |
| Krycie ringów w `ui/*` | Pełne (`ring-ring`, `ring-destructive`) | `/50` i `/20` dają niewidoczny fokus; komponenty shadcn są w repo, by je dostosowywać | Plan |
| Dostępność (C4) | W tej zmianie, faza stanów | Macierz error/focus-visible ma być spełniona semantycznie, nie tylko wizualnie | Plan |
| Kitchen sink | `/dev/dashboard-states`, 404 poza `DEV`, fixture'y | Lokalnie nie działa logowanie Supabase; strona debug nie trafia na produkcję | Plan + Research |
| Selecty | Natywne na klasach tokenów | Zachowuje natywny POST formularza bez ukrytych inputów | Plan |
| Importy radix (F2) | Ujednolicone na `radix-ui` w fazie 1 | Odroczone z S-03 „do następnego komponentu shadcn” | Research (Historical) |
| Link „Edit” | `Button asChild` wokół niezmienionego `<a href>` | `smoke.mjs:18` wyciąga id z `href` | Research |

## Scope

**In scope:**

- Tokeny i komponenty na stronach `/dashboard`, `/`, `/auth/signin|signup|confirm-email`, `/subscriptions/[id]/edit`
- Nowe `ui/card|input|label|alert`, ujednolicenie importów radix
- Focus-visible, `aria-invalid`/`aria-describedby`, `role="alert"`, ogłaszanie wysyłki, nazwy akcji wiersza
- Kitchen sink w trybie dev, reguła UI w `CLAUDE.md`, `scripts/check-ui-literals.mjs` w `npm run lint`

**Out of scope:**

- Ciemny motyw i przełącznik, kolor marki, shadcn `Select`
- Zmiany copy, routingu, endpointów i logiki domenowej
- Playwright jako zależność, testy `toHaveScreenshot`, macierz responsywności

## Architecture / Approach

Kolejność `/10x-ui`: biblioteka → wartości tokenów → widok → stany. Dashboard dzieli się na stronę (dane z Supabase, `?error=`) i `DashboardView.astro` (markup z propsami), dzięki czemu kitchen sink renderuje ten sam widok na fixture'ach. Współdzielone komponenty zmieniają się raz i niosą kontrakt na wszystkie strony; skan literałów spada z 50 do 0 i zostaje bramką w CI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Biblioteka komponentów | `card`, `input`, `label`, `alert`; importy `radix-ui` | CLI shadcn wygeneruje styl importów inny niż zakładany |
| 2. Wartości tokenów | `--ring`, pełne ringi, Banner/Layout na tokenach | Ring na wciąż ciemnych stronach — sprawdzić widoczność |
| 3. Widok dashboardu | `DashboardView`, dashboard i komponenty współdzielone na tokenach | Strony auth nieczytelne do końca fazy 4 — **bez push** |
| 4. Pozostałe strony | auth/edit/`/` na tokenach, `bg-cosmic` usunięty, skan = 0 | Smoke zależy od `href` i tekstów — zachować dosłownie |
| 5. Stany i kitchen sink | ARIA, focus-visible, nazwy akcji, `/dev/dashboard-states` | Strona dev wyciekająca na produkcję — kryterium 404 w preview |
| 6. Zabezpieczenie | `check-ui-literals.mjs` w lint, blok UI w `CLAUDE.md` | Fałszywe trafienia regexu w legalnych klasach |

**Prerequisites:** Node 22 przez `nvm`, `npx astro sync` na świeżym checkoucie, sieć dla `npx shadcn@latest add`; push i deploy wykonuje człowiek.
**Estimated effort:** ~3–4 sesje na 6 faz (fazy 3–4 największe).

## Open Risks & Assumptions

- Kontrast `--ring` wyliczony z oklch, nie zmierzony — potwierdzić na zrzutach w fazie 2/5.
- Lokalnie zalogowany dashboard niedostępny (`supabase start` nie działa); weryfikacja przez kitchen sink + smoke w CI po pushu faz 3–4.
- Zrzuty binarką `chrome-headless-shell` z `~/.cache/ms-playwright` — jeśli zniknie, zrzuty ręcznie z przeglądarki.

## Success Criteria (Summary)

- Każda strona jest jasna i czytelna na 1280 px i 375 px, a skan literałów w widokach daje 0 i blokuje `npm run lint`.
- Użytkownik klawiatury widzi fokus na każdej kontrolce, w tym na „Delete”; czytnik ekranu ogłasza błędy pól i stan zapisu.
- Smoke w CI przechodzi bez zmian po wdrożeniu.
