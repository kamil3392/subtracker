# Ekran główny: koszt miesięczny per waluta i odnowienia w 30 dni — plan implementacji

## Overview

Wycinek S-01 z `context/foundation/roadmap.md` (north star kamienia M-1). Zalogowany użytkownik trafia na `/dashboard`, dodaje subskrypcje i widzi uśredniony koszt miesięczny osobno dla każdej waluty (miesięczna w całości, kwartalna 1/3, roczna 1/12) oraz listę subskrypcji odnawiających się w ciągu 30 dni, z datami przesuwanymi o cykl przy odczycie (FR-009). Bez subskrypcji widzi czytelny stan pusty. Reguły liczenia są czystymi funkcjami pokrytymi pierwszymi testami jednostkowymi w projekcie (bariera jakości z PRD). Przy okazji zamyka ustalenia F1 (uprawnienia `authenticated`) i F7 (semantyka `price`) z przeglądu F-01.

## Current State Analysis

- Po zalogowaniu `src/pages/api/auth/signin.ts:19` przekierowuje na `/`, gdzie `src/pages/index.astro` renderuje ogólny landing startera (`src/components/Welcome.astro`) — także dla zalogowanych.
- `src/pages/dashboard.astro:1-27` to zaślepka („Welcome, {email}” + wylogowanie); jedyna chroniona trasa (`src/middleware.ts:4`, dopasowanie prefiksem).
- Klient Supabase tworzony per żądanie przez `createClient(headers, cookies)` (`src/lib/supabase.ts:6-22`), zwraca `null` przy braku konfiguracji; `locals` niesie tylko `user` (`src/env.d.ts:1-5`).
- Wzorzec akcji: wyspa React z ręczną walidacją (`src/components/auth/SignInForm.tsx:18-43`) → natywny `POST` → endpoint czyta `formData()`, wynik redirectem z `?error=`. Endpointy auth nie walidują wejścia; zod nie jest nigdzie używany.
- `public.subscriptions` istnieje (F-01): `price numeric(10,2)`, `currency ~ '^[A-Z]{3}$'`, `billing_cycle` enum, `next_renewal_date date` (data bazowa, rollover przy odczycie), `status` domyślnie `active`, `user_id default auth.uid()`; typy w `src/db/database.types.ts`, encje w `src/types.ts`; runtime'owe tablice enumów w `Constants.public.Enums` (`src/db/database.types.ts:207-217`).
- `authenticated` ma domyślne ALL na tabeli, w tym TRUNCATE (przegląd F-01, F1).
- Brak runnera testów, biblioteki dat, helperów `Intl`; z shadcn jest tylko `button`. UI po angielsku (`Layout.astro:14`).
- `scripts/smoke.mjs` sprawdza m.in. signin → 302 `/` (dopasowanie `startsWith`, l. 54/66) i `/dashboard` → 200 dla świeżego konta (l. 55).

## Desired End State

- `/dashboard` (chroniony) pokazuje: kafelki kosztu miesięcznego per waluta, listę odnowień w oknie [dziś, dziś+30] i formularz dodawania; bez aktywnych subskrypcji — stan pusty z zachętą do dodania pierwszej, bez kafelków „0”.
- Logowanie przekierowuje na `/dashboard`; zalogowany wchodzący na `/` jest przekierowany na `/dashboard`.
- `POST /api/subscriptions` waliduje wejście zod-em, zapisuje wiersz właściciela i wraca redirectem.
- `src/lib/services/` zawiera czyste, przetestowane (vitest) funkcje: „dziś” w `Europe/Warsaw`, rollover z kotwicą do dnia, okno 30 dni, koszt miesięczny per waluta w groszach.
- `authenticated` ma na `public.subscriptions` wyłącznie select/insert/update/delete — lokalnie, w CI i na produkcji.

Weryfikacja: `npm test`, `npx supabase test db`, lint/check/build zielone; job `smoke` w CI przechodzi z nowym krokiem dodania subskrypcji; przepływ PRD (rejestracja → 3 subskrypcje o różnych cyklach → poprawna suma i odnowienia) sprawdzony ręcznie na produkcji.

### Key Discoveries:

