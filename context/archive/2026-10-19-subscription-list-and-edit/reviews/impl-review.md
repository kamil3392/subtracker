<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Lista i edycja subskrypcji

- **Plan**: context/changes/subscription-list-and-edit/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Zapis edycji nie sprawdza liczby zmienionych wierszy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/subscriptions/[id].ts:52-61
- **Detail**: Endpoint robi select → update bez `.select()` ani licznika. Jeśli wiersz zniknie między tymi wywołaniami (np. usunięty w innej karcie po S-03), update dotknie 0 wierszy bez błędu, a użytkownik dostanie redirect na `/dashboard`, jakby zapis się udał. Dziś nieosiągalne (brak usuwania), realne od S-03.
- **Fix**: Dołączyć `.select("id")` do update i traktować pusty wynik jak „Subscription not found” (redirect na `/dashboard?error=`).
- **Decision**: FIXED

### F2 — Nieznana waluta wpisu po cichu zamienia się na PLN przy edycji

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/subscriptions/SubscriptionForm.tsx:68-70
- **Detail**: Baza akceptuje każdą walutę `^[A-Z]{3}$` (`supabase/migrations/20261002091205_create_subscriptions.sql:22`), a formularz pokazuje PLN, gdy zapisana waluta jest spoza `SUPPORTED_CURRENCIES`. Edycja samej nazwy takiego wpisu zapisałaby PLN bez ostrzeżenia, zmieniając sumę w innej walucie. Wpis spoza listy powstaje tylko przez bezpośredni zapis do PostgREST tokenem użytkownika albo po przyszłym zawężeniu listy walut — przez UI dziś nie.
- **Fix A ⭐ Recommended**: Zaakceptować jako ryzyko i zostawić notatkę dla przyszłej zmiany listy walut
  - Strength: Zero kodu; ścieżka UI nie tworzy takich wpisów (walidacja zod przy dodawaniu), a jedyny sposób to ręczny zapis do API własnym tokenem.
  - Tradeoff: Jeśli lista walut kiedyś się zawęzi, stare wpisy zmienią walutę przy pierwszej edycji.
  - Confidence: HIGH — insert i update walidują `z.enum(SUPPORTED_CURRENCIES)`.
  - Blind spot: Nie sprawdzono danych na produkcji pod kątem walut spoza listy.
- **Fix B**: Pokazać zapisaną nieznaną walutę jako dodatkową opcję selecta
  - Strength: Edycja nie zmienia niczego, czego użytkownik nie dotknął.
  - Tradeoff: Serwer i tak odrzuci tę walutę przy zapisie (zod), więc użytkownik dostanie błąd zamiast cichej zmiany — trzeba by też zmienić walidację, co rozszerza zakres.
  - Confidence: MED — wymaga decyzji, czy nieobsługiwana waluta ma być edytowalna.
  - Blind spot: Wpływ na sumy per waluta dla walut spoza listy.
- **Decision**: ACCEPTED (Fix A) — UI nie tworzy wpisów spoza SUPPORTED_CURRENCIES; wrócić przy zawężaniu listy walut

### F3 — Utrata kotwicy dnia, gdy wysłanie edycji przekroczy północ

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/subscriptions/[id].ts:59; src/lib/services/subscriptions.ts (renewalDateToStore)
- **Detail**: Strona liczy pokazaną datę z „dziś” w chwili renderu, endpoint z „dziś” w chwili zapisu. Gdy między nimi minie północ w Warszawie, a data bazowa jest w przeszłości, porównanie się rozjedzie i przesłana data stanie się nową bazą — dla kotwicy 29–31 może to przesunąć dzień. Plan świadomie wybrał porównanie po stronie serwera bez ukrytego pola (Critical Implementation Details).
- **Fix**: Zaakceptować jako ryzyko (wąskie okno, efekt tylko dla kotwic 29–31).
- **Decision**: ACCEPTED — wąskie okno, świadomy wybór planu

### F4 — „Subscription not found” z edycji pojawia się w formularzu dodawania

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/subscriptions/[id].ts:21,47; src/pages/dashboard.astro:149
- **Detail**: Endpoint edycji przy nieznanym id przekierowuje na `/dashboard?error=…`, a dashboard pokazuje `error` wyłącznie w `ServerError` formularza „Add subscription” — komunikat wygląda, jakby dotyczył dodawania.
- **Fix**: Zostawić do S-03 (które doda kolejne akcje na wpisach) i tam wprowadzić baner błędu na poziomie strony.
- **Decision**: DEFERRED to S-03 — follow-ups/review-fixes.md

### F5 — Luki w pokryciu testami

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/subscriptions.test.ts:65-108; scripts/smoke.mjs
- **Detail**: (a) Brak komórki „zmieniona data i zmieniony cykl” z macierzy w Testing Strategy (wynik taki jak w innych „zmienionych” przypadkach). (b) Smoke nie sprawdza nowej ceny po edycji, tylko nazwę. (c) Krok „unknown subscription” w smoke używa losowego uuid, więc dowodzi ścieżki not-found, nie izolacji między kontami — tę pokrywa wyłącznie pgTAP (`supabase/tests/subscriptions_rls.test.sql:59-111`), co jest wystarczające.
- **Fix**: Dodać test (a) i asercję ceny (b) przy następnej zmianie dotykającej tych plików; (c) bez zmian.
- **Decision**: FIXED — (a) test „zmieniona data + cykl”, (b) krok smoke z ceną; (c) bez zmian
