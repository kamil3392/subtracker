# Wyrocznia reguły kosztu i dat — Plan Brief

> Full plan: `context/changes/testing-cost-and-date-rule-oracle/plan.md`
> Research: `context/changes/testing-cost-and-date-rule-oracle/research.md`

## What & Why

Phase 1 planu testów: chronimy ryzyka #1 (błędna suma niezauważona), #2 (dryf daty 31 → 28, granice okna 30 dni) i #4 (anulowana poza datą D). Dodajemy testy, których oczekiwane wartości pochodzą z reguły PRD albo z niezależnej wyroczni — nie z kodu, który testują.

## Starting Point

Reguła jest czysta (`src/lib/services/`), ma 52 zielone testy z ręcznymi literałami. Sonda badania nie znalazła błędu w rolloverze (105 216 przypadków), za to wykryła rozjazd kafel 167 gr vs pozycje wykresu 166 gr — zaakceptowany.

## Desired End State

Nowy plik `src/lib/services/subscriptions.oracle.test.ts` przechodzi w `npm test`, a celowe wprowadzenie każdej znanej klasy regresji (zaokrąglanie per pozycja, rollover krok po kroku, wykluczenie anulowanej w D, okno bez ostatniego dnia) go wywraca. Cookbook §6.1 opisuje wzorzec.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Warstwa | unit | Reguła jest czysta z wstrzykiwanym `today`; wyższe warstwy nie dodają sygnału dla samej reguły | Research |
| Rozjazd kafel vs wykres | akceptowalny, ≤1 gr na pozycję; test dokumentuje | Kafel jest autorytatywny, pozycje są tylko do wyświetlenia | Research (decyzja użytkownika) |
| Wyrocznia dat | własna pętla wyczerpująca, bez fast-check | Deterministyczna, <1 s, bez nowej zależności | Research |
| Organizacja plików | osobny `subscriptions.oracle.test.ts`, lokalna fabryka `sub()` | Wyrocznia oddzielona od przykładów, łatwa do wskazania w cookbooku | Plan |
| Kod produkcyjny | bez zmian | Brak błędu w regule; etap to ochrona regresji | Research |
| Dowód czułości | tymczasowe mutacje wycofywane przed commitem | Pokazuje, że test łapie regresję z właściwego powodu | Plan |

## Scope

**In scope:** tabela kosztu z PRD (kwartalna z resztą, mieszanka walut × cykli × statusów, górny limit ceny, kafel vs pozycje), granica D w sumie i odnowieniach, tabela granic dat, pętla wyczerpująca z niezależną wyrocznią, cookbook §6.1/§6.6.

**Out of scope:** zmiany kodu produkcyjnego, nowe zależności, testy renderu (Phase 3 planu testów), zapis edycji (Phase 2), refaktor istniejących testów.

## Architecture / Approach

Jeden plik testów: część kosztowa z rachunkiem PRD w komentarzu przy każdym przypadku, część datowa z wyrocznią rolloveru liczoną własną arytmetyką miesięcy (bez importu `addMonthsClamped`/`addDays`). Czułość potwierdzana mutacjami.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Wyrocznia kosztu i granicy anulowania | Tabela FR-008/FR-007 z wartościami z PRD | Oczekiwania przepisane z formuły produkcyjnej |
| 2. Wyrocznia rolloveru i okna 30 dni | Tabela granic + pętla ≈105 tys. przypadków | Wyrocznia staje się lustrem implementacji |
| 3. Cookbook §6 i domknięcie | Przepis §6.1 i notatka §6.6 | Przepis zbyt ogólny, by go powtórzyć |

**Prerequisites:** Node 22 (`nvm use 22`), `npx astro sync` przed lintem na świeżym checkoucie.
**Estimated effort:** ~1 sesja, 3 fazy.

## Open Risks & Assumptions

- Etap nie znajdzie błędu dziś — jego wartość ujawni się przy następnej zmianie reguły.
- Rozjazd groszowy w wykresie zostaje; zmiana decyzji wymaga poprawki serwisu i zmiany asercji.

## Success Criteria (Summary)

- Każda znana klasa regresji reguły wywraca nowe testy.
- Oczekiwane wartości da się sprawdzić z PRD bez czytania kodu.
- Kolejny test reguły powstaje według §6.1.
