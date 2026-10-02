---
project: "Subtracker"
version: 1
status: draft
created: 2026-09-18
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-06
  after_hours_only: true
---

# Subtracker

## Vision & Problem Statement

Osoby prywatne z wieloma subskrypcjami płacą za usługi, o których zapomniały, i odkrywają to dopiero przy przeglądaniu wyciągu z karty pod koniec miesiąca. Informacja o cyklicznych opłatach jest rozproszona po wyciągach, mailach i pamięci; nie ma jednego miejsca, które ją zbiera. Dziś nikt tego nie robi systematycznie, więc kilkadziesiąt złotych miesięcznie ucieka na nieużywane subskrypcje.

Wgląd: różne cykle rozliczeniowe (roczne, kwartalne, miesięczne) zaciemniają realny koszt. Opłaty nie sumują się w głowie ani na wyciągu; dopiero sprowadzenie wszystkich do jednego kosztu miesięcznego pokazuje prawdę o wydatkach. Reguła domenowa działa per użytkownik na kilkunastu wpisach i nie zmienia się przy 100x docelowej skali.

## User & Persona

Główna persona: osoba prywatna opłacająca kilka do kilkunastu usług cyklicznych (np. Netflix, siłownia, hosting), bez kontroli nad ich sumą i terminami odnowień. Sięga po produkt, gdy chce wiedzieć, ile realnie wydaje miesięcznie i co niedługo się odnowi. Pierwszym takim użytkownikiem jest autor projektu.

```
Pain:        płacenie za subskrypcje, o których użytkownik zapomniał
Person:      osoba prywatna zarządzająca własnymi cyklicznymi opłatami
Moment:      przeglądanie wyciągu z karty pod koniec miesiąca
Cost today:  brak systematycznego śledzenia; kilkadziesiąt złotych miesięcznie
             na nieużywane subskrypcje
```

## Success Criteria

### Primary
- Użytkownik przechodzi cały przepływ MVP: rejestracja, dodanie trzech subskrypcji, edycja jednej, a na ekranie głównym widzi poprawny łączny koszt miesięczny i listę odnowień w ciągu 30 dni. Przepływ MVP (zablokowany):
  1. Użytkownik otwiera aplikację i rejestruje konto (e-mail + hasło), potem się loguje.
  2. Dodaje pierwszą subskrypcję: nazwa, cena, cykl rozliczeniowy, data następnego odnowienia.
  3. Dodaje jeszcze dwie.
  4. Edytuje jedną z wprowadzonych subskrypcji (np. poprawia cenę lub datę).
  5. Widzi na ekranie głównym łączny koszt miesięczny i listę „odnawia się w ciągu 30 dni”.

### Secondary
- Użytkownik rezygnuje z co najmniej jednej nieużywanej subskrypcji dzięki temu, co zobaczył w aplikacji.

### Guardrails
- Poprawność sumy miesięcznej: przeliczenie różnych cykli rozliczeniowych na koszt miesięczny nie może się mylić; błędna suma niszczy zaufanie do produktu.

## User Stories

### US-01: Użytkownik widzi realny miesięczny koszt i nadchodzące odnowienia

- **Given** zalogowany użytkownik z co najmniej trzema aktywnymi subskrypcjami o różnych cyklach
- **When** otwiera ekran główny
- **Then** widzi łączny koszt miesięczny przeliczony ze wszystkich cykli oraz listę subskrypcji odnawiających się w ciągu 30 dni

#### Acceptance Criteria
- Subskrypcja roczna liczy się jako 1/12 ceny miesięcznie, kwartalna jako 1/3.
- Subskrypcja anulowana liczy się do sumy i do listy odnowień do końca opłaconego okresu (daty następnego odnowienia), a po tej dacie znika z obu widoków (zgodnie z FR-007).
- Brak subskrypcji pokazuje czytelny stan pusty, nie zero bez wyjaśnienia.

## Functional Requirements

### Konto
- FR-001: Użytkownik może zarejestrować konto e-mailem i hasłem; wielu niezależnych użytkowników rejestruje własne konta. Priority: must-have
  > Socrates: Counter-argument considered: „dla jednego użytkownika konto to zbędny koszt”. Resolution: odrzucony; produkt ma obsługiwać wielu niezależnych użytkowników, FR doprecyzowany.
- FR-002: Użytkownik może zalogować się i wylogować. Priority: must-have
  > Socrates: Counter-argument considered: „częste logowanie zniechęca do comiesięcznego zaglądania”. Resolution: FR zostaje; długo utrzymywana sesja zapisana jako kandydat do Non-Functional Requirements.

### Subskrypcje
- FR-003: Użytkownik może dodać subskrypcję z nazwą, ceną, walutą, cyklem rozliczeniowym (miesięczny, kwartalny, roczny) i datą następnego odnowienia. Priority: must-have
  > Socrates: No counter-argument; stands as written.
- FR-004: Użytkownik może przeglądać listę własnych subskrypcji. Priority: must-have
  > Socrates: No counter-argument; stands as written.
