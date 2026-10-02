---
project: Subtracker
version: 1
status: draft                    # draft | active | locked
created: 2026-10-02
updated: 2026-10-02
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: first-usable-tracker
milestone_seq: 1
milestone_status: open           # open | done
---

# Roadmap: Subtracker

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Pierwszy używalny tracker subskrypcji** — Status: open

- **Intent:** Zalogowany użytkownik przechodzi cały przepływ MVP z PRD — rejestracja, dodanie trzech subskrypcji, edycja jednej — i na ekranie głównym widzi poprawny koszt miesięczny per waluta oraz odnowienia w ciągu 30 dni; może też usuwać i anulować wpisy.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`, a przepływ MVP z PRD §Success Criteria (Primary) przechodzi end-to-end na środowisku produkcyjnym.
- **Scope anchors:** FR-001 – FR-009 (wszystkie konieczne), US-01, NFR prywatności. FR-010 (nice-to-have) poza kamieniem milowym.

## Vision recap

Osoby prywatne z wieloma subskrypcjami płacą za usługi, o których zapomniały, bo informacja o cyklicznych opłatach jest rozproszona po wyciągach, mailach i pamięci. Kluczowy wgląd: różne cykle rozliczeniowe (miesięczny, kwartalny, roczny) zaciemniają realny koszt — dopiero sprowadzenie wszystkich opłat do jednego kosztu miesięcznego (osobno dla każdej waluty) pokazuje prawdę o wydatkach. Subtracker zbiera subskrypcje w jednym miejscu i pokazuje ten koszt oraz to, co odnowi się w ciągu 30 dni.

## North star

**S-01: Użytkownik dodaje subskrypcje i na ekranie głównym widzi koszt miesięczny per waluta oraz odnowienia w ciągu 30 dni** — to dokładnie główne kryterium sukcesu z PRD, więc przy celu „szybkość dostarczenia” stoi zaraz po jedynym wymaganym fundamencie.

> „Gwiazda przewodnia” (north star) oznacza tu najmniejszy kompletny przepływ widoczny dla użytkownika, którego dostarczenie udowadnia główną hipotezę produktu — dlatego stoi tak wcześnie, jak pozwalają jego zależności: wszystko inne ma sens tylko wtedy, gdy to działa.

## At a glance

| ID   | Change ID                       | Outcome (user can …)                                                                                  | Prerequisites | PRD refs                                    | Status   |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------- | -------- |
| F-01 | owner-only-subscription-store   | (foundation) magazyn subskrypcji istnieje i każde konto widzi wyłącznie własne wpisy                  | —             | NFR prywatności, Access Control             | in-progress |
| S-01 | home-screen-cost-and-renewals   | dodać subskrypcje i na ekranie głównym zobaczyć koszt miesięczny per waluta oraz odnowienia w 30 dni | F-01          | US-01, FR-001, FR-002, FR-003, FR-008, FR-009 | proposed |
| S-02 | subscription-list-and-edit      | przeglądać listę własnych subskrypcji i poprawić dowolny wpis                                        | S-01          | FR-004, FR-005                              | proposed |
| S-03 | subscription-delete-and-cancel  | usunąć błędny wpis lub oznaczyć subskrypcję jako anulowaną, z poprawnym wpływem na sumę i odnowienia | S-01          | FR-006, FR-007, US-01                       | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                      | Chain                      | Note                                                                                   |
| ------ | -------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| A      | Ścieżka głównego przepływu | `F-01` → `S-01` → `S-02`   | Najkrótsza droga do przepływu MVP z PRD (dodaj → zobacz sumę → edytuj) — cel `speed`. |
| B      | Cykl życia wpisu           | `S-03`                     | Dołącza do strumienia A w `S-01`; może iść równolegle z `S-02`.                        |

## Baseline

What's already in place in the codebase as of `2026-10-02` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present (per tech-stack.md) — SSR z interaktywnymi wyspami; strony `index`, `dashboard` (pusta), `auth/*` w `src/pages/`.
- **Backend / API:** partial — tylko endpointy auth (`src/pages/api/auth/{signin,signup,signout}.ts`); brak endpointów domenowych.
- **Data:** partial — klient bazy w `src/lib/supabase.ts` i `supabase/config.toml`; brak migracji, tabel domenowych i izolacji wierszy per konto.
- **Auth:** present — rejestracja/logowanie/wylogowanie e-mail + hasło; ochrona tras w `src/middleware.ts` (`PROTECTED_ROUTES = ["/dashboard"]`).
- **Deploy / infra:** present — produkcja na `subtracker.kamil-kapturski.workers.dev`; CI (`.github/workflows/ci.yml`) z jobami `ci`, `smoke`, `deploy`.
- **Observability:** partial — logi platformy włączone (`observability` w `wrangler.jsonc`); brak śledzenia błędów i brak testów jednostkowych.

## Foundations

### F-01: Magazyn subskrypcji z izolacją per konto

- **Outcome:** (foundation) trwały magazyn subskrypcji istnieje z polami wymaganymi przez FR-003 i FR-007 (nazwa, cena, waluta, cykl, data następnego odnowienia, status), a baza sama wymusza, że każde konto czyta, dodaje, zmienia i usuwa wyłącznie własne wpisy; osoba niezalogowana nie widzi niczego.
- **Change ID:** owner-only-subscription-store
- **PRD refs:** NFR prywatności, Access Control
- **Unlocks:** S-01, S-02, S-03; ścieżka weryfikacji „drugie konto nie widzi i nie modyfikuje cudzych subskrypcji” wymagana przez NFR prywatności.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wydzielone przed S-01, bo NFR prywatności jest binarny i jego złamanie jest nienaprawialne po wpuszczeniu użytkowników; zakres celowo minimalny (jeden magazyn + reguły dostępu + weryfikacja izolacji), bez UI i bez logiki przeliczeń — te wchodzą w S-01.
- **Status:** in-progress

## Slices

### S-01: Ekran główny z kosztem miesięcznym i odnowieniami

- **Outcome:** użytkownik po zalogowaniu trafia na ekran główny, dodaje subskrypcje o różnych cyklach i walutach, i widzi łączny uśredniony koszt miesięczny osobno dla każdej waluty (roczna = 1/12, kwartalna = 1/3) oraz listę subskrypcji odnawiających się w ciągu 30 dni, z datami odnowień automatycznie przesuwanymi o cykl po ich minięciu; bez subskrypcji widzi czytelny stan pusty.
- **Change ID:** home-screen-cost-and-renewals
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-008, FR-009
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jak przesuwać datę odnowienia, gdy dzień nie istnieje w kolejnym miesiącu (np. 31 → luty)? — Owner: user. Block: no.
  - Czy okno „w ciągu 30 dni” obejmuje dzisiejszą datę i dzień 30.? — Owner: user. Block: no.
- **Risk:** Niesie barierę jakości z PRD („błędna suma niszczy zaufanie”), więc przeliczanie cykli i przesuwanie dat odnowień muszą mieć tu automatyczne testy — to pierwszy wycinek, który ich potrzebuje; FR-001/FR-002 są już w kodzie i są tu jedynie weryfikowane w pełnym przepływie (rejestracja → ekran główny).
- **Status:** proposed

### S-02: Lista i edycja subskrypcji

- **Outcome:** użytkownik przegląda listę wszystkich własnych subskrypcji i edytuje dowolną z nich (np. cenę lub datę), a suma i odnowienia na ekranie głównym od razu to odzwierciedlają.
- **Change ID:** subscription-list-and-edit
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zamyka krok 4 przepływu MVP z PRD; po S-01, bo edycja bez wpisów i bez widocznego efektu na sumie nie daje sprawdzalnego wyniku.
- **Status:** proposed

### S-03: Usuwanie i anulowanie subskrypcji

- **Outcome:** użytkownik usuwa błędny wpis albo oznacza subskrypcję jako anulowaną; anulowana zostaje w historii, liczy się do sumy i listy odnowień do daty następnego odnowienia, a potem znika z obu widoków i nie jest już przesuwana o cykl.
- **Change ID:** subscription-delete-and-cancel
- **PRD refs:** FR-006, FR-007, US-01
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:**
  - Gdzie użytkownik widzi anulowane subskrypcje po wypadnięciu z sumy („zostaje w historii”) — na liście z S-02 czy osobno? — Owner: user. Block: no.
- **Risk:** Rozszerza regułę z S-01 o status anulowania (kryterium US-01 dostosowane do FR-007 — nie odwracać); oddzielone od S-02, bo to inna reguła domenowa z własnym ryzykiem poprawności sumy.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                                  | Ready for `/10x-plan` | Notes                                   |
| ---------- | ------------------------------ | ---------------------------------------------------------------------- | --------------------- | --------------------------------------- |
| F-01       | owner-only-subscription-store  | Magazyn subskrypcji z izolacją danych per konto                       | yes                   | Run `/10x-plan owner-only-subscription-store` |
| S-01       | home-screen-cost-and-renewals  | Ekran główny: koszt miesięczny per waluta i odnowienia w 30 dni       | no                    | Czeka na F-01                           |
| S-02       | subscription-list-and-edit     | Lista i edycja subskrypcji                                             | no                    | Czeka na S-01                           |
| S-03       | subscription-delete-and-cancel | Usuwanie i anulowanie subskrypcji                                      | no                    | Czeka na S-01; równolegle z S-02        |

## Open Roadmap Questions

Brak przekrojowych pytań na dzień 2026-10-02 (PRD §Open Questions: brak otwartych). Pytania dotyczące pojedynczych wycinków są w ich polach Unknowns.

## Parked

- **Faktyczne obciążenia bieżącego miesiąca (FR-010)** — Why parked: nice-to-have w PRD; cel `speed` i ryzyko `time`.
- **Współdzielenie, gospodarstwa domowe, role** — Why parked: PRD §Non-Goals.
- **Tryb offline** — Why parked: PRD §Non-Goals.
- **Katalog usług i cen** — Why parked: PRD §Non-Goals.
- **Import z banku lub maila** — Why parked: PRD §Non-Goals (poza zakresem MVP).
- **Przeliczanie walut po kursach** — Why parked: PRD §Non-Goals; decyzja „osobna suma per waluta” stoi.
- **Powiadomienia (e-mail, push)** — Why parked: PRD §Non-Goals (poza zakresem MVP).
- **Historia zmian cen** — Why parked: PRD §Non-Goals (poza zakresem MVP).
- **Długo utrzymywana sesja** — Why parked: kandydat z rundy Sokratesa dla FR-002, nieprzyjęty jako NFR.
- **Śledzenie błędów poza logami platformy** — Why parked: żaden FR/NFR tego nie wymaga; cel `speed`.

## Milestone History

## Done
