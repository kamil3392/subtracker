---
date: 2026-10-19T12:06:26+02:00
researcher: Claude (Opus 5.5) dla kkapturski
git_commit: 566bb369b9e9a5d622866cecb6fcb02da30077fe
branch: master
repository: 10xdevs
topic: "Dwukierunkowy audyt /dashboard względem tokenów z src/styles/global.css i komponentów src/components/ui"
tags: [research, ui, design-tokens, shadcn, dashboard, a11y, focus-visible]
status: complete
last_updated: 2026-10-19
last_updated_by: Claude (Opus 5.5)
---

# Research: audyt `/dashboard` — tokeny, komponenty, stany

**Date**: 2026-10-19T12:06:26+02:00
**Researcher**: Claude (Opus 5.5) dla kkapturski
**Git Commit**: 566bb369b9e9a5d622866cecb6fcb02da30077fe (drzewo robocze: niezatwierdzone zmiany tylko w `.claude/`, poza zakresem)
**Branch**: master
**Repository**: 10xdevs

## Research Question

Dla jednego widoku `/dashboard` (`src/pages/dashboard.astro` + `Topbar`, `Banner` przez `Layout`, `SubscriptionForm`, `SubscriptionActions`, `form/*`):
(źródło → widoki) które pliki czytają tokeny z `src/styles/global.css` i komponenty z `src/components/ui/`;
(widok → źródło) który token lub komponent powinien pokryć każdy literał ze skanu;
jak wygląda 7-stanowa macierz (default, hover, focus-visible, disabled, error, empty, loading);
jaki jest zasięg zmian poza `/dashboard`. Wynik: 3–5 zarzutów pod `## Charges`.

## Summary

- **Wariant kontraktu: świeży starter z martwym plikiem tokenów.** `global.css` ma pełny zestaw tokenów shadcn (`:root` 6–39, `.dark` 41–73, `@theme inline` 75–111), ale w 8 plikach widoku skan znalazł 50 trafień literałów i 0 użyć klas tokenów (`bg|text|border|ring-<rola>`). Klasy tokenów występują w `src/` wyłącznie w `ui/button.tsx` i `ui/alert-dialog.tsx`.
- **Ciemny wygląd to pozostałość startera, nie decyzja.** `bg-cosmic` (`global.css:113-115`, 3 kolory hex) i fiolet `SubmitButton` pojawiły się w commicie bootstrapu `f7e9256`; żaden dokument w `context/` nie wybiera tej palety. Klasa `.dark` nie jest nigdzie ustawiana (sprawdzone `src/`, `public/`, `astro.config.mjs`), więc `body` dostaje jasne `bg-background` (`global.css:121-122`) przykryte `div.bg-cosmic`.
- **Komponenty shadcn są nadpisywane literałami, żeby pasowały do „cosmic”** — `SubscriptionActions.tsx:52,58,61,66`, `SubmitButton.tsx:7`. Plan S-03 zapisał to jako decyzję („Kolory dialogu dopasowane do ciemnego motywu dashboardu przez `cn()`”, `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:222`).
- **Focus-visible i error rozjechały się najbardziej:** Delete ma ring `destructive/20` (~1.2:1 na tle `#0a0e1a`, wyliczone), linki i „Sign out” nie mają własnego stylu fokusu, pola używają `focus:` z literalnym fioletem; żadne pole nie ma `aria-invalid`/`aria-describedby`, a z 3 czerwonych pudełek błędu tylko jedno ma `role="alert"`.
- **Zasięg:** `FormField`, `SubmitButton`, `ServerError`, `Topbar`, `SubscriptionForm`, `Layout` i `bg-cosmic` są współdzielone z `/`, `/auth/*` i `/subscriptions/[id]/edit`. Tylko `SubscriptionActions` i inline markup `dashboard.astro` są wyłącznie dashboardowe.

## Charges

Każdy zarzut: kategoria, dowód `plik:linia`, wpływ na użytkownika. Kolejność = proponowana kolejność faz.

### C1 — Brakujące tokeny: widok nie czyta żadnego tokenu, `.dark` jest martwy *(brakujące tokeny)*

