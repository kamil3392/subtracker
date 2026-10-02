<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ekran główny: koszt miesięczny per waluta i odnowienia w 30 dni

- **Plan**: context/changes/home-screen-cost-and-renewals/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automatyczne kryteria uruchomione ponownie 2026-10-02: `supabase migration up`, `supabase test db` (19/19), `npm run db:types` (bez różnic), `npm test` (47/47), `astro sync && lint`, `astro check` (0 błędów), `build` — PASS. Ręczne (1.5, 2.5, 2.6, 3.5, 4.5–4.7, 5.1–5.3) mają dowody: runy CI 37001718197 i 37004035821, zrzuty ekranu produkcji, `curl` anon 401/42501, `migration list`. Odchylenia od planu to wyłącznie adaptacje zgłoszone w trakcie (redirect `/` w middleware zamiast `index.astro`, `src/lib/currencies.ts`, `FormField.inputMode`, ogólny komunikat błędu DB). XSS, CSRF (`checkOrigin` domyślnie włączone w Astro 7), authz endpointu, open redirect, zaokrąglenia i strefy czasowe sprawdzone — bez uwag.

## Findings

### F1 — Brak zakresu daty odnowienia i nieograniczona pętla rolloveru

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/subscriptions.ts:29-41; src/lib/validation/subscription.ts:24; src/lib/services/dates.ts:23-39
- **Detail**: `nextRenewalDate` iteruje po każdym minionym cyklu; formularz i `z.iso.date()` przyjmują np. `0100-01-01` (~9,6 ms CPU na wiersz miesięczny — kilka takich wierszy przekracza limit 10 ms CPU Workers free i wywraca dashboard właściciela). Baza nie ma ograniczenia zakresu, a `authenticated` może wstawiać bezpośrednio przez PostgREST: rok 5-cyfrowy (`10000-01-01`) albo data BC trafia do `parseDate`, które rzuca → 500. `Date.UTC` mapuje lata 0–99 na 1900+y (rozjazd klient/serwer). Skutek ogranicza się do konta, które wpisało dane (RLS).
- **Fix A ⭐ Recommended**: O(1) wyznaczanie `k` + zakres daty w zod i w bazie
  - Strength: `k = max(1, ceil(monthsBetween(base, today) / step))` z korektą o 1–2 kroki po przycięciu usuwa pętlę; zakres (np. `2000-01-01` … dziś+10 lat w zod, `check (next_renewal_date between '2000-01-01' and '2100-12-31')` w migracji) zamyka też ścieżkę PostgREST.
  - Tradeoff: Nowa migracja + ręczny `db push` (deploy-plan §12); trzeba sprawdzić, że istniejące wiersze mieszczą się w zakresie.
  - Confidence: HIGH — pomiar pętli i akceptacja `0100-01-01` przez obie walidacje zweryfikowane.
  - Blind spot: Nie sprawdzono danych już zapisanych na produkcji.
- **Fix B**: Tylko kod — O(1) pętla + zakres w zod, bez zmiany bazy
  - Strength: Bez migracji i `db push`; usuwa wydajnościowy problem z formularza.
  - Tradeoff: Wiersz wstawiony bezpośrednio przez PostgREST (5-cyfrowy rok, BC) nadal wywraca dashboard właściciela (500).
  - Confidence: MED — zależy, czy ścieżkę PostgREST uznajemy za istotną.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix B — O(1) rollover via monthsBetween; date range 2000-01-01…2099-12-31 in zod and in the form; no DB change)

### F2 — Treść `?error=` wyświetlana jako komunikat aplikacji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:10,113
- **Detail**: Escapowane (nie XSS), ale dowolny tekst z linku (`/dashboard?error=Your card expired – call …`) pojawia się w czerwonym polu błędu jak prawdziwy komunikat — phishing przez spreparowany link. Endpoint wysyła wyłącznie stałe komunikaty, więc poprawka jest tania. Ten sam wzorzec mają strony auth (poza zakresem).
- **Fix**: Redirect z kodem błędu (`?error=invalid_price`, `save_failed`, …) i mapowanie kod → komunikat na stronie; nieznane kody ignorowane.
- **Decision**: SKIPPED

### F3 — Nieaktualne i niepełne opisy w CLAUDE.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:8,16,28,31,53,55,58
- **Detail**: l.16 „żadna funkcja domenowa … nie jest jeszcze zaimplementowana” i l.58 „(do zbudowania)” — nieprawda po S-01; l.53 nie wspomina redirectu zalogowanego `/` → `/dashboard` w middleware (ani powodu, by nie robić go w `index.astro`); l.55 wzorzec endpointów opisany tylko dla `api/auth`; l.28/31 smoke jako „przepływ auth”, brak `test` w liście skryptów; l.8 reguła FR-007 opisana jako obowiązująca, a kod celowo pomija anulowane do S-03 — przyszły agent może uznać to za błąd.
- **Fix**: Zaktualizować te miejsca; przy FR-007 dopisać „S-01 liczy tylko aktywne; regułę wdraża S-03”.
- **Decision**: FIXED

### F4 — Endpoint: wyjątek przy nie-formularzowym body i brak logowania błędów

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/subscriptions.ts:20,30-31,42
- **Detail**: `request.formData()` rzuca przy body innym niż formularz → 500; błąd insertu połykany bez logu (trudna diagnoza na produkcji); gałąź `supabase === null` jest martwa (middleware przekierowuje wcześniej).
- **Fix**: try/catch wokół `formData()` z ogólnym redirectem błędu i `console.error` dla błędu insertu.
- **Decision**: SKIPPED

### F5 — Błędny komentarz o dacie w smoke

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/smoke.mjs (~l.68)
- **Detail**: Komentarz mówi, że subskrypcja „odnawia się dziś”; między ~22:00 a 24:00 UTC data UTC to „wczoraj” w Warszawie i wiersz trafia do okna po rolloverze o miesiąc. Test pozostaje poprawny (zweryfikowane), komentarz wprowadza w błąd.
- **Fix**: Doprecyzować komentarz (rollover o miesiąc nadal mieści się w [dziś, dziś+30]).
- **Decision**: FIXED

### F6 — Utrata wpisanych danych przy błędzie walidacji serwera

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/subscriptions.ts; src/components/subscriptions/AddSubscriptionForm.tsx
- **Detail**: Redirect z `?error=` czyści 5-polowy formularz; spójne ze wzorcem auth, a walidacja kliencka łapie prawie wszystko.
- **Fix**: Akceptować na razie; wrócić przy S-02 (edycja), jeśli UX będzie przeszkadzał.
- **Decision**: SKIPPED

### F7 — Wspólne komponenty formularza w `components/auth/`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/subscriptions/AddSubscriptionForm.tsx (importy z `@/components/auth/`)
- **Detail**: `FormField`, `SubmitButton`, `ServerError` są teraz ogólne, ale leżą w katalogu auth.
- **Fix**: Przenieść do `src/components/form/` przy następnej zmianie formularzy (S-02).
- **Decision**: SKIPPED

### F8 — Długość nazwy liczona w jednostkach UTF-16

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation/subscription.ts; AddSubscriptionForm.tsx
- **Detail**: Limit 100 w JS liczy jednostki UTF-16 (baza: code pointy) — nazwa z emoji jest odrzucana poniżej 100 widocznych znaków. Brak wejścia akceptowanego przez aplikację, a odrzucanego przez bazę.
- **Fix**: Pominąć (bez wpływu na poprawność danych).
- **Decision**: SKIPPED