- FR-005: Użytkownik może edytować subskrypcję. Priority: must-have
  > Socrates: No counter-argument; stands as written.
- FR-006: Użytkownik może usunąć subskrypcję. Priority: must-have
  > Socrates: Counter-argument considered: „usuwanie dubluje anulowanie”. Resolution: zostaje; usuwanie służy do błędnych wpisów, anulowanie do historii.
- FR-007: Użytkownik może oznaczyć subskrypcję jako anulowaną; anulowana zostaje w historii, liczy się do sumy i odnowień do końca opłaconego okresu (daty następnego odnowienia), a potem znika z sumy i listy odnowień. Priority: must-have
  > Socrates: Counter-argument considered: „anulowana wciąż kosztuje do końca opłaconego okresu; wykluczenie od razu zaniża koszt”. Resolution: FR zmodyfikowany; anulowana liczy się do końca okresu.

### Przegląd kosztów
- FR-008: Użytkownik może zobaczyć łączny uśredniony miesięczny koszt subskrypcji liczących się do sumy, podany osobno dla każdej waluty. Priority: must-have
  > Socrates: Counter-argument considered: „uśredniony koszt miesięczny nie odpowiada realnym obciążeniom w miesiącu odnowienia”. Resolution: zostaje; realne obciążenia bieżącego miesiąca wydzielone jako FR-010 nice-to-have.
- FR-009: Użytkownik może zobaczyć listę subskrypcji odnawiających się w ciągu 30 dni; po minięciu daty odnowienia aktywnej subskrypcji aplikacja automatycznie wylicza następną datę z cyklu. Priority: must-have
  > Socrates: Counter-argument considered: „bez przesuwania daty po odnowieniu lista kłamie”. Resolution: FR zmodyfikowany; aplikacja przesuwa datę o cykl bez działania użytkownika.
- FR-010: Użytkownik może zobaczyć faktyczne obciążenia bieżącego miesiąca (pełne kwoty subskrypcji odnawiających się w tym miesiącu). Priority: nice-to-have
  > Socrates: Wynik rundy dla FR-008; poza zakresem MVP.

## Non-Functional Requirements

- Prywatność: żaden użytkownik ani osoba niezalogowana nie widzi subskrypcji innego konta; właściwość binarna, brak wyjątków.

Uwaga: długo utrzymywana sesja (kandydat z rundy Sokratesa dla FR-002) nie została przyjęta jako NFR.

## Business Logic

Aplikacja sprowadza każdą subskrypcję, niezależnie od cyklu, do kosztu miesięcznego i na tej podstawie pokazuje realny miesięczny wydatek oraz to, co odnowi się w ciągu 30 dni.

Reguła korzysta z danych wpisanych przez użytkownika: ceny, waluty, cyklu rozliczeniowego (miesięczny, kwartalny, roczny), daty następnego odnowienia i statusu (aktywna lub anulowana). Cena roczna liczy się jako 1/12 na miesiąc, kwartalna jako 1/3, miesięczna w całości.

Wynikiem jest uśredniony koszt miesięczny podany osobno dla każdej waluty (bez przeliczania kursów) oraz lista subskrypcji odnawiających się w ciągu 30 dni. Po minięciu daty odnowienia aktywnej subskrypcji następna data jest wyliczana z cyklu bez działania użytkownika. Subskrypcja anulowana liczy się do sumy i odnowień do końca opłaconego okresu, a potem znika z obu widoków. Użytkownik spotyka regułę na ekranie głównym zaraz po zalogowaniu.

## Access Control

Logowanie kontem: e-mail + hasło. Płaski model użytkowników, jedna rola. Każdy zalogowany użytkownik widzi i modyfikuje wyłącznie własne subskrypcje. Brak ról administracyjnych i brak współdzielenia danych między kontami. Użytkownik niezalogowany nie ma dostępu do żadnych danych o subskrypcjach.

## Non-Goals

- Brak współdzielenia i ról: każde konto jest odrębne; żadnych gospodarstw domowych, zaprosień ani administratorów. Utrzymuje płaski model dostępu.
- Brak trybu offline: wymagane połączenie z siecią; MVP nie gwarantuje pracy bez dostępu (non-goal niefunkcjonalny).
- Brak katalogu usług i cen: użytkownik wpisuje nazwę i cenę sam; aplikacja nie zna dostawców ani ich cenników.

Nie wykluczone, ale poza zakresem MVP (żaden FR ich nie obejmuje; decyzje o ręcznym wpisywaniu i osobnej sumie na walutę stoją): import z banku lub maila, przeliczanie walut po kursach, powiadomienia (e-mail, push), historia zmian cen.

## Open Questions

Brak otwartych pytań na dzień 2026-09-18.

Rozstrzygnięte (dla śledzenia):
- Sumowanie subskrypcji w różnych walutach: osobna suma dla każdej waluty, bez przeliczania kursów.
- Konflikt kryterium US-01 z FR-007: rozstrzygnięty na rzecz FR-007; anulowana subskrypcja liczy się do końca opłaconego okresu. Kryterium US-01 dostosowane.