- Dowody: `dashboard.astro:69` (`text-white` dla całej siatki), `:84,:101,:177` (`bg-white/10 border-white/10`), `:86,:95,:102,:113,:122,:146,:150` (`text-blue-100/60`), `:77` (gradient `from-blue-200 to-purple-200`), `:159` i `Topbar.astro:10,14,24,27` (`text-purple-300 hover:text-purple-100`), `FormField.tsx:6,39,43,56`, `SubscriptionForm.tsx:17,150,163,172,185`, `global.css:113-115` (hex w `bg-cosmic`). `.dark` zdefiniowany w `global.css:41-73`, nigdzie nie stosowany; `Layout.astro` renderuje gołe `<html lang="en">`.
- Token, który powinien pokryć: `text-white` → `text-foreground`; `text-blue-100/60|70|80` → `text-muted-foreground`; `bg-white/10`/`bg-white/5` + `border-white/10` → `bg-card` + `border-border` (lub `bg-muted`); `text-purple-300` → `text-primary` (wariant `link` w `button.tsx:19`); `bg-slate-900` → `bg-popover`/`bg-background`; hex `bg-cosmic` → wartość `--background` w `.dark`.
- Wpływ: każdy komponent shadcn dodany do widoku renderuje się w jasnych tokenach `:root` i trzeba go ręcznie przemalowywać (tak już się stało z `AlertDialog`); zmiana koloru marki wymaga edycji kilkunastu plików zamiast jednego bloku.

### C2 — Brakujący współdzielony komponent: błąd, karta i pole budowane ręcznie po kilka razy *(brakujący komponent)*

- Błąd: `dashboard.astro:72` (`rounded-xl px-4 py-3`, `role="alert"`), `dashboard.astro:82` (te same klasy, **bez** roli), `ServerError.tsx:11` (`rounded-lg px-3 py-2`, bez roli) — trzy warianty tego samego komunikatu → shadcn `Alert` (wariant `destructive`) lub jeden `ServerError` na tokenie `destructive`.
- Karta: `dashboard.astro:84,101,177` (`rounded-2xl|xl border-white/10 bg-white/10 backdrop-blur-xl`) oraz listy/komunikaty `:95,:113,:117,:141` (`bg-white/5`) → shadcn `Card`.
- Pole: `FormField.tsx:5-6` (`inputBase`) vs `SubscriptionForm.tsx:16-17` (`selectBase`) — prawie identyczne ciągi, które już dryfują (`pl-10`, placeholder, miejsce koloru ringu); etykieta `mb-1 block text-sm text-blue-100/80` powtórzona w `FormField.tsx:39`, `SubscriptionForm.tsx:150,172` → shadcn `Input` + `Label` (select natywny na tych samych tokenach).
- Przycisk główny: `SubmitButton.tsx:6-7` nakłada `bg-purple-600 hover:bg-purple-500` na `Button` w wariancie `default` (`bg-primary`, `button.tsx:12`), czyli wariant shadcn jest nadpisany literałem.
- Link „Edit” (`dashboard.astro:157-162`) to `<a>` z klasami linku, obok `Button` ghost/destructive dla Cancel/Delete (`SubscriptionActions.tsx:47-56`) — trzy akcje wiersza w dwóch różnych prymitywach.
- Wpływ: ten sam błąd wygląda różnie zależnie od tego, skąd przyszedł; czytnik ekranu ogłasza tylko błąd akcji na wpisie (`:72`), a pomija błąd ładowania (`:82`) i błąd formularza „Add” (`ServerError.tsx:11`).

### C3 — Focus-visible: brak widocznego fokusu na akcji destrukcyjnej i linkach *(stany: focus-visible)*

- Delete (wyzwalacz i potwierdzenie): wariant `destructive` daje `focus-visible:ring-destructive/20` (`button.tsx:14`) — ~1.2:1 względem tła (wyliczone z wartości oklch/hex, nie zmierzone w przeglądarce).
- Ghost Cancel, „Keep”, „Add subscription”: `focus-visible:ring-ring/50` (`button.tsx:8`) — `--ring` `oklch(0.708 0 0)` przy 50% krycia na `#0a0e1a` ≈ 2.7:1, poniżej 3:1 dla elementów nietekstowych (wyliczone).
- Linki „Edit” (`dashboard.astro:157-162`), „Dashboard”, „Sign out” i linki wylogowanego (`Topbar.astro:10,14,24,27`): brak własnego stylu fokusu; jedyne źródło to globalne `outline-ring/50` (`global.css:118-119`). Czy przeglądarka stosuje autorski `outline-color` do `outline-style: auto` — niezweryfikowane.
- Pola i selecty: `focus:outline-none focus:ring-2 focus:ring-purple-400` (`FormField.tsx:6,56`, `SubscriptionForm.tsx:17`) — widoczne, ale `focus:` zamiast `focus-visible:` i literał zamiast `--ring`.
- Wpływ: użytkownik klawiatury nie widzi, że fokus stoi na „Delete”, czyli na nieodwracalnej akcji; po Tab z pola formularza do linku w Topbar fokus znika wizualnie.

