---
date: 2026-10-19T13:47:11+02:00
researcher: Claude (Opus 5.5)
git_commit: aa8d2013e15d4cdd4d4be829575ae2545912e356
branch: master
repository: subtracker
topic: "Ugruntowanie Phase 1 planu testów: wyrocznia reguły kosztu i dat (ryzyka #1, #2, #4)"
tags: [research, testing, subscriptions-service, dates, fr-007, fr-008, fr-009]
status: complete
last_updated: 2026-10-19
last_updated_by: Claude (Opus 5.5)
---

# Research: Ugruntowanie Phase 1 planu testów — wyrocznia reguły kosztu i dat

**Date**: 2026-10-19T13:47:11+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: aa8d2013e15d4cdd4d4be829575ae2545912e356
**Branch**: master
**Repository**: subtracker

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` (ryzyka #1, #2, #4): dla każdego ryzyka znaleźć realną ścieżkę awarii w kodzie, zweryfikować lub skorygować Risk Response Guidance, zlokalizować istniejące testy, wskazać najtańszą użyteczną warstwę i oznaczyć ryzyka spekulatywne lub mylący dowód hot-spotu.

## Summary

- Reguła żyje w dwóch czystych modułach: `src/lib/services/dates.ts` (kalendarz `YYYY-MM-DD`, „dziś” w Warszawie) i `src/lib/services/subscriptions.ts` (rollover, FR-007, suma, udziały, odnowienia). Ekran (`src/components/dashboard/DashboardView.astro:32-38`) wywołuje cztery funkcje serwisu z `today` liczonym raz w `src/pages/dashboard.astro:36`. Hot-spot `src/lib/services` jest więc trafnym dowodem prawdopodobieństwa; `src/lib/validation` nie dotyczy ryzyk #1/#2/#4 (to ryzyko #6, Phase 4).
- Istniejący zestaw jest silniejszy, niż zakładał plan: 2 pliki, 52 testy przechodzą (`npx vitest run src/lib/services`, Node 22). Oczekiwane wartości są ręcznie wyliczonymi literałami (np. `7000`, `167`, `2009` w `src/lib/services/subscriptions.test.ts:211-223`), a nie kopią formuły — antywzorzec „problem wyroczni” w tym zestawie nie występuje.
- Sonda z niezależną wyrocznią rolloveru (pętla po miesiącach z kotwicą, osobna implementacja) dała 0 rozbieżności na 105 216 przypadkach (bazy 2023-01-01…2025-12-31 codziennie × 3 cykle × co 35. dzień 2026–2028). Ryzyko #2 nie ma dziś błędu w tej ścieżce; wartość etapu to ochrona regresji, nie łapanie istniejącego błędu.
- **Realna awaria dla ryzyka #1 (zaobserwowana):** dla dwóch subskrypcji rocznych po 10 PLN kafel pokazuje `monthlyCents = 167`, a pozycje wykresu udziałów sumują się do 166 (każda zaokrąglana osobno, `src/lib/services/subscriptions.ts:181`, komentarz `:22`). Obie liczby są na tej samej karcie (`DashboardView.astro:89-90`, `CostShareChart.astro:82`), gdy waluta ma ≥2 pozycje. Użytkownik widzi, że „suma się nie zgadza” — dokładnie obawa z wywiadu Q1. To decyzja produktowa (dopuszczalny rozjazd groszowy vs dystrybucja reszty), nie oczywisty błąd.
- Ryzyko #4 jest w serwisie pokryte granicami D−1/D/D+1 (`subscriptions.test.ts:310-325`) i brakiem rolloveru anulowanej (`:161-166`); brakuje tylko scenariusza łączącego sumę i odnowienia dla tego samego wpisu w D i D+1.

## Detailed Findings

### Ryzyko #1 — koszt miesięczny per waluta

- Ścieżka: `monthlyCostByCurrency` (`src/lib/services/subscriptions.ts:121-132`) — filtr `countsToward`, grosze `Math.round(sub.price * 100)` (`:125`), waga `12 / CYCLE_MONTHS` (`:126`), suma per waluta, jedno `Math.round(yearlyCents / 12)` (`:131`), sortowanie po kodzie waluty.
- Wejście: `price` to `numeric(10, 2)` z `check (price > 0)` (`supabase/migrations/20261002091205_create_subscriptions.sql:14,21`); serwer przyjmuje maks. 8 cyfr całkowitych i 2 dziesiętne (`src/lib/validation/subscription.ts:18-23`). Przy tym górnym limicie roczne grosze jednej pozycji (≈1,2·10¹¹) mieszczą się w bezpiecznym zakresie liczb całkowitych JS. `Math.round(p * 100)` dał dokładne grosze dla sprawdzonych wartości 0.1, 19.99, 33.33, 99999999.99, 12345678.91 (sprawdzenie próbkowe, nie wyczerpujące).
- Istniejące testy (`subscriptions.test.ts:201-260`): normalizacja trzech cykli (30+90/3+120/12 = 70,00), jedno zaokrąglenie (2×10/12 → 167), dryf float (19,99+0,10), osobne waluty, anulowana w D i po D, pusta lista. Brak: kwartalnej z resztą (np. 10 PLN/kw. → 333), mieszanki walut × cykli × statusów w jednym scenariuszu, pozycji z wartością blisko górnego limitu.
- Rozjazd kafel vs wykres: `monthlyCostShares` zaokrągla `monthlyCents` per slice (`:181`) — sonda: total 167 vs suma slice'ów 166. `CostShareChart.astro:35` liczy też własny `total` z zaokrąglonych slice'ów (tylko do długości łuków).
- Korekta guidance: „Must challenge” należy rozszerzyć o „suma pokazana na kafelku zgadza się z tym, co sumują się pozycje na tej samej karcie”. Najtańsza warstwa: unit (ten sam moduł), bez renderu.

### Ryzyko #2 — rollover, okno 30 dni, „dziś” w Warszawie

- Rollover: `nextRenewalDate` (`subscriptions.ts:44-58`) — skok o `k = ceil(monthsBetween / step)` cykli, potem pętla korekcyjna; każdy kandydat liczony od bazy (`addMonthsClamped(base, k*step)`), więc bez dryfu. `addMonthsClamped` przycina dzień do długości miesiąca (`dates.ts:51-61`).
- Okno: `upcomingRenewals` (`subscriptions.ts:193-209`) — `windowEnd = addDays(today, 30)`, filtr `renewalDate >= today && renewalDate <= windowEnd` (`:201`), obie granice włącznie.
- „Dziś”: `todayInWarsaw` przez `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" })` (`dates.ts:14-19,46-48`); wywoływane z `new Date()` w `dashboard.astro:36`, `edit.astro:50`, `api/subscriptions/[id].ts:55`, `api/subscriptions/[id]/cancel.ts:47`.
- Istniejące testy: `dates.test.ts:5-27` (północ UTC vs Warszawa, oba przełączenia DST), `:29-51` (przycięcie, rok przestępny, kotwica przy +2, przejście roku); `subscriptions.test.ts:41-72` (kotwica 31.01→30.04, wiele cykli, 29.02 roczna), `:127-199` (granice okna dziś/dziś+30/dziś+31, rollover w oknie, sortowanie).
- Sonda wyroczni: 0 rozbieżności / 105 216 przypadków (opis w Summary). Luki w zestawie (nie błędy): przypadek „baza 31.01, dziś = 28.02 → 28.02, dziś = 01.03 → 31.03” jako para (powrót kotwicy przez `nextRenewalDate`, nie tylko `addMonthsClamped`), kwartalna z kotwicą 30./31. przez luty, okno przecinające koniec roku i luty, oraz test własności (niezmienniki: wynik ≥ dziś, wynik < dziś + cykl, dzień = min(kotwica, długość miesiąca)).
- Korekta guidance: „prove” dla #2 jest trafne; najtańsza warstwa to unit z tabelą granic **plus** deterministyczna wyczerpująca pętla po zakresie dat z niezależną wyrocznią (bez nowej zależności typu fast-check — sonda trwała <1 s). „Dziś w Warszawie” jest pokryte na poziomie funkcji; to, że wszystkie cztery wywołujące używają tej samej funkcji, jest faktem z kodu, nie testu — należy do Phase 3 (ekran), nie tutaj.

