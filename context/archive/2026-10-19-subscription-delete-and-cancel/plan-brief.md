# Usuwanie i anulowanie subskrypcji — Plan Brief

> Full plan: `context/changes/subscription-delete-and-cancel/plan.md`

## What & Why

S-03 z roadmapy (FR-006, FR-007, US-01): użytkownik usuwa błędny wpis albo oznacza subskrypcję jako anulowaną. Anulowana wciąż kosztuje do końca opłaconego okresu, więc liczy się do sumy i odnowień do daty następnego odnowienia, a potem znika z obu widoków — bez tego suma zaniża lub zawyża realny koszt, co PRD wskazuje jako barierę zaufania.

## Starting Point

Schemat (`status active | cancelled`) i polityki RLS dla update/delete istnieją od F-01, więc migracja nie jest potrzebna. Serwis `src/lib/services/subscriptions.ts` celowo liczy tylko `active` (odroczenie z S-01), a `/dashboard` ma listę „All subscriptions” z S-02, ale bez akcji usuwania i anulowania.

## Desired End State

W każdym wierszu „All subscriptions” są przyciski „Cancel” (dla aktywnej) i „Delete”, oba potwierdzane w dialogu. Anulowana ma zamrożoną datę końca D, liczy się w sumie i odnowieniach (oznaczona „won't renew”) do D włącznie, potem zostaje tylko na liście jako „Cancelled · ended D”. Błędy akcji pokazują się w banerze na górze strony.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Granica dnia D | Anulowana liczy się, gdy dziś ≤ D (włącznie) | Dosłownie PRD/US-01 („po tej dacie znika”) i spójne z obustronnie domkniętym oknem 30 dni. |
| Data końca D | Zamrożona w `next_renewal_date` przy anulowaniu (odnowienie wyliczone w dniu anulowania) | Bez migracji; anulowana nie jest przesuwana, więc utrata kotwicy dnia nic nie psuje. |
| Miejsce akcji | Wiersze listy „All subscriptions” na `/dashboard` | Wybór użytkownika — akcja z ekranu głównego bez wchodzenia w edycję. |
| Potwierdzenie | shadcn AlertDialog dla Cancel i Delete | Wybór użytkownika dla delete; cancel też, bo bez przywracania jest nieodwracalny. |
| Przywracanie anulowanej | Poza zakresem | Żaden FR tego nie wymaga; pomyłkę naprawia delete + ponowne dodanie. |
| Historia anulowanych | Ta sama lista z etykietą „Cancelled · ends/ended D” | Rozwiązuje Unknown z roadmapy bez nowego widoku. |
| Ponowne anulowanie | No-op (redirect bez update) | Ponowne zamrożenie przesunęłoby D o cykl po jego minięciu. |
| Baner błędów (F4 z S-02) | `?error=` bez przeniesionych pól → baner strony; z polami → formularz „Add” | `formErrorLocation` jest jedynym producentem pól, więc rozróżnienie jest jednoznaczne bez nowego parametru. |
| Stan pusty | Tylko przy zerze wpisów; brak liczonych → komunikat w sekcji kosztu | Zamyka follow-up z S-02 (stan pusty + lista jednocześnie). |

## Scope

**In scope:**
- Reguła FR-007 (`countsToward`, `effectiveRenewalDate`, `cancellationEndDate`) z testami vitest
- `POST /api/subscriptions/[id]/cancel` i `/delete`, baner błędów, kroki smoke
- Wyspa `SubscriptionActions` z AlertDialog, aktualizacja CLAUDE.md i README

**Out of scope:**
- Przywracanie anulowanej, osobny widok historii, akcje na stronie edycji
- Migracje schematu, kolumny `cancelled_at`, zmiany RLS/pgTAP, miękkie usuwanie

## Architecture / Approach

Czyste funkcje w serwisie rozróżniają znaczenie `next_renewal_date` po statusie (baza z rolloverem dla aktywnej, zamrożona D dla anulowanej); `/dashboard` liczy sumę i odnowienia z jednego istniejącego zapytania. Endpointy idą wzorcem `src/pages/api/subscriptions/[id].ts` (RLS → obce id = not found, wynik redirectem). Wyspa React tylko potwierdza i wysyła natywny `<form method="POST">`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reguła FR-007 w serwisie i widoku | Poprawna suma/odnowienia z anulowanymi do D, etykiety, stan pusty | Granica D i brak rolloveru dla anulowanej — pokryte testami |
| 2. Endpointy cancel i delete | Zapis stanu, baner błędów, smoke | Podwójne anulowanie przesuwające D — guard `status = active` |
| 3. Akcje w UI z potwierdzeniem | AlertDialog w wierszach listy, CLAUDE.md | Nowa zależność Radix z shadcn CLI; układ wiersza na telefonie |

**Prerequisites:** S-01 i S-02 zrobione (archiwum 2026-10-02 i 2026-10-19); Node 22.14.0, lokalny `supabase db start` do ręcznych testów; smoke z auth w CI.
**Estimated effort:** ~2–3 sesje w 3 fazach.

## Open Risks & Assumptions

- Anulowanie w dniu odnowienia daje D = dziś: wpis liczy się jeszcze tego dnia i znika jutro (konsekwencja granicy włącznie).
- Edycja anulowanej pozostaje dozwolona; zmiana daty w formularzu przesuwa datę końca D.
- Lokalny pełny `supabase start` nie działa w tym środowisku — smoke weryfikowany w CI.

## Success Criteria (Summary)

- Anulowana subskrypcja liczy się do sumy i odnowień do D włącznie, potem zostaje tylko w historii — potwierdzone testami granicy D.
- Użytkownik usuwa lub anuluje wpis z `/dashboard` z potwierdzeniem, a obce id nigdy nie jest modyfikowane.
- Przepływ MVP z PRD przechodzi end-to-end na produkcji.
