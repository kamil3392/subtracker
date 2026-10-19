# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-19

## 1. Strategy

Testy w tym projekcie podlegają trzem nienegocjowalnym zasadom:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `scripts/` (bez `src/db/database.types.ts`, lockfile, dokumentacji i `context/`).

## 2. Risk Map

Najważniejsze scenariusze awarii, uporządkowane wg wpływ × prawdopodobieństwo. Kolumna Source cytuje dowód, który podniósł ryzyko — nigdy plik jako „miejsce awarii” (patrz §1 zasada #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Dashboard pokazuje błędny koszt miesięczny waluty (zła proporcja cyklu, rozjazd groszowy, zła waluta lub zły zbiór liczonych wpisów) i nikt tego nie zauważa | High | High | PRD §Success Criteria (Guardrails), FR-008; interview Q1, Q4; hot-spot dir `src/lib/services` (15 commits/30d); research Phase 1 (pozycje wykresu udziałów sumują się do 1 gr mniej niż kafel — rozjazd zaakceptowany 2026-10-19) |
| 2 | Data odnowienia dryfuje (31. → 28. i zostaje) albo lista „w ciągu 30 dni” myli się na granicach okna lub dnia w strefie Europe/Warsaw | High | High | PRD FR-009; interview Q2 (już raz zawiodło); archive/2026-10-02-home-screen-cost-and-renewals/plan.md (dryf odrzucony, „dziś” w Warszawie); roadmap S-01 Unknowns |
| 3 | Zapis edycji po cichu nadpisuje kotwicę daty bazowej albo zostawia starą bazę mimo zmiany daty lub cyklu — kolejne odnowienia przesuwają się bez wiedzy użytkownika | High | High | PRD FR-005; interview Q3; archive/2026-10-19-subscription-list-and-edit/plan.md (reguła daty przy edycji); hot-spot dir `src/pages/api` (13 commits/30d) |
| 4 | Anulowana subskrypcja liczy się po dacie końca opłaconego okresu albo znika przed nią — z sumy lub z odnowień | High | Medium | PRD FR-007, US-01 (kryterium dostosowane); CLAUDE.md (twarda zasada FR-007); archive/2026-10-19-subscription-delete-and-cancel/plan.md |
| 5 | Nadużycie: zalogowany użytkownik podmienia id w URL lub formularzu i czyta, edytuje, anuluje albo usuwa cudzą subskrypcję; niezalogowany dostaje dane | High | Medium | PRD NFR prywatności (binarny), §Access Control; roadmap F-01; profil bazy testów (endpointy pokryte tylko smoke) |
| 6 | Nadużycie: serwer przyjmuje ręcznie spreparowany POST (waluta spoza listy, ujemna/absurdalna cena, nieprawidłowa data lub cykl) i zapisuje dane psujące sumę | Medium | Medium | CLAUDE.md (walidacja zod na granicy API); archive/2026-10-19-subscription-list-and-edit/plan.md (waluta wysłana ręcznie); hot-spot dir `src/lib/validation` (7 commits/30d) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Dla zestawu mieszanych cykli i walut wynik równa się wartości policzonej ręcznie z reguły PRD (miesięczna całość, kwartalna 1/3, roczna 1/12, osobno per waluta, bez przeliczania kursów) | „Testy serwisu są zielone, więc liczba na ekranie jest poprawna”; „pozycje wykresu muszą sumować się do kafla” (kafel jest wartością autorytatywną, pozycje zaokrąglane do wyświetlenia — rozjazd ≤1 gr na pozycję akceptowany) | źródło danych sumy, miejsce i liczba zaokrągleń, które wpisy trafiają do sumy | unit z wyrocznią z PRD | oczekiwana wartość wyliczona tą samą formułą co kod (problem wyroczni) |
| #2 | Kotwica dnia 31. wraca po krótkim miesiącu; okno [dziś, dziś+30] jest włączne na obu końcach; „dziś” liczone w Warszawie, gdy UTC jest jeszcze przed północą | „Jeden przypadek 31.01 wystarczy” | reguła kotwicy, definicja okna, źródło „dziś” | unit (tabela granic, ewentualnie property-based) | pojedynczy happy path bez granic dnia, miesiąca, roku i zmiany czasu |
| #3 | Zmiana samej ceny zostawia w bazie datę bazową z kotwicą; zmiana daty lub cyklu zapisuje nową bazę — sprawdzane na zapisanym wierszu | „Redirect na /dashboard znaczy, że zapis był poprawny” | przepływ odczyt → reguła → zapis w jednym żądaniu, co trafia do kolumny daty | unit reguły + integracja endpointu z lokalną bazą | asercja wyłącznie na redirect lub HTML bez odczytu zapisanego wiersza |
| #4 | Granica D: dzień przed D i D liczone, D+1 nieobecna w sumie i odnowieniach; anulowana nie jest przesuwana o cykl | „Anulowana = wykluczona od razu” (odwrócenie FR-007) | moment i wartość zamrożenia daty końca przy anulowaniu | unit z granicą D | „naprawianie” reguły w stronę kryterium US-01 sprzed korekty |
| #5 | Obce id przy edycji, anulowaniu i usuwaniu daje not found, a wiersz drugiego konta pozostaje niezmieniony; niezalogowany nie dostaje danych | „RLS ma testy pgTAP, więc endpointy są bezpieczne” | czy endpointy polegają wyłącznie na RLS, kształt sesji potrzebny w teście | pgTAP (istnieje) + integracja endpointów dla dwóch kont | test na jednym koncie albo mockowanie klienta bazy |
| #6 | Spreparowany POST z pominięciem walidacji klienta jest odrzucany redirectem z błędem, a do bazy nic nie trafia | „Formularz waliduje, więc serwer dostaje poprawne dane” | schemat wejścia, translacja błędu na redirect, brak surowych komunikatów bazy | unit schematu + integracja endpointu | testowanie walidacji wyspy React zamiast serwera |

## 3. Phased Rollout

Każdy wiersz to osobny etap wdrożenia otwierający własny folder zmiany przez `/10x-new`. Status przechodzi przez wartości poniżej; orkiestrator aktualizuje go w miarę pojawiania się artefaktów.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Wyrocznia reguły kosztu i dat | Udowodnić, że suma, rollover i granica anulowania zgadzają się z regułą PRD liczoną niezależnie od kodu | #1, #2, #4 | unit (tabele z PRD, granice) | implementing | context/changes/testing-cost-and-date-rule-oracle/ |
| 2 | Kotwica daty przy zapisie edycji | Udowodnić, że zapis edycji zachowuje lub zmienia datę bazową zgodnie z regułą — w bazie, nie w odpowiedzi | #3, #2 | unit + integracja endpointu z lokalnym Supabase | not started | — |
| 3 | Ekran zgodny z regułą | Udowodnić, że wyrenderowana suma i odnowienia dla danych z bazy równają się wyroczni z etapu 1 | #1, #4 | integracja renderu lub asercja kwoty w smoke | not started | — |
| 4 | Granice dostępu i walidacji serwera | Udowodnić, że obce id i spreparowany POST nie zmieniają ani nie ujawniają danych | #5, #6 | integracja endpointów (dwa konta) + istniejący pgTAP | not started | — |

## 4. Stack

Profil bazy testów: `sparse` — vitest skonfigurowany, 5 plików unit skupionych w `src/lib/`, 1 plik pgTAP (RLS); endpointy, middleware i widoki pokrywa tylko smoke po HTTP.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit | Vitest | ^5.0.3 | środowisko `node`, testy obok kodu jako `src/**/*.test.ts` |
| database / RLS | pgTAP przez Supabase CLI (`supabase test db`) | ^2.23.4 | wymaga lokalnej bazy (`supabase db start`) |
| integration (endpointy) | none yet — see Phase 2 | — | warstwa wybierana w `/10x-research` etapu 2 |
| smoke HTTP | `scripts/smoke.mjs` przeciw `astro preview` (workerd) | — | przepływ auth + CRUD subskrypcji; jedyny test w realnym runtime |
| e2e w przeglądarce | none — celowo | — | smoke pokrywa przepływ MVP; patrz §7 |
| (optional) AI-native | narzędzie automatyzacji przeglądarki (claude-in-chrome) — checked: 2026-10-19 | n/a | eksploracyjne przejście przepływu MVP na preview przed wydaniem. When NOT to use: do niczego, co wykrywa unit, pgTAP lub smoke; nie jako bramka CI |

**Stack grounding tools (current session):**
- Docs: none — Context7 / MCP dokumentacji frameworka not available in current session; wersje z `package.json`; checked: 2026-10-19
- Search: WebSearch (narzędzie hosta) — nieużyte w Fazie 1; dostępne do weryfikacji wsparcia narzędzi w `/10x-research`; checked: 2026-10-19
- Runtime/browser: claude-in-chrome — możliwe użycie tylko w opcjonalnym przeglądzie eksploracyjnym; checked: 2026-10-19
- Provider/platform: GitLab, Jira — bez znaczenia dla bramek (repozytorium na GitHubie); MCP Cloudflare/Supabase not available in current session; checked: 2026-10-19

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + kontrola literałów UI | local (pre-commit eslint) + CI `ci` | required | dryf typów/stylu, literały palety w widokach |
| typecheck (`astro check`) | CI `ci` | required | dryf typów w `.astro` i `.ts` |
| unit (`npm test`) | local + CI `ci` | required (wzmocniona po §3 Phase 1) | regresje reguły kosztu, rolloveru i anulowania |
| pgTAP (`supabase test db`) | CI `smoke` | required | regresje RLS i ograniczeń tabeli |
| integracja endpointów | CI | required after §3 Phase 2 | zapis daty bazowej, obce id, spreparowany POST |
| smoke HTTP w workerd | CI `smoke` | required | przepływ MVP, Node API spoza `nodejs_compat` |
| asercja zgodności ekranu z regułą | CI | required after §3 Phase 3 | rozjazd wyświetlonej sumy z regułą |
| post-edit hook | local (agent loop) | recommended (Lekcja 3) | regresje w chwili edycji — nie zastępuje CI |

## 6. Cookbook Patterns

Jak dodawać testy w tym projekcie. Każda podsekcja jest uzupełniana po wdrożeniu odpowiedniego etapu.

### 6.1 Test reguły domenowej z wyrocznią z PRD

- TBD — see §3 Phase 1 (wzorzec: tabela przypadków granicznych sumy, rolloveru i granicy D, z oczekiwaną wartością wyliczoną z PRD, nie z kodu).

### 6.2 Test zapisu sprawdzający stan w bazie

- TBD — see §3 Phase 2 (wzorzec: zachowanie lub nadpisanie kotwicy daty przy edycji, asercja na zapisanym wierszu).

### 6.3 Test zgodności ekranu z regułą

- TBD — see §3 Phase 3 (wzorzec: znane dane w bazie → wyrenderowana suma i odnowienia równe wyroczni).

### 6.4 Test nowego endpointu: własność i walidacja serwera

- TBD — see §3 Phase 4 (wzorzec: dwa konta, obce id → not found bez zmiany wiersza; spreparowany POST → redirect z błędem bez zapisu).

### 6.5 Test bazy (RLS, ograniczenia)

- **Location**: `supabase/tests/*.test.sql`.
- **Reference test**: `supabase/tests/subscriptions_rls.test.sql`.
- **Run locally**: `npx supabase db start` + `npx supabase test db`.

### 6.6 Per-rollout-phase notes

(Uzupełniane przez `/10x-implement` po każdym etapie.)

## 7. What We Deliberately Don't Test

- **Kitchen sink `/dev/dashboard-states` i stylowanie widoków** — kontrola literałów UI w lincie wystarcza; bez testów snapshotów i przeglądu wizualnego. Re-evaluate if pojawi się regresja wizualna zgłoszona przez użytkownika albo motyw ciemny. (Source: Phase 2 interview Q5.)
- **e2e w przeglądarce dla przepływu auth** — smoke po HTTP w workerd pokrywa przepływ MVP taniej. Re-evaluate if pojawi się logika po stronie klienta, której smoke nie widzi.
- **Wygenerowane `src/db/database.types.ts` i komponenty `src/components/ui/`** — generator jest testem.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-19
- Stack versions last verified: 2026-10-19
- AI-native tool references last verified: 2026-10-19

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
