# CLAUDE.md

## Twarde zasady

- Istnieje `public.subscriptions` (migracja w `supabase/migrations/`, RLS owner-only, testy pgTAP w `supabase/tests/`) obok `auth.users`. Kolejne tabele domenowe dodawaj jako migracje `supabase/migrations/YYYYMMDDHHmmss_krotki_opis.sql` i **zawsze** włączaj RLS z osobnymi politykami per operacja (select/insert/update/delete) dla `authenticated` — to jedyny mechanizm realizujący NFR „żaden użytkownik nie widzi subskrypcji innego konta”.
- `context/archive/` — niezmienne; nic tam nie zapisuj.
- Sekrety (`SUPABASE_URL`, `SUPABASE_KEY`) są deklarowane w `env.schema` w `astro.config.mjs` jako `context: "server", access: "secret", optional: true`. Importuj je przez `import { SUPABASE_URL } from "astro:env/server"`, **nie** przez `import.meta.env`. Nowa zmienna = nowy wpis w schema.
- `output: "server"` w `astro.config.mjs` — wszystkie strony są SSR; adapter `@astrojs/cloudflare`, flaga `nodejs_compat` w `wrangler.jsonc`. Kod serwerowy wykonuje się w workerd, nie w Node: z modułów Node używaj wyłącznie tych z listy `nodejs_compat` (https://developers.cloudflare.com/workers/runtime-apis/nodejs/), importowanych z prefiksem `node:`; `child_process`, `worker_threads` i `cluster` nie istnieją w workerd.
- Reguła anulowanej subskrypcji (FR-007): liczy się do sumy i odnowień do daty następnego odnowienia, potem znika z obu widoków. Kryterium US-01 zostało do niej dostosowane — nie „naprawiaj” tego w drugą stronę.
- Materiał lekcji 10x CLI nie należy do tego pliku: `10x get`/`10x sync` uruchamiaj z `--no-course-rules`, a treść lekcji dopisuj do @context/foundation/course-notes.md. Jeśli w pliku pojawi się blok `<!-- BEGIN/END @przeprogramowani/10x-cli -->`, przenieś go tam w całości.

## Czym jest ten projekt

**Subtracker** — aplikacja webowa do śledzenia subskrypcji: sprowadza cykle miesięczne/kwartalne/roczne do jednego kosztu miesięcznego (osobno per waluta) i pokazuje odnowienia w ciągu 30 dni. Zakres produktu (FR-001…FR-010, NFR prywatności, non-goals) definiuje @context/foundation/prd.md; wybór stosu uzasadnia @context/foundation/tech-stack.md.

Kod to świeży scaffold **10x Astro Starter** (Astro 7 SSR + React 19 + Tailwind 4 + Supabase Auth + Cloudflare Workers) z gotowym przepływem auth. Poza schematem `public.subscriptions` żadna funkcja domenowa Subtrackera (subskrypcje, suma miesięczna, odnowienia) nie jest jeszcze zaimplementowana. `package.json` nadal nazywa się `10x-astro-starter`, a `project_name` w tech-stack.md to `10x-cards` — obie nazwy są pozostałościami; PRD jest źródłem prawdy.

- `AGENTS.md` jest dowiązaniem symbolicznym do tego pliku — edytuj wyłącznie `CLAUDE.md`.
- Oryginalne zasady startera (`CLAUDE.md.scaffold`) zostały wchłonięte do tego pliku i usunięte.
- Repozytorium git (gałąź `master`, remote na GitHubie). Commity w Conventional Commits; dla zmian z `context/changes/` scope to change-id, a temat kończy się indeksem fazy, np. `feat(owner-only-subscription-store): Migracja schematu i RLS (p1)`.

## Polecenia

Standardowe skrypty (`dev`, `build`, `preview`, `lint`, `format`, `smoke`), lokalny Supabase i deploy opisuje @README.md. Poza nim:

- Wymagany Node 22.14.0 (`.nvmrc`); przed pracą `nvm use` — systemowy `node` może być za stary dla Astro 7.
- `npx astro sync` generuje `.astro/types.d.ts` — uruchom na świeżym checkoucie **przed** `lint`/`check`, inaczej type-checked lint zgłasza fałszywe błędy.
- `npx astro check` sprawdza typy w `.astro` i `.ts`; CI to uruchamia, ale nie ma skryptu npm.
- `npx shadcn@latest add <name>` dodaje komponent shadcn/ui do `src/components/ui/`.

**Testy**: brak zestawu testów jednostkowych i runnera — nie ma „pojedynczego testu” do uruchomienia. Automatyczne kontrole to testy bazy pgTAP w `supabase/tests/` (`npx supabase test db` przeciw działającemu lokalnemu Supabase; RLS i ograniczenia `public.subscriptions`) oraz `scripts/smoke.mjs` (przepływ auth po HTTP przeciw **działającemu** serwerowi; wymagania w @README.md). Obie uruchamia job `smoke` w CI. Dodając testy jednostkowe (np. dla przeliczania cykli — guardrail z PRD), wybierz runner i rozszerz `.github/workflows/ci.yml`.

**Pre-commit**: husky + lint-staged (konfiguracja w @package.json). Hook (`npx lint-staged`: `eslint --fix` dla `ts/tsx/astro`, `prettier --write` dla `json/css/md`) działa w tym checkoucie; `package.json` nie ma skryptu `prepare`, więc na świeżym klonie uruchom `npx husky`, inaczej hook z `.husky/pre-commit` nie zostanie podpięty.

**CI**: @.github/workflows/ci.yml, gałąź `master`, joby `ci` i `smoke` — opis w @README.md.

## Architektura

### Rendering i runtime

- React wyłącznie jako wyspy (`client:load` w plikach `.astro`) tam, gdzie potrzebna jest interaktywność; treść statyczna i layout w `.astro`. Żadnych dyrektyw Next.js (`"use client"`).
- Tailwind 4 przez plugin Vite — nie ma `tailwind.config`; tokeny kolorów (oklch, tryb `.dark`) i warianty żyją w `src/styles/global.css`. Klasy warunkowe łącz przez `cn()` z `@/lib/utils`, nie konkatenacją stringów.
- shadcn/ui w stylu `new-york` (`components.json`), komponenty w `src/components/ui/`, ikony z `lucide-react`.
- Alias `@/*` → `./src/*`.

### Zmienne środowiskowe

- Dwa pliki sekretów, oba w `.gitignore`: `.env` (Node: `astro check`, `astro build`, Supabase CLI) i `.dev.vars` (workerd: `dev`, `preview`). Trzymaj je zsynchronizowane (`cp .env .dev.vars`).
- Brak konfiguracji jest **obsługiwanym stanem**, nie błędem: `createClient()` w `src/lib/supabase.ts` zwraca `null`, middleware ustawia `locals.user = null`, endpointy auth przekierowują z komunikatem, a `Layout.astro` renderuje `Banner` na podstawie `src/lib/config-status.ts`. Nową integrację zewnętrzną rejestruj w tej samej tablicy `configStatuses`.

### Przepływ auth (wzorzec do naśladowania dla nowych akcji)

1. `src/middleware.ts` na każdym żądaniu tworzy klienta Supabase SSR (sesja w cookies przez `@supabase/ssr`), wpisuje użytkownika do `Astro.locals.user` (typ w `src/env.d.ts`) i przekierowuje na `/auth/signin` dla ścieżek z `PROTECTED_ROUTES` (dopasowanie po prefiksie `startsWith`). Nowe strony chronione dopisz do tej tablicy.
2. Formularze to wyspy React (`src/components/auth/SignInForm.tsx` + `FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`) robiące **tylko** walidację po stronie klienta; wysyłają natywny `<form method="POST" action="/api/...">` — bez `fetch` i bez JSON.
3. Endpointy w `src/pages/api/auth/*.ts` eksportują `POST: APIRoute`, czytają `request.formData()` i komunikują wynik **redirectem**: sukces → strona docelowa, błąd → `redirect("/auth/signin?error=" + encodeURIComponent(msg))`. Strona `.astro` czyta `Astro.url.searchParams.get("error")` i przekazuje go do wyspy jako `serverError`.
4. Wylogowanie i akcje w `Topbar.astro` to również formularze POST — nie linki GET.

### Dane i logika domenowa (do zbudowania)

- Typy bazy generuje `npm run db:types` do `src/db/database.types.ts` (commitowany, wyłączony z ESLint i Prettier — nie edytuj ręcznie, regeneruj po każdej migracji); klient z `createClient()` jest typowany `Database`.
- Współdzielone typy (encje, DTO) → `src/types.ts` (już: `Subscription`, `BillingCycle`, `SubscriptionStatus`, wyprowadzone z `Database`); logika biznesowa (przeliczanie cyklu na koszt miesięczny, sumy per waluta, rollover daty odnowienia z FR-009 liczony przy odczycie) → `src/lib/services/`; hooki React → `src/components/hooks/`.
- Walidacja wejścia na granicach (API, formularze) zod-em. Nie dodawaj `zod` do `package.json` — importuj `z` z `astro:schema` (Astro re-eksportuje zod); jeśli brakuje w nim potrzebnego API, opisz to w PR zamiast instalować pakiet.

### Lint

- Reguły w @eslint.config.js (`typescript-eslint` type-aware, `projectService`) — linter zgłosi naruszenia sam.
- Pułapki konfiguracji: pliki `.astro` są lintowane z `project: ./tsconfig.json` zamiast `projectService` (ograniczenie astro-eslint-parser); `scripts/**/*.mjs` bez type-check. `eslint-plugin-react` jest owinięty `fixupPluginRules` dla ESLint 10 — nie usuwaj tego owinięcia.

### Katalog `context/`

- `context/foundation/` — `prd.md`, `tech-stack.md`, `shape-notes.md` (wejścia z wcześniejszych lekcji; `lessons.md` powstanie przy pierwszym `/10x-lesson`); `course-notes.md` — materiał lekcji z 10x CLI, nie zasady.
- `context/changes/` — logi zmian, np. `bootstrap-verification/verification.md` (pełny zapis scaffoldu i audytu `npm audit`).
<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 2, Lekcja 3

Przejrzyj kod wygenerowany przez AI przed scaleniem, korzystając z **łańcucha przeglądu implementacji**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` jest głównym tematem lekcji. Przegląd jest bramką jakości, a nie poleceniem naprawienia każdego znaleziska.

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Przegląd kodu (główny temat lekcji)** | |
| `/10x-impl-review <change-id>` | Zaimplementowano kod i chcesz przeprowadzić ustrukturyzowany przegląd przed scaleniem. Umiejętność sprawdza zgodność z planem, dyscyplinę zakresu, bezpieczeństwo i jakość, architekturę, spójność wzorców oraz kryteria sukcesu, a następnie przedstawia ustalenia do selekcji. |
| **Wynik powtarzającej się lekcji** | |
| `/10x-lesson` | Ustalenie ujawnia powtarzającą się regułę projektu lub wzorzec błędów agenta. Zapisz je w `context/foundation/lessons.md` zamiast traktować je jako jednorazową notatkę. |

### Dyscyplina selekcji

- Dotkliwość określa, jak poważne jest ustalenie. Wpływ określa, jak duże znaczenie ma teraz decyzja.
- Prawidłowe wyniki: napraw teraz, napraw inaczej, pomiń, zaakceptuj jako ryzyko, zapisz jako powtarzającą się regułę (`/10x-lesson`), nie zgódź się.
- Naprawiaj krytyczne ustalenia. Nie poświęcaj godzin na obserwacje o niskim wpływie tylko dlatego, że agent je znalazł.
- Świadome pomijanie ustaleń o niskim wpływie jest prawidłowym wynikiem przeglądu, a nie zaniedbaniem.
- Jeśli nie zgadzasz się z ustaleniem, zapisz dlaczego. Błędne rozumowanie agenta również jest sygnałem.

### Granice przeglądu

- Ta lekcja dotyczy przeglądu zaimplementowanego kodu. Nie tworzy planu, nie wykonuje nowych faz ani nie uczy przeglądu CI.
- Strategia testowania i bramki jakości zostaną wprowadzone w Module 3.
- Nie używaj `/10x-contract` jako wyniku selekcji w tej lekcji.

### Ścieżki używane przez tę lekcję

- `context/changes/<change-id>/plan.md` — oczekiwany kontrakt implementacji
- `context/changes/<change-id>/reviews/` — wynik przeglądu
- `context/foundation/lessons.md` — powtarzające się lekcje

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`."

<!-- END @przeprogramowani/10x-cli -->
