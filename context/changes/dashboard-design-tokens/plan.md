# Dashboard design tokens — plan implementacji

## Overview

Wszystkie 6 stron aplikacji (`/dashboard` jako widok wiodący oraz `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/subscriptions/[id]/edit`) przechodzą z literalnej ciemnej palety startera („cosmic”) na **jasne, neutralne tokeny shadcn** z `:root` w `src/styles/global.css` i komponenty z `src/components/ui/`. Zmiana dodatkowo domyka 7-stanową macierz (z naciskiem na focus-visible i semantykę błędów), dodaje stronę kitchen sink dostępną tylko w trybie dev i zostawia regułę oraz kontrolę lint, która pilnuje kontraktu.

Dowody i zarzuty C1–C5: `context/changes/dashboard-design-tokens/research.md` (`## Charges`).

## Current State Analysis

- Tokeny shadcn są kompletne i poprawnie publikowane (`global.css:6-39` `:root`, `:41-73` `.dark`, `:75-111` `@theme inline` przez `var()`), ale w 8 plikach widoku dashboardu skan literałów daje **50** trafień i **0** użyć klas tokenów. Klasy tokenów występują w `src/` wyłącznie w `ui/button.tsx` i `ui/alert-dialog.tsx`.
- Ciemny wygląd to `div.bg-cosmic` (`global.css:113-115`, hex) + literały (`text-white`, `bg-white/10`, `text-blue-100/60`, `purple-*`, `red-*`) na 6 stronach; `body` już ma `bg-background text-foreground` (`global.css:121-122`), tylko jest przykryty.
- Współdzielone komponenty niosą paletę w sobie: `FormField.tsx:5-6,39,43,56,62`, `SubmitButton.tsx:6-7,32`, `ServerError.tsx:11`, `SubscriptionForm.tsx:16-17,150,163,172,185`, `Topbar.astro:5-27`, `PasswordToggle.tsx:13`; `SubscriptionActions.tsx:52,58,61,66` nadpisuje warianty shadcn literałami.
- Focus: `ui/button.tsx:8` `ring-ring/50`, `:14` `ring-destructive/20`; globalne `outline-ring/50` (`global.css:118-119`); pola używają `focus:ring-purple-400`. Na białym tle `--ring oklch(0.708 0 0)` przy 50% ≈ 1.9:1 (wyliczone).
- Błędy: brak `aria-invalid`/`aria-describedby` na polach (`FormField.tsx:50-65`), 3 różne pudełka błędu, `role="alert"` tylko w `dashboard.astro:72`.
- `scripts/smoke.mjs:18` wyciąga id regexem `href="\/subscriptions\/([0-9a-f-]{36})\/edit"`; sprawdza też teksty `59,99` (`:129`), `Cancelled · ends` (`:155`), obecność/brak nazwy (`:100,:126,:170`) i 200 na `/` (`:56`).
- CI: `.github/workflows/ci.yml:77-80` ma job deploy (`wrangler deploy`) — push na `master` wdraża.
- `components.json`: `new-york`, `baseColor: neutral`. `ui/button.tsx` importuje `@radix-ui/react-slot`, `ui/alert-dialog.tsx` pakiet zbiorczy `radix-ui` (odroczone F2 z `context/archive/2026-10-19-subscription-delete-and-cancel/reviews/impl-review.md:51-53`).

## Desired End State

- Każda strona renderuje się na jasnym `bg-background` z tekstem `text-foreground`/`text-muted-foreground`, kartami `Card`, polami `Input` + `Label`, komunikatami błędu `Alert` (wariant `destructive`) i akcjami `Button`. `bg-cosmic` nie istnieje w repo.
- Skan literałów (regex z `/10x-ui`, patrz „Skan” niżej) na `src/pages/**/*.astro` i `src/components/**/*.{astro,tsx}` poza `src/components/ui/**` daje **0** trafień i jest częścią `npm run lint`.
- Każda kontrolka ma widoczny focus-visible w kolorze `--ring` (pełne krycie), dostępną nazwę zawierającą nazwę subskrypcji tam, gdzie akcja dotyczy wiersza, a błędy pól są powiązane przez `aria-invalid` + `aria-describedby`.
- `/dev/dashboard-states` (tylko `import.meta.env.DEV`) pokazuje 7 stanów widoku dashboardu na danych przykładowych; na produkcji zwraca 404.
- `CLAUDE.md` ma blok UI wskazujący tokeny, komponenty, kitchen sink i zakaz literałów.

Weryfikacja: `npm run lint` (z kontrolą literałów), `npm test`, `npx astro check`, `npm run build`, smoke w CI, zrzuty desktop 1280 px i mobile 375 px z kitchen sinka i każdej strony.

### Key Discoveries:

