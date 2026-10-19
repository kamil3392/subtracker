---
change_id: dashboard-design-tokens
title: Dashboard design tokens
status: implemented
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Notes

Zmiana UI prowadzona przez `/10x-ui` (cel: https://subtracker.kamil-kapturski.workers.dev/ → po zalogowaniu `/dashboard`).

- **Widok (jeden):** `/dashboard` — `src/pages/dashboard.astro` wraz z wyspami/komponentami, które renderuje: `Topbar.astro`, `Banner.astro` (przez `Layout.astro`), `subscriptions/SubscriptionForm.tsx`, `subscriptions/SubscriptionActions.tsx`, `form/FormField.tsx`, `form/SubmitButton.tsx`, `form/ServerError.tsx`.
- **Źródło tokenów:** `src/styles/global.css` (`:root` / `.dark` → `@theme inline`), shadcn/ui `new-york`, `baseColor: neutral`; komponenty w `src/components/ui/` (dziś: `button`, `alert-dialog`).
- **Wariant kontraktu:** świeży starter z martwym plikiem tokenów — tokeny istnieją, ale widoki ich nie czytają. Faza tokenów polega na podłączeniu widoku do istniejących tokenów, nie na wyborze nowego motywu.

Wstępny audyt (2026-10-19), skan wartości zakodowanych na sztywno na plikach widoku: **50 trafień, 0 użyć tokenów**; importy z `components/ui` tylko w `SubscriptionActions.tsx` (2) i `SubmitButton.tsx` (1). `.dark` nigdzie nie jest włączane, a ciemny wygląd pochodzi z literałów (`text-white`, `bg-white/10`, `text-blue-100/60`, `purple-*`) i `bg-cosmic` (hex w `global.css`).

Otwarta decyzja na plan: włączyć `.dark` i dostroić jego wartości (rekomendacja) vs. przenieść paletę „cosmic” do `:root`.
