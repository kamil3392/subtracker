# Usuwanie i anulowanie subskrypcji — plan implementacji

## Overview

Wycinek S-03 z roadmapy (FR-006, FR-007, US-01). Użytkownik usuwa błędny wpis albo oznacza subskrypcję jako anulowaną. Anulowana zostaje w historii (na liście „All subscriptions”), liczy się do sumy miesięcznej i listy odnowień do daty końca opłaconego okresu **włącznie**, a potem znika z obu widoków i nie jest już przesuwana o cykl. Kończy to celowe odroczenie FR-007 z S-01, które dziś pomija anulowane od razu.

## Current State Analysis

- Schemat jest gotowy: enum `subscription_status` (`active | cancelled`), kolumna `status` z domyślną wartością `active`, polityki RLS `subscriptions_update_own` / `subscriptions_delete_own` i granty select/insert/update/delete dla `authenticated` (`supabase/migrations/20261002091205_create_subscriptions.sql:8,18,45-56`, `20261002111450_restrict_subscriptions_grants.sql:9`). pgTAP już pokrywa izolację update/delete między kontami. **Migracja nie jest potrzebna.**
- `src/lib/services/subscriptions.ts:63-65` — `isActive()` filtruje sumę (`monthlyCostByCurrency`, l.73) i odnowienia (`upcomingRenewals`, l.90); anulowane są pomijane natychmiast. `monthlyCostByCurrency` nie zna „dziś”.
- `next_renewal_date` to data bazowa; odnowienie wyliczane jest przy odczycie (`nextRenewalDate`, l.28). Dla anulowanej „data następnego odnowienia” musi być ustalona w chwili anulowania, inaczej przesuwałaby się w nieskończoność.
- `/dashboard` (`src/pages/dashboard.astro`) pobiera wszystkie wiersze jednym zapytaniem; lista „All subscriptions” już ma gałąź `"Cancelled"` (l.122-125) z komentarzem „FR-007 is S-03”. `isEmpty = costs.length === 0` (l.35) — konto z samymi anulowanymi zobaczy jednocześnie stan pusty i listę (follow-up z S-02).
- Błędy akcji na wpisach (`/dashboard?error=…`, np. „Subscription not found” z `src/pages/api/subscriptions/[id].ts:8-12`) trafiają dziś do `ServerError` formularza „Add subscription” (follow-up F4 z S-02, `context/archive/2026-10-19-subscription-list-and-edit/follow-ups/review-fixes.md`).
- Wzorzec endpointu domenowego: `src/pages/api/subscriptions/[id].ts` — `locals.user` → `parseSubscriptionId` → `createClient` → zapytanie z RLS → wynik redirectem; update z `.select("id")` i obsługą 0 wierszy jako „not found”.
- `src/components/ui/` ma tylko `button.tsx`; z Radix zainstalowany jest jedynie `@radix-ui/react-slot`.
- `scripts/smoke.mjs` — kroki `[name, run, expected]`, id wpisu wyciągane z linku Edit (`EDIT_LINK_PATTERN`), `foreignId = randomUUID()` dla ścieżek obcego id.

## Desired End State

- Wiersz aktywnej subskrypcji w „All subscriptions” ma przyciski „Cancel” i „Delete”; anulowanej — tylko „Delete” (i „Edit”). Każda akcja otwiera AlertDialog z potwierdzeniem; dopiero potwierdzenie wysyła natywny `<form method="POST">`.
- Anulowanie zapisuje `status = 'cancelled'` i zamraża `next_renewal_date` na dacie odnowienia wyliczonej w dniu anulowania (D). Od tej chwili D się nie zmienia.
- Anulowana z datą D liczy się do sumy i — gdy D mieści się w oknie [dziś, dziś+30] — do listy odnowień, dopóki `dziś ≤ D`; od D+1 znika z obu. W odnowieniach jest oznaczona jako „won't renew”, na liście jako „Cancelled · ends D” / „Cancelled · ended D”.
- Usunięcie trwale usuwa wiersz; znika ze wszystkich widoków.
- Błędy akcji na wpisach pokazują się w banerze na górze `/dashboard`, nie w formularzu dodawania.
- Stan pusty tylko przy zerze wpisów.

Weryfikacja: `npm test` (reguła FR-007 z granicami D), `npm run lint`, `npx astro check`, kroki smoke dla cancel/delete i obcego id, ręczny przegląd UI.

### Key Discoveries:

