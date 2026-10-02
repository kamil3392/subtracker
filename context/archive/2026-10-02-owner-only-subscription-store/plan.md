# Magazyn subskrypcji z izolacją per konto — plan implementacji

## Overview

Fundament F-01 z `context/foundation/roadmap.md`: pierwsza tabela domenowa `public.subscriptions` z polami wymaganymi przez FR-003 i FR-007 oraz Row Level Security, które sama baza wymusza dla NFR prywatności („żaden użytkownik ani osoba niezalogowana nie widzi subskrypcji innego konta”). Izolację potwierdzają automatyczne testy pgTAP w CI, aplikacja dostaje typy bazy, a migracja trafia na hostowany Supabase przez bramkę ręczną. Bez UI i bez logiki przeliczeń — to zakres S-01.

## Current State Analysis

- Jedyna używana tabela to `auth.users`; `supabase/migrations/` nie istnieje (`CLAUDE.md:5`, `README.md:115`).
- `supabase/config.toml`: Postgres 17, `[db.migrations] enabled = true` (`supabase/config.toml:53-55`), lokalnie `enable_confirmations = false`.
- Klient Supabase SSR jest nietypowany: `createServerClient(SUPABASE_URL, SUPABASE_KEY, …)` (`src/lib/supabase.ts:9`); `src/types.ts` nie istnieje.
- Job `smoke` w CI już startuje lokalny Supabase (`.github/workflows/ci.yml:39-41`), który przy starcie stosuje migracje — naturalne miejsce na `supabase test db`.
- Brak testów i runnera; jedyna automatyczna kontrola to `scripts/smoke.mjs` (przepływ auth po HTTP).
- Projekt nie jest połączony (`supabase link`) z hostowanym Supabase (`supabase/.temp/` zawiera tylko `cli-latest`); agent nie wykonuje operacji wdrożeniowych na produkcji — robi to człowiek (`context/deployment/deploy-plan.md`).
- `infrastructure.md` (risk register): rollback Workera nie cofa migracji → migracje muszą być addytywne / wstecznie zgodne.

## Desired End State

- `supabase/migrations/<YYYYMMDDHHmmss>_create_subscriptions.sql` tworzy `public.subscriptions` z RLS i czterema politykami (select/insert/update/delete) dla `authenticated`; `anon` nie ma żadnych uprawnień do tabeli.
- `supabase/tests/subscriptions_rls.test.sql` dowodzi izolacji dwóch kont i braku dostępu anon dla wszystkich czterech operacji oraz pilnuje ograniczeń danych; uruchamia się w CI i lokalnie przez `npx supabase test db`.
- `createClient()` zwraca klienta typowanego `Database`; `src/types.ts` eksportuje typ encji `Subscription` i jej enumy — gotowe dla S-01.
- README i CLAUDE.md opisują istnienie migracji i testów DB.
- Migracja jest zastosowana na hostowanym Supabase, a wynik zapisany w `context/deployment/deploy-plan.md`.

Weryfikacja: `npx supabase db reset` + `npx supabase test db` lokalnie zielone; job `smoke` w CI zielony; `supabase migration list` po stronie produkcji pokazuje migrację jako zastosowaną; zapytanie anon do `/rest/v1/subscriptions` jest odrzucane.

### Key Discoveries:

- `src/lib/supabase.ts:9` — jedyne miejsce tworzenia klienta; wystarczy parametr generyczny `<Database>`, żeby typy dotarły do middleware i przyszłych endpointów.
- `.github/workflows/ci.yml:41` — `supabase start -x … postgres-meta …`: generowanie typów nie działa w CI w tej konfiguracji, więc typy są generowane lokalnie i commitowane.
- Supabase domyślnie nadaje `anon` i `authenticated` pełne uprawnienia do nowych tabel w `public`; RLS bez polityk dla `anon` już blokuje wiersze, a jawne `revoke` daje drugą warstwę i czytelny błąd `42501`.

## What We're NOT Doing

- UI, formularze, endpointy API, zod-owe schematy wejścia — S-01/S-02/S-03.
- Przeliczanie cykli na koszt miesięczny, sumy per waluta, rollover daty odnowienia (FR-008/FR-009) — S-01 (liczone przy odczycie, więc baza trzyma tylko datę bazową).
- Kolumna `updated_at` z triggerem, `cancelled_at`, historia zmian cen — żaden FR tego nie wymaga.
- Zamknięta lista walut w bazie — baza pilnuje tylko formatu ISO 4217; lista w formularzu należy do S-01.
- Automatyczny `supabase db push` w CI — wybrano bramkę ręczną.
- Skrypt Node testujący izolację przez PostgREST — wybrano pgTAP.
- Testy jednostkowe w JS / wybór runnera — należy do S-01 (przeliczanie cykli).

