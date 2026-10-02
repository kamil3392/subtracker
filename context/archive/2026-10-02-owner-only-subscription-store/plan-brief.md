# Magazyn subskrypcji z izolacją per konto — Plan Brief

> Full plan: `context/changes/owner-only-subscription-store/plan.md`

## What & Why

Fundament F-01 z roadmapy: pierwsza tabela domenowa `public.subscriptions` z Row Level Security, dzięki któremu sama baza gwarantuje NFR prywatności: żaden użytkownik ani osoba niezalogowana nie widzi subskrypcji innego konta. Wydzielone przed S-01, bo złamanie tej właściwości po wpuszczeniu użytkowników jest nienaprawialne.

## Starting Point

Dziś używana jest tylko `auth.users`; nie ma `supabase/migrations/`, testów DB ani typów bazy. Klient Supabase (`src/lib/supabase.ts`) jest nietypowany, a job `smoke` w CI już uruchamia lokalny Supabase.

## Desired End State

Tabela z polami z FR-003/FR-007 istnieje lokalnie, w CI i na produkcji. Testy pgTAP w każdym CI dowodzą, że konto B nie czyta, nie zmienia, nie usuwa i nie podrzuca subskrypcji konta A, a anon nie ma dostępu. Aplikacja ma typ `Subscription` gotowy dla S-01.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Weryfikacja izolacji | pgTAP (`supabase test db`) w jobie `smoke` | Natywne narzędzie, testuje polityki dla wszystkich 4 operacji, bez nowych zależności npm. |
| Typ ceny | `numeric(10,2)` | Dokładny typ dziesiętny, 1:1 z wpisem użytkownika; zaokrąglanie przy /3 i /12 należy do S-01. |
| Minimalna cena | `price > 0` | Pozycja 0,00 nie wpływa na sumę i najpewniej jest błędem wpisu. |
| Waluta | tekst z CHECK `^[A-Z]{3}$` (ISO 4217) | Nowa waluta bez migracji; konkretną listę ustala formularz w S-01. |
| Cykl i status | enumy Postgresa | Wygenerowane typy TS są uniami, a wartości są ustalone w PRD. |
| Własność wiersza | `user_id default auth.uid()`, FK do `auth.users` on delete cascade | Klient nie musi podawać właściciela; usunięcie konta sprząta dane. |
| Update | polityka z `USING` i `WITH CHECK` | Bez `WITH CHECK` właściciel mógłby przepisać wiersz na cudze konto. |
| Anon | brak polityk + `revoke all` | Dwie warstwy; anon dostaje jawny błąd `42501`. |
| Produkcja | ręczny `supabase link` + `db push` przez człowieka | Zgodne z granicami deployu, bez nowych sekretów w CI. |

## Scope

**In scope:**
- Migracja tabeli, enumów, indeksu, RLS i 4 polityk
- Test pgTAP izolacji i ograniczeń + krok w CI
- Wygenerowane typy, typowany klient, `src/types.ts`, skrypt `db:types`
- Aktualizacja README/CLAUDE.md, wdrożenie na produkcję i zapis w deploy-plan

**Out of scope:**
- UI, endpointy, zod, przeliczanie cykli, rollover dat (S-01…S-03)
- `updated_at`, `cancelled_at`, historia cen
- Zamknięta lista walut, auto `db push` w CI, skrypt Node dla izolacji, runner testów JS

## Architecture / Approach

Schemat → weryfikacja → typy → produkcja. Migracja jest czysto addytywna, więc obecny kod i rollback Workera nie są dotknięte. Testy pgTAP symulują dwa konta i anon przez `set local role` + `request.jwt.claims` i liczą dotknięte wiersze (cudze wiersze są „niewidzialne”, nie rzucają błędów).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migracja schematu i RLS | `public.subscriptions` z politykami, stosowana lokalnie | Brak `WITH CHECK` w update |
| 2. Testy pgTAP i CI | Automatyczny dowód izolacji w każdym CI | Asercje oczekujące wyjątku tam, gdzie RLS daje 0 wierszy |
| 3. Typy i dokumentacja | Typowany klient, `Subscription`, aktualne README/CLAUDE.md | Wygenerowany plik łamie lint |
| 4. Produkcja (bramka ręczna) | Migracja na hostowanym Supabase + wpis w deploy-plan | Zapomniany ręczny `db push` przy przyszłych migracjach |

**Prerequisites:** Docker lokalnie (dla `supabase start`), Node 22 (`nvm use 22`), dostęp człowieka do hostowanego projektu Supabase (login, project ref, hasło bazy).
**Estimated effort:** ~1–2 sesje wieczorne w 4 fazach; faza 4 to ~15 minut pracy człowieka.

## Open Risks & Assumptions

- Zakładamy, że lokalny obraz Supabase zawiera rozszerzenie `pgtap` (standard dla `supabase test db`).
- Ręczny `db push` to proces, nie mechanizm — zasada zapisana w deploy-plan musi być przestrzegana przy S-01+.

## Success Criteria (Summary)

- `npx supabase test db` jest zielony lokalnie i w CI, a usunięcie zabezpieczenia RLS go wywraca.
- Na produkcji tabela istnieje, a anon dostaje odmowę.
- S-01 może od razu używać typowanego `Subscription` bez zmian w schemacie.
