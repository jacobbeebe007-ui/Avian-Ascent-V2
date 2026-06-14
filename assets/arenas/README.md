# Battle arena backdrops (PNG)

Drop PNG files here. The game loads **`arena-{id}.png`** or responsive variants **`arena-{id}-desktop.png`** / **`arena-{id}-mobile.png`**.

| Filename | Theme |
|----------|--------|
| `arena-forest.png` | Forest |
| `arena-river.png` | River |
| `arena-ruins.png` | Ruins |
| `arena-barn.png` | Barn |
| `arena-house.png` | House |
| `arena-bridge.png` | Bridge |
| `arena-trees.png` | Trees |
| `arena-open-glade.png` | Open glade |
| `arena-castle-gate.png` | Castle gate |
| `arena-castle-interior.png` | Castle interior |
| `arena-castle-throne.png` | Castle throne room |
| `arena-finch-burrow-desktop.png` | Finch Burrow (desktop / landscape) |
| `arena-finch-burrow-mobile.png` | Finch Burrow (mobile / portrait) |

If a file is missing, the loader tries `-desktop` or `-mobile` first (by UI mode), then the legacy single file, then falls back to the default green vignette.

Arena is chosen from overworld node **terrain** when present, otherwise from **story stage** (1–20).
