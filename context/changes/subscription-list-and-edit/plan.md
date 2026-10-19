# Lista i edycja subskrypcji — plan implementacji

## Overview

Wycinek S-02 roadmapy (FR-004, FR-005): zalogowany użytkownik widzi na `/dashboard` listę wszystkich własnych subskrypcji i z każdego wpisu przechodzi do strony edycji, gdzie poprawia nazwę, cenę, walutę, cykl lub datę odnowienia; po zapisie wraca na `/dashboard`, a suma per waluta i odnowienia w 30 dni od razu uwzględniają zmianę. To zamyka krok 4 przepływu MVP z PRD („edycja jednej”). Przy okazji domykamy dwie obserwacje odłożone przy przeglądzie S-01: F7 (wspólne komponenty formularza poza `components/auth/`) i F6 (formularz traci wpisane dane po błędzie serwera).

## Current State Analysis

- `/dashboard` (`src/pages/dashboard.astro:21`) czyta wszystkie wiersze właściciela (`select("*")`, RLS), ale pokazuje tylko kafelki kosztu i listę odnowień — nie ma listy wszystkich wpisów ani żadnej akcji na wpisie.
- Dodawanie: wyspa `AddSubscriptionForm` (`src/components/subscriptions/AddSubscriptionForm.tsx`) z walidacją kliencką wysyła natywny POST do `src/pages/api/subscriptions.ts`, który waliduje `parseNewSubscription` (`src/lib/validation/subscription.ts:38`) i odpowiada redirectem (`/dashboard` lub `/dashboard?error=`).
- Baza jest gotowa na edycję: polityka `subscriptions_update_own` z `using` + `with check` (`supabase/migrations/20261002091205_create_subscriptions.sql:45-50`), grant `update` dla `authenticated` (`…111450_restrict_subscriptions_grants.sql:9`), pgTAP sprawdza update właściciela i brak efektu dla cudzego konta (`supabase/tests/subscriptions_rls.test.sql:59-111`). **Migracja nie jest potrzebna.**
- Kolumna `next_renewal_date` to data bazowa; rollover FR-009 liczy `nextRenewalDate` przy odczycie z kotwicą do dnia (`src/lib/services/subscriptions.ts:28-42`).
- `PROTECTED_ROUTES = ["/dashboard", "/api/subscriptions"]` z dopasowaniem `startsWith` (`src/middleware.ts:4,24`) — `/api/subscriptions/<id>` jest już chronione, nowa strona `/subscriptions/...` nie.
- `FormField`, `SubmitButton`, `ServerError` leżą w `src/components/auth/` i są już używane przez formularz subskrypcji (F7).
- `context/foundation/lessons.md` jeszcze nie istnieje.

## Desired End State

- `/dashboard` ma sekcję „All subscriptions” z każdym wpisem użytkownika (nazwa, cena + cykl, najbliższa data odnowienia) i linkiem „Edit” do `/subscriptions/<id>/edit`.
- Strona edycji pokazuje formularz wypełniony danymi wpisu, z datą odnowienia **po rolloverze** (tą samą co na dashboardzie). Zapis → `/dashboard` ze zaktualizowaną sumą i odnowieniami. Błąd walidacji/zapisu → powrót na stronę edycji z komunikatem i wpisanymi wartościami.
- Jeśli użytkownik nie zmienił daty ani cyklu, data bazowa w bazie zostaje bez zmian (wpis z kotwicą 31. nie „spada” na 28.).
- Wpis cudzy lub nieistniejący: strona edycji renderuje stan „Subscription not found” ze statusem 404; POST na taki id nic nie zmienia i wraca na `/dashboard?error=`.
- Formularz dodawania po błędzie serwera odtwarza wpisane wartości.
- Komponenty formularza leżą w `src/components/form/`.
- Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, job `smoke` w CI (rozszerzony o edycję) zielone; ręczny przepływ PRD na produkcji.

