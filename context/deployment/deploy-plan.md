---
project: Subtracker
platform: cloudflare-workers
worker_name: subtracker
account_id: 3e6c96199bd2a36317a753cc7e5f1aca
production_url: https://subtracker.kamil-kapturski.workers.dev
first_deploy_at: 2026-09-21T11:21:18Z
version_id: 0f589141-ed1e-4867-9933-ca29579ee24c
code_version_id: 7d7466cb-ac88-459c-8983-c9f6d368302b
secrets_wired: [SUPABASE_URL, SUPABASE_KEY]
ci_deploy: active (github.com/kamil3392/subtracker, push to master)
ci_first_deploy_version: 0f589141-ed1e-4867-9933-ca29579ee24c
plan_approved_at: 2026-09-21
status: deployed
verified_at: 2026-10-02
source_contracts:
  - context/foundation/infrastructure.md
  - context/foundation/tech-stack.md
---

# Deploy plan: pierwsze wdrożenie Subtrackera na Cloudflare Workers

Zatwierdzony w Plan Mode 2026-09-21. Ten plik jest ścieżką audytową „co miało się wydarzyć” i źródłem prawdy „co jest wdrożone i jakie sekrety są podłączone” dla planowania kamieni milowych. Sekcja **Status wykonania** jest aktualizowana po każdym kroku.

## 1. Kontekst i decyzje

`infrastructure.md` rekomenduje Cloudflare Workers (Worker + static assets, `wrangler deploy`), **nie** Cloudflare Pages: adapter `@astrojs/cloudflare` 14 nie wspiera Pages, a `wrangler pages deploy` to inny produkt bez rollbacku.

Decyzje użytkownika (2026-09-21):

| Pytanie | Decyzja |
|---|---|
| Hostowany projekt Supabase | istnieje; wartości sekretów podaje użytkownik interaktywnie (`wrangler secret put`) |
| Deploy z CI | ręczny deploy teraz **oraz** job `deploy` dopisany do `ci.yml` od razu; aktywny dopiero po `git init` i pushu do GitHub |
| Nazwa Workera | pierwotnie `10x-astro-starter`; **zmieniona na `subtracker`** 2026-09-21 13:20 po tym, jak kreator subdomeny w panelu utworzył placeholder `subtracker` (patrz §5, krok 5a). Adres: `https://subtracker.kamil-kapturski.workers.dev` |
| Weryfikacja | ręczny click-through + `wrangler tail`; potwierdzanie e-mail w Supabase **włączone**; `npm run smoke` nie jest uruchamiany przeciw produkcji |

## 2. Stan zweryfikowany przed wykonaniem

| Element | Stan (2026-09-21) |
|---|---|
| wrangler | zalogowany OAuth na konto `3e6c96199bd2a36317a753cc7e5f1aca`; wrangler 4.135.0 (infrastructure.md: 4.131.1 — drift bez znaczenia) |
| Workery | ani `10x-astro-starter`, ani `subtracker` nie istniały (API code 10007) — pierwszy deploy, brak wersji do rollbacku |
| Node | `.nvmrc` = 22.14.0 nie jest zainstalowany w nvm; użyto 22.22.3 (CI używa `node-version: 22`, więc jest wierne CI) |
| Astro / adapter | Astro 7.3.2, `@astrojs/cloudflare` 14.3.1, `@cloudflare/vite-plugin` 1.54.8; `session: false` potwierdzone w kodzie adaptera jako wyłączenie bindingu KV `SESSION` |
| Sekrety lokalne | `.env`/`.dev.vars` brak; build ich nie potrzebuje (`astro:env` `access: "secret"` = runtime) |
| git / gh | brak `.git/`, brak `gh` — job CI nie może być dziś uruchomiony ani zweryfikowany |
| Supabase | lokalny `config.toml` (`site_url` 127.0.0.1:3000) dotyczy tylko lokalnego stacka; hostowany projekt ma własne Site URL / Redirect URLs |
| Auth | `signUp({ email, password })` bez `emailRedirectTo` → link potwierdzający kieruje na Site URL hostowanego projektu |

## 3. Ocena „Getting Started” z infrastructure.md — uzupełnione braki

