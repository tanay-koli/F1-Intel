# Driver Images

Place driver portrait images here. `components/F1Image.jsx` loads
`/images/drivers/<driverId>.<ext>`, trying `.webp`, `.png`, `.jpg`, `.jpeg` in
that order, and shows the driver's initials if none exists.

## Naming Convention

The file name must be the driver's `driverId` from the Jolpica API, exactly.
IDs are lowercase with underscores. They are **not** always the surname:
established drivers usually have just the surname (`norris`, `hamilton`), while
newer drivers and name clashes get `firstname_lastname` (`arvid_lindblad`,
`max_verstappen`). Look an ID up with `GET /api/drivers?season=2026` (field
`driverId`).

## Format

- Preferred: `.webp` (best compression + quality)
- Also supported: `.png`, `.jpg`, `.jpeg`

## 2026 race drivers

| Driver                   | driverId           | File in this folder |
|--------------------------|--------------------|---------------------|
| Alexander Albon          | `albon`            | `albon.jpg` |
| Fernando Alonso          | `alonso`           | `alonso.webp` |
| Andrea Kimi Antonelli    | `antonelli`        | `antonelli.png` |
| Oliver Bearman           | `bearman`          | `bearman.webp` |
| Gabriel Bortoleto        | `bortoleto`        | `bortoleto.webp` |
| Valtteri Bottas          | `bottas`           | `bottas.webp` |
| Franco Colapinto         | `colapinto`        | `colapinto.jpg` |
| Pierre Gasly             | `gasly`            | `gasly.webp` |
| Isack Hadjar             | `hadjar`           | `hadjar.jpg` |
| Lewis Hamilton           | `hamilton`         | `hamilton.jpg` |
| Nico Hülkenberg          | `hulkenberg`       | `hulkenberg.jpg` |
| Liam Lawson              | `lawson`           | `lawson.png` |
| Charles Leclerc          | `leclerc`          | `leclerc.jpg` |
| Arvid Lindblad           | `arvid_lindblad`   | `arvid_lindblad.png` |
| Lando Norris             | `norris`           | `norris.webp` |
| Esteban Ocon             | `ocon`             | `ocon.jpg` |
| Oscar Piastri            | `piastri`          | `piastri.webp` |
| Sergio Pérez             | `perez`            | `perez.jpg` |
| George Russell           | `russell`          | `russell.webp` |
| Carlos Sainz             | `sainz`            | `sainz.jpg` |
| Lance Stroll             | `stroll`           | `stroll.jpg` |
| Yuki Tsunoda             | `tsunoda`          | — (missing) |
| Max Verstappen           | `max_verstappen`   | `max_verstappen.jpg` |

## Recommended Image Specs

- Aspect ratio: 1:1 (square) or portrait 3:4
- Minimum size: 200×200 px
- Transparent background preferred (PNG/WebP with alpha)