### Key Discoveries:

- Wzorzec akcji: natywny `<form method="POST">` + redirect z `?error=`; HTML nie wyśle PATCH, więc edycja to `POST /api/subscriptions/[id]` (`CLAUDE.md` → „Przepływ auth”).
- Redirect we frontmatterze strony (`return Astro.redirect()`) łamie `no-misused-promises` (`src/middleware.ts:19`) — strona edycji dla nieznanego id renderuje stan „not found” i ustawia `Astro.response.status = 404` zamiast przekierowywać.
- Wyspa nie może importować modułów z `astro/zod` (`src/lib/currencies.ts:1-4`) — helpery F6 czytane przez wyspę muszą być zod-free; parsowanie parametrów robią strony `.astro` po stronie serwera.
- `parseNewSubscription` waliduje dokładnie pięć pól formularza edycji — używamy go ponownie dla edycji.

## What We're NOT Doing

- Usuwanie i oznaczanie jako anulowane, reguła FR-007 dla anulowanych, zmiana `status` przez formularz — S-03.
- Migracje schematu, zmiany RLS/grantów, nowe testy pgTAP (update jest już pokryty).
- Edycja inline na liście, osobna strona `/subscriptions` z listą, paginacja, sortowanie/filtrowanie przez użytkownika.
- Wykrywanie konfliktów przy równoczesnej edycji (ostatni zapis wygrywa — jedno konto, jeden użytkownik).
- Zapisywanie przesuniętej daty w bazie przy odczycie, historia zmian cen (PRD Non-Goals).
- Testy komponentów React / E2E w przeglądarce.

## Implementation Approach

Najpierw czyste, przetestowane reguły (która data trafia do bazy, walidacja id, serializacja wartości formularza do redirectu), potem refaktor formularza bez zmiany zachowania (F7 + uogólnienie wyspy + F6 dla dodawania), na końcu właściwa funkcja: lista na dashboardzie, strona edycji i endpoint, z rozszerzonym smoke. Każda faza zostawia działającą aplikację.

**Reguła daty przy zapisie edycji** (decyzja z planowania): formularz pokazuje datę po rolloverze. Serwer zachowuje zapisaną datę bazową wtedy i tylko wtedy, gdy przesłana data równa się `nextRenewalDate(stored.next_renewal_date, stored.billing_cycle, today)` **oraz** przesłany cykl równa się zapisanemu; w każdym innym przypadku zapisuje przesłaną datę jako nową bazę. Przykład (dziś 2026-10-19): baza 2026-08-15 monthly → formularz 2026-11-15. Zmiana samej ceny → baza zostaje 2026-08-15. Zmiana cyklu na yearly przy niezmienionej dacie → baza 2026-11-15 (inaczej następne odnowienie wypadłoby 2027-08-15, a nie pokazane 2026-11-15). Baza 2026-01-31 monthly, dziś 2026-02-10 → formularz 2026-02-28; zmiana ceny → baza zostaje 2026-01-31, więc marzec dalej daje 2026-03-31.

## Critical Implementation Details

- **Timing & lifecycle**: endpoint edycji porównuje datę z wierszem odczytanym z bazy w tym samym żądaniu (select → reguła → update), z „dziś” liczonym przez `todayInWarsaw(new Date())` — bez ukrytego pola z oryginalną datą od klienta.

## Phase 1: Reguły edycji i helpery formularza

### Overview

Czyste funkcje z testami vitest: wybór daty do zapisu, walidacja id z URL i przenoszenie wartości formularza przez redirect (F6). Bez zmian w UI.

### Changes Required:

#### 1. Reguła daty bazowej

**File**: `src/lib/services/subscriptions.ts`, `src/lib/services/subscriptions.test.ts`

**Intent**: Dodać funkcję rozstrzygającą, którą datę zapisać przy edycji, zgodnie z regułą z „Implementation Approach”, żeby edycja bez zmiany daty nie przesuwała kotwicy dnia.

