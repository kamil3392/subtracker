<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Ekran główny: koszt miesięczny per waluta i odnowienia w 30 dni

- **Plan**: context/changes/home-screen-cost-and-renewals/plan.md
- **Mode**: Deep
- **Date**: 2026-10-02
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
10/10 paths ✓, 5/5 symbols ✓, brief↔plan ✓. Zweryfikowane eksperymentalnie: vitest 5.0.3 z vite 8.3.0 (jedna kopia vite), `astro/zod` = zod v4 importowalny w vitest, `Intl` z `Europe/Warsaw` w workerd → `2026-10-02`, PostgREST zwraca `numeric` jako liczbę JSON.

## Findings

### F1 — Stałe walut muszą być w module bez zod

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §1, Phase 4 §2
- **Detail**: Plan zostawia wydzielenie `SUPPORTED_CURRENCIES` jako „jeśli konieczne”. Pomiar (vite 8 build): import stałej z modułu ze schematem zod na górnym poziomie wciąga ~132 kB zod do bundla wyspy; z modułu bez zod — 0,08 kB.
- **Fix**: Obowiązkowy moduł `src/lib/currencies.ts` (bez zod) ze `SUPPORTED_CURRENCIES` i etykietami cykli; importują go schemat i wyspa.
- **Decision**: SKIPPED

### F2 — Kryterium 3.5 zależy od niedziałającego lokalnego stosu; smoke nie czyta treści

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 Manual Verification; Phase 4 §4
- **Detail**: Ręczny `curl` na lokalnym dev serverze wymaga działającego auth (kong lokalnie nie startuje). `scripts/smoke.mjs` `request()` zwraca tylko `{status, location}` — sprawdzenie „treść zawiera nazwę” wymaga rozszerzenia.
- **Fix**: Zastąpić weryfikację 3.5 krokiem smoke „anonimowy POST /api/subscriptions → 302 /auth/signin” (weryfikowanym w CI w fazie 4); w kontrakcie smoke dopisać `body` w `request()` i opcjonalne `bodyIncludes` w sprawdzeniu.
- **Decision**: SKIPPED

### F3 — Dokumentacja dezaktualizowana przez zmianę nie jest w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phases 2 i 4
- **Detail**: CLAUDE.md:31 („brak zestawu testów jednostkowych i runnera”), README.md:148-156 (`/dashboard` jako „Example protected page”) i :174 (smoke tylko auth), context/deployment/deploy-plan.md:186 („zaloguj się → przekierowanie na `/`”).
- **Fix**: Faza 2: CLAUDE.md „Testy” + README skrypty (`npm test`); faza 4: README trasy/smoke, deploy-plan krok 9.
- **Decision**: FIXED

### F4 — Wersja vitest nieokreślona

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1
- **Detail**: Najnowsza vitest 5.0.3 (2026-09-30) wspiera vite `^8`; przetestowana z repo bez drugiej kopii vite. Alternatywa `~4.1.11` też wspiera vite 8.
- **Fix**: Kontrakt: devDependency `vitest ^5.0.3`.
- **Decision**: ACCEPTED

### F5 — Oczekiwany zapis kwot w przykładzie jest błędny

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy → Manual Testing Steps (krok 2)
- **Detail**: `Intl.NumberFormat("pl-PL", {style:"currency"})` daje `149,00 zł` i `10,00 €` (z NBSP), nie „149,00 PLN / 10,00 EUR”.
- **Fix**: Poprawić oczekiwany wynik na `149,00 zł` i `10,00 €`.
- **Decision**: FIXED

### F6 — Brak kryterium dla `npm test` w CI

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria
- **Detail**: Faza 2 dodaje krok `npm test` do joba `ci`, ale żadne kryterium nie potwierdza, że job w GitHub Actions go wykonuje i jest zielony.
- **Fix**: Dodać kryterium ręczne 2.6 „Job `ci` w GitHub Actions wykonuje `npm test` i jest zielony”.
- **Decision**: FIXED

### F7 — Komunikaty błędów walidacji dla użytkownika

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §1
- **Detail**: Domyślne komunikaty zod v4 są techniczne („Too small: expected string to have >=1 characters”), a trafiają do UI przez `?error=`.
- **Fix**: Kontrakt schematu: własne, czytelne komunikaty per pole (np. „Price must be greater than 0 with at most 2 decimals”).
- **Decision**: SKIPPED