### C4 — Stany error/disabled/nazwy kontrolek nie są wyrażone semantycznie *(stany: error, disabled; dostępne nazwy)*

- Błędy pól: `FormField.tsx:50-65` renderuje komunikat `<p>` pod polem, ale input nie dostaje `aria-invalid` ani `aria-describedby`, a komunikat nie ma `id` (grep `aria-|role=` w `src/components/form/*`, `src/components/subscriptions/*`, `dashboard.astro`, `Topbar.astro` — jedyne trafienie to `dashboard.astro:72`). Kolor błędu literalny `red-300/400` zamiast `destructive`.
- Pending: spinner `SubmitButton.tsx:32` bez `role="status"`/`aria-live`; pola formularza pozostają edytowalne podczas wysyłki; „Sign out” (`Topbar.astro:13-16`) nie ma ochrony przed podwójnym wysłaniem.
- Nazwy: „Edit”, „Cancel”, „Delete” powtarzają się w każdym wierszu bez nazwy subskrypcji (`dashboard.astro:161`, `SubscriptionActions.tsx:47-56`) — na liście kilku wpisów czytnik ekranu podaje kilka identycznych przycisków.
- Natywny `type="date"` (`SubscriptionForm.tsx:195`) bez `color-scheme: dark` — ikona kalendarza prawdopodobnie ciemna na ciemnym polu (niezweryfikowane w przeglądarce).
- Wpływ: użytkownik czytnika ekranu nie dowiaduje się, które pole jest błędne ani że zapis trwa; na liście nie wie, którą subskrypcję usuwa, zanim otworzy dialog.

### C5 — Przypadkowa architektura: motyw rozsiany po komponentach, `.dark` na wrapperze nie dosięgnie dialogu *(przypadkowa architektura)*

- Motyw istnieje tylko jako kopiowane literały i `bg-cosmic`, używane na 6 stronach: `dashboard.astro:65`, `subscriptions/[id]/edit.astro:54`, `auth/signin.astro:9`, `auth/signup.astro:9`, `auth/confirm-email.astro:22`, `Welcome.astro:5`. Każdy nowy widok kopiuje paletę z sąsiedniego pliku, bo nie ma innego źródła.
- `AlertDialogContent` renderuje się w portalu do `document.body` (`alert-dialog.tsx:40-51`), więc `.dark` nałożone na wrapper wewnątrz `dashboard.astro` **nie** obejmie dialogu (wariant `dark` to `&:is(.dark *)`, `global.css:4`). Działa tylko `.dark` na `<html>` w `Layout.astro`.
- `Banner.astro:27-40` ma własną paletę hex (jasne `#dbeafe`/`#fef3c7`/`#fee2e2`) w scoped `<style>`, równoległą do tokenów; wyświetla się na każdej stronie przy braku konfiguracji.
- `Layout.astro:9` ma domyślny tytuł „10x Astro Starter”; `ui/LibBadge.astro` nie ma importerów.
- Reguła agenta: `CLAUDE.md` opisuje, gdzie żyją tokeny (sekcja „Rendering i runtime”), ale nie zakazuje literałów w widokach, a archiwalny plan S-03 (`plan.md:222`) jawnie przyjął „dopasowanie do ciemnego motywu przez `cn()`”, czyli nadpisywanie literałami.
- Wejście bez sesji: `/dashboard` → 302 na `/auth/signin` (zmierzone `curl` na wdrożeniu 2026-10-19); brak zarzutu.
- Wpływ: użytkownik widzi spójny wygląd tylko przypadkiem — dopóki ktoś kopiuje te same klasy; pierwszy komponent spoza tego wzoru (dialog, baner) wygląda jak z innej aplikacji.

## Detailed Findings

### Źródło → widoki

