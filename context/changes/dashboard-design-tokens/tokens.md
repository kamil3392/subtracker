# Tokeny — źródło wartości i kontrast fokusu

## Źródło

`:root` w `src/styles/global.css` = wartości wygenerowane przez shadcn/ui (`style: new-york`, `baseColor: neutral`), bez zmian. Jedyny wyjątek: `--ring`. `.dark` bez zmian i nieużywany (motyw jasny).

| Token    | Było               | Jest               |
| -------- | ------------------ | ------------------ |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |

`--sidebar-ring` pozostaje `oklch(0.708 0 0)` (sidebar nieużywany).

## Kontrast pierścienia na `--background` (`oklch(1 0 0)`, biały)

Dla barw achromatycznych luminancja liniowa Y = L³; WCAG: (1.05) / (Y + 0.05). Krycie /N złożone z białym w sRGB.

| Pierścień                                           | ≈ sRGB    | Y      | Kontrast na białym |
| --------------------------------------------------- | --------- | ------ | ------------------ |
| nowy `ring-ring` — `oklch(0.556 0 0)`               | `#737373` | 0.1719 | **4.73:1**         |
| stary `ring-ring/50` — `oklch(0.708 0 0)` @50%      | —         | —      | 1.54:1             |
| stary `--ring` w pełnym kryciu — `oklch(0.708 0 0)` | `#a1a1a1` | 0.3549 | 2.59:1             |
| nowy `ring-destructive` — `oklch(0.577 0.245 27.325)` | `#e7000b` | 0.1704 | **4.76:1**         |
| stary `ring-destructive/20` @20%                    | —         | —      | 1.44:1             |

Wymóg WCAG 1.4.11 (komponenty UI): ≥ 3:1 — spełniony przez oba nowe pierścienie. Szerokość `ring-[3px]` bez zmian; `aria-invalid:ring-destructive/…` (stan błędu, nie fokus) bez zmian.

## Banner (`src/components/Banner.astro`)

Bez literałów kolorów, bez nowych tokenów:

| Wariant   | Tło                                                         | Tekst              | Obramowanie          |
| --------- | ----------------------------------------------------------- | ------------------ | -------------------- |
| `info`    | `var(--muted)`                                              | `var(--foreground)` | `var(--border)`      |
| `warning` | `color-mix(in oklch, var(--chart-4) 20%, var(--background))` | `var(--foreground)` | `var(--chart-4)`     |
| `error`   | `color-mix(in oklch, var(--destructive) 10%, var(--background))` | `var(--foreground)` | `var(--destructive)` |

Tekst zawsze `--foreground` (≈ 18:1 na białym; na jasnych domieszkach nadal ≫ 4.5:1) — `--destructive` jako kolor tekstu na tle z domieszką spadałby poniżej 4.5:1.