## Implementation Approach

Kolejność „schemat → weryfikacja → typy aplikacji → produkcja”: migracja powstaje i jest stosowana lokalnie, testy pgTAP dowodzą izolacji zanim cokolwiek z niej korzysta, typy generuje się dopiero ze zweryfikowanego schematu, a produkcja dostaje migrację na końcu, gdy CI ją potwierdził. Migracja jest czysto addytywna (nowa tabela, nowe typy), więc obecny kod aplikacji i rollback Workera nie są nią dotknięte.

## Critical Implementation Details

- **Update wymaga `USING` i `WITH CHECK`** — samo `USING` pozwoliłoby właścicielowi przepisać `user_id` na cudze konto i „wstrzyknąć” wiersz innemu użytkownikowi. Test pgTAP musi to łapać.
- **Testy pgTAP symulują użytkownika rolą + claims** — w transakcji `set local role authenticated` i `set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`; użytkownicy testowi wstawiani bezpośrednio do `auth.users` jako superuser przed zmianą roli. Odczyt/aktualizacja/usunięcie cudzego wiersza nie rzuca błędu, tylko dotyka 0 wierszy — asercja musi liczyć wiersze (np. CTE z `returning`), a nie oczekiwać wyjątku. Insert z cudzym `user_id` i update zmieniający `user_id` rzucają `42501`.
- **Wygenerowany plik typów a lint** — `src/db/database.types.ts` jest objęty `eslint .` z type-aware regułami; jeśli wygenerowany kod łamie reguły, dodaj ten plik do ignorowanych w `eslint.config.js`, zamiast ręcznie edytować wygenerowany plik.

## Phase 1: Migracja schematu i RLS

### Overview

Tabela `public.subscriptions` z ograniczeniami danych i politykami dostępu, stosowana lokalnie bez błędów.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_subscriptions.sql` (znacznik czasu z chwili utworzenia, np. przez `npx supabase migration new create_subscriptions`)

**Intent**: Utworzyć magazyn subskrypcji, w którym baza sama gwarantuje poprawność pól i własność wiersza, zgodnie z regułą z CLAUDE.md (RLS + osobna polityka per operacja dla `authenticated`).

**Contract**:
- Typy enum: `public.billing_cycle` = `monthly | quarterly | yearly`; `public.subscription_status` = `active | cancelled` (enumy zamiast text+check, żeby wygenerowane typy TS były uniami).
- Kolumny `public.subscriptions`:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`
  - `name text not null`, CHECK: `char_length(btrim(name)) between 1 and 100`
  - `price numeric(10,2) not null`, CHECK: `price > 0`
  - `currency text not null`, CHECK: `currency ~ '^[A-Z]{3}$'` (format ISO 4217)
  - `billing_cycle public.billing_cycle not null`
  - `next_renewal_date date not null` (data bazowa; rollover liczony przy odczycie w S-01)
  - `status public.subscription_status not null default 'active'`
  - `created_at timestamptz not null default now()`
- Indeks na `user_id`.
- `alter table … enable row level security`.
- Cztery polityki `to authenticated`, każda oparta na `(select auth.uid()) = user_id`: `select` (USING), `insert` (WITH CHECK), `update` (USING **i** WITH CHECK), `delete` (USING).
- `revoke all on public.subscriptions from anon`.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie: `npx supabase db reset` kończy się bez błędów
- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Przegląd SQL migracji: cztery polityki, update z `USING` i `WITH CHECK`, `revoke` dla `anon`, wszystkie CHECK obecne

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Testy izolacji pgTAP i CI

### Overview

Automatyczny dowód NFR prywatności i ograniczeń danych, uruchamiany przy każdym pushu/PR.

### Changes Required:

#### 1. Test pgTAP

**File**: `supabase/tests/subscriptions_rls.test.sql`

**Intent**: Udowodnić, że konto B nie czyta, nie zmienia i nie usuwa subskrypcji konta A, nie może jej podrzucić A, a anon nie ma dostępu w ogóle; dodatkowo przypiąć ograniczenia danych, na których oprze się S-01.

**Contract**: Plik w konwencji `supabase test db`: `begin; create extension if not exists pgtap with schema extensions; select plan(N); … select * from finish(); rollback;`. Przypadki (każdy = co najmniej jedna asercja):
- A wstawia własny wiersz bez podawania `user_id` → `user_id` = A (default `auth.uid()`).
- A widzi swój wiersz; B widzi 0 wierszy A.
- B: update wiersza A dotyka 0 wierszy i nie zmienia danych; delete wiersza A dotyka 0 wierszy, wiersz nadal istnieje.
- B: insert z `user_id` = A → `throws_ok` z `42501`.
- A: update własnego wiersza zmieniający `user_id` na B → `throws_ok` z `42501`.
- A: update i delete własnego wiersza działają.
- anon: `select` z tabeli → `throws_ok` z `42501`.
- Ograniczenia: `price = 0`, `currency = 'pln'`, pusta/białoznakowa `name`, niedozwolony `billing_cycle` → odrzucone.

