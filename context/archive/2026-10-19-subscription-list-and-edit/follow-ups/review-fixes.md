# Review follow-ups: subscription-list-and-edit

Source: `reviews/impl-review.md` (2026-10-19)

- **F4 → S-03 (`subscription-delete-and-cancel`)**: błędy z akcji na wpisach (`/dashboard?error=…`, np. „Subscription not found” z edycji) są dziś pokazywane w `ServerError` formularza „Add subscription” (`src/pages/dashboard.astro`). S-03 doda kolejne akcje na wpisach — wprowadzić tam baner błędu na poziomie strony.
- **Do S-03 (z wdrożenia)**: lista „All subscriptions” ma osobny warunek widoczności niż stan pusty (`isEmpty` liczy tylko `active`) — konto z samymi anulowanymi wpisami zobaczy jednocześnie stan pusty i listę.
