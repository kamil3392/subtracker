# CLAUDE.md

## Twarde zasady

- Istnieje `public.subscriptions` (migracja w `supabase/migrations/`, RLS owner-only, testy pgTAP w `supabase/tests/`) obok `auth.users`. Kolejne tabele domenowe dodawaj jako migracje `supabase/migrations/YYYYMMDDHHmmss_krotki_opis.sql` i **zawsze** włączaj RLS z osobnymi politykami per operacja (select/insert/update/delete) dla `authenticated` — to jedyny mechanizm realizujący NFR „żaden użytkownik nie widzi subskrypcji innego konta”.
- `context/archive/` — niezmienne; nic tam nie zapisuj.
- Sekrety (`SUPABASE_URL`, `SUPABASE_KEY`) są deklarowane w `env.schema` w `astro.config.mjs` jako `context: "server", access: "secret", optional: true`. Importuj je przez `import { SUPABASE_URL } from "astro:env/server"`, **nie** przez `import.meta.env`. Nowa zmienna = nowy wpis w schema.
- `output: "server"` w `astro.config.mjs` — wszystkie strony są SSR; adapter `@astrojs/cloudflare`, flaga `nodejs_compat` w `wrangler.jsonc`. Kod serwerowy wykonuje się w workerd, nie w Node: z modułów Node używaj wyłącznie tych z listy `nodejs_compat` (https://developers.cloudflare.com/workers/runtime-apis/nodejs/), importowanych z prefiksem `node:`; `child_process`, `worker_threads` i `cluster` nie istnieją w workerd.
- Reguła anulowanej subskrypcji (FR-007): liczy się do sumy i odnowień do daty następnego odnowienia, potem znika z obu widoków. Kryterium US-01 zostało do niej dostosowane — nie „naprawiaj” tego w drugą stronę. **Stan obecny:** serwis w `src/lib/services/subscriptions.ts` (`countsToward`) liczy aktywne oraz anulowane do zamrożonej daty końca włącznie; `next_renewal_date` anulowanej to ta data końca (ustawiana przy anulowaniu przez `cancellationEndDate`), bez rolloveru.
- Materiał lekcji 10x CLI nie należy do tego pliku: `10x get`/`10x sync` uruchamiaj z `--no-course-rules`, a treść lekcji dopisuj do @context/foundation/course-notes.md. Jeśli w pliku pojawi się blok `<!-- BEGIN/END @przeprogramowani/10x-cli -->`, przenieś go tam w całości.

## Czym jest ten projekt

**Subtracker** — aplikacja webowa do śledzenia subskrypcji: sprowadza cykle miesięczne/kwartalne/roczne do jednego kosztu miesięcznego (osobno per waluta) i pokazuje odnowienia w ciągu 30 dni. Zakres produktu (FR-001…FR-010, NFR prywatności, non-goals) definiuje @context/foundation/prd.md; wybór stosu uzasadnia @context/foundation/tech-stack.md.

Kod to świeży scaffold **10x Astro Starter** (Astro 7 SSR + React 19 + Tailwind 4 + Supabase Auth + Cloudflare Workers) z gotowym przepływem auth. Zaimplementowano S-01: `/dashboard` (ekran główny zalogowanego) z kosztem miesięcznym per waluta, odnowieniami w 30 dni i dodawaniem subskrypcji (`POST /api/subscriptions`), S-02: lista wszystkich wpisów na `/dashboard` i edycja (`/subscriptions/[id]/edit` + `POST /api/subscriptions/[id]`) oraz S-03: anulowanie i usuwanie (`POST /api/subscriptions/[id]/cancel|delete`) z akcjami potwierdzanymi dialogiem w liście na `/dashboard`. Zakres kolejnych slice'ów w @context/foundation/roadmap.md. `package.json` nadal nazywa się `10x-astro-starter`, a `project_name` w tech-stack.md to `10x-cards` — obie nazwy są pozostałościami; PRD jest źródłem prawdy.

- `AGENTS.md` jest dowiązaniem symbolicznym do tego pliku — edytuj wyłącznie `CLAUDE.md`.
- Oryginalne zasady startera (`CLAUDE.md.scaffold`) zostały wchłonięte do tego pliku i usunięte.
- Repozytorium git (gałąź `master`, remote na GitHubie). Commity w Conventional Commits; dla zmian z `context/changes/` scope to change-id, a temat kończy się indeksem fazy, np. `feat(owner-only-subscription-store): Migracja schematu i RLS (p1)`.

## Polecenia

Standardowe skrypty (`dev`, `build`, `preview`, `lint`, `format`, `test`, `smoke`, `db:types`), lokalny Supabase i deploy opisuje @README.md. Poza nim:

- Wymagany Node 22.14.0 (`.nvmrc`); przed pracą `nvm use` — systemowy `node` może być za stary dla Astro 7.
- `npx astro sync` generuje `.astro/types.d.ts` — uruchom na świeżym checkoucie **przed** `lint`/`check`, inaczej type-checked lint zgłasza fałszywe błędy.
- `npx astro check` sprawdza typy w `.astro` i `.ts`; CI to uruchamia, ale nie ma skryptu npm.
- `npx shadcn@latest add <name>` dodaje komponent shadcn/ui do `src/components/ui/`.

**Testy**: testy jednostkowe na vitest (`vitest.config.ts`: środowisko `node`, alias `@`) leżą obok kodu jako `src/**/*.test.ts` i importują `describe`/`it`/`expect` jawnie z `vitest` (bez globals); pliki testów są lintowane type-aware jak reszta `src/`. Wszystkie: `npm test`; pojedynczy plik: `npx vitest run <ścieżka>`. Job `ci` uruchamia `npm test` po `npm run lint`. Poza tym testy bazy pgTAP w `supabase/tests/` (`npx supabase test db` przeciw działającemu lokalnemu Supabase; RLS i ograniczenia `public.subscriptions`) oraz `scripts/smoke.mjs` (przepływ auth, dodanie subskrypcji z jej widocznością na `/dashboard`, jej edycja, anulowanie i usunięcie — w tym 404/redirect dla obcego id, po HTTP przeciw **działającemu** serwerowi; wymagania w @README.md) — obie uruchamia job `smoke` w CI.

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

1. `src/middleware.ts` na każdym żądaniu tworzy klienta Supabase SSR (sesja w cookies przez `@supabase/ssr`), wpisuje użytkownika do `Astro.locals.user` (typ w `src/env.d.ts`) i przekierowuje na `/auth/signin` dla ścieżek z `PROTECTED_ROUTES` (dopasowanie po prefiksie `startsWith`; dziś `/dashboard`, `/api/subscriptions` i `/subscriptions`). Nowe strony i endpointy chronione dopisz do tej tablicy. Middleware przekierowuje też zalogowanego z `/` na `/dashboard` — rób takie redirecty tutaj, nie przez `return Astro.redirect()` we frontmatterze strony (crash reguły `no-misused-promises`).
2. Formularze to wyspy React (`src/components/auth/SignInForm.tsx` + `PasswordToggle`, `src/components/subscriptions/SubscriptionForm.tsx`, `src/components/subscriptions/SubscriptionActions.tsx` — przyciski Cancel/Delete z `AlertDialog` i formularzem POST; wspólne `FormField`, `SubmitButton`, `ServerError` w `src/components/form/`) robiące **tylko** walidację po stronie klienta; wysyłają natywny `<form method="POST" action="/api/...">` — bez `fetch` i bez JSON.
3. Endpointy w `src/pages/api/**/*.ts` (`auth/*`, `subscriptions.ts`, `subscriptions/[id].ts`, `subscriptions/[id]/cancel.ts`, `subscriptions/[id]/delete.ts`; wspólne redirecty błędów w `src/lib/api-redirects.ts`) eksportują `POST: APIRoute`, czytają `request.formData()` i komunikują wynik **redirectem**: sukces → strona docelowa, błąd → `redirect("<strona formularza>?error=" + encodeURIComponent(msg))` (np. `/auth/signin`, `/dashboard`, `/subscriptions/<id>/edit`). Endpointy domenowe walidują wejście zod-em (`src/lib/validation/`) i nie przekazują surowych komunikatów bazy. Strona `.astro` czyta `Astro.url.searchParams.get("error")` i przekazuje go do wyspy jako `serverError`. Na `/dashboard` `?error=` z przeniesionymi polami formularza (tylko `formErrorLocation`) trafia do formularza „Add”, a bez nich — do banera strony (błędy akcji na wpisach).
4. Wylogowanie i akcje w `Topbar.astro` to również formularze POST — nie linki GET.

### Dane i logika domenowa

- Typy bazy generuje `npm run db:types` do `src/db/database.types.ts` (commitowany, wyłączony z ESLint i Prettier — nie edytuj ręcznie, regeneruj po każdej migracji); klient z `createClient()` jest typowany `Database`.
- Współdzielone typy (encje, DTO) → `src/types.ts` (już: `Subscription`, `BillingCycle`, `SubscriptionStatus`, wyprowadzone z `Database`); logika biznesowa → `src/lib/services/` (już: `dates.ts` — daty kalendarzowe `YYYY-MM-DD`, „dziś” w `Europe/Warsaw`; `subscriptions.ts` — rollover z kotwicą do dnia liczony przy odczycie, odnowienia w [dziś, dziś+30], koszt miesięczny per waluta w groszach); schematy wejścia → `src/lib/validation/`; stałe współdzielone z wyspami bez zod → `src/lib/currencies.ts` (wyspa nie może importować modułu z zod — trafia do bundla klienta); hooki React → `src/components/hooks/`.
- Walidacja wejścia na granicach (API, formularze) zod-em. Nie dodawaj `zod` do `package.json` — importuj `z` z `astro/zod` (Astro re-eksportuje zod v4; `astro:schema` jest deprecated w Astro 7 i nie rozwiązuje się w vitest, a `astro/zod` tak); jeśli brakuje w nim potrzebnego API, opisz to w PR zamiast instalować pakiet.

### Lint

- Reguły w @eslint.config.js (`typescript-eslint` type-aware, `projectService`) — linter zgłosi naruszenia sam.
- Pułapki konfiguracji: pliki `.astro` są lintowane z `project: ./tsconfig.json` zamiast `projectService` (ograniczenie astro-eslint-parser); `scripts/**/*.mjs` bez type-check. `eslint-plugin-react` jest owinięty `fixupPluginRules` dla ESLint 10 — nie usuwaj tego owinięcia.

### Katalog `context/`

- `context/foundation/` — `prd.md`, `tech-stack.md`, `shape-notes.md` (wejścia z wcześniejszych lekcji; `lessons.md` powstanie przy pierwszym `/10x-lesson`); `course-notes.md` — materiał lekcji z 10x CLI, nie zasady.
- `context/changes/` — logi zmian, np. `bootstrap-verification/verification.md` (pełny zapis scaffoldu i audytu `npm audit`).