#### 2. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Uruchamiać testy DB w jobie `smoke`, który już ma lokalny Supabase z zastosowanymi migracjami.

**Contract**: Nowy krok `supabase test db` w jobie `smoke` zaraz po kroku „Start local Supabase”, przed buildem; job `ci` i `deploy` bez zmian.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` lokalnie: wszystkie asercje przechodzą
- Test jest wrażliwy na regresję: usunięcie `WITH CHECK` lub polityki select wywraca `npx supabase test db` (zmiana tymczasowa, wycofana)
- `npm run smoke` przeciw lokalnemu dev serverowi nadal przechodzi

#### Manual Verification:

- Job `smoke` w GitHub Actions jest zielony i wykonuje `supabase test db`

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Typy w aplikacji i dokumentacja

### Overview

Aplikacja zna schemat w typach, a dokumentacja przestaje twierdzić, że migracji nie ma.

### Changes Required:

#### 1. Wygenerowane typy bazy

**File**: `src/db/database.types.ts`, `package.json`

**Intent**: Dać S-01 typowany dostęp do tabeli bez ręcznego utrzymywania kształtu wiersza.

**Contract**: Plik generowany przez `npx supabase gen types typescript --local`; nowy skrypt npm `db:types` zapisujący do tego pliku. Plik commitowany (CI nie ma `postgres-meta`). Patrz „Critical Implementation Details” w sprawie lintu.

#### 2. Typowany klient

**File**: `src/lib/supabase.ts`

**Intent**: Typy docierają do każdego miejsca, które używa klienta.

**Contract**: `createServerClient<Database>(…)`; sygnatura `createClient()` i zachowanie `null` przy braku konfiguracji bez zmian.

#### 3. Typy encji

**File**: `src/types.ts` (nowy)

**Intent**: Współdzielony typ encji zgodnie z konwencją z CLAUDE.md (encje i DTO w `src/types.ts`).

**Contract**: Eksporty `Subscription` (wiersz tabeli), `BillingCycle`, `SubscriptionStatus` — wyprowadzone z `Database`, bez duplikowania pól.

#### 4. Dokumentacja

**File**: `README.md`, `CLAUDE.md`

**Intent**: Usunąć nieaktualne twierdzenia i opisać nowy przepływ pracy z bazą.

**Contract**: `README.md:115` — zastąpić zdanie o braku tabel opisem: migracje w `supabase/migrations/`, testy w `supabase/tests/` (`npx supabase test db`), regeneracja typów (`npm run db:types`), CI uruchamia testy DB w jobie `smoke`. `CLAUDE.md:5` — zaktualizować stan („istnieje `public.subscriptions`…”), zachowując regułę RLS; w sekcji „Testy” dopisać `npx supabase test db`.

### Success Criteria:

#### Automated Verification:

- `npm run db:types` odtwarza `src/db/database.types.ts` bez różnic
- `npx astro sync && npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` przechodzi

#### Manual Verification:

- README i CLAUDE.md nie zawierają już twierdzenia, że migracji/tabel domenowych nie ma

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 4.

---

## Phase 4: Migracja na hostowany Supabase (bramka ręczna)

### Overview

Produkcja dostaje tę samą migrację, którą potwierdził CI; wykonuje ją człowiek, agent przygotowuje polecenia i zapisuje wynik.

### Changes Required:

#### 1. Wdrożenie migracji (człowiek)

**File**: — (polecenia w terminalu użytkownika)

**Intent**: Zastosować migrację na produkcji bez wprowadzania nowych sekretów do CI ani do rozmowy.

**Contract**: Użytkownik w swoim terminalu: `npx supabase login` → `npx supabase link --project-ref <ref>` (hasło bazy wpisywane interaktywnie) → `npx supabase db push --dry-run` (oczekiwane: tylko `create_subscriptions`) → `npx supabase db push` → `npx supabase migration list` (Local = Remote). Następnie sprawdzenie anon: `curl "$SUPABASE_URL/rest/v1/subscriptions?select=id" -H "apikey: $SUPABASE_KEY"` → odmowa (`42501` / permission denied), nie `[]` z danymi.

#### 2. Zapis w deploy-plan

**File**: `context/deployment/deploy-plan.md`

**Intent**: Utrzymać deploy-plan jako źródło prawdy o stanie produkcji.

**Contract**: Nowy wpis z datą: migracja `create_subscriptions` zastosowana, wynik `migration list` i sprawdzenia anon; usunąć „migracje `supabase/migrations/`” z listy rzeczy poza zakresem (`deploy-plan.md:284`); w stanie Supabase zastąpić „brak tabel domenowych” opisem `public.subscriptions` z RLS. Dopisać zasadę: każda nowa migracja wymaga ręcznego `db push` przed merge zmiany, która z niej korzysta.

### Success Criteria:

#### Manual Verification:

- `npx supabase migration list` na produkcji pokazuje migrację `create_subscriptions` po stronie Remote
- Zapytanie anon do `/rest/v1/subscriptions` na produkcji jest odrzucane
- `context/deployment/deploy-plan.md` zawiera wpis o migracji i zasadę ręcznego `db push`

---

## Testing Strategy

### Unit Tests:

- Brak testów JS w tej zmianie (brak logiki aplikacyjnej); runner wybiera S-01.

### Integration Tests:

- `supabase/tests/subscriptions_rls.test.sql` (pgTAP): izolacja A/B dla select/insert/update/delete, blokada przepisania `user_id`, brak dostępu anon, ograniczenia CHECK.
- `scripts/smoke.mjs` bez zmian — potwierdza brak regresji auth.

### Manual Testing Steps:

1. Lokalnie `npx supabase db reset && npx supabase test db` — wszystkie asercje zielone.
2. Tymczasowo usuń `WITH CHECK` z polityki update, uruchom testy — muszą się wywrócić; przywróć.
3. Po fazie 4 sprawdź anon na produkcji poleceniem `curl` z fazy 4.

## Performance Considerations

Indeks na `user_id` wystarcza dla skali z PRD (kilkanaście wpisów na użytkownika). `(select auth.uid())` w politykach jest wyliczane raz na zapytanie, a nie per wiersz.

## Migration Notes

Migracja czysto addytywna (dwa enumy, jedna tabela) — wstecznie zgodna z obecnym kodem, więc kolejność „deploy Workera” vs „db push” nie ma znaczenia dla tej zmiany. Wycofanie: brak automatycznego down; ręcznie `drop table public.subscriptions; drop type public.subscription_status; drop type public.billing_cycle;` (bezpieczne tylko zanim S-01 zacznie zapisywać dane).

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- PRD: `context/foundation/prd.md` (FR-003, FR-007, NFR prywatności, Access Control)
- Ryzyka migracji: `context/foundation/infrastructure.md` (risk register)
- Stan produkcji: `context/deployment/deploy-plan.md`
- Klient Supabase: `src/lib/supabase.ts:9`
- CI: `.github/workflows/ci.yml:39-41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja schematu i RLS

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie: `npx supabase db reset` kończy się bez błędów — a7d8989
- [x] 1.2 `npm run lint` przechodzi — a7d8989
- [x] 1.3 `npx astro check` przechodzi — a7d8989