**Contract**: `renewalDateToStore(stored: Pick<Subscription, "next_renewal_date" | "billing_cycle">, submitted: { next_renewal_date: string; billing_cycle: BillingCycle }, today: string): string`. Testy obejmują co najmniej: niezmieniona data i cykl → baza (także baza w przeszłości z rolloverem); zmieniona data → przesłana; niezmieniona data + zmieniony cykl → przesłana; kotwica 31.01 → formularz 28.02 → baza 31.01 zostaje; baza ≥ dziś bez zmian → baza.

#### 2. Walidacja id subskrypcji

**File**: `src/lib/validation/subscription.ts`, `src/lib/validation/subscription.test.ts`

**Intent**: Walidować parametr `[id]` z URL zod-em (`z.uuid()` z `astro/zod`), żeby nieprawidłowy id nie trafiał do zapytania (Postgres zwróciłby błąd rzutowania uuid zamiast „nie znaleziono”).

**Contract**: `parseSubscriptionId(value: string | undefined): string | null` — zwraca id lub `null`. `parseNewSubscription` pozostaje bez zmian i służy też edycji.

#### 3. Wartości formularza w redirectcie (F6)

**File**: `src/lib/subscription-form.ts` (nowy, zod-free), `src/lib/subscription-form.test.ts`, typ w `src/types.ts`

**Intent**: Przy błędzie serwera endpoint dokleja do redirectu `?error=` także pięć wpisanych wartości, a strona odczytuje je z powrotem jako wartości początkowe formularza. Moduł bez zod, bo typ i domyślne wartości trafiają do wyspy.