1. **Konfiguracja URL w hostowanym Supabase** (Site URL + Redirect URLs = adres workers.dev) — brakowała; dodana jako bramka ręczna C.
2. **`preview_urls: false`** było tylko w rejestrze ryzyk — dodane do `wrangler.jsonc` przed pierwszym deployem.
3. **Bramka jakości przed deployem** (`astro sync`, `lint`, `astro check`) i inspekcja wygenerowanej konfiguracji — dodane.
4. **Rollback deployu nr 1 nie istnieje** — fallback to fix-forward lub `wrangler delete` (human-only).
5. **Node z `.nvmrc` niedostępny** — użyto 22.22.3; aktualizacja `.nvmrc`/CLAUDE.md poza zakresem, odnotowana jako rozbieżność.
6. **Pierwszy `wrangler deploy` wymaga subdomeny `workers.dev`** — bez niej wrangler próbuje zarejestrować subdomenę o nazwie Workera; jeśli nazwa jest zajęta, deploy kończy się błędem **przed** uploadem. Rejestracja subdomeny to krok wyłącznie w panelu (`https://dash.cloudflare.com/<account>/workers/onboarding`). **Potwierdzone w praktyce 2026-09-21 12:44** — patrz Status wykonania.
7. **Kolejność sekretów** — `wrangler secret put` wymaga istniejącego Workera; między deployem a ustawieniem sekretów aplikacja pokazuje Banner „Supabase nie jest skonfigurowany” (stan obsługiwany).
8. **Wbudowany SMTP Supabase** ma limit kilku e-maili/h — wystarcza do ręcznej weryfikacji, utrudnia powtórki.
9. **Job `deploy` w CI** doprecyzowany: build w tym samym jobie, `needs: [ci, smoke]`, tylko `push` na `master`, `concurrency: deploy-production`, sekrety `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
10. **`tech-stack.md`** miało `deployment_target: cloudflare-pages` — poprawione na `cloudflare-workers`.
11. **Ścieżka wygenerowanej konfiguracji**: infrastructure.md mówi `dist/wrangler.json`; adapter 14.3.1 pisze `dist/server/wrangler.json` (layout `dist/client` + `dist/server`), a `.wrangler/deploy/config.json` wskazuje `../../dist/server/wrangler.json`. Polecenie `npx wrangler deploy` z katalogu repo działa bez zmian.
12. **Auto-binding `IMAGES`** (Cloudflare Images) jest dodawany przez adapter obok `ASSETS`; nie wymaga provisioningu ani id zasobu, aplikacja go nie używa. Można go wyłączyć `imageService: "compile"` w opcjach adaptera, jeśli kiedyś zacznie przeszkadzać.

## 4. Zmiany w repozytorium (wykonane)

| Plik | Zmiana |
|---|---|
| `astro.config.mjs` | `session: false` — usuwa auto-binding KV `SESSION` i beta auto-provisioning |
| `wrangler.jsonc` | `"preview_urls": false`; `name` zmienione z `10x-astro-starter` na `subtracker` (13:20, po utworzeniu placeholdera w panelu) |
| `.github/workflows/ci.yml` | nowy job `deploy` (patrz §3 pkt 9); `npx wrangler deploy` z pinowanym wranglerem z `package.json` |
| `context/foundation/tech-stack.md` | `deployment_target: cloudflare-workers` |
| `README.md` | sekcja Deployment: jedno polecenie `npm run build && npx wrangler deploy`, zakaz `wrangler pages deploy`, kolejność sekretów |
| `context/deployment/deploy-plan.md` | ten plik |

## 5. Kroki i status wykonania

Środowisko: `. ~/.nvm/nvm.sh && nvm use 22` (22.22.3), katalog repo, bez `--config`.

| # | Krok | Kto | Polecenie | Status |
|---|---|---|---|---|
| 1 | Edycje plików z §4 | agent | Edit | ✅ 2026-09-21 12:42 |
| 2 | Bramka jakości | agent | `npx astro sync && npm run lint && npx astro check && npm run build` | ✅ 12:43 — lint 0 błędów, check 0/0/0 (29 plików), build OK (ostrzeżenie: sitemap pominięta, brak `site`) |
| 3 | Inspekcja artefaktu | agent | `cat .wrangler/deploy/config.json`, `cat dist/server/wrangler.json` | ✅ `name` = `10x-astro-starter`, `nodejs_compat`, `kv_namespaces: []`, `preview_urls: false`, bindings: `ASSETS`, `IMAGES`, observability on. Wykonane przed zmianą nazwy; po zmianie `name` na `subtracker` inspekcja zostaje powtórzona po buildzie z kroku 5b. |
| 4 | **Bramka ręczna A** — Supabase gotowy (URL + anon key pod ręką) | człowiek | — | ⏳ potwierdzone słownie („projekt istnieje”) |
| 5 | Pierwszy deploy | agent (za zgodą z planu) | `npx wrangler deploy` | ❌ 12:44 — `You need to register a workers.dev subdomain`; auto-rejestracja `10x-astro-starter` niemożliwa (nazwa zajęta). **Nic nie zostało wgrane** (Worker nadal nie istnieje). |
| 5a | **Bramka ręczna A'** — rejestracja subdomeny `workers.dev` | człowiek | panel: `https://dash.cloudflare.com/3e6c96199bd2a36317a753cc7e5f1aca/workers/onboarding` | ✅ 13:15 — subdomena `kamil-kapturski.workers.dev`. Kreator utworzył przy tym placeholder Worker `subtracker` (wersja `01d79bdb…`, źródło Upload, odpowiada `error code: 1042`) — nie jest to nasza aplikacja. Decyzja: wdrażamy pod nazwą `subtracker`, deploy nadpisze placeholder. |
| 5b | Powtórka deployu | **człowiek** (klasyfikator auto-mode blokuje deploy agentowi) | `nvm use 22 && npm run build && npx wrangler deploy` | ✅ 13:21 — URL `https://subtracker.kamil-kapturski.workers.dev`, Version ID `7d7466cb-ac88-459c-8983-c9f6d368302b` (100% ruchu). Inspekcja po buildzie: `name: subtracker`, `preview_urls: false`, `kv_namespaces: []`, `nodejs_compat`, compat 2026-05-08. Wcześniejsze wersje `2ff8d00a…` i `01d79bdb…` (11:15Z) to placeholder z kreatora. |
| 6 | **Bramka ręczna B** — sekrety | człowiek | `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY` (interaktywnie) | ✅ 13:35 — `secret list` pokazuje obie nazwy. Użyty klucz **publishable** (`sb_publishable_…`, nowy odpowiednik `anon`) pod nazwą `SUPABASE_KEY`. Pierwsza próba ustawiła tylko `SUPABASE_KEY`; brak `SUPABASE_URL` wykryła runda 2 (Banner + „Supabase is not configured”), uzupełniony bez redeployu. |
| 7 | **Bramka ręczna C** — URL w Supabase | człowiek | Authentication → URL Configuration: Site URL = adres workers.dev; dodać go do Redirect URLs; Confirm email zostaje włączone | ✅ zgłoszone przez użytkownika („gotowe”, 2026-10-02); agent nie ma wglądu w panel Supabase, pośrednie potwierdzenie: link potwierdzający w kroku 9 otworzył workers.dev |
| 8 | Weryfikacja automatyczna | agent | patrz §6 | ✅ 13:36 — runda 2 zielona (tabela w §6) |
| 9 | Weryfikacja ręczna | człowiek | click-through przy `wrangler tail` | ✅ zgłoszone przez użytkownika („gotowe”, 2026-10-02), bez zgłoszonych błędów. Zapis `wrangler tail --status error` **nie zachował się** — sesja agenta zakończyła się przed odczytem, pliki scratch zostały wyczyszczone. Historyczne logi: Workers Logs w panelu (observability włączone). |
| 10 | Aktualizacja tego pliku (URL, Version ID, sekrety) | agent | — | ✅ 2026-10-02 |
| 11 | CI deploy end-to-end (push → ci → smoke → deploy) | człowiek (push, sekrety GitHub) + CI | `git push -u origin master` | ✅ 2026-10-02 08:17Z — wersja `0f589141…`, weryfikacja curl po deployu zielona |