#### Manual

- [x] 1.4 Przegląd SQL migracji: cztery polityki, update z `USING` i `WITH CHECK`, `revoke` dla `anon`, wszystkie CHECK obecne — a7d8989

### Phase 2: Testy izolacji pgTAP i CI

#### Automated

- [x] 2.1 `npx supabase test db` lokalnie: wszystkie asercje przechodzą — c3b400b
- [x] 2.2 Test jest wrażliwy na regresję: usunięcie `WITH CHECK` lub polityki select wywraca `npx supabase test db` (zmiana tymczasowa, wycofana) — c3b400b
- [x] 2.3 `npm run smoke` przeciw lokalnemu dev serverowi nadal przechodzi — c3b400b

#### Manual

- [x] 2.4 Job `smoke` w GitHub Actions jest zielony i wykonuje `supabase test db` — c3b400b

### Phase 3: Typy w aplikacji i dokumentacja

#### Automated

- [x] 3.1 `npm run db:types` odtwarza `src/db/database.types.ts` bez różnic — bc86177
- [x] 3.2 `npx astro sync && npm run lint` przechodzi — bc86177
- [x] 3.3 `npx astro check` przechodzi — bc86177
- [x] 3.4 `npm run build` przechodzi — bc86177

#### Manual

- [x] 3.5 README i CLAUDE.md nie zawierają już twierdzenia, że migracji/tabel domenowych nie ma — bc86177

### Phase 4: Migracja na hostowany Supabase (bramka ręczna)

#### Manual

- [x] 4.1 `npx supabase migration list` na produkcji pokazuje migrację `create_subscriptions` po stronie Remote — 2cc59da
- [x] 4.2 Zapytanie anon do `/rest/v1/subscriptions` na produkcji jest odrzucane — 2cc59da
- [x] 4.3 `context/deployment/deploy-plan.md` zawiera wpis o migracji i zasadę ręcznego `db push` — 2cc59da
