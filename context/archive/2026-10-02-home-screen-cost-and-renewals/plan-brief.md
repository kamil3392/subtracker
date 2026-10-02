# Ekran główny: koszt miesięczny i odnowienia — Plan Brief

> Full plan: `context/changes/home-screen-cost-and-renewals/plan.md`

## What & Why

Wycinek S-01 (north star kamienia M-1): zalogowany użytkownik dodaje subskrypcje i na ekranie głównym widzi uśredniony koszt miesięczny osobno dla każdej waluty oraz listę odnowień w ciągu 30 dni. To główne kryterium sukcesu PRD; bariera jakości „błędna suma niszczy zaufanie” wymaga, by reguły liczenia były przetestowane, zanim cokolwiek je wyświetli.

## Starting Point

Tabela `public.subscriptions` z RLS istnieje (F-01), ale aplikacja jej nie używa: po zalogowaniu użytkownik trafia na landing startera, `/dashboard` jest zaślepką, nie ma endpointu zapisu, runnera testów ani helperów dat. `authenticated` ma domyślne ALL na tabeli (w tym TRUNCATE) — ustalenie F1 z przeglądu F-01.

## Desired End State

Logowanie prowadzi na `/dashboard` z kafelkami kosztu per waluta, listą odnowień i formularzem dodawania; nowe konto widzi stan pusty. Daty odnowień w przeszłości przesuwają się o cykl przy odczycie. Reguły są czystymi funkcjami z testami vitest w CI, smoke sprawdza dodanie subskrypcji end-to-end, a `authenticated` ma tylko select/insert/update/delete — także na produkcji.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Trasa ekranu | `/dashboard`; signin i `/` (zalogowany) przekierowują tam | Ochrona już działa w middleware, smoke sprawdza tę trasę. |
| Koniec miesiąca | Kotwica do dnia z daty bazowej: 31.01 → 28.02 → 31.03 | Odpowiada obciążeniom kart i nie dryfuje. |
| Okno odnowień | [dziś, dziś+30] włącznie (2.10 → do 1.11) | Dzisiejsze odnowienie jest najważniejsze, pełne 30 dni naprzód. |
| „Dziś” | `Europe/Warsaw` przez `Intl` | Persona w Polsce; UTC myliłby dzień po północy. |
| Anulowane | S-01 liczy tylko `active`; FR-007 dokłada S-03 | Ścisły podział z roadmapy. |
| Waluta | Lista PLN/EUR/USD/GBP/CHF, domyślnie PLN | Literówka nie rozbija sum per waluta. |
| Język UI | Angielski, kwoty/daty `pl-PL` | Spójność z istniejącymi stronami. |
| Uprawnienia (F1) | Migracja revoke/grant + `table_privs_are` | Domknięcie ryzyka TRUNCATE przed prawdziwymi danymi. |
| Kwoty (F7) | Walidacja ≤ 2 miejsc i < 1e8; sumy w groszach, jedno zaokrąglenie | Bez cichej utraty groszy i rozjazdów przy rocznych. |
| zod | `astro/zod` zamiast przestarzałego `astro:schema` | Importowalne w vitest, przeżyje Astro 8; bez nowej zależności. |
| Runner | vitest (node), `npm test` w jobie `ci` | Czyste funkcje, pierwszy runner w projekcie. |

## Scope

**In scope:** migracja grantów + pgTAP; serwis dat i reguł z testami; schemat zod i `POST /api/subscriptions`; ekran `/dashboard` (suma, odnowienia, stan pusty, formularz); przekierowania; rozszerzony smoke; `db push` na produkcję.

**Out of scope:** lista i edycja (S-02), usuwanie i anulowanie oraz reguła FR-007 (S-03), kursy walut, FR-010, tłumaczenie UI, strefa per użytkownik, zapisywanie przesuniętej daty w bazie, testy komponentów/E2E w przeglądarce.

## Architecture / Approach

Strona SSR `/dashboard` czyta wiersze właściciela (RLS), liczy „dziś” w Warszawie i przekazuje dane do czystych funkcji w `src/lib/services/` (rollover, okno, sumy w groszach). Formularz to wyspa React z walidacją kliencką, wysyłająca natywny `POST` do `/api/subscriptions`, który waliduje zod-em, wstawia wiersz (`user_id` z `auth.uid()`) i wraca redirectem — jak przepływ auth.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Uprawnienia | `authenticated` tylko 4 operacje, test pgTAP | Lokalny stos Supabase na tej maszynie (używać `db start`, nie `db reset`) |
| 2. Serwis + vitest | Przetestowane reguły dat i sum, krok w CI | Pułapki dat/stref — pokryte przypadkami granicznymi |
| 3. Zapis | Schemat zod + endpoint chroniony | Zgodność walidacji klienta i serwera |
| 4. Ekran główny | `/dashboard`, redirecty, smoke | Smoke zależny od CI (lokalnie kong nie działa) |
| 5. Produkcja | Migracja grantów na hostowanym Supabase | Bramka ręczna `db push` |

**Prerequisites:** F-01 zarchiwizowany i na produkcji; lokalna baza (`npx supabase db start`); push do `master` robi człowiek.
**Estimated effort:** ~3–4 sesje w 5 fazach.

## Open Risks & Assumptions

- Lokalny pełny stos Supabase nie startuje (kong) — smoke i ręczne testy UI weryfikowane w CI i na produkcji.
- Push fazy 4 na `master` od razu deployuje — UI trafia na produkcję przed fazą 5 (bezpieczne: granty nie wpływają na działanie aplikacji).

## Success Criteria (Summary)

- Przepływ PRD: rejestracja → trzy subskrypcje o różnych cyklach → poprawna suma per waluta i odnowienia w 30 dni na produkcji.
- `npm test`, `supabase test db` i job `smoke` zielone w CI.
- `authenticated` bez TRUNCATE na produkcji.