- Brak migracji — RLS i granty już obejmują update/delete (`supabase/migrations/20261002091205_create_subscriptions.sql:45-56`).
- Zamrożenie D w kolumnie `next_renewal_date` gubi kotwicę dnia (31.01 → 28.02), co jest bez znaczenia, bo anulowana nie jest przesuwana, a przywracania nie ma.
- `renewalDateToStore` (`src/lib/services/subscriptions.ts:51`) przy edycji anulowanej zachowuje się poprawnie: formularz pokazuje zapisaną D, a wysłana niezmieniona D zostaje zapisana z powrotem (gałąź „submitted”), więc edycja nazwy/ceny nie rusza daty końca.
- `formErrorLocation` (`src/lib/subscription-form.ts:27`) jest jedynym producentem `?error=` z doklejonymi polami formularza — to pozwala jednoznacznie odróżnić błąd formularza „Add” od błędu akcji na wpisie.

## What We're NOT Doing

- Przywracanie anulowanej subskrypcji (reactivate) — żaden FR tego nie wymaga; pomyłkę naprawia się usunięciem i ponownym dodaniem.
- Osobny widok/sekcja historii anulowanych — anulowane zostają w „All subscriptions”.
- Akcje cancel/delete na stronie edycji — wyłącznie wiersze listy na `/dashboard`.
- Kolumny `cancelled_at` / `ends_on`, migracje schematu, zmiany RLS i pgTAP.
- Zmiana statusu przez formularz edycji (endpoint edycji nadal nigdy nie zapisuje `status`).
- Miękkie usuwanie / kosz — usunięcie jest trwałe (FR-006: błędne wpisy).

## Implementation Approach

Najpierw reguła domenowa jako czyste funkcje z testami (ryzyko poprawności sumy z PRD), od razu podpięta do odczytu na `/dashboard` — da się ją sprawdzić ręcznie, ustawiając status w lokalnej bazie. Potem endpointy zapisujące stan (cancel z zamrożeniem D, delete) wraz z banerem błędów i smoke. Na końcu UI akcji (AlertDialog) i aktualizacja CLAUDE.md. Endpointy nie zależą od UI (smoke wysyła POST bezpośrednio), a UI zależy od endpointów.

## Critical Implementation Details

- **Semantyka `next_renewal_date` zależy od statusu.** Dla `active` to data bazowa z rolloverem przy odczycie; dla `cancelled` to zamrożona data końca D, **bez rolloveru**. Każde miejsce, które pokazuje lub liczy datę odnowienia (`upcomingRenewals`, lista „All subscriptions”, formularz edycji), musi przejść przez jeden helper, który rozróżnia status — nie wywołuj `nextRenewalDate` bezpośrednio na anulowanej.
- **Cancel jest idempotentny.** Endpoint najpierw czyta wiersz; jeśli już `cancelled`, redirect na `/dashboard` bez update (ponowne zamrożenie przesunęłoby D na kolejny cykl, gdy D < dziś). Update dodatkowo filtruje `.eq("status", "active")`, żeby równoległe dwa anulowania nie nadpisały D.

## Phase 1: Reguła FR-007 w serwisie i widoku

### Overview

Wprowadza regułę „anulowana liczy się do D włącznie” do sumy i odnowień, z testami jednostkowymi, oraz odczytową prezentację anulowanych na `/dashboard` (etykiety, poprawka stanu pustego).

### Changes Required:

#### 1. Reguła domenowa

**File**: `src/lib/services/subscriptions.ts`

**Intent**: Zastąpić `isActive()` regułą zależną od dnia: aktywna liczy się zawsze, anulowana — gdy `today ≤ next_renewal_date`. Dodać jeden helper daty „efektywnej” (rollover dla aktywnej, zamrożona D dla anulowanej) i helper wyliczający D przy anulowaniu. Suma i odnowienia używają nowej reguły.

**Contract**:
- `countsToward(sub: Subscription, today: string): boolean` — `active` → `true`; `cancelled` → `today <= sub.next_renewal_date` (granica D włącznie).
- `effectiveRenewalDate(sub: Subscription, today: string): string` — `active` → `nextRenewalDate(base, cycle, today)`; `cancelled` → `sub.next_renewal_date` bez zmian.
- `cancellationEndDate(stored: Pick<Subscription, "next_renewal_date" | "billing_cycle">, today: string): string` — `nextRenewalDate(stored.next_renewal_date, stored.billing_cycle, today)`; to wartość zapisywana przy anulowaniu.
- `monthlyCostByCurrency(subs: Subscription[], today: string): MonthlyCost[]` — **nowy parametr `today`**; filtr `countsToward`. Reszta (grosze, jedno zaokrąglenie, sortowanie) bez zmian.
- `upcomingRenewals(subs, today, days = 30)` — filtr `countsToward`, data z `effectiveRenewalDate`; okno i sortowanie bez zmian.
- Docstringi zaktualizowane (FR-007 wdrożone, koniec „active subscriptions only”).

