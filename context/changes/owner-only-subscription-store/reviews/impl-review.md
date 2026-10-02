<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Magazyn subskrypcji z izolacją per konto

- **Plan**: context/changes/owner-only-subscription-store/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Automatyczne kryteria uruchomione ponownie 2026-10-02: `npx supabase test db` (17/17), `npm run db:types` (bez różnic), `astro sync && lint`, `astro check` (0/0), `build` — PASS. `npx supabase db reset` (1.1) nie uruchomiony ponownie: na tej maszynie rozbija lokalny stos (kong); migrację potwierdzają test db i produkcja (4.1). Pozycje ręczne 1.4, 2.4, 3.5, 4.1–4.3 mają dowody (przegląd SQL, run CI 36993967953, grep dokumentacji, wyniki `migration list` / `curl` od użytkownika).

## Findings

### F1 — `authenticated` ma domyślne ALL (w tym TRUNCATE) na tabeli

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261002091205_create_subscriptions.sql:30
- **Detail**: Migracja odbiera uprawnienia tylko `anon`. Lokalnie `authenticated` ma `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`. RLS nie obejmuje TRUNCATE — dziś PostgREST go nie wystawia, ale przyszła funkcja SECURITY INVOKER albo inna ścieżka SQL jako `authenticated` mogłaby wyczyścić tabelę wszystkich kont. Uprawnienia są też niejawne (zależne od domyślnych grantów projektu).
- **Fix A ⭐ Recommended**: Nowa addytywna migracja `revoke all … from anon, authenticated; grant select, insert, update, delete … to authenticated;` + asercja pgTAP `table_privs_are` (patrz F2), potem ręczny `db push` na produkcję
  - Strength: Zamyka klasę ryzyka u źródła i czyni uprawnienia jawnymi; zgodne z zasadą „baza sama gwarantuje izolację” z planu.
  - Tradeoff: Druga migracja + ponowna bramka ręczna `db push` (procedura w deploy-plan §12).
  - Confidence: HIGH — stan uprawnień sprawdzony w lokalnej bazie.
  - Blind spot: Nie sprawdzono grantów na hostowanym projekcie (mogą się różnić, jeśli auto-grant Data API jest wyłączony).
- **Fix B**: Zaakceptować ryzyko teraz i dołączyć migrację uprawnień do S-01 (pierwsza zmiana, która dotyka tabeli z aplikacji)
  - Strength: Bez dodatkowego `db push` teraz; dziś żadna ścieżka nie wystawia TRUNCATE.
  - Tradeoff: Ryzyko zostaje do S-01 i łatwo o nim zapomnieć.
  - Confidence: MEDIUM — zależy od dyscypliny przy S-01.
  - Blind spot: None significant.
- **Decision**: SKIPPED

### F2 — Testy behawioralne maskują regresje polityk update/delete i grantów

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/tests/subscriptions_rls.test.sql:46-58, 150-160
- **Detail**: UPDATE/DELETE z `WHERE id`/`RETURNING` stosuje także politykę SELECT, więc osłabienie `subscriptions_update_own`/`subscriptions_delete_own` do `using (true)` nie wywróci asercji „0 rows”, dopóki polityka select istnieje. Anon testowany tylko dla SELECT — przyszły `grant insert … to anon` przejdzie niezauważony.
- **Fix**: Dodać asercje strukturalne: `policies_are('public','subscriptions', array[4 nazwy])`, `policy_cmd_is`/`policy_roles_are` per polityka, `table_privs_are('public','subscriptions','anon', '{}')` (i dla `authenticated` po F1); podnieść `plan(N)`.
- **Decision**: SKIPPED

### F3 — Blok lekcji 10x CLI w CLAUDE.md łamie twardą zasadę

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:73-116
- **Detail**: Commit a7d8989 wprowadził blok `<!-- BEGIN/END @przeprogramowani/10x-cli -->` (Moduł 2, Lekcja 3). CLAUDE.md:10 nakazuje przenieść taki blok w całości do `context/foundation/course-notes.md`. Poza zakresem planu, ale weszło w commicie fazy 1.
- **Fix**: Przenieść blok (bez znaczników) do `context/foundation/course-notes.md` i usunąć z CLAUDE.md.
- **Decision**: SKIPPED