### Ryzyko #4 — anulowana do daty D

- `countsToward` (`subscriptions.ts:84-89`): aktywna zawsze, anulowana gdy `today <= next_renewal_date`. `effectiveRenewalDate` (`:96-101`): anulowana zwraca zapisaną datę bez rolloveru. `cancellationEndDate` (`:107-112`) = rollover bazy w chwili anulowania; zapis w `api/subscriptions/[id]/cancel.ts:47`.
- Istniejące testy: `countsToward` D−1/D/D+1 (`subscriptions.test.ts:310-325`), suma z anulowaną w D i D−1 względem dziś (`:238-254`), odnowienia anulowanej w dziś, w dziś+30, po D bez rolloveru, roczna anulowana poza oknem ale w sumie (`:149-179`), `cancellationEndDate` (`:343-361`).
- Luka: brak jednego scenariusza „ten sam wpis, dziś = D → w sumie i w odnowieniach; dziś = D+1 → nieobecny w obu” (dziś sprawdzane osobno dla każdej funkcji). Ryzyko nie jest spekulatywne (reguła istnieje), ale prawdopodobieństwo regresji jest niższe niż zakładał plan; „Medium” pozostaje uzasadnione przez CLAUDE.md (reguła już raz odwracana w PRD).

### Dowód hot-spotu