#### 2. Testy jednostkowe

**File**: `src/lib/services/subscriptions.test.ts`

**Intent**: Przypiąć regułę FR-007 i jej granicę dnia D; dostosować istniejące testy do nowej sygnatury `monthlyCostByCurrency`.

**Contract**: Przypadki (dziś i D jako literały `YYYY-MM-DD`):
- `countsToward`: anulowana z D = `2026-11-01` → `true` dla dziś `2026-10-31` i `2026-11-01`, `false` dla `2026-11-02`; aktywna z przeszłą bazą → `true`.
- `monthlyCostByCurrency`: aktywna 30 PLN + anulowana 30 PLN z D ≥ dziś → 6000 gr; ta sama anulowana z D < dziś → 3000 gr; tylko anulowane z minioną D → `[]`.
- `upcomingRenewals`: anulowana z D = dziś → na liście z datą D; z D = dziś+30 → na liście; z D < dziś → poza; anulowana z przeszłą D nie jest przesuwana o cykl (nie pojawia się z datą D + cykl); anulowana roczna z D = dziś+120 → liczona w sumie, poza listą odnowień.
- `effectiveRenewalDate`: anulowana zwraca zapisaną datę nawet gdy jest w przeszłości; aktywna — rollover.
- `cancellationEndDate`: przeszła baza miesięczna `2026-01-31`, dziś `2026-10-02` → `2026-10-31`; przyszła baza → bez zmian; baza = dziś → dziś.
- Dotychczasowe testy „`cancelled` pominięte” zastąpione powyższymi (bez utraty pokrycia aktywnych).

#### 3. Prezentacja na `/dashboard`

**File**: `src/pages/dashboard.astro`

**Intent**: Przekazać `today` do `monthlyCostByCurrency`; oznaczyć anulowane w odnowieniach i w liście; pokazywać stan pusty tylko przy braku wpisów.

**Contract**:
- `isEmpty = subscriptions.length === 0`. Gdy wpisy są, ale `costs` puste — sekcja „Monthly cost” pokazuje komunikat (np. „No subscriptions count toward your monthly cost right now.”) zamiast kafelków.
- Odnowienia: wiersz anulowanej ma dopisek „won't renew” (np. w linii z datą: `{date} · Cancelled, won't renew`).
- „All subscriptions”: linia statusu dla anulowanej — `Cancelled · ends {D}` gdy `today ≤ D`, `Cancelled · ended {D}` gdy `today > D`; dla aktywnej bez zmian (`Next renewal: …` przez `effectiveRenewalDate`). Usunąć komentarz „FR-007 is S-03”.

#### 4. Strona edycji

**File**: `src/pages/subscriptions/[id]/edit.astro`

**Intent**: Pokazywaną datę wyliczać przez `effectiveRenewalDate` zamiast rozgałęzienia po statusie; zaktualizować komentarz (dla anulowanej pole daty to data końca).

**Contract**: `next_renewal_date: effectiveRenewalDate(subscription, todayInWarsaw(new Date()))`; brak zmian w endpointach edycji.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`

#### Manual Verification:

- Po ręcznym ustawieniu w lokalnej bazie `status = 'cancelled'` i `next_renewal_date` = dziś dla jednego wpisu, `/dashboard` liczy go w sumie i pokazuje w odnowieniach z „won't renew” oraz w liście jako „Cancelled · ends …”; po ustawieniu daty na wczoraj znika z sumy i odnowień, a w liście ma „Cancelled · ended …”.
- Konto z samymi anulowanymi po dacie końca widzi listę i komunikat w sekcji kosztu, a nie stan pusty.

**Implementation Note**: Po zakończeniu tej fazy i przejściu automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Endpointy cancel i delete

### Overview

Dodaje dwa endpointy POST zapisujące stan, baner błędów akcji na `/dashboard` i kroki smoke.

### Changes Required:

#### 1. Endpoint anulowania

**File**: `src/pages/api/subscriptions/[id]/cancel.ts` (nowy)

**Intent**: Oznaczyć własną aktywną subskrypcję jako anulowaną z zamrożoną datą końca; wynik redirectem jak w `[id].ts`.