- `src/pages/api/auth/signin.ts:7-19` — wzorzec endpointu do naśladowania (formData → createClient → null-check → redirect).
- `src/middleware.ts:4,18-22` — `PROTECTED_ROUTES` z prefiksem; `/api/subscriptions` nie jest chroniony, dopóki go nie dopiszemy.
- `src/components/auth/SubmitButton.tsx:12` (`useFormStatus`) i `ServerError.tsx` — do ponownego użycia w formularzu dodawania.
- `node_modules/astro/client.d.ts:155-171` — `astro:schema` jest przestarzałe w Astro 7 („removed in Astro 8, use `astro/zod`”); moduł wirtualny nie importuje się też w vitest.
- `scripts/smoke.mjs:54-55,66` — oczekiwania lokalizacji są prefiksowe; po zmianie redirectu oczekiwanie `/` trzeba zaostrzyć do `/dashboard`.

## What We're NOT Doing

- Lista wszystkich subskrypcji i edycja (S-02), usuwanie i oznaczanie jako anulowane (S-03).
- Reguła anulowanej subskrypcji (FR-007): S-01 liczy wyłącznie `status = 'active'`; wiersze `cancelled` są pomijane w sumie i odnowieniach, regułę „do daty odnowienia” dokłada S-03.
- Przeliczanie kursów walut, waluty spoza listy PLN/EUR/USD/GBP/CHF.
- Faktyczne obciążenia bieżącego miesiąca (FR-010).
- Tłumaczenie UI na polski; strefa czasowa per użytkownik.
- Zapisywanie przesuniętej daty odnowienia w bazie — rollover wyłącznie przy odczycie.
- Testy komponentów React / E2E w przeglądarce.

## Implementation Approach

„Baza → reguły → zapis → widok → produkcja”: najpierw zawężenie uprawnień (addytywna migracja, testowana pgTAP), potem czyste funkcje domenowe z testami jednostkowymi — bariera jakości „błędna suma niszczy zaufanie” jest zamknięta, zanim cokolwiek je wyświetli. Następnie endpoint zapisu z walidacją i dopiero na końcu ekran, który łączy odczyt RLS, serwis i formularz. Produkcja dostaje migrację przez tę samą bramkę ręczną co F-01. Daty są traktowane jako kalendarzowe `YYYY-MM-DD` (liczby rok/miesiąc/dzień), nigdy jako `Date` w lokalnej strefie — jedyne użycie strefy to wyznaczenie „dziś” w `Europe/Warsaw` przez `Intl`.

## Critical Implementation Details

- **Rollover liczony od daty bazowej, nie krok po kroku** — następna data to `addMonthsClamped(base, k × n)` dla najmniejszego `k ≥ 0` dającego datę ≥ dziś (`n` = 1/3/12), z dniem przyciętym do ostatniego dnia miesiąca docelowego. Liczenie iteracyjne od poprzedniej przyciętej daty daje dryf (31.01 → 28.02 → 28.03), który użytkownik odrzucił.
- **Suma w groszach z jednym zaokrągleniem** — koszt miesięczny waluty = `round(Σ price_grosze × m / 12)`, gdzie `m` = 12 (miesięczna), 4 (kwartalna), 1 (roczna); zaokrąglanie każdej pozycji osobno daje rozjazdy groszowe przy kilku rocznych.
- **`astro/zod` zamiast `astro:schema`** — schemat musi się importować w vitest i przeżyć Astro 8; reguła z CLAUDE.md („zod Astro, bez dodawania `zod` do package.json”) pozostaje w mocy, aktualizujemy tylko ścieżkę importu.

## Phase 1: Zawężenie uprawnień do tabeli subskrypcji

### Overview

`authenticated` dostaje wyłącznie cztery operacje objęte politykami RLS; `anon` nic. Domyka F1 z przeglądu F-01, zanim aplikacja zacznie zapisywać dane.

### Changes Required:

#### 1. Migracja grantów

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_restrict_subscriptions_grants.sql` (przez `npx supabase migration new restrict_subscriptions_grants`)

**Intent**: Uczynić uprawnienia jawnymi i usunąć TRUNCATE/REFERENCES/TRIGGER, których RLS nie obejmuje.

**Contract**: `revoke all on public.subscriptions from anon, authenticated;` następnie `grant select, insert, update, delete on public.subscriptions to authenticated;`. Bez zmian w politykach, kolumnach i typach (migracja czysto addytywna w sensie schematu — `src/db/database.types.ts` się nie zmienia). `service_role` bez zmian.

#### 2. Asercje pgTAP

**File**: `supabase/tests/subscriptions_rls.test.sql`

**Intent**: Przypiąć uprawnienia, żeby przyszły `grant` dla `anon` albo powrót TRUNCATE wywracał test (uzupełnia lukę F2 z przeglądu F-01).

**Contract**: `table_privs_are('public', 'subscriptions', 'anon', array[]::text[])` oraz `table_privs_are('public', 'subscriptions', 'authenticated', array['SELECT','INSERT','UPDATE','DELETE'])`; `plan(N)` podniesione o 2. Asercje wykonywane jako superuser (przed `set local role`).

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się lokalnie: `npx supabase migration up` kończy się bez błędów
- `npx supabase test db`: wszystkie asercje przechodzą
- Test wykrywa regresję: tymczasowy `grant truncate on public.subscriptions to authenticated` wywraca `npx supabase test db` (zmiana wycofana)
- `npm run db:types` nie zmienia `src/db/database.types.ts`

#### Manual Verification:

- Przegląd SQL: tylko revoke/grant, brak zmian w politykach

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Serwis domenowy i runner testów

### Overview

Czyste funkcje liczące koszt miesięczny i odnowienia, pokryte testami jednostkowymi uruchamianymi lokalnie i w CI.

### Changes Required:

#### 1. Runner testów

**File**: `package.json`, `vitest.config.ts` (nowy), `.github/workflows/ci.yml`

**Intent**: Pierwszy runner testów jednostkowych (wskazany w CLAUDE.md jako brakujący) dla logiki domenowej.

**Contract**: devDependency `vitest`; skrypt `"test": "vitest run"`; konfiguracja ze środowiskiem `node`, aliasem `@` → `./src`, `include: ["src/**/*.test.ts"]`. W jobie `ci` krok `npm test` po `npm run lint`. Pliki testów objęte lintem jak reszta `src/`.

#### 2. Daty kalendarzowe

**File**: `src/lib/services/dates.ts` (nowy)

**Intent**: Arytmetyka na datach `YYYY-MM-DD` bez pułapek stref czasowych.

**Contract**:
- `todayInWarsaw(now: Date): string` — data kalendarzowa w `Europe/Warsaw` (np. `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" })`), `now` wstrzykiwane dla testowalności.
- `addMonthsClamped(date: string, months: number): string` — dzień przycięty do ostatniego dnia miesiąca docelowego (z obsługą lat przestępnych).
- `addDays(date: string, days: number): string`, porównania na stringach `YYYY-MM-DD` (porządek leksykograficzny = chronologiczny).

#### 3. Reguły subskrypcji

**File**: `src/lib/services/subscriptions.ts` (nowy)

**Intent**: Jedno źródło reguł FR-008/FR-009 dla ekranu głównego.

**Contract**:
- `CYCLE_MONTHS: Record<BillingCycle, 1 | 3 | 12>`.
- `nextRenewalDate(base: string, cycle: BillingCycle, today: string): string` — `base`, jeśli `base ≥ today`; w przeciwnym razie najmniejsze `addMonthsClamped(base, k × CYCLE_MONTHS[cycle])` ≥ `today` (liczone od `base`, patrz Critical Implementation Details).
- `monthlyCostByCurrency(subs: Subscription[]): { currency: string; monthlyCents: number }[]` — tylko `status === "active"`; grosze z `price` bez błędów float (`Math.round(price × 100)`), suma `price_grosze × m` per waluta, jedno `Math.round(… / 12)`; wynik posortowany po kodzie waluty; pusta tablica dla braku aktywnych.
- `upcomingRenewals(subs: Subscription[], today: string, days = 30): { subscription: Subscription; renewalDate: string }[]` — tylko aktywne, `renewalDate = nextRenewalDate(...)`, filtr `today ≤ renewalDate ≤ addDays(today, days)` (oba końce włącznie), sortowanie po dacie, potem nazwie.

#### 4. Testy jednostkowe

**File**: `src/lib/services/dates.test.ts`, `src/lib/services/subscriptions.test.ts` (nowe)

**Intent**: Bariera jakości z PRD — przeliczanie i daty nie mogą się mylić.