- `@theme inline` jest gotowy — wystarczy, że widoki zaczną używać ról (`global.css:75-111`).
- Portal dialogu renderuje się pod `document.body` (`alert-dialog.tsx:40-51`), więc jasne tokeny `:root` obejmą go bez żadnej klasy — literalne nadpisania w `SubscriptionActions.tsx:58,61,66` można po prostu usunąć.
- Link „Edit” musi zachować atrybut `href="/subscriptions/<uuid>/edit"` (`smoke.mjs:18`; decyzja w `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:230`).
- Przeglądarki Playwright są w `~/.cache/ms-playwright` (m.in. `chromium_headless_shell-1223`); pakiet nie jest zależnością repo — zrzuty robimy binarką headless (`--screenshot --window-size=…`), bez dodawania zależności.
- Lokalny `supabase start` nie działa w tym środowisku (kong 499), więc zalogowany dashboard lokalnie oglądamy przez kitchen sink na fixture'ach; prawdziwy przepływ sprawdza smoke w CI.

## What We're NOT Doing

- Brak motywu ciemnego i przełącznika: `.dark` w `global.css` zostaje nietknięty i nieużywany.
- Brak koloru marki: `--primary` i reszta `:root` zostają neutralne shadcn; jedyna zmiana wartości to `--ring` (kontrast fokusu).
- Bez shadcn `Select` — selecty zostają natywne (natywny POST formularza, bez ukrytych inputów), tylko na klasach tokenów.
- Bez zmian treści/copy stron (w tym marketingowego tekstu `Welcome.astro`), routingu, endpointów, walidacji i logiki domenowej.
- Bez Playwright jako zależności i bez testów `toHaveScreenshot`; bramka wizualna = kitchen sink + zrzuty.
- Bez usuwania nieużywanego `ui/LibBadge.astro` i bez porządków poza zakresem (np. domyślne kopie startera w README).
- Bez macierzy responsywności — desktop 1280 px + jedna szerokość mobilna 375 px.

## Implementation Approach

Kolejność z `/10x-ui`: biblioteka → wartości tokenów → widok → stany, plus faza pozostałych stron (decyzja: wszystkie 6 stron w tej zmianie) i faza zabezpieczenia. Fazy 1–2 nie zmieniają wyglądu stron (poza pierścieniem fokusu i banerem). Faza 3 przełącza dashboard i współdzielone komponenty na jasne tokeny — od tego momentu strony auth/edit/`/` są niespójne aż do końca fazy 4.

## Critical Implementation Details

- **Nie pushuj między fazą 3 a końcem fazy 4.** Push na `master` wdraża (`ci.yml:77-80`), a po fazie 3 współdzielone komponenty są jasne (ciemny tekst), podczas gdy strony auth wciąż leżą na ciemnym `bg-cosmic` — formularz logowania byłby nieczytelny na produkcji. Commity faz 3 i 4 zostają lokalnie i idą razem.
- **`bg-cosmic` usuwamy dopiero w fazie 4**, po zdjęciu klasy ze wszystkich 6 stron; wcześniejsze usunięcie utility daje biały tekst na białym tle.
- **Pierścienie fokusu w `ui/*`:** komponenty shadcn są w repo po to, by je dostosowywać; zmiana krycia ringów to świadoma edycja kontraktu (zapisana w regule w fazie 6), a nie „ręczna poprawka do cofnięcia”.

## Faza 1: Biblioteka komponentów

### Overview

Dodanie brakujących prymitywów shadcn używanych przez widoki i domknięcie odroczonego F2 (spójny styl importów radix). Bez zmian wizualnych na stronach.

### Changes Required:

#### 1. Nowe komponenty shadcn

**File**: `src/components/ui/card.tsx`, `input.tsx`, `label.tsx`, `alert.tsx` (nowe)

**Intent**: Dodać komponenty, które zastąpią ręcznie budowane karty, pola, etykiety i pudełka błędu (C2), ścieżką stosu, nie ręcznie.

**Contract**: `npx shadcn@latest add card input label alert` (styl `new-york` z `components.json`); pliki bez zmian poza tym, czego wymaga lint/format. `label` korzysta z radix — import z pakietu zbiorczego `radix-ui`, jak w `alert-dialog.tsx`.

#### 2. Ujednolicenie importów radix (F2)

**File**: `src/components/ui/button.tsx`, `package.json`, `package-lock.json`

**Intent**: Przenieść `Slot` na import z pakietu `radix-ui`, tak jak robią to pozostałe komponenty, i usunąć z zależności `@radix-ui/react-slot`, jeśli nic innego go nie importuje.

**Contract**: `button.tsx` importuje `Slot` z `"radix-ui"`; `grep -rn "@radix-ui/" src` pusty; API `Button` (props `variant`, `size`, `asChild`) bez zmian.