**Contract**: `export const POST: APIRoute`. Kolejność: brak `locals.user` → `/auth/signin`; nieprawidłowe id (`parseSubscriptionId`) → `/dashboard?error=Subscription not found`; brak Supabase → `/dashboard?error=Supabase is not configured`; select `status, next_renewal_date, billing_cycle` z `.eq("id", id).maybeSingle()` (RLS: obce id = brak wiersza → not found; błąd select → `/dashboard?error=Could not cancel the subscription`); już `cancelled` → `/dashboard` bez update; update `{ status: "cancelled", next_renewal_date: cancellationEndDate(existing, todayInWarsaw(new Date())) }` z `.eq("id", id).eq("status", "active").select("id")`; błąd → `…?error=Could not cancel the subscription`; 0 wierszy → not found; sukces → `/dashboard`. Ciało żądania nie jest czytane. Nie przekazywać surowych komunikatów bazy.

#### 2. Endpoint usuwania

**File**: `src/pages/api/subscriptions/[id]/delete.ts` (nowy)

**Intent**: Trwale usunąć własny wpis (dowolny status).

**Contract**: `export const POST: APIRoute`. Te same kroki wstępne co cancel; `delete().eq("id", id).select("id")`; błąd → `/dashboard?error=Could not delete the subscription`; 0 wierszy (obce lub już usunięte) → `/dashboard?error=Subscription not found`; sukces → `/dashboard`. Middleware już chroni prefiks `/api/subscriptions` — bez zmian w `PROTECTED_ROUTES`. Wspólny helper `redirectToDashboardWithError` i stała `NOT_FOUND` mogą zostać wyniesione z `[id].ts` do małego modułu w `src/lib/` (np. `src/lib/api-redirects.ts`), jeśli trzy endpointy miałyby je powielać.

#### 3. Baner błędu na poziomie strony (follow-up F4)

**File**: `src/pages/dashboard.astro`

**Intent**: Błąd akcji na wpisie pokazać na górze strony, a nie w formularzu „Add subscription”.

**Contract**: Gdy `error` jest ustawione, a `formValuesFromSearchParams` zwraca pusty obiekt (brak przeniesionych pól — błąd nie pochodzi z `formErrorLocation`), renderuj baner (styl jak `loadError`, `role="alert"`) nad nagłówkiem i **nie** przekazuj `serverError` do formularza. W przeciwnym razie zachowanie jak dziś (błąd i wartości w formularzu). Dotyczy to też istniejącego „Subscription not found” z edycji.

#### 4. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć cancel, delete i obce id przeciw działającemu serwerowi; zaktualizować opis w nagłówku pliku.

**Contract**: Nowe kroki po „edit page of an unknown subscription is 404”, przed „home redirects signed-in user…”:
- „cancel subscription redirects to dashboard” — POST `/api/subscriptions/<id>/cancel` → 302 `/dashboard` (exact).
- „dashboard shows the cancelled subscription” — 200, body zawiera `Cancelled · ends` (D = data odnowienia z dnia anulowania ≥ dziś).
- „cancel of an unknown subscription is rejected” — POST z `foreignId` → 302 `/dashboard?error=`.
- „delete subscription redirects to dashboard” — POST `/api/subscriptions/<id>/delete` → 302 `/dashboard` (exact).
- „dashboard no longer lists the deleted subscription” — 200, body **nie** zawiera `renamedSubscriptionName` (nowe pole oczekiwania, np. `bodyExcludes`, obsłużone w pętli weryfikacji i w komunikacie FAIL).
- „delete of an unknown subscription is rejected” — POST z `foreignId` → 302 `/dashboard?error=`.
- Opcjonalnie po signout: „cancel redirects after signout” — POST cancel → 302 `/auth/signin`.

#### 5. Dokumentacja testów

**File**: `README.md`

**Intent**: Opis smoke wymienia anulowanie i usuwanie obok dodania i edycji.

**Contract**: Sekcja opisująca `npm run smoke` / job `smoke`.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Smoke przechodzi w CI (job `smoke`) lub lokalnie przeciw działającemu serwerowi: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- POST cancel na własny aktywny wpis z minioną datą bazową zapisuje w bazie `status = cancelled` i D = najbliższe odnowienie ≥ dziś; ponowny POST cancel nie zmienia D.
- POST cancel/delete na id innego konta (drugie konto) kończy się banerem „Subscription not found” na górze `/dashboard`, a wiersz drugiego konta jest nietknięty.
- Błąd walidacji formularza „Add” nadal pojawia się w formularzu z zachowanymi wartościami, nie w banerze.