**Contract**: przypadki co najmniej:
- `todayInWarsaw`: `2026-10-01T22:30:00Z` → `2026-10-02` (po północy w Polsce, przed w UTC); zmiana czasu (marzec/październik).
- `addMonthsClamped`: `2026-01-31` +1 → `2026-02-28`; `2028-01-31` +1 → `2028-02-29`; `2026-01-31` +2 → `2026-03-31` (kotwica, bez dryfu); +12 przez koniec roku.
- `nextRenewalDate`: data w przyszłości/dziś bez zmian; miesięczna z `2026-01-31` przy dziś `2026-04-01` → `2026-04-30`; kwartalna i roczna sprzed wielu cykli; roczna z `2024-02-29` → `2025-02-28` / `2028-02-29`.
- `upcomingRenewals` przy dziś `2026-10-02`: odnowienie `2026-10-02` i `2026-11-01` na liście, `2026-11-02` poza; `cancelled` pominięte; kolejność po dacie i nazwie.
- `monthlyCostByCurrency`: 30 PLN/msc + 90 PLN/kwartał + 120 PLN/rok → 7000 gr; dwie roczne po 10 PLN → 167 gr (jedno zaokrąglenie, nie 83+83); osobne sumy PLN i EUR; `cancelled` pominięte; brak aktywnych → `[]`.

#### 5. Dokumentacja runnera

**File**: `CLAUDE.md`, `README.md`

**Intent**: Dokumentacja przestaje twierdzić, że w projekcie nie ma testów jednostkowych.

**Contract**: CLAUDE.md sekcja „Testy” (dziś: „brak zestawu testów jednostkowych i runnera”) — vitest, `npm test`, pojedynczy plik `npx vitest run <ścieżka>`, testy obok kodu w `src/**/*.test.ts`, krok w jobie `ci`. README „Available Scripts” — wpis `npm run test`; opis joba `ci` uzupełniony o testy.

### Success Criteria:

#### Automated Verification:

- `npm test`: wszystkie testy przechodzą
- Testy są wrażliwe na regresję: zamiana kotwicy na liczenie krok po kroku w `nextRenewalDate` albo zaokrąglanie per pozycja w `monthlyCostByCurrency` wywraca `npm test` (zmiana tymczasowa, wycofana)
- `npx astro sync && npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Przegląd przypadków testowych względem decyzji: kotwica do dnia, okno [dziś, dziś+30], `Europe/Warsaw`, tylko aktywne
- Job `ci` w GitHub Actions wykonuje `npm test` i jest zielony

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Dodawanie subskrypcji (backend)

### Overview

Endpoint zapisujący subskrypcję zalogowanego użytkownika, z walidacją na granicy.

### Changes Required:

#### 1. Schemat wejścia

**File**: `src/lib/validation/subscription.ts` (nowy), `src/lib/validation/subscription.test.ts` (nowy)

**Intent**: Jedna definicja reguł formularza po stronie serwera; domyka F7 z przeglądu F-01 (cicha utrata groszy, przepełnienie `numeric(10,2)`, nieprzycięta nazwa).

**Contract**: `import { z } from "astro/zod"`. Eksporty `SUPPORTED_CURRENCIES = ["PLN","EUR","USD","GBP","CHF"] as const` i `parseNewSubscription(form: FormData)` zwracający sukces z `TablesInsert<"subscriptions">` (bez `user_id`, `status`) albo komunikat błędu. Reguły:
- `name`: przycięta, 1–100 znaków;
- `price`: string `^\d{1,8}([.,]\d{1,2})?$` (przecinek akceptowany i normalizowany do kropki), > 0;
- `currency`: jedna z `SUPPORTED_CURRENCIES`;
- `billing_cycle`: jedna z `Constants.public.Enums.billing_cycle`;
- `next_renewal_date`: poprawna data kalendarzowa `YYYY-MM-DD` (np. `2026-02-30` odrzucone).
Testy: przypadki graniczne każdego pola (np. `0`, `9.999`, `100000000`, `12,50` → 12.5, `"   "`, `XYZ`, `weekly`, `2026-02-30`).

#### 2. Endpoint

**File**: `src/pages/api/subscriptions.ts` (nowy)

**Intent**: Zapis subskrypcji według wzorca endpointów auth.

**Contract**: `export const POST: APIRoute`. Brak `locals.user` → redirect `/auth/signin`; `createClient(...)` `null` → `/dashboard?error=…`; błąd walidacji → `/dashboard?error=<komunikat>`; `insert` bez `user_id` (default `auth.uid()`, RLS `with check`); błąd bazy → `/dashboard?error=…`; sukces → `/dashboard`.

#### 3. Ochrona trasy i reguła w CLAUDE.md

**File**: `src/middleware.ts`, `CLAUDE.md`

**Intent**: Endpoint chroniony tak jak strona; zaktualizować przestarzałą ścieżkę importu zod w regułach projektu.

**Contract**: `PROTECTED_ROUTES` = `["/dashboard", "/api/subscriptions"]`. CLAUDE.md (sekcja „Dane i logika domenowa”): `import { z } from "astro/zod"` zamiast `astro:schema`, z krótkim powodem (deprecated w Astro 7, importowalne w vitest); zakaz dodawania `zod` do `package.json` bez zmian.

### Success Criteria:

#### Automated Verification:

- `npm test`: testy schematu i serwisu przechodzą
- `npx astro sync && npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` przechodzi

#### Manual Verification:

- `curl -X POST` na `/api/subscriptions` bez sesji (dev server) kończy się redirectem na `/auth/signin`, bez zapisu

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 4.

---

## Phase 4: Ekran główny

### Overview

`/dashboard` łączy odczyt subskrypcji użytkownika, serwis domenowy i formularz dodawania; przekierowania prowadzą zalogowanego użytkownika na ten ekran.

### Changes Required:

#### 1. Strona

**File**: `src/pages/dashboard.astro`

**Intent**: Zastąpić zaślepkę ekranem z FR-008/FR-009 i stanem pustym z US-01.

**Contract**: SSR: `createClient(...)` → `select` z `subscriptions` (RLS zawęża do właściciela); `today = todayInWarsaw(new Date())`; `monthlyCostByCurrency` i `upcomingRenewals(…, today)`. Sekcje: koszt miesięczny (kafelek na walutę), „Renewals in the next 30 days” (nazwa, data, cena z walutą, cykl; komunikat, gdy okno puste), formularz (`client:load`, `serverError` z `?error=`). Brak aktywnych subskrypcji → stan pusty („No subscriptions yet…”) zamiast kafelków i listy. Błąd odczytu → komunikat w miejscu danych, strona nadal 200. Teksty po angielsku; kwoty `Intl.NumberFormat("pl-PL", { style: "currency", currency })` z `monthlyCents / 100`, daty czytelne (`pl-PL`). Zachowane: `Topbar` (z wylogowaniem) i styl „glass” istniejących stron.

#### 2. Formularz dodawania

**File**: `src/components/subscriptions/AddSubscriptionForm.tsx` (nowy)

**Intent**: Wyspa według wzorca `SignInForm`: walidacja tylko po stronie klienta, natywny `POST`.

**Contract**: `<form method="POST" action="/api/subscriptions" noValidate>`; pola `name`, `price` (`inputMode="decimal"`), `currency` (select z `SUPPORTED_CURRENCIES`, domyślnie PLN), `billing_cycle` (select: Monthly/Quarterly/Yearly), `next_renewal_date` (`type="date"`); ręczna walidacja odpowiadająca regułom schematu; ponowne użycie `FormField`, `SubmitButton`, `ServerError`. Import `SUPPORTED_CURRENCIES` nie może wciągać zod do bundla klienta (stała w osobnym module bez importu `astro/zod`, jeśli to konieczne).

#### 3. Przekierowania

**File**: `src/pages/api/auth/signin.ts`, `src/pages/index.astro`

**Intent**: „Ekran główny zaraz po zalogowaniu” (PRD Business Logic).

**Contract**: sukces logowania → `/dashboard`; `index.astro` z `locals.user` → `Astro.redirect("/dashboard")`, niezalogowany widzi landing bez zmian.

#### 4. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Przepływ dodania subskrypcji sprawdzany end-to-end w CI.

**Contract**: oczekiwanie po logowaniu zaostrzone do `/dashboard`; nowe kroki po „dashboard renders for signed-in user”: `POST /api/subscriptions` z poprawnymi polami → 302 `/dashboard` (bez `error`), następnie `GET /dashboard` → 200 i treść zawiera nazwę dodanej subskrypcji; zalogowany `GET /` → 302 `/dashboard`. Bez nowych zależności.

#### 5. Dokumentacja tras i smoke

**File**: `README.md`, `context/deployment/deploy-plan.md`

**Intent**: Dokumenty opisują nowy ekran główny i przepływ po logowaniu.

**Contract**: README — tabela tras (`/dashboard` przestaje być „Example protected page”; ekran główny z kosztem i odnowieniami, `/` przekierowuje zalogowanych, `POST /api/subscriptions`), opis smoke (auth + dodanie subskrypcji). deploy-plan §5a krok 9 — „zaloguj się → przekierowanie na `/dashboard`”.

### Success Criteria:

#### Automated Verification:

- `npx astro sync && npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm test` przechodzi
- `npm run build` przechodzi

#### Manual Verification:

- Job `smoke` w GitHub Actions jest zielony z nowymi krokami
- Na produkcji (po deployu z CI): nowe konto widzi stan pusty; po dodaniu trzech subskrypcji (miesięczna, kwartalna, roczna; w tym jedna w EUR) suma per waluta i lista odnowień zgadzają się z ręcznym przeliczeniem
- Błędne dane w formularzu (np. cena `0`) pokazują komunikat bez zapisu

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 5.

---

## Phase 5: Migracja uprawnień na hostowany Supabase (bramka ręczna)

### Overview

Produkcja dostaje migrację z fazy 1; wykonuje człowiek, agent zapisuje wynik (procedura z `context/deployment/deploy-plan.md` §12).

### Changes Required:

#### 1. Wdrożenie migracji (człowiek)

**File**: — (terminal użytkownika)

**Intent**: Domknąć F1 na produkcji.

**Contract**: `npx supabase db push --dry-run` (oczekiwane: tylko `restrict_subscriptions_grants`) → `npx supabase db push` → `npx supabase migration list` (Local = Remote); sprawdzenie anon jak w F-01 (`curl` → 401 / `42501`); dodanie subskrypcji przez UI na produkcji nadal działa.

#### 2. Zapis w deploy-plan

**File**: `context/deployment/deploy-plan.md`

**Intent**: Utrzymać deploy-plan jako źródło prawdy o stanie produkcji.

**Contract**: nowy wiersz w tabeli historii §12 (data, migracja, wynik `migration list`, anon, zapis przez UI); §8 — opis uprawnień `authenticated` (tylko select/insert/update/delete).

### Success Criteria:

#### Manual Verification:

- `npx supabase migration list` na produkcji pokazuje `restrict_subscriptions_grants` po stronie Remote
- Anon nadal odrzucany (`42501`), a dodanie subskrypcji przez UI na produkcji działa
- `context/deployment/deploy-plan.md` zawiera wpis o migracji uprawnień

---

## Testing Strategy

### Unit Tests:

- `src/lib/services/dates.test.ts` — strefa Warszawy (północ, zmiany czasu), przycinanie dnia, lata przestępne.
- `src/lib/services/subscriptions.test.ts` — rollover z kotwicą, granice okna 30 dni, sumy w groszach per waluta, pomijanie `cancelled`, stan pusty.
- `src/lib/validation/subscription.test.ts` — przypadki graniczne każdego pola.

### Integration Tests:

- `supabase/tests/subscriptions_rls.test.sql` — dodatkowo `table_privs_are` dla `anon` i `authenticated`.
- `scripts/smoke.mjs` — logowanie → `/dashboard`, dodanie subskrypcji, widoczność na ekranie, przekierowanie z `/`.

### Manual Testing Steps:

1. Nowe konto → `/dashboard` pokazuje stan pusty.
2. Dodaj: Netflix 49 PLN miesięcznie, siłownia 300 PLN kwartalnie, hosting 120 EUR rocznie → koszt: `149,00 zł` i `10,00 €` (format `Intl` `pl-PL`, z twardą spacją przed symbolem).
3. Subskrypcja z datą odnowienia w przeszłości (np. 31 stycznia, miesięczna) pokazuje się z przesuniętą datą zgodną z kotwicą.
4. Cena `0` / `9.999` → komunikat błędu, brak zapisu.

## Performance Considerations

Kilkanaście wierszy na użytkownika: jeden `select` na wyrenderowanie, obliczenia w pamięci; indeks `user_id` z F-01 wystarcza.

## Migration Notes

Migracja grantów jest addytywna względem schematu (bez zmian kolumn i typów) i wstecznie zgodna z kodem: aplikacja używa wyłącznie select/insert/update/delete. Wycofanie: `grant all on public.subscriptions to authenticated;`. Kolejność „deploy Workera” vs `db push` nie ma znaczenia.

## References

- Roadmap: `context/foundation/roadmap.md` (S-01, Unknowns rozstrzygnięte w tym planie)
- PRD: `context/foundation/prd.md` (US-01, FR-003, FR-008, FR-009, Guardrails)
- Przegląd F-01 (F1, F2, F7): `context/archive/2026-10-02-owner-only-subscription-store/reviews/impl-review.md`
- Procedura `db push`: `context/deployment/deploy-plan.md` §12
- Wzorzec endpointu: `src/pages/api/auth/signin.ts:7-19`; wzorzec formularza: `src/components/auth/SignInForm.tsx:18-43`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zawężenie uprawnień do tabeli subskrypcji

#### Automated

- [x] 1.1 Migracja stosuje się lokalnie: `npx supabase migration up` kończy się bez błędów — fe66a68
- [x] 1.2 `npx supabase test db`: wszystkie asercje przechodzą — fe66a68
- [x] 1.3 Test wykrywa regresję: tymczasowy `grant truncate on public.subscriptions to authenticated` wywraca `npx supabase test db` (zmiana wycofana) — fe66a68
- [x] 1.4 `npm run db:types` nie zmienia `src/db/database.types.ts` — fe66a68

#### Manual

- [x] 1.5 Przegląd SQL: tylko revoke/grant, brak zmian w politykach — fe66a68

### Phase 2: Serwis domenowy i runner testów

#### Automated

- [x] 2.1 `npm test`: wszystkie testy przechodzą — 80125d6
- [x] 2.2 Testy są wrażliwe na regresję: zamiana kotwicy na liczenie krok po kroku w `nextRenewalDate` albo zaokrąglanie per pozycja w `monthlyCostByCurrency` wywraca `npm test` (zmiana tymczasowa, wycofana) — 80125d6
- [x] 2.3 `npx astro sync && npm run lint` przechodzi — 80125d6
- [x] 2.4 `npx astro check` przechodzi — 80125d6

#### Manual

- [x] 2.5 Przegląd przypadków testowych względem decyzji: kotwica do dnia, okno [dziś, dziś+30], `Europe/Warsaw`, tylko aktywne — 80125d6
- [x] 2.6 Job `ci` w GitHub Actions wykonuje `npm test` i jest zielony — 80125d6

### Phase 3: Dodawanie subskrypcji (backend)

#### Automated

- [x] 3.1 `npm test`: testy schematu i serwisu przechodzą — 45f5024
- [x] 3.2 `npx astro sync && npm run lint` przechodzi — 45f5024
- [x] 3.3 `npx astro check` przechodzi — 45f5024
- [x] 3.4 `npm run build` przechodzi — 45f5024

#### Manual

- [x] 3.5 `curl -X POST` na `/api/subscriptions` bez sesji (dev server) kończy się redirectem na `/auth/signin`, bez zapisu — 45f5024

### Phase 4: Ekran główny

#### Automated

- [x] 4.1 `npx astro sync && npm run lint` przechodzi
- [x] 4.2 `npx astro check` przechodzi
- [x] 4.3 `npm test` przechodzi
- [x] 4.4 `npm run build` przechodzi

#### Manual

- [ ] 4.5 Job `smoke` w GitHub Actions jest zielony z nowymi krokami
- [ ] 4.6 Na produkcji (po deployu z CI): nowe konto widzi stan pusty; po dodaniu trzech subskrypcji (miesięczna, kwartalna, roczna; w tym jedna w EUR) suma per waluta i lista odnowień zgadzają się z ręcznym przeliczeniem
- [ ] 4.7 Błędne dane w formularzu (np. cena `0`) pokazują komunikat bez zapisu

### Phase 5: Migracja uprawnień na hostowany Supabase (bramka ręczna)

#### Manual

- [ ] 5.1 `npx supabase migration list` na produkcji pokazuje `restrict_subscriptions_grants` po stronie Remote
- [ ] 5.2 Anon nadal odrzucany (`42501`), a dodanie subskrypcji przez UI na produkcji działa
- [ ] 5.3 `context/deployment/deploy-plan.md` zawiera wpis o migracji uprawnień