## 5a. Runbook kroków ręcznych (instrukcje do wykonania)

Uwaga operacyjna: klasyfikator trybu auto w Claude Code odrzuca `wrangler deploy` (i build sprzężony z deployem) jako „Production Deploy”. Kroki 5b–7 wykonuje więc człowiek. Polecenia z prefiksem `!` można wpisać w sesji Claude Code — ich wynik trafia do rozmowy. Polecenia z sekretami uruchamiaj w **osobnym, zwykłym terminalu**, żeby wartości nie trafiły do rozmowy ani do logów.

Wymagania wstępne w każdym terminalu: `cd ~/10xdevs/10xdevs && nvm use 22` (Node 22.22.3; `nvm use` z `.nvmrc` pada, bo 22.14.0 nie jest zainstalowany).

### Krok 5a — rejestracja subdomeny `workers.dev` (panel, jednorazowo)

1. Otwórz `https://dash.cloudflare.com/3e6c96199bd2a36317a753cc7e5f1aca/workers/onboarding` (albo Workers & Pages → Overview → „Set up a subdomain”).
2. Wpisz dowolną wolną nazwę (np. własny nick). Nazwa staje się częścią adresu każdego Workera na koncie: `https://<worker>.<subdomena>.workers.dev`. Zmiana później jest możliwa, ale unieważnia wszystkie dotychczasowe adresy.
3. Kryterium sukcesu: panel pokazuje `<subdomena>.workers.dev` jako aktywną.