### Success Criteria:

#### Automated Verification:

- Pliki `src/components/ui/{card,input,label,alert}.tsx` istnieją
- `grep -rn "@radix-ui/" src` nie zwraca trafień
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- `/auth/signin` w `npm run dev` wygląda tak samo jak przed fazą

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne.

---

## Faza 2: Wartości tokenów

### Overview

Ustawienie wartości i zachowania, które później czytają widoki: kontrastowy `--ring`, pełne pierścienie fokusu w `ui/*` i warstwie bazowej, baner i layout na tokenach. Strony nadal ciemne (literały zostają do faz 3–4).

### Changes Required:

#### 1. `--ring` i warstwa bazowa

**File**: `src/styles/global.css`

**Intent**: Dać fokusowi kontrast ≥3:1 na `--background` (biały) przy zachowaniu neutralnej palety (C3) oraz zapisać obok bloku, skąd pochodzą wartości.

**Contract**: w `:root` `--ring: oklch(0.556 0 0)` (≈ #737373, ≈4.7:1 na białym; wyliczyć i zapisać w `context/changes/dashboard-design-tokens/tokens.md`); w `@layer base` `outline-ring/50` → `outline-ring`. Komentarz nad `:root`: wartości = shadcn `new-york`/`neutral`, wyjątek `--ring` z odnośnikiem do `tokens.md`. `.dark` bez zmian.

#### 2. Pierścienie fokusu w komponentach `ui`

**File**: `src/components/ui/button.tsx`, `input.tsx`, `alert-dialog.tsx` (i każdy inny plik `ui/*.tsx` z ringiem o obniżonym kryciu)

**Intent**: Usunąć obniżone krycie ringu, które daje niewidoczny fokus (Delete ≈1.2:1 dziś).

**Contract**: `focus-visible:ring-ring/50` → `focus-visible:ring-ring`; `focus-visible:ring-destructive/20` i `dark:focus-visible:ring-destructive/40` → `focus-visible:ring-destructive`. Klasy `aria-invalid:ring-destructive/…` zostają (to stan błędu, nie fokus). Szerokość `ring-[3px]` bez zmian.

#### 3. Banner i Layout

**File**: `src/components/Banner.astro`, `src/layouts/Layout.astro`

**Intent**: Baner konfiguracji przestaje mieć własną paletę hex (C5); domyślny tytuł przestaje być nazwą startera.

**Contract**: `Banner.astro` — warianty `info|warning|error` na tokenach (`var(--muted)`/`var(--foreground)`/`var(--border)`, `error` na `var(--destructive)`; `warning` na `var(--chart-4)` lub `var(--muted)` + `var(--border)` — bez nowych tokenów), styl scoped może zostać, ale bez literałów kolorów. `Layout.astro` — domyślne `title = "Subtracker"`.

### Success Criteria:

#### Automated Verification:

- `grep -nE '#[0-9a-fA-F]{3,8}\b' src/components/Banner.astro` nie zwraca trafień
- `grep -rnE 'ring-(ring|destructive)/[0-9]+' src/components/ui` nie zwraca trafień dla wariantów `focus-visible:`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Fokus z klawiatury (Tab) na przyciskach strony `/auth/signin` jest widoczny
- Baner (uruchomienie bez `.dev.vars`/`.env`) jest czytelny

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne.

---

## Faza 3: Widok dashboardu

### Overview

`/dashboard` i komponenty, które renderuje, przechodzą na tokeny i komponenty `ui` (C1, C2, C5). Markup widoku zostaje wydzielony do komponentu przyjmującego dane, żeby kitchen sink (faza 5) renderował dokładnie ten sam widok na fixture'ach. **Bez pusha po tej fazie.**

### Changes Required:

#### 1. Wydzielenie widoku

**File**: `src/pages/dashboard.astro`, `src/components/dashboard/DashboardView.astro` (nowy), `src/lib/format.ts` (nowy)

**Intent**: Strona zostaje odpowiedzialna za dane (query Supabase, `?error=`, wyliczenia), a markup przenosi się do komponentu z propsami — warunek kitchen sinka na fixture'ach bez Supabase.

**Contract**: `DashboardView` props: `pageError: string | null`, `loadError: string | null`, `subscriptions: Subscription[]`, `today: string`, `formError: string | null`, `initialValues` (typ jak dziś przekazywany do `SubscriptionForm`); sam liczy `costs`/`renewals`/sortowanie tymi samymi funkcjami z `src/lib/services/subscriptions.ts` albo dostaje je w propsach (wybór implementującego, byle jedna ścieżka). `formatMoney`/`formatDate` (`dashboard.astro:53-61`) przenoszą się bez zmiany zachowania do `src/lib/format.ts`. Teksty, `pl-PL` i struktura sekcji bez zmian.

#### 2. Markup dashboardu na tokenach i komponentach

**File**: `src/components/dashboard/DashboardView.astro`, `src/pages/dashboard.astro`

**Intent**: Zastąpić literały rolami i ręczne karty/błędy komponentami (C1, C2).

**Contract**: wrapper bez `bg-cosmic` (tło z `body`); karty sekcji i kafelki kosztu → `Card` (`CardHeader`/`CardContent`); listy → `Card` z `divide-y divide-border`; teksty pomocnicze → `text-muted-foreground`; nagłówek `h1` → `text-foreground` (bez gradientu); `pageError` i `loadError` → `Alert variant="destructive"` z `role="alert"` (oba); link „Edit” → `Button asChild variant="ghost" size="sm"` wokół `<a href={`/subscriptions/${id}/edit`}>` — atrybut `href` w dokładnie tej postaci. Komponenty `.tsx` w `.astro` bez dyrektywy `client:*` (renderowane statycznie), poza istniejącymi wyspami.

#### 3. Komponenty współdzielone

**File**: `src/components/Topbar.astro`, `src/components/form/FormField.tsx`, `SubmitButton.tsx`, `ServerError.tsx`, `src/components/subscriptions/SubscriptionForm.tsx`, `SubscriptionActions.tsx`

**Intent**: Usunąć literały z komponentów, które widok renderuje; z definicji zmieni to też strony auth/edit/`/` (dokończone w fazie 4).

**Contract**:
- `Topbar.astro`: kontener `Card`/`border-border bg-card`, e-mail `text-muted-foreground`, linki i „Sign out” jako `Button` `variant="link"` (`asChild` dla `<a>`), formularz POST bez zmian.
- `FormField.tsx`: `Label` + `Input`; ikona `text-muted-foreground`; błąd przez `aria-invalid` na `Input` (styl błędu daje wariant `aria-invalid:` z `input.tsx`), komunikat `text-destructive`. API props bez zmian.
- `SubscriptionForm.tsx`: `selectBase` na tych samych klasach tokenów co `Input` (`border-input bg-transparent`, `focus-visible:ring-ring`), etykiety → `Label`, `<option>` bez `bg-slate-900`.
- `SubmitButton.tsx`: usunięcie `PRIMARY_CLASSES`; bez `variant` = wariant `default` (`bg-primary`) + `w-full`; spinner na `border-primary-foreground/30 border-t-primary-foreground` (lub `currentColor`), bez `white`. API props bez zmian.
- `ServerError.tsx`: `Alert variant="destructive"` (`AlertDescription`), API props bez zmian.
- `SubscriptionActions.tsx`: usunięcie wszystkich nadpisań kolorów z wyzwalaczy, `AlertDialogContent`, `AlertDialogDescription` i `AlertDialogCancel` — wyglądają tak, jak dają warianty i tokeny.

### Success Criteria:

#### Automated Verification:

- Skan literałów (regex w „Skan”) na `src/pages/dashboard.astro src/components/dashboard/*.astro src/components/Topbar.astro src/components/form/*.tsx src/components/subscriptions/*.tsx` = 0 trafień
- `grep -n 'bg-cosmic' src/pages/dashboard.astro src/components/dashboard/*.astro` pusty
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Zrzut dashboardu desktop 1280 px i mobile 375 px — jasny, czytelny, bez poziomego scrolla na 375 px
  (kitchen sink powstaje w fazie 5; tu `npm run dev` z fixture'ami wpiętymi tymczasowo albo `.dev.vars` wskazujące na zdalny projekt — wybór implementującego)
- Dialog Cancel/Delete otwiera się w jasnych tokenach, „Keep” i potwierdzenie czytelne

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne. Commit lokalnie, **bez push**.

---

## Faza 4: Pozostałe strony

### Overview

Strony `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` i `/subscriptions/[id]/edit` oraz wyspy auth przechodzą na tokeny; `bg-cosmic` znika z repo. Po tej fazie aplikacja jest spójnie jasna i commity faz 3–4 mogą zostać wypchnięte.

### Changes Required:

#### 1. Strony auth i confirm-email

**File**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`, `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`, `PasswordToggle.tsx`

**Intent**: Usunąć literały i `bg-cosmic`, użyć `Card` dla panelu formularza i `Button variant="link"` dla linków.

**Contract**: ten sam słownik ról co w fazie 3 (tekst `text-foreground`/`text-muted-foreground`, nagłówki bez gradientu, linki `variant="link"`); `PasswordToggle` jako `Button variant="ghost" size="icon"` lub z klasami tokenów, z istniejącym `aria-label`. Teksty i akcje formularzy bez zmian.

#### 2. Strona edycji

**File**: `src/pages/subscriptions/[id]/edit.astro`

**Intent**: Te same zamiany; komunikat błędu ładowania → `Alert variant="destructive"` z `role="alert"`, stan „Subscription not found” → `Card`.

**Contract**: link „Back to dashboard” (`:59`, `:91`) jako `Button variant="link"` z `asChild`; struktura i teksty bez zmian.

#### 3. Strona startowa

**File**: `src/components/Welcome.astro`, `src/pages/index.astro`

**Intent**: Treść startera zostaje, kolory i karty przechodzą na tokeny/komponenty.

**Contract**: CTA z `bg-purple-600` → `Button` (`asChild` dla linku), karty → `Card`, teksty `text-muted-foreground`.

#### 4. Usunięcie `bg-cosmic`

**File**: `src/styles/global.css`

**Intent**: Usunąć utility, gdy nic jej już nie używa.

**Contract**: blok `@utility bg-cosmic` (`global.css:113-115`) usunięty; `grep -rn bg-cosmic src` pusty.

### Success Criteria:

#### Automated Verification:

- Skan literałów na `src/pages/**/*.astro` i `src/components/**/*.{astro,tsx}` poza `src/components/ui/**` = 0 trafień
- `grep -rn 'bg-cosmic' src` nie zwraca trafień
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Zrzuty desktop 1280 px i mobile 375 px stron `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` — jasne, czytelne, bez poziomego scrolla
- Strona edycji (stan „not found” lokalnie, formularz po wdrożeniu) — jasna i czytelna
- Smoke w CI zielony po pushu commitów faz 3–4

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne. Dopiero teraz commity faz 3–4 mogą trafić na `master` (push wykonuje człowiek).

---

## Faza 5: Stany, dostępność i kitchen sink

### Overview

Domknięcie 7-stanowej macierzy: focus-visible na każdej kontrolce (C3), semantyka błędów i wysyłki oraz dostępne nazwy akcji wiersza (C4), strona kitchen sink w trybie dev jako bramka wizualna.

### Changes Required:

#### 1. Semantyka błędów pól

**File**: `src/components/form/FormField.tsx`, `src/components/subscriptions/SubscriptionForm.tsx`

**Intent**: Czytnik ekranu ma wiedzieć, które pole jest błędne i dlaczego.

**Contract**: przy błędzie `Input`/`select` dostaje `aria-invalid="true"` i `aria-describedby="<id>-error"`; komunikat ma `id="<id>-error"`. Bez błędu oba atrybuty nieobecne. Dotyczy też formularzy auth (wspólny `FormField`).

#### 2. Błędy serwera i stan wysyłki

**File**: `src/components/form/ServerError.tsx`, `src/components/form/SubmitButton.tsx`

**Intent**: Błąd formularza jest ogłaszany; trwający zapis jest ogłaszany, a nie tylko pokazany spinnerem.

**Contract**: `ServerError` z `role="alert"`; `SubmitButton` w stanie `pending` ma `aria-busy="true"`, spinner `aria-hidden`, a tekst `pendingText` jest w regionie `role="status"` (lub `aria-live="polite"`). Wygląd disabled = `disabled:opacity-50` z wariantu, nadal czytelny.

#### 3. Nazwy akcji wiersza

**File**: `src/components/dashboard/DashboardView.astro`, `src/components/subscriptions/SubscriptionActions.tsx`

**Intent**: Na liście kilku wpisów każda akcja mówi, której subskrypcji dotyczy.

**Contract**: „Edit”, „Cancel”, „Delete” zachowują widoczny tekst, a dostępna nazwa zawiera nazwę subskrypcji (np. `<span class="sr-only"> {name}</span>` po widocznym tekście lub `aria-label="Edit {name}"`). Atrybut `href` linku Edit bez zmian (`smoke.mjs:18`); `smoke.mjs:170` (nazwa usuniętej subskrypcji nieobecna) nadal spełnione, bo wiersz znika razem z akcjami.

#### 4. Focus-visible na linkach i natywnych kontrolkach

**File**: `src/components/Topbar.astro`, `src/components/subscriptions/SubscriptionForm.tsx`, `src/styles/global.css`

**Intent**: Każda kontrolka (także linki i natywny `select`/`input type="date"`) ma widoczny fokus w kolorze `--ring`, tylko przy nawigacji klawiaturą.

**Contract**: kontrolki są `Button`/`Input` (fokus z wariantu) albo mają `focus-visible:ring-[3px] focus-visible:ring-ring` / `outline-ring`; żadnego `focus:` bez `-visible` dla stylu fokusu. `:root` dostaje `color-scheme: light`, żeby natywne kontrolki (ikona kalendarza) pasowały do motywu.

#### 5. Kitchen sink

**File**: `src/pages/dev/dashboard-states.astro` (nowy), `src/components/dashboard/fixtures.ts` (nowy)

**Intent**: Jeden widok, każdy stan widoczny naraz — dowód do przeglądu i bramka wizualna bez Supabase i bez logowania.

**Contract**: strona zwraca 404, gdy `import.meta.env.DEV` jest fałszywe (przed renderem, przez `return new Response(null, { status: 404 })` w frontmatterze — nie `Astro.redirect`), i nie jest w `PROTECTED_ROUTES`. Renderuje `DashboardView` w sekcjach: **default** (fixture z aktywną, anulowaną-ale-liczoną i anulowaną-wygasłą subskrypcją, 2 waluty), **empty** (0 wpisów), **error** (`loadError`, `pageError`, `formError` z przeniesionymi wartościami), oraz panel prymitywów: `Button` (wszystkie warianty) w stanie zwykłym i `disabled`, `Input` zwykły i z `aria-invalid` + komunikatem, `SubmitButton` w stanie pending (prop lub wrapper tylko dla kitchen sinka — bez zmiany publicznego API). Hover/focus-visible: kontrolki w sekcji default, sprawdzane klawiaturą/myszą. Loading: sekcja z opisem „N/A — SSR czeka na dane przed wysłaniem HTML (`dashboard.astro` frontmatter); jedyny loading UI to pending `SubmitButton`” i jego przykładem. Fixture'y używają typu `Subscription` z `src/types.ts` i dat względnych wobec `todayInWarsaw`.

### Success Criteria:

#### Automated Verification:

- `npm run build` przechodzi, a w `npm run preview` żądanie `GET /dev/dashboard-states` zwraca 404
- W `npm run dev` żądanie `GET /dev/dashboard-states` zwraca 200
- `grep -rnE '\bfocus:(ring|border|outline)' src/components src/pages` nie zwraca trafień
- Skan literałów na plikach z fazy 4 + `src/pages/dev/*.astro` + `src/components/dashboard/*` = 0
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy przechodzą: `npm test`

#### Manual Verification:

- Kitchen sink, zrzuty desktop 1280 px i mobile 375 px: każda komórka macierzy 7 stanów pokazana albo oznaczona N/A z powodem
  (stany: default, hover, focus-visible, disabled, error, empty, loading)
- Tab przez cały dashboard: fokus widoczny na każdej kontrolce, w tym na „Delete” i linkach
  (kolejność: Topbar → formularz → akcje wiersza → dialog)
- Czytnik ekranu lub drzewo dostępności: błąd pola opisany, przyciski wiersza z nazwą subskrypcji, zapis ogłasza stan

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne.

---

## Faza 6: Zabezpieczenie kontraktu

### Overview

Reguła dla kolejnego agenta i kontrola, która nie pozwoli wrócić do literałów.

### Changes Required:

#### 1. Kontrola literałów

**File**: `scripts/check-ui-literals.mjs` (nowy), `package.json`

**Intent**: Nieudana kontrola zamiast reguły, o której agent zapomni; bez nowych zależności.

**Contract**: skrypt Node (moduły `node:fs`/`node:path`) skanuje `src/pages/**/*.astro` i `src/components/**/*.{astro,tsx}` z wyłączeniem `src/components/ui/**`, regexem „Skan” niżej; wypisuje `plik:linia: dopasowanie` i kończy kodem 1 przy ≥1 trafieniu. `package.json` `"lint": "eslint . && node scripts/check-ui-literals.mjs"` — CI (`ci.yml:20`) uruchamia go przez `npm run lint`. Lint-staged bez zmian. Skrypt podlega `scriptsConfig` w `eslint.config.js` (bez type-check).

#### 2. Reguła UI w `CLAUDE.md`

**File**: `CLAUDE.md` (sekcja „Architektura → Rendering i runtime” lub nowa podsekcja „UI”)

**Intent**: Kolejny agent wie, gdzie są tokeny i komponenty, i że literały są zabronione.

**Contract**: krótki blok: tokeny w `src/styles/global.css` (`:root` = jasny motyw; `.dark` nieużywany), komponenty w `src/components/ui/` — sprawdź tam przed utworzeniem komponentu, brakujące dodaj `npx shadcn@latest add <name>`; w widokach żadnych klas palety, hex/rgb/oklch ani wartości arbitralnych `-[Npx]` — używaj ról (`bg-card`, `text-muted-foreground`, `text-destructive`); pierścienie fokusu w `ui/*` mają pełne krycie `--ring` (nie przywracaj `/50`); kitchen sink: `/dev/dashboard-states` (tylko dev) — nowy stan widoku dodaj tam; kontrola: `npm run lint` uruchamia `scripts/check-ui-literals.mjs`. Usunąć/przepisać zdanie w „Rendering i runtime” sugerujące, że kolory żyją tylko w `global.css` bez zakazu literałów, jeśli koliduje. Poza blokiem `<!-- BEGIN/END @przeprogramowani/10x-cli -->` (w pliku go nie ma).

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi (eslint + kontrola literałów)
- Kontrola łapie regresję: tymczasowe `text-white` w `src/pages/dashboard.astro` daje kod wyjścia 1 z `plik:linia`
  (zmiana cofnięta po sprawdzeniu)
- `grep -n 'check-ui-literals' package.json CLAUDE.md` zwraca trafienia w obu plikach

#### Manual Verification:

- Blok UI w `CLAUDE.md` jest zwięzły i wskazuje tokeny, komponenty, kitchen sink i kontrolę

**Implementation Note**: Po fazie zatrzymaj się na potwierdzenie ręczne; następnie `/10x-impl-review dashboard-design-tokens`.

---

## Skan

Regex wartości zakodowanych na sztywno (z `/10x-ui`), używany w kryteriach faz i w `scripts/check-ui-literals.mjs`:

```
#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b
```

Baseline (8 plików dashboardu, 2026-10-19): 50 linii z trafieniem. Liczba ma spadać faza po fazie; wzrost to regresja.

## Testing Strategy

### Unit Tests:

- `src/lib/format.ts`: `formatMoney` (np. `59.99`, `PLN` → zawiera `59,99`) i `formatDate` (`2026-10-19` → data `pl-PL` bez przesunięcia strefy) — zachowanie przeniesione z `dashboard.astro:53-61`.
- Brak testów komponentów (zgodnie z wcześniejszymi zmianami; wyspy testuje smoke i ręczna weryfikacja).

### Integration Tests:

- `scripts/smoke.mjs` w CI bez zmian — przepływ auth, dodanie, edycja, anulowanie, usunięcie po HTTP; potwierdza, że restyle nie zepsuł `href` linku Edit ani tekstów.

### Manual Testing Steps:

1. `npm run dev` → `/dev/dashboard-states`: przejrzyj 7 stanów, zrób zrzuty 1280 px i 375 px (`chrome-headless-shell --screenshot --window-size=1280,2400` / `375,2400` z `~/.cache/ms-playwright`).
2. Tab przez wszystkie kontrolki kitchen sinka i `/auth/signin`; potwierdź widoczny fokus.
3. Otwórz dialog Delete, sprawdź fokus na „Keep”/„Delete”, Esc zamyka i wraca fokus.
4. Po pushu faz 3–4: na wdrożeniu zaloguj się, przejdź dashboard → edit → cancel → delete i porównaj ze zrzutami.

## Performance Considerations

Brak istotnych: zmiana klas CSS i kilku komponentów statycznych; nowe komponenty `ui` renderują się w SSR bez dodatkowych wysp poza istniejącymi.

## Migration Notes

Brak danych do migracji. Wycofanie = revert commitów zmiany; commity faz 3–4 trzeba cofać razem.

## References

- Research: `context/changes/dashboard-design-tokens/research.md` (zarzuty C1–C5, macierz stanów, zasięg)
- Zmiana: `context/changes/dashboard-design-tokens/change.md`
- Odroczone F2: `context/archive/2026-10-19-subscription-delete-and-cancel/reviews/impl-review.md:51-53`
- Dodanie shadcn w poprzedniej zmianie: `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:212-214`
- Ograniczenie linku Edit: `scripts/smoke.mjs:18`, `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:230`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Biblioteka komponentów

#### Automated

- [x] 1.1 Pliki `src/components/ui/{card,input,label,alert}.tsx` istnieją — 031905a
- [x] 1.2 `grep -rn "@radix-ui/" src` nie zwraca trafień — 031905a
- [x] 1.3 Lint przechodzi: `npm run lint` — 031905a
- [x] 1.4 Typy przechodzą: `npx astro check` — 031905a
- [x] 1.5 Testy przechodzą: `npm test` — 031905a
- [x] 1.6 Build przechodzi: `npm run build` — 031905a

#### Manual

- [x] 1.7 `/auth/signin` w `npm run dev` wygląda tak samo jak przed fazą — 031905a

### Phase 2: Wartości tokenów

#### Automated

- [x] 2.1 `grep -nE '#[0-9a-fA-F]{3,8}\b' src/components/Banner.astro` nie zwraca trafień — 3099b88
- [x] 2.2 `grep -rnE 'ring-(ring|destructive)/[0-9]+' src/components/ui` nie zwraca trafień dla wariantów `focus-visible:` — 3099b88
- [x] 2.3 Lint przechodzi: `npm run lint` — 3099b88
- [x] 2.4 Typy przechodzą: `npx astro check` — 3099b88
- [x] 2.5 Build przechodzi: `npm run build` — 3099b88

#### Manual

- [ ] 2.6 Fokus z klawiatury (Tab) na przyciskach strony `/auth/signin` jest widoczny
- [ ] 2.7 Baner (uruchomienie bez `.dev.vars`/`.env`) jest czytelny

### Phase 3: Widok dashboardu

#### Automated

- [x] 3.1 Skan literałów (regex w „Skan”) na `src/pages/dashboard.astro src/components/dashboard/*.astro src/components/Topbar.astro src/components/form/*.tsx src/components/subscriptions/*.tsx` = 0 trafień — 31d6efe
- [x] 3.2 `grep -n 'bg-cosmic' src/pages/dashboard.astro src/components/dashboard/*.astro` pusty — 31d6efe
- [x] 3.3 Lint przechodzi: `npm run lint` — 31d6efe
- [x] 3.4 Typy przechodzą: `npx astro check` — 31d6efe
- [x] 3.5 Testy przechodzą: `npm test` — 31d6efe
- [x] 3.6 Build przechodzi: `npm run build` — 31d6efe

#### Manual

- [x] 3.7 Zrzut dashboardu desktop 1280 px i mobile 375 px — jasny, czytelny, bez poziomego scrolla na 375 px — 31d6efe
- [ ] 3.8 Dialog Cancel/Delete otwiera się w jasnych tokenach, „Keep” i potwierdzenie czytelne

### Phase 4: Pozostałe strony

#### Automated

- [x] 4.1 Skan literałów na `src/pages/**/*.astro` i `src/components/**/*.{astro,tsx}` poza `src/components/ui/**` = 0 trafień — 1eae1f1
- [x] 4.2 `grep -rn 'bg-cosmic' src` nie zwraca trafień — 1eae1f1
- [x] 4.3 Lint przechodzi: `npm run lint` — 1eae1f1
- [x] 4.4 Typy przechodzą: `npx astro check` — 1eae1f1
- [x] 4.5 Testy przechodzą: `npm test` — 1eae1f1
- [x] 4.6 Build przechodzi: `npm run build` — 1eae1f1

#### Manual

- [x] 4.7 Zrzuty desktop 1280 px i mobile 375 px stron `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` — jasne, czytelne, bez poziomego scrolla — 1eae1f1
- [ ] 4.8 Strona edycji (stan „not found” lokalnie, formularz po wdrożeniu) — jasna i czytelna
- [ ] 4.9 Smoke w CI zielony po pushu commitów faz 3–4

### Phase 5: Stany, dostępność i kitchen sink

#### Automated

- [x] 5.1 `npm run build` przechodzi, a w `npm run preview` żądanie `GET /dev/dashboard-states` zwraca 404 — 4cb23b8
- [x] 5.2 W `npm run dev` żądanie `GET /dev/dashboard-states` zwraca 200 — 4cb23b8
- [x] 5.3 `grep -rnE '\bfocus:(ring|border|outline)' src/components src/pages` nie zwraca trafień — 4cb23b8
- [x] 5.4 Skan literałów na plikach z fazy 4 + `src/pages/dev/*.astro` + `src/components/dashboard/*` = 0 — 4cb23b8
- [x] 5.5 Lint przechodzi: `npm run lint` — 4cb23b8
- [x] 5.6 Typy przechodzą: `npx astro check` — 4cb23b8
- [x] 5.7 Testy przechodzą: `npm test` — 4cb23b8

#### Manual

- [x] 5.8 Kitchen sink, zrzuty desktop 1280 px i mobile 375 px: każda komórka macierzy 7 stanów pokazana albo oznaczona N/A z powodem — 4cb23b8
- [x] 5.9 Tab przez cały dashboard: fokus widoczny na każdej kontrolce, w tym na „Delete” i linkach — 4cb23b8
- [x] 5.10 Czytnik ekranu lub drzewo dostępności: błąd pola opisany, przyciski wiersza z nazwą subskrypcji, zapis ogłasza stan — 4cb23b8

### Phase 6: Zabezpieczenie kontraktu

#### Automated

- [x] 6.1 `npm run lint` przechodzi (eslint + kontrola literałów)
- [x] 6.2 Kontrola łapie regresję: tymczasowe `text-white` w `src/pages/dashboard.astro` daje kod wyjścia 1 z `plik:linia`
- [x] 6.3 `grep -n 'check-ui-literals' package.json CLAUDE.md` zwraca trafienia w obu plikach

#### Manual

- [x] 6.4 Blok UI w `CLAUDE.md` jest zwięzły i wskazuje tokeny, komponenty, kitchen sink i kontrolę
