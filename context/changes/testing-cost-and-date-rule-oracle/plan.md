# Wyrocznia reguły kosztu i dat — plan implementacji

## Overview

Phase 1 wdrożenia z `context/foundation/test-plan.md` (ryzyka #1, #2, #4). Dodajemy osobny plik testów jednostkowych, w którym oczekiwane wartości pochodzą z reguły PRD (FR-007, FR-008, FR-009) liczonej ręcznie albo przez niezależną wyrocznię — nie z formuły produkcyjnej. Kod produkcyjny się nie zmienia; to ochrona regresji dla obszaru, który już raz zawiódł (wywiad Q2) i którego błąd byłby niewidoczny dla użytkownika (wywiad Q1, Q4).

## Current State Analysis

- Reguła jest czysta i deterministyczna: `src/lib/services/dates.ts` (kalendarz `YYYY-MM-DD`, „dziś” w Warszawie) i `src/lib/services/subscriptions.ts` (rollover `:44-58`, FR-007 `:84-112`, suma `:121-132`, udziały `:142-186`, odnowienia `:193-209`); `today` jest wstrzykiwane jako string.
- 52 istniejące testy przechodzą (`src/lib/services/subscriptions.test.ts`, `src/lib/services/dates.test.ts`), z ręcznie wyliczonymi literałami — problem wyroczni tam nie występuje (research Summary).
- Sonda z niezależną wyrocznią rolloveru: 0 rozbieżności na 105 216 przypadkach, <1 s (research §Ryzyko #2).
- Zaobserwowany rozjazd kafel 167 gr vs suma pozycji wykresu 166 gr — **zaakceptowany przez użytkownika 2026-10-19** (kafel autorytatywny, pozycje zaokrąglane do wyświetlenia).
- Luki: kwartalna z resztą, mieszanka walut × cykli × statusów, cena przy górnym limicie (`numeric(10,2)`, maks. 8+2 cyfr — `src/lib/validation/subscription.ts:18-23`), para powrotu kotwicy przez `nextRenewalDate`, kwartalna kotwica przez luty, okno przez koniec roku i luty, scenariusz D / D+1 łączący sumę i odnowienia.

## Desired End State

- `src/lib/services/subscriptions.oracle.test.ts` istnieje, przechodzi w `npm test` i jest lintowany jak reszta `src/`.
- Każdy test w tym pliku ma oczekiwaną wartość z PRD (rachunek w komentarzu) albo z niezależnej wyroczni zdefiniowanej w pliku, która nie importuje `addMonthsClamped`, `monthsBetween` ani `addDays`.
- Celowe wprowadzenie każdej z trzech znanych klas regresji (zaokrąglanie per pozycja, rollover krok po kroku od przyciętej daty, wykluczenie anulowanej w dniu D) wywraca nowy plik testów.
- `context/foundation/test-plan.md` §6.1 opisuje wzorzec, a §6.6 zawiera notatkę etapu.

### Key Discoveries:

- `src/lib/services/subscriptions.ts:131` — jedno `Math.round(yearlyCents / 12)` per waluta; `:181` — zaokrąglenie per pozycja wykresu (źródło zaakceptowanego rozjazdu).
- `src/lib/services/subscriptions.ts:51-57` — rollover kotwiczony do bazy (`addMonthsClamped(base, k*step)`).
- `src/lib/services/subscriptions.ts:88` — anulowana liczy się, gdy `today <= next_renewal_date`.
- `src/lib/services/subscriptions.test.ts:18-39` — wzorzec fabryki `sub()` z nadpisaniami.
- Środowisko: `nvm use 22` (Node 22.22.3); `nvm use` z `.nvmrc` 22.14.0 nie działa w tym checkoucie.

## What We're NOT Doing

- Zmian w kodzie produkcyjnym, w tym dystrybucji reszty groszy w wykresie (rozjazd zaakceptowany).
- Nowych zależności (fast-check itp.) — pętla wyczerpująca jest deterministyczna i własna.
- Testów renderu ekranu i zgodności widoku z regułą — §3 Phase 3.
- Testów zapisu edycji i kotwicy w bazie — §3 Phase 2.
- Przenoszenia ani refaktoru istniejących testów; fabryka `sub()` jest powielona lokalnie (kilkanaście linii), bez wspólnego helpera.

## Implementation Approach

Jeden nowy plik, dwie grupy testów odpowiadające ryzykom: najpierw tabela przypadków policzonych ręcznie z PRD (koszt + granica D), potem wyrocznia dat (tabela granic + pętla wyczerpująca). Każdy przypadek zapisuje rachunek w komentarzu, żeby recenzent mógł sprawdzić oczekiwaną wartość bez czytania kodu produkcyjnego. Czułość na regresję potwierdzamy tymczasowymi mutacjami kodu, wycofywanymi przed commitem.

## Critical Implementation Details

- **Niezależność wyroczni** — wyrocznia rolloveru przechodzi miesiąc po miesiącu od bazy własną arytmetyką (rok/miesiąc jako liczby, długość miesiąca z `Date.UTC(y, m, 0)`), a offsety okna liczy z różnicy `Date.UTC` w dniach. Import funkcji pomocniczych z `dates.ts` do wyroczni zrobiłby z niej lustro implementacji.

## Phase 1: Wyrocznia kosztu i granicy anulowania (#1, #4)

### Overview

Tabela przypadków FR-008 i FR-007 z oczekiwanymi wartościami wyliczonymi ręcznie z PRD, w nowym pliku testów.

### Changes Required:

#### 1. Plik testów wyroczni — część kosztowa

**File**: `src/lib/services/subscriptions.oracle.test.ts` (nowy)

**Intent**: Udowodnić, że koszt miesięczny per waluta równa się wartości z reguły PRD (miesięczna całość, kwartalna 1/3, roczna 1/12, osobno per waluta, jedno zaokrąglenie) i że anulowana liczy się do D włącznie — w sumie i odnowieniach jednocześnie.

**Contract**: Import `describe`/`it`/`expect` z `vitest`; lokalna fabryka `sub()` w konwencji `subscriptions.test.ts:18-39`. Przypadki (dziś `2026-10-19`, chyba że podano inaczej; rachunek w komentarzu przy każdym):

- **Kwartalna z resztą** — 10 PLN/kw. → 10/3 = 3,333 → `333`; dwie po 10 PLN/kw. → 20/3 = 6,667 → `667` (zaokrąglanie per pozycja dałoby 666). *Regresja*: zaokrąglanie per subskrypcja. *Granica*: reszta 1/3 i 2/3.
- **Mieszanka walut × cykli × statusów** — PLN: 49,99 mies. + 129,99 kw. + 299 rocz. → (4999·12 + 12999·4 + 29900)/12 = 141884/12 = 11823,67 → `11824`; EUR: 9,99 mies. + 60 rocz. anulowana z D = dziś → 999 + 500 = `1499`; GBP: 15 kw. → `500`; USD: 120 rocz. anulowana z D = wczoraj → brak wiersza USD. Oczekiwany wynik `[EUR 1499, GBP 500, PLN 11824]`. *Regresja*: zły zbiór liczonych wpisów, mieszanie walut, zła waga cyklu. *Granica*: anulowana w D vs D−1 w jednym zestawie.
- **Górny limit ceny** — 99999999,99 rocz. → 9999999999/12 = 833333333,25 → `833333333`; dwie po 99999999,99 mies. → `19999999998`. *Regresja*: utrata precyzji / konwersja groszy. *Granica*: maks. wartość dopuszczona przez walidację.
- **Kafel vs pozycje wykresu** — dwie po 10 PLN rocz.: kafel `167`, suma pozycji `166`; dla zestawu PLN z mieszanki: |kafel − Σ pozycji| ≤ liczba pozycji. *Asercja dokumentuje zaakceptowaną decyzję* (kafel autorytatywny, rozjazd ≤1 gr na pozycję), nie wymusza równości.
- **Granica D w obu widokach** — anulowana 30 PLN mies. z D = `2026-10-25`: dziś `2026-10-24` i `2026-10-25` → koszt `3000` i odnowienie z datą `2026-10-25`; dziś `2026-10-26` → koszt `[]` i odnowienia `[]`. *Regresja*: „anulowana = wykluczona od razu” albo liczenie po D. *Anty-wzorzec*: odwracanie FR-007 w stronę US-01 sprzed korekty.

Antywzorzec unikany w całej fazie: oczekiwane wartości liczone formułą produkcyjną (`Math.round(Σ/12)` w teście).

### Success Criteria:

#### Automated Verification:

- Nowy plik przechodzi: `npx vitest run src/lib/services/subscriptions.oracle.test.ts`
- Cały zestaw przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Tymczasowa mutacja zaokrąglania per subskrypcja (w `monthlyCostByCurrency`) wywraca nowy plik; mutacja wycofana
- Tymczasowa zmiana `<=` na `<` w `countsToward` wywraca nowy plik; mutacja wycofana

#### Manual Verification:

- Rachunki w komentarzach dają się sprawdzić bez czytania `subscriptions.ts`

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Wyrocznia rolloveru i okna 30 dni (#2)

### Overview

Tabela granic dat z ręcznie wyliczonymi oczekiwaniami oraz deterministyczna pętla wyczerpująca porównująca `nextRenewalDate` i `upcomingRenewals` z niezależną wyrocznią.

### Changes Required:

#### 1. Plik testów wyroczni — część datowa

**File**: `src/lib/services/subscriptions.oracle.test.ts`

**Intent**: Udowodnić, że kotwica dnia wraca po krótkim miesiącu (bez dryfu 31 → 28), a okno [dziś, dziś+30] jest włączne na obu końcach także przez koniec roku i luty.

**Contract**: Tabela granic:

- **Powrót kotwicy (mies.)** — baza `2026-01-31`: dziś `2026-02-28` → `2026-02-28`; dziś `2026-03-01` → `2026-03-31`. Rok przestępny: baza `2028-01-31`, dziś `2028-02-29` → `2028-02-29`; dziś `2028-03-01` → `2028-03-31`. *Regresja*: dryf krok po kroku (wywiad Q2).
- **Kotwica kwartalna przez luty** — baza `2025-11-30`: dziś `2026-02-01` → `2026-02-28`; dziś `2026-03-01` → `2026-05-30`.
- **Przejście roku** — baza `2025-12-31` mies., dziś `2026-01-01` → `2026-01-31`.
- **Okno przez koniec roku** — dziś `2026-12-15` (koniec okna `2027-01-14`): mies. baza `2026-11-15` → `2026-12-15` (dziś, w oknie); mies. baza `2026-11-14` → `2027-01-14` (ostatni dzień, w oknie); rocz. baza `2026-01-15` → `2027-01-15` (poza oknem).
- **Okno przez luty** — dziś `2027-02-01` (koniec okna `2027-03-03`): rocz. baza `2026-03-03` → w oknie; rocz. baza `2026-03-04` → poza oknem.

Pętla wyczerpująca (jeden `it`, bez `console`):

- Wyrocznia rolloveru: dla bazy < dziś iteruje k = 1, 2, … po miesiącach `k × cykl` od bazy, dzień = min(dzień bazy, długość miesiąca), zwraca pierwszą datę ≥ dziś; baza ≥ dziś → baza.
- Zakres jak w sondzie z research: bazy codziennie `2023-01-01`…`2025-12-31` × 3 cykle × dziś co 35 dni w `2026-01-01`…`2028-12-31` (≈105 tys. przypadków).
- Asercje: wynik `nextRenewalDate` = wyrocznia; niezmienniki: wynik ≥ dziś, dzień wyniku = min(dzień bazy, długość miesiąca wyniku). Zbierać do 5 rozbieżności i asertować pustą listę (czytelny komunikat zamiast 105 tys. asercji).
- Okno: dla jednego `today` z każdego roku 2026–2028 i offsetów −1…31 dni (liczonych z `Date.UTC`) subskrypcja aktywna z bazą = dziś + offset jest w `upcomingRenewals` wtedy i tylko wtedy, gdy 0 ≤ offset ≤ 30.

Antywzorzec unikany: jeden przypadek 31.01 jako „dowód” braku dryfu; wyrocznia korzystająca z `addMonthsClamped`/`addDays`.

### Success Criteria:

#### Automated Verification:

- Nowy plik przechodzi: `npx vitest run src/lib/services/subscriptions.oracle.test.ts`
- Cały zestaw przechodzi w czasie < 5 s: `npm test`
- Lint przechodzi: `npm run lint`
- Tymczasowa mutacja rolloveru na iteracyjny krok od poprzedniej przyciętej daty wywraca nowy plik; mutacja wycofana
- Tymczasowa zmiana `renewalDate <= windowEnd` na `<` w `upcomingRenewals` wywraca nowy plik; mutacja wycofana

#### Manual Verification:

- Wyrocznia w pliku nie importuje niczego z `dates.ts` poza ewentualnie typami

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Cookbook §6 i domknięcie

### Overview

Wpisać wzorzec testu z wyrocznią z PRD do cookbooka planu testów, żeby kolejny test reguły powstawał w tym samym kształcie.

### Changes Required:

#### 1. Cookbook planu testów

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąpić placeholder §6.1 przepisem i dopisać notatkę etapu w §6.6; bez zmian w §1–§5.

**Contract**: §6.1 „Test reguły domenowej z wyrocznią z PRD”: **Location** `src/lib/services/*.oracle.test.ts` obok kodu; **Pattern** oczekiwana wartość z PRD z rachunkiem w komentarzu albo z niezależnej wyroczni w pliku (bez importu helperów produkcyjnych), granice D−1/D/D+1 i dni miesiąca, pętla wyczerpująca zamiast nowej zależności; **Reference test** `src/lib/services/subscriptions.oracle.test.ts`; **Run locally** `npx vitest run src/lib/services/subscriptions.oracle.test.ts` (Node 22). §6.6: 2–3 linie — brak błędu w regule, wartość to ochrona regresji; rozjazd kafel/wykres zaakceptowany 2026-10-19; `nvm use 22` zamiast `.nvmrc`. Zaktualizować „Last updated”.

### Success Criteria:

#### Automated Verification:

- §6.1 nie zawiera już „TBD — see §3 Phase 1”: `grep -c "TBD — see §3 Phase 1" context/foundation/test-plan.md` zwraca 0
- `npm test` i `npm run lint` przechodzą

#### Manual Verification:

- §6.1 wystarcza, by dodać kolejny test reguły bez czytania tego planu

---

## Testing Strategy

### Unit Tests:

- Koszt: kwartalna z resztą, mieszanka walut × cykli × statusów, górny limit ceny, kafel vs pozycje.
- FR-007: D−1/D/D+1 w sumie i odnowieniach jednocześnie.
- Daty: powrót kotwicy, kwartalna przez luty, przejście roku, okno przez koniec roku i luty, pętla wyczerpująca z niezależną wyrocznią.

### Integration Tests:

- Brak w tym etapie (§3 Phase 2–4).

### Manual Testing Steps:

1. Przeczytać rachunki w komentarzach i sprawdzić 2–3 wartości ręcznie z PRD.
2. Wykonać mutacje z Success Criteria i potwierdzić, że testy padają z czytelnym komunikatem.

## Performance Considerations

Pętla wyczerpująca ≈105 tys. przypadków trwała <1 s w sondzie; budżet `npm test` < 5 s.

## References

- Research: `context/changes/testing-cost-and-date-rule-oracle/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#1, #2, #4), §3 Phase 1
- Wzorzec testów: `src/lib/services/subscriptions.test.ts:18-39`
- Archiwum: `context/archive/2026-10-02-home-screen-cost-and-renewals/plan.md:52-53`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wyrocznia kosztu i granicy anulowania (#1, #4)

#### Automated

- [x] 1.1 Nowy plik przechodzi: `npx vitest run src/lib/services/subscriptions.oracle.test.ts`
- [x] 1.2 Cały zestaw przechodzi: `npm test`
- [x] 1.3 Lint przechodzi: `npm run lint`
- [x] 1.4 Mutacja zaokrąglania per subskrypcja wywraca nowy plik; wycofana
- [x] 1.5 Mutacja `<=` → `<` w `countsToward` wywraca nowy plik; wycofana

#### Manual

- [x] 1.6 Rachunki w komentarzach sprawdzalne bez czytania `subscriptions.ts`

### Phase 2: Wyrocznia rolloveru i okna 30 dni (#2)

#### Automated

- [ ] 2.1 Nowy plik przechodzi: `npx vitest run src/lib/services/subscriptions.oracle.test.ts`
- [ ] 2.2 Cały zestaw przechodzi w czasie < 5 s: `npm test`
- [ ] 2.3 Lint przechodzi: `npm run lint`
- [ ] 2.4 Mutacja rolloveru krok po kroku wywraca nowy plik; wycofana
- [ ] 2.5 Mutacja `<=` → `<` na końcu okna wywraca nowy plik; wycofana

#### Manual

- [ ] 2.6 Wyrocznia nie importuje helperów z `dates.ts`

### Phase 3: Cookbook §6 i domknięcie

#### Automated

- [ ] 3.1 §6.1 bez placeholdera Phase 1
- [ ] 3.2 `npm test` i `npm run lint` przechodzą

#### Manual

- [ ] 3.3 §6.1 wystarcza do dodania kolejnego testu reguły
