# Constructor Images

Place constructor / team logo images here.

## Naming Convention

File names must be the team's `constructorId` from the Jolpica API, exactly (lowercase with
underscores, e.g. `red_bull`). Look one up with `GET /api/constructors?season=2026`.

## Format

- Preferred: `.webp` or `.png` (logos need transparency)
- Also supported: `.jpg`, `.jpeg`

## 2026 Constructor IDs

| Team             | constructorId  | File in this folder |
|------------------|----------------|---------------------|
| Alpine F1 Team   | `alpine`       | `alpine.png`        |
| Aston Martin     | `aston_martin` | `aston_martin.jpg`  |
| Audi             | `audi`         | `audi.webp`         |
| Cadillac F1 Team | `cadillac`     | `cadillac.jpg`      |
| Ferrari          | `ferrari`      | `ferrari.png`       |
| Haas F1 Team     | `haas`         | `haas.png`          |
| McLaren          | `mclaren`      | `mclaren.png`       |
| Mercedes         | `mercedes`     | `mercedes.webp`     |
| RB F1 Team       | `rb`           | `rb.png`            |
| Red Bull         | `red_bull`     | `red_bull.webp`     |
| Williams         | `williams`     | `williams.png`      |

## Recommended Image Specs

- Aspect ratio: 16:9 or 3:2 (landscape for car shots)  
  OR 1:1 square for logo-only images
- Minimum size: 400×225 px (landscape) / 200×200 px (logo)
- Transparent background strongly preferred (PNG/WebP with alpha)
