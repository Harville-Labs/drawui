# License texts drawui ships for others

`scripts/package.ts` writes `THIRD_PARTY_LICENSES.md` into the npm package from each bundled package's own license file. The files here fill the gaps.

Packages whose npm release has no license file. Each text is copied from the package's repository:

| File                              | Package                   | Source                                                                                               |
| --------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `excalidraw.LICENSE`              | `@excalidraw/excalidraw`  | github.com/excalidraw/excalidraw `LICENSE`                                                           |
| `radix-ui.LICENSE`                | `@radix-ui/*`             | github.com/radix-ui/primitives `LICENSE`                                                             |
| `scritto.LICENSE`                 | `@scritto/core`           | github.com/JaceThings/Scritto `LICENSE`                                                              |
| `react-remove-scroll-bar.LICENSE` | `react-remove-scroll-bar` | github.com/theKashey/react-remove-scroll-bar `LICENSE`                                               |
| `fastdom.LICENSE`                 | `fastdom`                 | the License section of github.com/wilsonpage/fastdom `README.md`; the repository has no license file |

`fonts/` holds the licenses of the fonts the canvas copies from `@excalidraw/excalidraw`, which ships them without license files. Each is the upstream project's license file:

| File              | Upstream                                              |
| ----------------- | ----------------------------------------------------- |
| `Assistant.txt`   | github.com/hafontia/Assistant `OFL.txt`               |
| `Cascadia.txt`    | github.com/microsoft/cascadia-code `LICENSE`          |
| `ComicShanns.txt` | github.com/shannpersand/comic-shanns `LICENSE`        |
| `Liberation.txt`  | github.com/liberationfonts/liberation-fonts `LICENSE` |
| `Lilita.txt`      | github.com/google/fonts `ofl/lilitaone/OFL.txt`       |
| `Nunito.txt`      | github.com/googlefonts/nunito `OFL.txt`               |
| `Virgil.txt`      | github.com/excalidraw/virgil `LICENSE.md`             |
| `Xiaolai.txt`     | github.com/lxgw/kose-font `OFL.txt`                   |

Excalifont has no separate license. It's Excalidraw's own font and ships in the Excalidraw repository under its MIT license, though the font file's copyright field says "All rights reserved".

When a dependency update adds a font or a package without a license file, `bun run package` fails and names it. Add its text here, from its repository, and list it above.