- `src/lib/services` — trafny: ostatnie 6 commitów dotyczy reguły (np. `aa8d201` wykres udziałów — źródło rozjazdu, `0873f4d` FR-007).
- `src/lib/validation` — mylący dla Phase 1 (dotyczy ryzyka #6).

## Code References

- `src/lib/services/dates.ts:14-19,46-48` — „dziś” w Europe/Warsaw
- `src/lib/services/dates.ts:51-61` — `addMonthsClamped` z przycięciem dnia
- `src/lib/services/subscriptions.ts:44-58` — `nextRenewalDate` (rollover z kotwicą)
- `src/lib/services/subscriptions.ts:84-112` — `countsToward`, `effectiveRenewalDate`, `cancellationEndDate`
- `src/lib/services/subscriptions.ts:121-132` — `monthlyCostByCurrency`
- `src/lib/services/subscriptions.ts:142-186` — `monthlyCostShares` (zaokrąglenie per slice, `:181`)
- `src/lib/services/subscriptions.ts:193-209` — `upcomingRenewals`
- `src/components/dashboard/DashboardView.astro:32-38,89-90` — konsumpcja serwisu, kafel kosztu
- `src/components/dashboard/CostShareChart.astro:35,82` — suma slice'ów i kwoty w legendzie
- `src/pages/dashboard.astro:36` — `today` dla ekranu
- `src/lib/services/subscriptions.test.ts`, `src/lib/services/dates.test.ts` — istniejące testy (52)

## Architecture Insights

- Reguła jest czysta i deterministyczna (`today` wstrzykiwane jako string) — unit jest najtańszą warstwą z pełnym sygnałem dla #1/#2/#4; integracja/e2e nie dodaje sygnału dla samej reguły.
- Konwencja testów: `describe` per funkcja, fabryka `sub()` z nadpisaniami (`subscriptions.test.ts:18-39`), literały oczekiwane wyliczone ręcznie, komentarz z rachunkiem przy nieoczywistych wartościach.
- Środowisko: `nvm use` z `.nvmrc` (22.14.0) nie działa — wersja niezainstalowana; działa `nvm use 22` (22.22.3).

## Historical Context (from prior changes)

- `context/archive/2026-10-02-home-screen-cost-and-renewals/plan.md:52-53` — rollover liczony od bazy (dryf odrzucony) i suma z jednym zaokrągleniem: oba twierdzenia **supported** przez kod (`subscriptions.ts:44-58`, `:131`).
- `context/archive/2026-10-19-subscription-delete-and-cancel/plan.md:83-87` — przypadki `countsToward` i `cancellationEndDate`: **supported**, obecne w testach.
- `context/archive/2026-10-19-dashboard-design-tokens/plan.md` — nie dotyczy reguły.

## Related Research

Brak wcześniejszych `research.md` w `context/changes/**` i `context/archive/**` dotyczących tej reguły.

## Open Questions

1. **Rozjazd kafel vs wykres (decyzja produktowa):** czy pozycje wykresu mają sumować się dokładnie do kafla (np. dystrybucja reszty groszy jak przy procentach), czy rozjazd ±1 gr na pozycję jest akceptowalny? Od odpowiedzi zależy, czy test w Phase 1 asertuje równość (i wymaga poprawki kodu), czy jedynie dokumentuje dopuszczalny rozjazd.

   **Rozstrzygnięte 2026-10-19 (użytkownik):** rozjazd akceptowalny — kafel jest wartością autorytatywną; test dokumentuje, że rozjazd wynosi maks. 1 gr na pozycję, bez zmiany kodu. Backport do §2 test-plan.md (Source i Must challenge dla #1) wykonany.
