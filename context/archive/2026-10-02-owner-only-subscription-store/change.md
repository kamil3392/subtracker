---
change_id: owner-only-subscription-store
title: Magazyn subskrypcji z izolacją danych per konto
status: archived
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02T10:47:05Z
---

## Notes

Roadmap F-01 (`context/foundation/roadmap.md`) — fundament wymagany przez S-01 (`home-screen-cost-and-renewals`), S-02 i S-03. Zakres celowo minimalny: tabela subskrypcji z polami z FR-003 i FR-007 (nazwa, cena, waluta, cykl, data następnego odnowienia, status), RLS z osobnymi politykami select/insert/update/delete dla `authenticated` oraz weryfikacja izolacji („drugie konto nie widzi i nie modyfikuje cudzych subskrypcji”, NFR prywatności). Bez UI i bez logiki przeliczeń — te wchodzą w S-01.