### Krok 5b — build i pierwszy deploy

```bash
! nvm use 22 && npm run build && npx wrangler deploy
```

Oczekiwany wynik: tabela modułów, `Uploaded subtracker`, `Deployed subtracker triggers`, adres `https://subtracker.kamil-kapturski.workers.dev`, `Current Version ID: <uuid>`.

Jeśli zobaczysz `You need to register a workers.dev subdomain` — krok 5a nie został ukończony; nic nie zostało wgrane, wróć do 5a.

Jeśli wrangler zapyta o cokolwiek interaktywnie (np. zgodę na rejestrację subdomeny), odpowiedz w terminalu; prefiks `!` nie obsługuje pytań interaktywnych — wtedy uruchom to samo polecenie w zwykłym terminalu.

**Przekaż agentowi:** adres Workera i Version ID (trafiają do frontmattera tego pliku).

Zanim ustawisz sekrety, aplikacja pod tym adresem renderuje Banner „Supabase nie jest skonfigurowany” — to stan obsługiwany, nie błąd.

### Krok 6 — sekrety produkcyjne (osobny terminal, nie przez `!`)

Wartości weź z panelu hostowanego projektu Supabase: Project Settings → API → „Project URL” oraz klucz **`anon` public** (nie `service_role`).

```bash
cd ~/10xdevs/10xdevs && nvm use 22
npx wrangler secret put SUPABASE_URL
# wrangler pyta: Enter a secret value:  → wklej https://<project-ref>.supabase.co
npx wrangler secret put SUPABASE_KEY
# → wklej klucz anon
```

Oczekiwany wynik każdego polecenia: `✨ Success! Uploaded secret SUPABASE_URL` (odpowiednio `SUPABASE_KEY`). Sekret działa od następnego żądania, bez redeployu.

Kontrola bez ujawniania wartości (można przez `!`):

```bash
! npx wrangler secret list
```

Oczekiwane: dwie pozycje `SUPABASE_URL`, `SUPABASE_KEY` typu `secret_text`.

Pomyłka w wartości: powtórz `wrangler secret put <NAME>` — nadpisuje w miejscu. Nigdy `echo "<wartość>" | wrangler secret put` w sesji agenta (wartość ląduje w rozmowie).

### Krok 7 — konfiguracja URL w hostowanym Supabase (panel)

1. Supabase Dashboard → projekt → Authentication → URL Configuration.
2. **Site URL**: `https://subtracker.kamil-kapturski.workers.dev` (dokładnie adres z kroku 5b, bez ukośnika na końcu). Tu prowadzi link z e-maila potwierdzającego, bo `signUp` nie podaje `emailRedirectTo`.
3. **Redirect URLs**: dodaj ten sam adres (opcjonalnie także `https://subtracker.kamil-kapturski.workers.dev/**`, jeśli w przyszłości pojawią się przekierowania na podstrony).
4. Authentication → Sign In / Providers → Email: **„Confirm email” zostaje włączone** (decyzja z §1). Wbudowany SMTP Supabase wysyła kilka e-maili na godzinę — do ręcznej weryfikacji wystarcza, ale nie rejestruj wielu kont pod rząd.
5. Zapisz.

**Przekaż agentowi:** potwierdzenie „krok 6 i 7 gotowe” — od tego momentu agent uruchamia weryfikację z §6.

### Krok 8 — weryfikacja automatyczna (agent, tylko odczyt)

Wykonuje agent po otrzymaniu adresu; polecenia w §6. Jeśli chcesz sprawdzić samodzielnie:

```bash
URL=https://subtracker.kamil-kapturski.workers.dev
npx wrangler deployments status
curl -sS -o /dev/null -w '%{http_code}\n' "$URL/"                        # 200
curl -sS "$URL/" | grep -c "Supabase nie jest skonfigurowany"            # 0
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "$URL/dashboard"  # 302 .../auth/signin
curl -sS -o /dev/null -w '%{http_code}\n' "$URL/auth/signin"             # 200
curl -sS -o /dev/null -w '%{http_code}\n' "$URL/nie-istnieje"            # 404
```

### Krok 9 — weryfikacja ręczna (przeglądarka + tail)

W jednym terminalu (lub przez `!` w sesji agenta, jako proces w tle):

```bash
npx wrangler tail subtracker --format json --status error
```

W przeglądarce, w kolejności:

1. `/` — strona główna bez czerwonego Bannera o Supabase.
2. `/auth/signup` — zarejestruj konto na własny adres e-mail → przekierowanie na `/auth/confirm-email`.
3. Kliknij link z e-maila „Confirm your signup” — musi otworzyć adres `workers.dev` (jeśli otwiera `localhost`/`127.0.0.1:3000`, Site URL z kroku 7 jest błędne).
4. `/auth/signin` — zaloguj się → przekierowanie na `/`.
5. `/dashboard` — renderuje się (200), pokazuje zalogowanego użytkownika.
6. Wyloguj (formularz POST w topbarze) → `/dashboard` przekierowuje na `/auth/signin`.
7. Negatywny test: logowanie złym hasłem → `/auth/signin?error=...` z komunikatem.

Kryterium sukcesu: wszystkie kroki przechodzą, `wrangler tail` nie pokazał żadnego wpisu o statusie error. Zatrzymaj tail (`Ctrl+C`).

### Krok 10 — zamknięcie (agent)

Agent uzupełnia frontmatter (`production_url`, `first_deploy_at`, `version_id`, `secrets_wired`, `status: deployed`) oraz §5 (statusy), §6 (wyniki) i §8 (co jest wdrożone).

### Rollback / awaria w trakcie

- Deploy poszedł, ale aplikacja zwraca 500: `npx wrangler tail subtracker --format pretty` pokaże stack trace; typowa przyczyna to moduł Node poza listą `nodejs_compat`. Naprawa to fix-forward (kolejny `npm run build && npx wrangler deploy`); pierwsza wersja nie ma do czego się cofnąć.
- Trzeba zdjąć aplikację z sieci: `npx wrangler delete` (tylko człowiek; usuwa Worker razem z sekretami).
- Sekret wpisany błędnie: `npx wrangler secret put <NAME>` ponownie.

## 6. Weryfikacja

Automatyczna (agent, po kroku 7):

- `npx wrangler deployments status` — aktywna wersja = Version ID z kroku 5b.
- `npx wrangler secret list` — nazwy `SUPABASE_URL`, `SUPABASE_KEY` (bez wartości).
- `curl -sS -o /dev/null -w '%{http_code}' <URL>/` → `200`; treść `/` nie zawiera „Supabase nie jest skonfigurowany”.
- `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' <URL>/dashboard` → `302` na `/auth/signin`.
- `<URL>/auth/signin` → `200`; `<URL>/nie-istnieje` → `404`.
- `npx wrangler tail subtracker --format json --status error` w tle podczas click-through — oczekiwane zero wpisów.

Ręczna (człowiek): rejestracja → e-mail potwierdzający (link prowadzi na workers.dev) → logowanie → `/dashboard` renderuje się → wylogowanie → `/dashboard` przekierowuje na `/auth/signin`.

Wyniki — runda 1 (13:22, przed sekretami):

| Test | Wynik |
|---|---|
| `deployments status` | aktywna `7d7466cb…` (100%) |
| `GET /` | 200; Banner „Supabase nie jest skonfigurowany” **obecny** (oczekiwane przed krokiem 6) |
| `GET /dashboard` | 302 → `/auth/signin` |
| `GET /auth/signin`, `/auth/signup` | 200 |
| `GET /nie-istnieje` | 404 |

Runda 2 (13:36, po ustawieniu obu sekretów):

| Test | Wynik |
|---|---|
| `wrangler secret list` | `SUPABASE_KEY`, `SUPABASE_URL` |
| `GET /` | 200, Banner **nieobecny** |
| `GET /dashboard` | 302 → `/auth/signin` |
| `GET /auth/signin` | 200 |
| `GET /nie-istnieje` | 404 |
| `POST /api/auth/signin` złe hasło | 302 → `/auth/signin?error=Invalid%20login%20credentials` (odpowiedź z Supabase, więc Worker → Supabase działa) |

