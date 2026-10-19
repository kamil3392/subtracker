# Lista i edycja subskrypcji — Plan Brief

> Full plan: `context/changes/subscription-list-and-edit/plan.md`

## What & Why

Wycinek S-02 (FR-004, FR-005): użytkownik przegląda wszystkie własne subskrypcje i poprawia dowolny wpis, a suma i odnowienia na `/dashboard` od razu to odzwierciedlają. Zamyka krok „edycja jednej” z przepływu MVP w PRD.

## Starting Point

`/dashboard` pokazuje koszt per waluta, odnowienia w 30 dni i formularz dodawania (S-01), ale nie ma listy wszystkich wpisów ani edycji. Baza jest gotowa — polityka RLS `update` i jej testy pgTAP istnieją, migracja niepotrzebna. Przegląd S-01 odłożył do tej zmiany F6 (utrata danych formularza po błędzie) i F7 (komponenty formularza w `components/auth/`).

## Desired End State

Pod sumą na `/dashboard` jest lista „All subscriptions” z linkiem Edit. Strona `/subscriptions/<id>/edit` pokazuje wypełniony formularz z datą odnowienia taką jak na dashboardzie; zapis wraca na `/dashboard` ze zaktualizowanymi liczbami. Cudzy/nieistniejący wpis → „Subscription not found” (404). Formularze po błędzie serwera zachowują wpisane wartości.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Miejsce listy | Sekcja na `/dashboard` | Dane już są pobrane, a skutek edycji widać na tej samej stronie. |
| Forma edycji | Strona `/subscriptions/[id]/edit` + `POST /api/subscriptions/[id]` | Wpisuje się we wzorzec natywny POST + redirect; `?error=` zostaje przy wpisie. |
| Data w formularzu | Po rolloverze; baza zostaje, gdy data **i** cykl niezmienione | Użytkownik widzi datę z dashboardu, a kotwica 31. nie spada na 28.; zmiana cyklu zapisuje pokazaną datę. |
| F7 | Komponenty do `src/components/form/` | Drugi formularz domenowy korzysta z nich. |
| F6 | Wartości wracają w parametrach redirectu `?error=` | Bez zmiany wzorca (bez `fetch`), dla dodawania i edycji. |
| Nieznany id | Stan „not found” + 404 zamiast redirectu we frontmatterze | Redirect we frontmatterze łamie `no-misused-promises`. |
| Anulowane na liście | Etykieta „Cancelled”, bez rolloveru; reszta w S-03 | FR-007 należy do S-03. |

## Scope

**In scope:** reguła `renewalDateToStore` + `parseSubscriptionId` + helpery F6 z testami; przeniesienie komponentów; wyspa `SubscriptionForm` (dodawanie i edycja); lista na dashboardzie; strona i endpoint edycji; `/subscriptions` w `PROTECTED_ROUTES`; rozszerzony smoke; aktualizacja `CLAUDE.md`.

**Out of scope:** usuwanie/anulowanie i FR-007 (S-03), migracje i zmiany RLS, edycja inline, osobna strona listy, konflikty równoczesnej edycji, testy komponentów/E2E.

## Architecture / Approach

Dashboard renderuje listę z już pobranych wierszy. Strona edycji (SSR) czyta wiersz przez RLS i przekazuje wartości do wyspy `SubscriptionForm`, która robi tylko walidację kliencką i wysyła natywny POST. Endpoint waliduje id i pola zod-em, czyta istniejący wiersz, ustala datę bazową czystą funkcją i robi update tylko pięciu pól; wynik komunikuje redirectem.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reguły i helpery | Przetestowane: wybór daty, walidacja id, F6 | Pominięty przypadek zmiany cyklu — pokryty testem |
| 2. Wspólny formularz | F7 + `SubscriptionForm` + F6 dla dodawania | Regresja auth/dodawania po przeniesieniu importów |
| 3. Lista i edycja | Lista, strona i endpoint edycji, smoke | Smoke tylko w CI (lokalny kong nie działa) |

**Prerequisites:** S-01 zarchiwizowany i na produkcji; push na `master` robi człowiek.
**Estimated effort:** ~2 sesje w 3 fazach.

## Open Risks & Assumptions

- Lokalny pełny stos Supabase nie startuje (kong) — smoke i UI weryfikowane w CI i na produkcji.
- Wartości formularza w URL po błędzie lądują w historii przeglądarki/logach — akceptowalne (nazwa, cena, data nie są wrażliwe).
- Ostatni zapis wygrywa przy równoczesnej edycji — akceptowalne dla jednego użytkownika na koncie.

## Success Criteria (Summary)

- Przepływ PRD na produkcji: rejestracja → trzy subskrypcje → edycja jednej → poprawna suma i odnowienia.
- Edycja bez zmiany daty i cyklu nie przesuwa kotwicy dnia.
- `npm test`, lint, `astro check` i job `smoke` zielone.