| Plik | Trafienia skanu | Klasy tokenów | Importy `components/ui` |
| --- | --- | --- | --- |
| `src/pages/dashboard.astro` | 17 | 0 | 0 |
| `src/components/Topbar.astro` | 7 | 0 | 0 |
| `src/components/Banner.astro` | 9 | 0 | 0 |
| `src/components/subscriptions/SubscriptionForm.tsx` | 5 | 0 | 0 |
| `src/components/subscriptions/SubscriptionActions.tsx` | 4 | 0 | 2 |
| `src/components/form/FormField.tsx` | 5 | 0 | 0 |
| `src/components/form/SubmitButton.tsx` | 2 | 0 | 1 |
| `src/components/form/ServerError.tsx` | 1 | 0 | 0 |
| `src/layouts/Layout.astro` | 0 | 0 | 0 |

Skan: regex z umiejętności `/10x-ui` (hex/rgb/hsl/oklch, arbitralne `-[Npx|rem]`, klasy palety Tailwind). Liczby trafień to linie, nie wystąpienia. „Klasy tokenów” = wystąpienia `(bg|text|border|ring)-(primary|secondary|muted|accent|destructive|background|foreground|card|popover|input|border|ring)(-foreground)?`. Baseline dla kolejnych faz: **50**.

`components/ui` zawiera dziś `button.tsx`, `alert-dialog.tsx` i nieużywany `LibBadge.astro`. `components.json`: `style: new-york`, `baseColor: neutral`, `cssVariables: true`.

### Wartości `.dark` (do decyzji D1/D3)

`.dark` jest paletą neutralną: `--background oklch(0.145 0 0)`, `--card oklch(0.205 0 0)`, `--primary oklch(0.922 0 0)` (prawie biały), `--muted-foreground oklch(0.708 0 0)`, `--destructive oklch(0.704 0.191 22.216)`, `--border oklch(1 0 0 / 10%)`, `--ring oklch(0.556 0 0)` (`global.css:41-73`). Samo włączenie `.dark` zamieni fioletowy akcent na neutralny biały i ciemniejszy ring — fokus (C3) bez dostrojenia `--ring` będzie jeszcze słabszy.

### Macierz 7 stanów — stan obecny

| Stan | Stan obecny | Dowód |
| --- | --- | --- |
| default | literały, 0 tokenów | tabela wyżej |
| hover | literały (`hover:bg-white/10`, `hover:text-purple-100`, `hover:bg-purple-500`); tokenowy tylko Delete (`hover:bg-destructive/90`); pola bez hover | `SubscriptionActions.tsx:52,66`, `Topbar.astro:10`, `SubmitButton.tsx:7`, `button.tsx:14` |
| focus-visible | patrz C3 | — |
| disabled | tylko `SubmitButton` podczas wysyłki (`disabled={pending}`, `opacity-50`) | `SubmitButton.tsx:27`, `useNativeFormPending.ts:16-24`, `button.tsx:8` |
| error | patrz C2/C4; błędy pól tylko po stronie klienta, czyszczone przy zmianie | `SubscriptionForm.tsx:76-111`, `FormField.tsx:61-65` |
| empty | istnieje: „No subscriptions yet” (0 wpisów), komunikaty w sekcji kosztu i odnowień; sekcja „All subscriptions” ukryta przy 0 wpisów | `dashboard.astro:83-89,94-97,112-115,138` |
| loading | N/A na poziomie strony: SSR czeka na select Supabase we frontmatterze (`dashboard.astro:37`) przed wysłaniem HTML; jedyny loading UI to spinner `SubmitButton` | `dashboard.astro:37`, `SubmitButton.tsx:30-34` |

Przed hydracją (`client:load`, `dashboard.astro:167`) wyzwalacze Cancel/Delete nie robią nic; formularz „Add” wysyła się natywnie (`noValidate`, `SubscriptionForm.tsx:120`), walidację robi serwer.

### Zasięg poza `/dashboard`