Runda 3 (2026-10-02, kontrola końcowa agenta po click-through użytkownika):

| Test | Wynik |
|---|---|
| `deployments status` | aktywna `d8a8b707…` (100%), źródło „Secret Change” |
| `wrangler secret list` | `SUPABASE_KEY`, `SUPABASE_URL` |
| `GET /` | 200, Banner nieobecny |
| `GET /dashboard` | 302 → `/auth/signin` |
| `POST /api/auth/signin` złe hasło | 302 → `?error=Invalid%20login%20credentials` |
| click-through (rejestracja → e-mail → logowanie → `/dashboard` → wylogowanie) | zgłoszony przez użytkownika jako udany; logi `tail` z tej sesji nie zachowane |

## 7. Rollback

- Deploy nr 1 nadpisuje placeholder z kreatora, więc `wrangler rollback` cofnąłby do placeholdera (`error code: 1042`), nie do działającej aplikacji — traktuj jak brak poprzedniej wersji: fix-forward (`npm run build && npx wrangler deploy`) albo zdjęcie aplikacji przez `npx wrangler delete` (wyłącznie człowiek).
- Od wersji nr 2: `npx wrangler versions list` → `npx wrangler rollback <VERSION_ID> --message "<why>"`. Odmowa, gdy bindings różnią się między wersjami — wtedy redeploy poprzedniego commita. Migracje Supabase nie cofają się z Workerem.
- Sekrety są per Worker, nie per wersja: `wrangler secret put` działa natychmiast dla wszystkich wersji.

## 8. Co jest wdrożone / podłączone (źródło prawdy)

| Zasób | Stan |
|---|---|
| Worker `subtracker` | **wdrożony i zweryfikowany**, `https://subtracker.kamil-kapturski.workers.dev`. Aktywna wersja `d8a8b707-bcc5-4b94-ac7d-614ce8756289` (11:30Z, Secret Change) = kod z `7d7466cb-ac88-459c-8983-c9f6d368302b` (11:21Z, upload) + oba sekrety. Historia: `2ff8d00a…`, `01d79bdb…` (11:15Z) placeholder z kreatora; `ee46191b…` (11:27Z) pierwszy Secret Change. Worker `10x-astro-starter` nie istnieje. |
| Workers Secrets | `SUPABASE_URL`, `SUPABASE_KEY` (wartość: klucz publishable) — ustawione 2026-09-21 13:35, działają bez redeployu |
| Bindings w konfiguracji | `ASSETS` (dist/client), `IMAGES` (auto z adaptera); brak KV/D1/R2 |
| Supabase | hostowany projekt podłączony przez Workers Secrets; Site URL / Redirect URLs = adres workers.dev (zgłoszone przez użytkownika); Confirm email włączone; schemat: `auth.users` + `public.subscriptions` (migracja `20261002091205_create_subscriptions`, RLS owner-only z politykami select/insert/update/delete dla `authenticated`, `anon` bez uprawnień) — zastosowana 2026-10-02 przez `supabase db push`, patrz §12 |
| CI deploy | **aktywny**: push na `master` w `github.com/kamil3392/subtracker` → `ci` → `smoke` → `deploy`. Pierwszy przebieg 2026-10-02 wgrał wersję `0f589141-ed1e-4867-9933-ca29579ee24c` (08:17Z, 100% ruchu); sekrety Workera nietknięte, aplikacja zweryfikowana curl-em po deployu |

## 9. Do zrobienia, żeby CI deployował