**Implementation Note**: Po zakończeniu tej fazy i przejściu automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Akcje w UI z potwierdzeniem

### Overview

Dodaje shadcn AlertDialog i wyspę z przyciskami „Cancel”/„Delete” w wierszach „All subscriptions”; aktualizuje CLAUDE.md.

### Changes Required:

#### 1. Komponent AlertDialog

**File**: `src/components/ui/alert-dialog.tsx` (generowany)

**Intent**: Dodać komponent przez `npx shadcn@latest add alert-dialog` (styl `new-york`, zależność Radix dopisana przez CLI do `package.json`).

**Contract**: Komponent bez ręcznych zmian poza tym, czego wymaga lint/format; zależność w `package.json` i `package-lock.json`. Jeśli CLI doda zależność z nieaktualnymi podatnościami lub w stylu niezgodnym z ESLint, opisać to w PR zamiast obchodzić.

#### 2. Wyspa akcji wiersza

**File**: `src/components/subscriptions/SubscriptionActions.tsx` (nowy)

**Intent**: Przyciski „Cancel” (tylko dla aktywnej) i „Delete”; każdy otwiera AlertDialog z nazwą subskrypcji i skutkiem akcji; przycisk potwierdzenia jest `type="submit"` natywnego `<form method="POST" action="/api/subscriptions/<id>/cancel|delete">` — bez `fetch`, bez JSON.

**Contract**: Props `{ id: string; name: string; status: SubscriptionStatus }` (typy z `@/types`, bez importu modułów z zod). Treść dialogów: cancel — „It keeps counting toward your total and renewals until its next renewal date, then disappears from both. This can't be undone.”; delete — „This permanently removes the entry. This can't be undone.” Przycisk „Delete” w wariancie destrukcyjnym. Stan oczekiwania na przycisku potwierdzenia przez `useFormStatus` (jak `SubmitButton`) — formularz musi obejmować przycisk. Kolory dialogu dopasowane do ciemnego motywu dashboardu przez `cn()`; ikony z `lucide-react`. Dialog dostępny z klawiatury (zapewnia Radix).

#### 3. Podpięcie w liście

**File**: `src/pages/dashboard.astro`

**Intent**: W każdym wierszu „All subscriptions” obok linku „Edit” wyrenderować `SubscriptionActions` jako wyspę `client:load`.

**Contract**: Kontener akcji z `flex-wrap`, żeby wiersz mieścił się na telefonie; link „Edit” bez zmian (smoke wyciąga z niego id).

#### 4. CLAUDE.md

**File**: `CLAUDE.md`

**Intent**: Usunąć zapis o celowym odroczeniu FR-007 i opisać stan po S-03.

**Contract**: Twarda zasada FR-007: „Stan obecny” → serwis liczy aktywne oraz anulowane do zamrożonej daty końca włącznie; `next_renewal_date` anulowanej to data końca bez rolloveru. Sekcja „Czym jest ten projekt” — S-03 zaimplementowane (endpointy `/api/subscriptions/[id]/cancel|delete`, akcje w liście). Lista komponentów formularzy/wysp i endpointów w „Przepływ auth” — dopisać nowe pliki. Opis smoke — cancel/delete.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi w CI (job `smoke`)

#### Manual Verification:

- Na `/dashboard` kliknięcie „Cancel” przy aktywnym wpisie otwiera dialog; „Keep”/Escape zamyka bez zmian; potwierdzenie anuluje wpis, który zostaje w sumie i liście z etykietą „Cancelled · ends …” i traci przycisk „Cancel”.
- „Delete” z potwierdzeniem usuwa wpis ze wszystkich sekcji; anulowanie dialogu nic nie zmienia.
- Wiersz z przyciskami mieści się bez poziomego przewijania przy szerokości telefonu (~375 px).
- Pełny przepływ MVP z PRD (rejestracja → trzy subskrypcje → edycja → anulowanie → usunięcie) działa na produkcji po deployu.

**Implementation Note**: Po zakończeniu tej fazy i przejściu automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie.

---

## Testing Strategy

### Unit Tests:

- `src/lib/services/subscriptions.test.ts` — `countsToward` z granicą D (D−1, D, D+1), suma z anulowanymi przed/po D, odnowienia anulowanych bez rolloveru i z granicami okna, `effectiveRenewalDate`, `cancellationEndDate` (przeszła/przyszła/dzisiejsza baza, kotwica końca miesiąca).