| Element | Konsumenci poza dashboardem |
| --- | --- |
| `Layout.astro` | wszystkie 6 stron (`index`, `auth/signin`, `auth/signup`, `auth/confirm-email`, `subscriptions/[id]/edit`) |
| `Topbar.astro` | `subscriptions/[id]/edit.astro:2`, `Welcome.astro:2` (strona `/`) |
| `SubscriptionForm.tsx` | `subscriptions/[id]/edit.astro:3` |
| `FormField.tsx` | `auth/SignInForm.tsx:3`, `auth/SignUpForm.tsx:3` |
| `SubmitButton.tsx` | `SignInForm.tsx:5`, `SignUpForm.tsx:5` |
| `ServerError.tsx` | `SignInForm.tsx:6`, `SignUpForm.tsx:6` |
| `bg-cosmic` | 5 stron poza dashboardem (lista w C5) |
| `SubscriptionActions.tsx`, `alert-dialog.tsx` | brak |

Strony poza dashboardem mają tę samą literalną paletę we własnym markupie (np. `auth/signin.astro:10,11,15,17`, `subscriptions/[id]/edit.astro:58,59,68,72`, `Welcome.astro:31,46,63`). Poprawa współdzielonych komponentów zmieni je częściowo; ich własny markup zostanie literalny.

### Ograniczenia testów i narzędzi

- `scripts/smoke.mjs:18` wyciąga id z regexu `href="\/subscriptions\/([0-9a-f-]{36})\/edit"` — link „Edit” musi pozostać `<a href="/subscriptions/<uuid>/edit">` z atrybutem dokładnie w tej postaci (decyzja potwierdzona w `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:230`). Smoke sprawdza też teksty `59,99` (`:129`), `Cancelled · ends` (`:155`) i nazwę w HTML (`:100,:126`).
- Testy vitest (4 pliki w `src/lib/**`) nie sprawdzają klas ani markupu.
- Playwright nie jest zależnością (`package.json`), pakietu nie ma w `node_modules`; przeglądarki są pobrane w `~/.cache/ms-playwright` (chromium-1223). Bramka wizualna wg `/10x-ui`: strona kitchen-sink + zrzuty, bez instalowania runnera tylko na potrzeby zmiany.
- Lokalny Supabase: pełny `supabase start` nie działa w tym środowisku (notatka w pamięci sesji), więc zrzuty zalogowanego dashboardu lokalnie wymagają albo kitchen-sinka na danych przykładowych, albo wdrożenia.

## Code References

- `src/styles/global.css:4` — `@custom-variant dark (&:is(.dark *))`
- `src/styles/global.css:6-39` — tokeny `:root` (jasne, neutralne)
- `src/styles/global.css:41-73` — tokeny `.dark` (nieużywane)
- `src/styles/global.css:75-111` — `@theme inline` publikuje `--color-*` przez `var()` (poprawnie, bez surowych kolorów)
- `src/styles/global.css:113-115` — `bg-cosmic` z hex
- `src/styles/global.css:117-123` — `outline-ring/50`, `body bg-background text-foreground`
- `src/components/ui/button.tsx:8` — bazowy focus `ring-ring/50` 3px; `:14` — `ring-destructive/20`
- `src/components/ui/alert-dialog.tsx:24` — overlay `bg-black/50`; `:40-51` — content w portalu
- `src/components/form/SubmitButton.tsx:6-7` — `PRIMARY_CLASSES` (fiolet startera)
- `src/components/form/FormField.tsx:5-6,39,50-65` — `inputBase`, etykieta, błąd bez ARIA
- `src/components/subscriptions/SubscriptionForm.tsx:16-17,150,172,195` — `selectBase`, etykiety, `type="date"`
- `src/components/subscriptions/SubscriptionActions.tsx:47-79` — wyzwalacze i dialog z nadpisaniami
- `src/pages/dashboard.astro:65-189` — markup widoku
- `src/components/Topbar.astro:5-27` — linki i wylogowanie
- `src/components/Banner.astro:27-40` — paleta hex
- `src/layouts/Layout.astro:9,14` — tytuł startera, `<html>` bez klasy
- `scripts/smoke.mjs:18` — regex linku Edit

## Architecture Insights

- `@theme inline` jest zbudowany poprawnie (wartości w `:root`/`.dark`, publikacja przez `var()`), więc zmiana motywu na warstwie tokenów zadziała, gdy tylko widoki zaczną czytać role.
- Komponent współdzielony = kontrakt: poprawka `FormField`/`SubmitButton`/`ServerError`/`Topbar` jest z definicji globalna. Zasada „jeden widok na zmianę” dotyczy markupu widoku; współdzielone komponenty, których widok używa, zmieniają się razem z nim, a strony auth/edit wymagają tylko kontroli regresji.
- Nadpisywanie wariantów shadcn przez `className` (`cn()` + twMerge) usuwa klasy wariantu, ale **nie** usuwa klas `dark:` z wariantu (`button.tsx:14,16,18`) — po włączeniu `.dark` zaczną konkurować z literalnymi nadpisaniami w `SubscriptionActions.tsx:52,66`. Wniosek z odczytu kodu, nie zbudowane i nie sprawdzone.