### F4 — `npm run db:types` zeruje plik typów przy błędzie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: package.json:14
- **Detail**: Przekierowanie `>` obcina plik przed uruchomieniem CLI; gdy lokalny Supabase nie działa, `src/db/database.types.ts` ma 0 bajtów, a lint/check/build padają (plik jest ignorowany przez ESLint i Prettier, więc hook tego nie złapie).
- **Fix**: `supabase gen types typescript --local > src/db/database.types.ts.tmp && mv src/db/database.types.ts.tmp src/db/database.types.ts` (+ `*.tmp` w `.gitignore`).
- **Decision**: SKIPPED

### F5 — Komentarz w migracji i kryterium 2.2 opisują `WITH CHECK` błędnie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/migrations/20261002091205_create_subscriptions.sql:44; plan.md (kryterium 2.2, Critical Implementation Details)
- **Detail**: Bez `WITH CHECK` Postgres stosuje `USING` do nowego wiersza, więc „samo USING pozwoliłoby przepisać user_id” jest nieprawdą; usunięcie `WITH CHECK` nie wywraca testów (sprawdzone). Kryterium 2.2 zostało spełnione wariantem „bez polityki select” (7/17 czerwonych). Pomyłka planu, nie implementacji. Migracja jest już na produkcji — edycja komentarza zmieniłaby plik zastosowanej migracji (sumy kontrolne nie są sprawdzane, ale to zła praktyka).
- **Fix**: Zostawić migrację; zapisać jako lekcję („jawne `WITH CHECK` dla czytelności; regresję blokady `user_id` chronią testy strukturalne z F2”).
- **Decision**: SKIPPED

### F6 — Commit fazy 1 zawiera niezwiązane pliki narzędziowe

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commit a7d8989 (.claude/skills/**, .claude/.10x-cli-manifest.json, context/foundation/roadmap.md, eslint.config.js:82-83); bc86177 (.prettierignore:7-8, CLAUDE.md git/pre-commit)
- **Detail**: ~5k linii skilli 10x CLI, manifest, roadmapa i ignore `.claude/**` weszły razem z migracją (komunikat commitu to odnotowuje, plan nie). `.prettierignore` dla typów — uzasadnione (bajtowa regeneracja). Poprawki CLAUDE.md o git/pre-commit — na prośbę użytkownika. Historia już wypchnięta.
- **Fix**: Brak zmian w kodzie; w przyszłych zmianach commitować aktualizacje narzędzi osobno.
- **Decision**: SKIPPED

### F7 — `price numeric(10,2)` i `name` — semantyka do obsłużenia w S-01

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261002091205_create_subscriptions.sql:14, 20-22
- **Detail**: `9.999` zapisuje się jako `10.00` (cicho), ≥1e8 rzuca 22003 (500 bez walidacji); typ TS `price: number` → sumy na float. `name` sprawdzany po `btrim`, ale zapisywany nieprzycięty (długość surowa nieograniczona); `^[A-Z]{3}$` przepuszcza `XYZ` (zgodnie z planem).
- **Fix**: Kolejka dla S-01: zod (dodatnia, ≤ 2 miejsca po przecinku, górny limit; `name` trim) i sumy/przeliczenia w groszach w `src/lib/services/`.
  - Strength: Walidacja na granicy zgodnie z CLAUDE.md; bez nowej migracji.
  - Tradeoff: Baza nadal przyjmie np. nieprzycięte nazwy z innych ścieżek.
  - Confidence: HIGH — S-01 i tak buduje formularz i przeliczenia.
  - Blind spot: None significant.
- **Decision**: SKIPPED

### F8 — Commit `FAZA 3` łamie konwencję

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: commit bc86177
- **Detail**: Pozostałe fazy: `feat(owner-only-subscription-store): … (pN)`; CLAUDE.md:20 opisuje tę konwencję. Commit jest wypchnięty — przepisanie historii nieopłacalne.
- **Fix**: Zostawić; trzymać konwencję w kolejnych commitach.
- **Decision**: SKIPPED

### F9 — CI używa niepinowanej wersji Supabase CLI

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:35-37
- **Detail**: `supabase/setup-cli@v1` z `version: latest`; teraz od CLI zależą też testy pgTAP. Niezgodne z devDependency `supabase` w package.json (lokalnie 2.117.0).
- **Fix**: Przypiąć `version:` do wersji z `package-lock.json`.
- **Decision**: SKIPPED
