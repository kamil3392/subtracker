---
change_id: testing-cost-and-date-rule-oracle
title: Wyrocznia reguły kosztu i dat z PRD (test-plan Phase 1)
status: implementing
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Wyrocznia reguły kosztu i dat". Risks covered: #1 (błędny koszt miesięczny waluty niezauważony), #2 (dryf daty odnowienia / granice okna 30 dni i dnia w Europe/Warsaw), #4 (anulowana liczona po dacie końca lub znikająca przed nią). Test types planned: unit (tabele przypadków z PRD, granice). Risk response intent: #1: wynik dla mieszanych cykli i walut równa się wartości policzonej ręcznie z reguły PRD (1/12, 1/3, osobno per waluta) — nie formułą skopiowaną z kodu. #2: kotwica 31. wraca po krótkim miesiącu; okno [dziś, dziś+30] włączne na obu końcach; „dziś” w Warszawie, gdy UTC jest przed północą. #4: granica D — dzień przed D i D liczone, D+1 nieobecna w sumie i odnowieniach; anulowana bez rolloveru. After creating the folder, follow the downstream continuation rule.