### Integration Tests:

- `scripts/smoke.mjs` — cancel i delete własnego wpisu, obce id dla obu akcji, widoczność skutków na `/dashboard`.
- pgTAP bez zmian — izolacja update/delete między kontami już pokryta w `supabase/tests/subscriptions_rls.test.sql`.

### Manual Testing Steps:

1. Dodaj miesięczną subskrypcję z datą sprzed dwóch miesięcy, anuluj ją z UI; sprawdź w bazie, że D = najbliższe odnowienie ≥ dziś, a na `/dashboard` wpis jest w sumie i w odnowieniach z „won't renew”.
2. Ustaw w lokalnej bazie D na wczoraj; wpis znika z sumy i odnowień, w liście „Cancelled · ended …”.
3. Usuń wpis z potwierdzeniem; znika ze wszystkich sekcji.
4. Wyślij błędny formularz „Add” — błąd w formularzu; wywołaj delete na nieistniejące id — baner na górze.

## Performance Considerations

Brak — wszystkie reguły liczone w pamięci na wierszach z jednego istniejącego zapytania; po jednej wyspie na wiersz listy (skala osobistej listy subskrypcji).

## Migration Notes

Brak migracji schematu. Istniejące wiersze `cancelled` (nieosiągalne z UI przed S-03) zostaną zinterpretowane jako anulowane z datą końca = zapisana `next_renewal_date`. Wycofanie: revert commitów; dane anulowane po S-03 pozostają poprawnymi wierszami (`status = cancelled`).

## References

- Roadmapa: `context/foundation/roadmap.md` (S-03)
- PRD: `context/foundation/prd.md` (FR-006, FR-007, US-01, §Open Questions)
- Follow-upy z S-02: `context/archive/2026-10-19-subscription-list-and-edit/follow-ups/review-fixes.md`
- Wzorzec endpointu: `src/pages/api/subscriptions/[id].ts:14-72`
- Reguła odnowień: `src/lib/services/subscriptions.ts:28-106`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reguła FR-007 w serwisie i widoku

#### Automated

- [x] 1.1 Testy jednostkowe przechodzą: `npm test` — 0873f4d
- [x] 1.2 Lint przechodzi: `npm run lint` — 0873f4d
- [x] 1.3 Typy przechodzą: `npx astro check` — 0873f4d

#### Manual

- [ ] 1.4 Anulowana z D = dziś liczy się w sumie i odnowieniach („won't renew”, „Cancelled · ends …”); z D = wczoraj znika z obu („Cancelled · ended …”)
- [ ] 1.5 Konto z samymi anulowanymi po dacie końca widzi listę i komunikat w sekcji kosztu, a nie stan pusty

### Phase 2: Endpointy cancel i delete

#### Automated

- [x] 2.1 Testy jednostkowe przechodzą: `npm test` — 0df0711
- [x] 2.2 Lint przechodzi: `npm run lint` — 0df0711
- [x] 2.3 Typy przechodzą: `npx astro check` — 0df0711
- [ ] 2.4 Smoke przechodzi w CI (job `smoke`) lub lokalnie przeciw działającemu serwerowi

#### Manual

- [ ] 2.5 Cancel zamraża D = najbliższe odnowienie ≥ dziś; ponowny cancel nie zmienia D
- [ ] 2.6 Cancel/delete na id innego konta daje baner „Subscription not found”, wiersz drugiego konta nietknięty
- [ ] 2.7 Błąd walidacji formularza „Add” nadal w formularzu z zachowanymi wartościami, nie w banerze

### Phase 3: Akcje w UI z potwierdzeniem

#### Automated

- [x] 3.1 Testy jednostkowe przechodzą: `npm test`
- [x] 3.2 Lint przechodzi: `npm run lint`
- [x] 3.3 Typy przechodzą: `npx astro check`
- [x] 3.4 Build przechodzi: `npm run build`
- [ ] 3.5 Smoke przechodzi w CI (job `smoke`)

#### Manual

- [ ] 3.6 „Cancel” otwiera dialog; zamknięcie nic nie zmienia; potwierdzenie anuluje wpis, który zostaje z etykietą i traci przycisk „Cancel”
- [ ] 3.7 „Delete” z potwierdzeniem usuwa wpis ze wszystkich sekcji; anulowanie dialogu nic nie zmienia
- [ ] 3.8 Wiersz z przyciskami mieści się bez poziomego przewijania przy ~375 px
- [ ] 3.9 Pełny przepływ MVP z PRD działa na produkcji po deployu