## Historical Context (from prior changes)

- `context/archive/2026-10-02-home-screen-cost-and-renewals/plan.md:244` — „Zachowane: `Topbar` … i styl „glass” istniejących stron”: decyzja, by kontynuować wygląd startera (poparte).
- `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:212-214` — `alert-dialog` dodany przez `npx shadcn@latest add`, bez ręcznych zmian (poparte, plik zgodny).
- `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:222` — kolory dialogu dopasowane literałami przez `cn()` (poparte: `SubscriptionActions.tsx:58,61,66`). To źródło części C1/C5.
- `context/archive/2026-10-19-subscription-delete-and-cancel/reviews/impl-review.md:51-53` (F2) — `alert-dialog.tsx` importuje pakiet zbiorczy `radix-ui`, `button.tsx` `@radix-ui/react-slot`; ujednolicenie importów odroczone „do następnego komponentu shadcn”. Dodanie `Card`/`Input`/`Label`/`Alert` w tej zmianie uruchamia ten odroczony punkt.
- `context/archive/2026-10-19-subscription-delete-and-cancel/reviews/impl-review.md:55-67` (F3) — powstanie `useNativeFormPending` i `PRIMARY_CLASSES`; fiolet przeniesiony z bootstrapu bez decyzji o kolorze (poparte, commit `84e1884`).
- `context/foundation/prd.md:65` — US-01: „Brak subskrypcji pokazuje czytelny stan pusty” (wymaganie; spełnione przez `dashboard.astro:83-89`).
- `context/foundation/prd.md:97` — jedyne NFR to prywatność; brak NFR dostępności. W `context/` nie znaleziono wpisu, że polerowanie UI jest non-goal (sprawdzone: PRD Non-Goals `prd.md:113-119`, wszystkie archiwalne `impl-review.md`).
- `context/foundation/roadmap.md:12,23,35` — M-1 zamknięty 2026-10-19, M-2 nieotwarty; jedyny zaparkowany element z nowym UI to FR-010 (`roadmap.md:141`).

## Related Research

- Brak wcześniejszych `research.md` o UI w `context/changes/**` i `context/archive/**`.

## Open Questions

Decyzje do `/10x-plan` (fakty wyżej, wybór należy do uczestnika):

- **D1 — gdzie włączyć `.dark`:** na `<html>` w `Layout.astro` (obejmuje portal dialogu i wszystkie strony; `body` też staje się ciemne) vs wrapper w `dashboard.astro` (dialog zostaje na jasnych tokenach — C5). Rekomendacja: `<html class="dark">`, bo wszystkie 6 stron i tak są ciemne.
- **D2 — `bg-cosmic`:** zastąpić wartością `--background` w `.dark` (płaski kolor) vs zachować gradient jako utility zbudowaną z tokenów.
- **D3 — akcent marki:** zostawić neutralne `--primary oklch(0.922 0 0)` z `.dark` vs ustawić fioletowe `--primary`/`--ring` (kontynuacja obecnego wyglądu); w obu przypadkach `--ring` musi dać ≥3:1 na `--background` (C3).
- **D4 — zasięg współdzielonych komponentów:** przyjąć, że `/auth/*`, `/` i edit zmienią się przez `FormField`/`SubmitButton`/`ServerError`/`Topbar` (kontrola regresji zrzutem), a ich własny markup zostaje odroczony do osobnej zmiany.
- **D5 — kitchen sink:** gdzie umieścić stronę stanów, żeby nie była publiczną trasą na produkcji (np. tylko w `import.meta.env.DEV` albo pod chronionym prefiksem z `PROTECTED_ROUTES`).
- Niezweryfikowane w przeglądarce: kontrast ringów (wyliczony), widoczność ikony `type="date"`, zachowanie `outline-color` przy `outline-style: auto`, konflikt klas `dark:` z nadpisaniami.
