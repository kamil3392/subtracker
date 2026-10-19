# Notatki z kursu 10xDevs (materiał lekcji)

Treść dostarczana przez `@przeprogramowani/10x-cli` (blok `BEGIN/END @przeprogramowani/10x-cli`), wyprowadzona z `CLAUDE.md` 2026-09-21 po `/10x-rule-review`. To materiał dydaktyczny dla człowieka, nie zasady dla agenta. Kolejne lekcje pobieraj z `--no-course-rules` i dopisuj tutaj ręcznie (`10x get <ref> --print --type rules`).

---

## Zestaw narzędzi AI 10xDevs — Moduł 1, Lekcja 4

Wdróż agenta do projektu, który utworzyłeś w Lekcji 3, za pomocą **łańcucha kontekstu agenta**:

```
(/10x-init  →  /10x-shape  →  /10x-prd  →  /10x-tech-stack-selector  →  /10x-bootstrapper)  →  /10x-agents-md  →  /10x-rule-review  →  /10x-lesson
```

Łańcuch PRD → tech-stack → bootstrap pochodzi z Lekcji 1–3 (został ponownie uwzględniony, aby można było naprawić projekt w trakcie pracy). `/10x-agents-md`, `/10x-rule-review` i `/10x-lesson` to główne tematy lekcji. Łańcuch zostaje rozszerzony w Lekcji 5 o krok infra/deploy.

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Kontekst agenta (temat lekcji)** | |
| `/10x-agents-md` | Repozytorium jest utworzone, ale agent nie ma wdrożenia specyficznego dla projektu. Analizuje repozytorium (manifest pakietu, README, skrypty, konfigurację lint/test, układ, historię commitów) i zapisuje zwięzłe, uporządkowane „Wytyczne repozytorium” w `AGENTS.md` (lub, gdy jest wywoływane z podkatalogu, `AGENTS.md` na poziomie katalogu, przeformułowane wokół lokalnych konwencji i dominującej jednostki). Użyj jako alternatywy dla wbudowanego `/init` hosta lub jako rozwiązania awaryjnego dla narzędzi, które go nie mają. Treść na poziomie repozytorium ma docelowo ~200 wierszy; przewodniki na poziomie katalogu mają docelowo 120–250 słów. |
| `/10x-rule-review <path>` | Masz plik zasad dla AI (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, zagnieżdżone pliki dla poszczególnych obszarów) i chcesz otrzymać kartę wyników w 5 osiach: długość, osadzone fragmenty kodu/konfiguracji, precyzja języka, redundancja względem wiedzy publicznej oraz kolejność zasad. Niezależne od narzędzia — ocenia stan artefaktu, a nie projektu. Domyślne wyjście jest tylko do odczytu; tylko Kontrola 5 (zmiana kolejności) może edytować, i wyłącznie po wyraźnej akceptacji. |
| `/10x-lesson [seed]` | Zauważyłeś powtarzającą się zasadę, którą warto ujawnić na potrzeby przyszłych uruchomień `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement` i `/10x-impl-review`. Dodaje pojedynczy wpis (Kontekst / Problem / Zasada / Dotyczy) do `context/foundation/lessons.md`. Przy pierwszym użyciu samodzielnie inicjalizuje plik z kanonicznym nagłówkiem `# Lessons Learned`. Tylko dopisywanie — nigdy nie zmienia kolejności ani nie przepisuje wcześniejszych wpisów. |
| **W razie potrzeby uruchom ponownie wcześniejszy etap** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-stack-assess` / `/10x-health-check` | Dołączone, aby można było poprawić PRD, zmienić stos technologiczny lub ponownie utworzyć szkielet w trakcie pracy. Jeśli `/10x-rule-review` zgłosi `FAIL`, którego nie da się rozwiązać przez skrócenie, często wskazuje to na niejednoznaczne decyzje dotyczące PRD lub stosu — uruchom ponownie wcześniejszą umiejętność zamiast wypełniać `AGENTS.md` poprawkami. |

### Jak łańcuch przekazuje pracę dalej

- `/10x-agents-md` zapisuje (lub punktowo aktualizuje) `AGENTS.md` w określonym zakresie. Zakres na poziomie repozytorium = plik znajduje się w korzeniu repozytorium i opisuje cały projekt; zakres na poziomie katalogu = plik znajduje się obok kodu, którym zarządza, i jest przeformułowany wokół lokalnej jednostki, całkowicie pomijając perspektywę całego repozytorium. Umiejętność nigdy nie nadpisuje po cichu — gdy cel istnieje, przełącza się na przepływ aktualizacji.
- `/10x-rule-review` odczytuje dowolny wskazany plik markdown z zasadami dla AI i wyświetla kartę wyników z 5 kontrolami (`OK` / `WARN` / `FAIL`) wraz z konkretnymi poprawkami. Nie zależy od wcześniejszego uruchomienia `/10x-agents-md`; w ten sam sposób możesz sprawdzić `.cursor/rules/`, instrukcje Copilot lub ręcznie napisany `CLAUDE.md`.
- `/10x-lesson` przy pierwszym użyciu samodzielnie inicjalizuje `context/foundation/lessons.md`, a następnie przy każdym wywołaniu dopisuje jeden wpis Kontekst/Problem/Zasada/Dotyczy. Plik jest wykorzystywany jako wcześniejszy kontekst przez umiejętności fazy planowania i przeglądu wprowadzone później w procesie — `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`.

### Co wychwytują umiejętności lekcji (a czego NIE robią)

- **`/10x-agents-md` wychwytuje**: strukturę projektu, polecenia build/test/lint faktycznie obecne w skryptach, konwencje commitów wywnioskowane z historii, pułapki specyficzne dla repozytorium, które agent mógłby przeoczyć, odwołania do kanonicznych plików przez ścieżki `@` zamiast wklejania ich treści. Zakres na poziomie katalogu dodatkowo wychwytuje: lokalne wzorce nazewnictwa/układu wywnioskowane z sąsiednich elementów, dozwolone/zabronione importy, wzorzec testów używany przez sąsiednie moduły oraz pułapki widoczne w bezpośrednim otoczeniu.
- **`/10x-agents-md` NIE** wkleja zawartości `tsconfig.json` / `eslint.config` / dokumentacji frameworka, którą agent już zna; **NIE** generuje ogólnych intencji typu „pisz czysty kod”; **NIE** zastępuje wbudowanego `/init` hosta, gdy taki istnieje — jest pozycjonowany jako alternatywa lub rozwiązanie awaryjne, a nie domyślna opcja.
- **`/10x-rule-review` wychwytuje**: werdykt długości (OK ≤ 200 niepustych wierszy, WARN 201–500, FAIL 501+), bloki kodu/konfiguracji, które powinny być odwołaniami `@`, niejasny język intencji, redundancję względem dokumentacji frameworka, którą agent zna już z treningu, oraz propozycję zmiany kolejności w Kontroli 5, która przenosi krytyczne zasady na górę.
- **`/10x-rule-review` NIE** edytuje pliku domyślnie; **NIE** ocenia zawartości projektu (architektury, wyborów stosu) — ocenia stan artefaktu zasad; **NIE** generuje „poprawionej wersji” pliku (Kontrola 5 może przenosić sekcje po wyraźnej akceptacji, ale nigdy nie przepisuje brzmienia zasad).
- **`/10x-lesson` wychwytuje**: jeden wpis na wywołanie z krótkim tytułem H2 w trybie rozkazującym (tytuł JEST zasadą), Kontekst (podsystem / faza / wzorzec plików, wystarczająco konkretny do dopasowywania wzorców), Problem (co konkretnie psuje się bez zasady, najlepiej wraz z wcześniejszym incydentem), Zasada (1–2 zdania w trybie rozkazującym, które można dosłownie wkleić do przyszłego ustalenia przeglądu), Dotyczy (podzbiór `frame`, `research`, `plan`, `plan-review`, `implement`, `impl-review` lub `all`).
- **`/10x-lesson` NIE** edytuje ani nie usuwa istniejących lekcji — plik z założenia pozwala wyłącznie na dopisywanie (bezrefleksyjne przepisywanie powtarzających się zasad jest trybem awarii, któremu ta konwencja zapobiega); **NIE** grupuje wielu zasad w jednym wywołaniu; **NIE** wypełnia pól proaktywnie (użytkownik pisze treść — to cena wychwytywania zasad poza ustrukturyzowanym przeglądem).

### Test włączenia (filtr dla AGENTS.md / CLAUDE.md)

Przed dodaniem zasady do dowolnego pliku zasad dla AI zapytaj: *czy agent mógłby wiedzieć to bez tego pliku? Czy publiczne dane treningowe — książki, blogi, repozytoria w tym stosie — mogły go do tego przygotować?* Jeśli tak, pomiń ją. Jeśli nie, zachowaj ją. Plik służy do wdrożenia agenta, który już zna TypeScript / Python / twój framework, ale NIE zna twoich lokalnych konwencji.

Należy:
- nieoczywiste konwencje projektu (kształt odpowiedzi błędów, nazewnictwo plików, dozwolone ścieżki importu)
- pułapki specyficzne dla projektu i „żenujące” obejścia związane z historią lub błędami zależności
- odwołania do kanonicznych plików przez ścieżki `@` (np. `@src/features/users/user.service.ts` jako odwołanie do wzorca, a nie wklejony kod)

NIE należy:
- dokumentacja popularnych frameworków
- zawartość README, którą agent i tak przeczyta (połącz przez `@README.md`)
- popularne ogólne porady („używaj trybu TypeScript strict”), które są już wymuszane przez konfigurację
- deklaracje intencji („pisz czysty kod”, „stosuj dobre praktyki”) — przekształć w sprawdzalne zachowanie lub pomiń

### U-kształtna uwaga i szczegółowe zasady

LLM-y najsilniej skupiają uwagę na początku i końcu kontekstu (Lost-in-the-Middle / U-shaped attention). Długi monolityczny `CLAUDE.md` umieszcza zasady ze środka w najsłabszej strefie uwagi. Dwie praktyczne konsekwencje:

1. **Najważniejsze zasady trafiają na górę** każdego pliku zasad.
2. **Zasady dla poszczególnych obszarów powinny znajdować się obok ich kodu** — zagnieżdżone `AGENTS.md` / `CLAUDE.md` wewnątrz `src/api/`, `.cursor/rules/*.mdc` z globami plików itd. Szczegółowe pliki są ładowane selektywnie i pojawiają się w całości blisko początku własnej sekcji, zamiast być zakopane w wierszu 400 jednego dużego pliku.

Kontrola 5 (zmiana kolejności) w `/10x-rule-review` operacjonalizuje konsekwencję (1); test włączenia wraz z `/10x-agents-md` na poziomie katalogu operacjonalizuje konsekwencję (2).

### Ćwiczenie kalibracyjne z pięcioma wzorcami

Przed zapisaniem zasady potwierdź, że agent faktycznie łamie konwencję bez niej. Wybierz jeden wzorzec z projektu (kształt odpowiedzi błędów, nazewnictwo plików, styl importów, struktura modułu, obsługa dat). Następnie:

1. Poproś agenta o zaimplementowanie zgodnie ze wzorcem 3–5 razy ze stanu czystego, bez zasady.
2. Zanotuj, gdzie złamał konwencję; uchwyć czas wykonania, przeanalizowane pliki oraz widoczny koszt/tokeny, jeśli host je pokazuje.
3. Dodaj zasadę składającą się z 1–3 zdań do odpowiedniego zakresu (głównego lub na poziomie obszaru).
4. Uruchom ponownie to samo zadanie w świeżej sesji i porównaj przestrzeganie konwencji, czas, pliki i liczbę iteracji.

Jeśli agent już bez zasady ma tendencję do stosowania konwencji, nie potrzebujesz tej zasady. Jeśli systematycznie wybiera niewłaściwy wzorzec, znalazłeś zasadę o dużej dźwigni, którą warto dodać. To ćwiczenie pokazuje, jak w praktyce wygląda „zasłużenie na zasadę przez powtarzającą się porażkę”.

### Hierarchia i interoperacyjność narzędzi

- **Claude Code** ładuje `CLAUDE.md` z katalogu użytkownika (`~/.claude/CLAUDE.md`), korzenia repozytorium oraz każdego podkatalogu, w którym pracuje agent. Głębsze pliki zastępują lub uzupełniają pliki znajdujące się wyżej.
- **Codex** i **GitHub Copilot** ładują `AGENTS.md` od bieżącego katalogu w górę — wygrywa najbliższy plik.
- Jeden kanoniczny plik jest lepszy niż trzy duplikaty. Typowy wzorzec: `AGENTS.md` jako źródło prawdy, `CLAUDE.md` jako cienka nakładka Claude Code z importem `@AGENTS.md`, `.github/copilot-instructions.md` tylko wtedy, gdy Copilot potrzebuje własnych dodatków. Dowiązanie symboliczne (`ln -s AGENTS.md CLAUDE.md`) jest najprostszą deduplikacją, gdy narzędzia wymagają obu nazw.
- Automatyczna pamięć (np. `~/.claude/projects/<dir-with-slashes-as-dashes>/memory/MEMORY.md` Claude Code) jest lokalna dla maszyny i nie zastępuje `AGENTS.md`. Zasady wiążące zespół znajdują się w repozytorium; automatyczna pamięć jest osobistym cache'em, który można okresowo przeglądać.

### Hooki wewnętrznej pętli (deterministyczne sprzężenie zwrotne bez promptowania)

Mechaniczne, nieopcjonalne kontrole powinny znajdować się w hookach (np. `PostToolUse` Claude Code), a nie w pliku zasad. Agent kończy edycję; uruchamia się formatter lub szybki lint; wynik wraca bez konieczności przypominania mu o tym. Szablon ustawień (`settings.json.template`) jest dostarczany w pakiecie lekcji jako punkt wejścia do konfiguracji. Przepływy proceduralne (głębszy przegląd, lista kontrolna wydania, wdrożenie w sandboxie) trzymaj w umiejętnościach, a hooki rezerwuj dla deterministycznych sygnałów narzędzi.

### Ścieżki fundamentu używane przez tę lekcję

- `AGENTS.md` / `CLAUDE.md` (oraz warianty dla poszczególnych obszarów) — wynik `/10x-agents-md`
- `context/foundation/lessons.md` — wynik `/10x-lesson` (rejestr tylko do dopisywania, używany przez przyszłe umiejętności planowania/przeglądu)
- `context/foundation/prd.md`, `context/foundation/tech-stack.md` — dane wejściowe z wcześniejszych lekcji, nadal obecne
- `docs/reference/contract-surfaces.md` — rejestr nazw mających kluczowe znaczenie (utworzony przez `/10x-init`)

### Uniwersalny język

Dostarczone umiejętności nie zawierają odniesień do 10xDevs / kohorty / certyfikacji. `/10x-agents-md` odkrywa informacje na podstawie repozytorium, w którym jest wywoływane; `/10x-rule-review` jest niezależne od narzędzia i traktuje każdy plik jako „artefakt zasad dla AI”; `/10x-lesson` zapisuje wpis o jednym kształcie niezależnie od dziedziny projektu. Ćwiczenie kalibracyjne z pięcioma wzorcami ma charakter ilustracyjny — zastąp wzorce wzorcami z własnego stosu.

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: „This change is archived. Open a new change with `/10x-new` instead.”

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

## Zestaw narzędzi AI 10xDevs — Moduł 2, Lekcja 5 (interfejs 10xDevs 4.0)

**W przypadku pracy nad interfejsem widoku, który już się renderuje, zacznij od `/10x-ui <view>`.** To
punkt wejścia: krótki audyt wstępny, sugerowany identyfikator zmiany oraz polecenie `/10x-new` do
uruchomienia, a następnie opis audytu dla `/10x-research`. Zmiana wizualna przechodzi przez ten sam łańcuch
co każda inna zmiana (`/10x-new` → `/10x-research` → `/10x-plan` → `/10x-implement` →
`/10x-impl-review`); `/10x-ui <change-id>` wznawia pracę od pierwszego kroku, który nie został jeszcze wykonany. Przenosi
zasady:
kiedy rozpocząć i który widok wybrać, audyt do opłat, kontrakt systemu projektowego w formie,
w jakiej realizuje go to repozytorium, stany komponentów, bramkę zrzutu ekranu oraz zasadę, która
utrzymuje następnego agenta przy kontrakcie. Jego `references/` zawiera listę kontrolną jakości.

Tworzenie widoku po raz pierwszy nie jest zadaniem dla `/10x-ui` — utwórz go za pomocą
zwykłego łańcucha, a następnie wróć do niego z `/10x-ui`.