1. ✅ 2026-10-02: `git init -b master`, `npx husky` (hooksPath `.husky/_`), pierwszy commit `f7e9256`. Dodano `.prettierignore` (skille 10x CLI, `context/`, `CLAUDE.md`), żeby hook lint-staged nie przeformatował plików chronionych hashem ani dokumentów agentowych; `*.iml` w `.gitignore`.
2. ✅ 2026-10-02: repozytorium `https://github.com/kamil3392/subtracker` (remote `origin`, HTTPS), `git push -u origin master` → `7b006d3`. Pułapki po drodze: (a) GitHub nie przyjmuje hasła konta, potrzebny Personal Access Token lub klucz SSH; (b) push commita zawierającego `.github/workflows/ci.yml` wymaga od tokena uprawnienia **workflow** (classic) / **Workflows: Read and write** (fine-grained), inaczej `refusing to allow a Personal Access Token to create or update workflow`.
3. GitHub Secrets (Settings → Secrets and variables → Actions → Secrets): `CLOUDFLARE_API_TOKEN` (szablon „Edit Cloudflare Workers”, ograniczony do tego konta, bez DNS/billing/KV — KV niepotrzebne dzięki `session: false`), `CLOUDFLARE_ACCOUNT_ID` = `3e6c96199bd2a36317a753cc7e5f1aca`, oraz `SUPABASE_URL`/`SUPABASE_KEY` dla joba `ci` (build).
4. ✅ 2026-10-02: sekrety ustawione, pierwszy przebieg workflow przeszedł wszystkie trzy joby; `deploy` utworzył wersję `0f589141…` (źródło `version_upload`). PR merge pozostaje bramką ludzką dla kolejnych zmian.
5. Preview deploye (Workers Builds vs `wrangler versions upload --preview-alias`) dopiero po: Cloudflare Access na `*.workers.dev` previews **i** osobnym projekcie Supabase dla previews. Do tego czasu `preview_urls: false`.

## 10. Rozbieżności odnotowane

- `.nvmrc` 22.14.0 vs użyte 22.22.3 (CI: `node-version: 22`).
- wrangler 4.135.0 vs 4.131.1 w `infrastructure.md`.
- `dist/server/wrangler.json` vs `dist/wrangler.json` w `infrastructure.md`.
- Nazwa Workera zmieniona w trakcie z `10x-astro-starter` na `subtracker` (powód: placeholder z kreatora subdomeny); `package.json` nadal nosi nazwę startera.
- Subdomena `workers.dev` nie była zarejestrowana na koncie — krok nieobecny w „Getting Started”.
- `wrangler secret put` **tworzy nową wersję Workera** (źródło „Secret Change”) i od razu ją wdraża; infrastructure.md pisze tylko „bez redeployu”. Konsekwencja: do `wrangler rollback` wskazuj najnowszą wersję z działającym kodem (tu `d8a8b707…`), nie wersję z uploadu kodu.
- Logi z `wrangler tail` uruchomionego w tle przez agenta giną wraz z sesją; przy kolejnych weryfikacjach zapisuj je do pliku w repo-ignorowanym katalogu albo czytaj od razu po click-through.

## 11. Poza zakresem

Custom domain/DNS, Cloudflare Access, Workers Paid, `site` w `astro.config.mjs` (sitemapa; wymaga znanej subdomeny), aktualizacja `.nvmrc`. (Migracje `supabase/migrations/` przeszły do zakresu — §12.)

## 12. Migracje bazy (hostowany Supabase)

**Zasada:** każda nowa migracja w `supabase/migrations/` wymaga ręcznego `npx supabase db push` na produkcję **przed** merge zmiany, która z niej korzysta. CI nie wykonuje `db push` (brak sekretów bazy w GitHub); job `smoke` stosuje migracje tylko na lokalnym, efemerycznym Supabase i uruchamia na nim testy pgTAP. Rollback Workera nie cofa migracji — migracje muszą być addytywne / wstecznie zgodne (risk register w `infrastructure.md`).

Procedura (człowiek, osobny terminal — `login` i `link` są interaktywne, hasło bazy nie trafia do rozmowy):

```bash
cd ~/10xdevs/10xdevs && nvm use 22
npx supabase login                          # jednorazowo
npx supabase link --project-ref <ref>       # jednorazowo na checkout; pyta o hasło bazy
npx supabase db push --dry-run              # oczekiwane: tylko nowe migracje
npx supabase db push
npx supabase migration list                 # Local = Remote dla każdej migracji
```

Historia:

| Data | Migracja | Wynik |
|---|---|---|
| 2026-10-02 | `20261002091205_create_subscriptions.sql` (change `owner-only-subscription-store`, commit `a7d8989`) | `db push`: zastosowana tylko ta migracja; `migration list`: Local `20261002091205` = Remote `20261002091205` (09:12:05 UTC). Sprawdzenie anon `GET /rest/v1/subscriptions?select=id` z kluczem publishable: `HTTP 401`, `{"code":"42501","message":"permission denied for table subscriptions"}` — anon odrzucony na poziomie uprawnień tabeli (`revoke all … from anon`), nie przez zły klucz |