**Contract**:
- `SubscriptionFormValues` w `src/types.ts`: `{ name; price; currency; billing_cycle; next_renewal_date }` — wszystkie jako `string` (surowe wartości pól).
- `formErrorLocation(path: string, message: string, form: FormData): string` — buduje `path?error=…&name=…&…` przez `URLSearchParams` (tylko pięć znanych pól, wartości przycięte do rozsądnej długości, np. 200 znaków).
- `formValuesFromSearchParams(params: URLSearchParams): Partial<SubscriptionFormValues>` — zwraca tylko obecne znane pola.
- Testy: round-trip wartości z polskimi znakami, `&`, `=` i spacjami; pomijanie nieznanych pól; brak pól → pusty obiekt.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`

**Implementation Note**: Faza bez zmian widocznych dla użytkownika — brak weryfikacji ręcznej.

---

## Phase 2: Wspólny formularz subskrypcji

### Overview

F7 i uogólnienie wyspy formularza tak, by obsłużyła dodawanie i edycję; dodawanie zachowuje wpisane dane po błędzie serwera (F6). Zachowanie dodawania poza F6 bez zmian.

### Changes Required:

#### 1. Przeniesienie komponentów (F7)

**File**: `src/components/form/{FormField,SubmitButton,ServerError}.tsx` (przeniesione z `src/components/auth/`), importy w `src/components/auth/*` i formularzu subskrypcji

**Intent**: Komponenty są ogólne, a S-02 dodaje drugi formularz domenowy — przenosimy je do neutralnego katalogu. `PasswordToggle` zostaje w `auth/`.

**Contract**: ścieżki importu `@/components/form/...`; brak zmian w API komponentów. Przeniesienie przez `git mv`, żeby zachować historię.

#### 2. Wyspa `SubscriptionForm`

**File**: `src/components/subscriptions/SubscriptionForm.tsx` (zastępuje `AddSubscriptionForm.tsx`)

**Intent**: Jedna wyspa z walidacją kliencką dla dodawania i edycji; stan pól inicjalizowany z propsów zamiast stałych.

**Contract**: props `{ action: string; submitLabel: string; pendingText: string; initialValues?: Partial<SubscriptionFormValues>; serverError?: string | null }`. Domyślne wartości jak dziś (puste pola, `PLN`, `monthly`); `initialValues` je nadpisuje. Nieznana waluta/cykl z `initialValues` spada do domyślnych (select nie może pokazać wartości spoza listy). Ikona przycisku: `Plus` dla dodawania, `Save` dla edycji — przez prop albo `submitIcon`.

#### 3. Dodawanie z F6

**File**: `src/pages/api/subscriptions.ts`, `src/pages/dashboard.astro`

**Intent**: Błąd walidacji/zapisu przy dodawaniu wraca przez `formErrorLocation("/dashboard", …)`; dashboard przekazuje `formValuesFromSearchParams(Astro.url.searchParams)` jako `initialValues`, gdy jest `error`.

**Contract**: sukces nadal `302 /dashboard` (dokładnie — smoke to sprawdza); błąd `302 /dashboard?error=…&<pola>`. Brak konfiguracji Supabase może nadal używać samego `?error=`.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- W `src/components/auth/` nie ma już `FormField`, `SubmitButton`, `ServerError`: `ls src/components/auth`

#### Manual Verification:

- Logowanie, rejestracja i dodawanie subskrypcji działają jak przed zmianą (lokalnie `npm run dev` z hostowanym Supabase albo po deployu)
- Błąd serwera przy dodawaniu (np. waluta spoza listy wysłana ręcznie) zostawia wpisane nazwę, cenę i datę w formularzu

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przez człowieka przed kolejną fazą.

---

## Phase 3: Lista i edycja

### Overview

Właściwa funkcja S-02: lista wszystkich wpisów na dashboardzie, strona edycji, endpoint zapisu, ochrona trasy i smoke.

### Changes Required:

#### 1. Lista na dashboardzie (FR-004)

**File**: `src/pages/dashboard.astro`

**Intent**: Pod sumą i odnowieniami sekcja „All subscriptions” z każdym wierszem z już pobranej tablicy (bez nowego zapytania), posortowana po nazwie (`localeCompare`). Wiersz: nazwa, cena w walucie + etykieta cyklu, „Next renewal” — data po rolloverze dla `active`; dla `cancelled` (dziś nieosiągalne z UI) etykieta „Cancelled” zamiast daty, bez rolloveru — szczegóły FR-007 należą do S-03. Link „Edit” → `/subscriptions/<id>/edit`. Sekcja widoczna, gdy jest choć jeden wiersz; stan pusty bez zmian.

**Contract**: link edycji ma postać `href="/subscriptions/<uuid>/edit"` (smoke wyciąga z niej id).

#### 2. Strona edycji

**File**: `src/pages/subscriptions/[id]/edit.astro`

**Intent**: SSR: waliduje `Astro.params.id` (`parseSubscriptionId`), pobiera wiersz `.eq("id", id).maybeSingle()` (RLS), a formularz `SubscriptionForm` wypełnia danymi wpisu z datą `nextRenewalDate(…, todayInWarsaw(new Date()))`; gdy w URL jest `error`, wartości z `formValuesFromSearchParams` mają pierwszeństwo przed danymi z bazy. Nieprawidłowy id lub brak wiersza → stan „Subscription not found” z linkiem do `/dashboard` i `Astro.response.status = 404`. Brak Supabase / błąd zapytania → komunikat jak na dashboardzie. Layout spójny z dashboardem (`Topbar`, link „Back to dashboard”).

**Contract**: `action="/api/subscriptions/<id>"`, `submitLabel="Save changes"`.

#### 3. Endpoint zapisu (FR-005)

**File**: `src/pages/api/subscriptions/[id].ts`

**Intent**: `POST: APIRoute` wg wzorca z `src/pages/api/subscriptions.ts`: brak użytkownika → `/auth/signin`; nieprawidłowy id → `/dashboard?error=Subscription not found`; błąd `parseNewSubscription` → `formErrorLocation("/subscriptions/<id>/edit", …)`; odczyt istniejącego wiersza (RLS) — brak → `/dashboard?error=Subscription not found`; `next_renewal_date` z `renewalDateToStore`; `update(...).eq("id", id)` z pozostałymi czterema polami; błąd bazy → strona edycji z „Could not save the subscription” (bez surowego komunikatu bazy); sukces → `/dashboard`.

**Contract**: payload update to wyłącznie `name, price, currency, billing_cycle, next_renewal_date` — nigdy `user_id` ani `status`. Plik obok istniejącego `src/pages/api/subscriptions.ts` (Astro obsługuje oba).

#### 4. Ochrona trasy

**File**: `src/middleware.ts`

**Intent**: Dopisać `/subscriptions` do `PROTECTED_ROUTES`, żeby niezalogowany trafiał na `/auth/signin`.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/api/subscriptions", "/subscriptions"]`.

#### 5. Smoke

**File**: `scripts/smoke.mjs`, opis w `README.md` (jeśli wymienia kroki smoke) i w `CLAUDE.md` (sekcja Testy: „…dodanie subskrypcji z jej widocznością…”)

**Intent**: Po kroku „dashboard lists the added subscription” wyciągnąć id z linku Edit i sprawdzić: strona edycji 200 z nazwą wpisu; POST edycji (nowa nazwa + cena) → dokładnie `302 /dashboard`; dashboard zawiera nową nazwę; POST na losowy uuid → `302` z `/dashboard?error=`; GET edycji losowego uuid → 404; po wylogowaniu GET strony edycji → `302 /auth/signin`.

**Contract**: smoke zostaje bez zależności; kroki nadal deklaratywne, id przekazany przez zmienną ustawianą przez wcześniejszy krok.

#### 6. Dokumentacja projektu

**File**: `CLAUDE.md`

**Intent**: Zaktualizować opis stanu: S-02 zaimplementowane (lista na `/dashboard`, edycja `/subscriptions/[id]/edit` + `POST /api/subscriptions/[id]`), `PROTECTED_ROUTES` z `/subscriptions`, komponenty formularza w `src/components/form/`.

**Contract**: sekcje „Czym jest ten projekt”, „Przepływ auth” pkt 1–3, „Testy” (smoke).

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Job `smoke` w CI przechodzi z nowymi krokami edycji

#### Manual Verification:

- Na produkcji: rejestracja → trzy subskrypcje → edycja jednej (cena) → suma per waluta i odnowienia na `/dashboard` od razu uwzględniają zmianę (przepływ MVP z PRD)
- Edycja samej ceny wpisu z datą w przeszłości nie zmienia pokazywanej daty odnowienia
- Zmiana daty w formularzu edycji przesuwa wpis na liście odnowień zgodnie z nową datą
- Błąd walidacji na stronie edycji (np. cena `0`) zostawia wpisane wartości i komunikat
- Drugie konto otwierające `/subscriptions/<id>/edit` cudzego wpisu widzi „Subscription not found”

**Implementation Note**: Push na `master` wykonuje człowiek (deploy z CI); weryfikację na produkcji potwierdza człowiek.

---

## Testing Strategy

### Unit Tests:

- `renewalDateToStore`: macierz zmieniona/niezmieniona data × zmieniony/niezmieniony cykl, baza w przeszłości z rolloverem, kotwica 31.
- `parseSubscriptionId`: poprawny uuid, pusty, `undefined`, nie-uuid, uuid z białymi znakami.
- `formErrorLocation` / `formValuesFromSearchParams`: round-trip, kodowanie znaków specjalnych, ignorowanie nieznanych pól, limit długości.

### Integration Tests:

- `scripts/smoke.mjs` (CI): pełny przepływ dodaj → edytuj → zobacz zmianę, nieistniejący id, ochrona trasy po wylogowaniu.
- pgTAP bez zmian — izolacja update między kontami już pokryta.

### Manual Testing Steps:

1. Zaloguj się, dodaj subskrypcję miesięczną z datą 31. dnia ubiegłego miesiąca; otwórz edycję i sprawdź, że data to najbliższe odnowienie.
2. Zmień tylko cenę, zapisz; sprawdź nową sumę i niezmienioną datę odnowienia.
3. Zmień cykl na roczny bez zmiany daty; sprawdź, że odnowienie zostaje na pokazanej dacie, a koszt miesięczny = cena/12.
4. Wpisz cenę `0` z wyłączoną walidacją kliencką (np. DevTools) — wraca strona edycji z komunikatem i wpisanymi wartościami.
5. Z drugiego konta otwórz URL edycji z kroku 1 — „Subscription not found”.

## Performance Considerations

Brak istotnych: lista korzysta z danych już pobranych przez dashboard; endpoint edycji robi jeden select i jeden update po kluczu głównym.

## Migration Notes

Brak migracji bazy. Przeniesienie komponentów formularza zmienia ścieżki importu w `src/components/auth/*`.

## References

- Roadmapa: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (FR-004, FR-005, Success Criteria)
- Poprzedni wycinek: `context/archive/2026-10-02-home-screen-cost-and-renewals/plan.md`
- Odłożone obserwacje F6/F7: `context/archive/2026-10-02-home-screen-cost-and-renewals/reviews/impl-review.md`
- Wzorzec endpointu: `src/pages/api/subscriptions.ts:9-31`
- Rollover: `src/lib/services/subscriptions.ts:28-42`
- Polityka update: `supabase/migrations/20261002091205_create_subscriptions.sql:45-50`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reguły edycji i helpery formularza

#### Automated

- [x] 1.1 Testy jednostkowe przechodzą: `npm test` — b753039
- [x] 1.2 Lint przechodzi: `npm run lint` — b753039
- [x] 1.3 Typy przechodzą: `npx astro check` — b753039

### Phase 2: Wspólny formularz subskrypcji

#### Automated

- [x] 2.1 Testy jednostkowe przechodzą: `npm test` — a90f82b
- [x] 2.2 Lint przechodzi: `npm run lint` — a90f82b
- [x] 2.3 Typy przechodzą: `npx astro check` — a90f82b
- [x] 2.4 Build przechodzi: `npm run build` — a90f82b
- [x] 2.5 W `src/components/auth/` nie ma już `FormField`, `SubmitButton`, `ServerError`: `ls src/components/auth` — a90f82b

#### Manual

- [x] 2.6 Logowanie, rejestracja i dodawanie subskrypcji działają jak przed zmianą — a90f82b
- [x] 2.7 Błąd serwera przy dodawaniu zostawia wpisane nazwę, cenę i datę w formularzu — a90f82b

### Phase 3: Lista i edycja

#### Automated

- [x] 3.1 Testy jednostkowe przechodzą: `npm test` — d188066
- [x] 3.2 Lint przechodzi: `npm run lint` — d188066
- [x] 3.3 Typy przechodzą: `npx astro check` — d188066
- [x] 3.4 Build przechodzi: `npm run build` — d188066
- [x] 3.5 Job `smoke` w CI przechodzi z nowymi krokami edycji — d188066

#### Manual

- [x] 3.6 Na produkcji przepływ MVP z PRD z edycją jednej subskrypcji daje poprawną sumę i odnowienia — d188066
- [x] 3.7 Edycja samej ceny wpisu z datą w przeszłości nie zmienia pokazywanej daty odnowienia — d188066
- [x] 3.8 Zmiana daty w formularzu edycji przesuwa wpis na liście odnowień zgodnie z nową datą — d188066
- [x] 3.9 Błąd walidacji na stronie edycji zostawia wpisane wartości i komunikat — d188066
- [x] 3.10 Drugie konto otwierające edycję cudzego wpisu widzi „Subscription not found” — d188066
