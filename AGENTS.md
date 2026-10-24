# AGENTS.md

Guide for AI coding agents and the humans reviewing their work in this repository. Harville Labs' org-wide standards ([Harville-Labs/agents](https://github.com/Harville-Labs/agents/blob/main/AGENTS.md)) apply too. This file adds to them and can tighten them; it departs from one only where an ADR in `docs/adr/` says so.

## What this repo is

drawui: a local Excalidraw canvas plus an MCP server, so a user can draw UI and a coding agent can build it and draw its changes back. See [README.md](README.md) for the drawing conventions and [docs/mcp.md](docs/mcp.md) for the tools. Architecture: [ADR 0001](docs/adr/0001-excalidraw-island-and-bun-server.md).

## Commands

```sh
bun install
bun run check                      # lint, typecheck, tests, canvas build, file length; what CI runs
bun test packages/core             # one package's tests
bun run build                      # build the canvas into apps/canvas/build
bun start <project-dir> --port 4747 --no-open   # run the server against a project
bun run format                     # apply Biome fixes
```

## Layout

| Path            | Owns                                                                                                                                          | Must not                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/core` | Pure logic: element parsing, interpreting a drawing into a UI tree, the outline text, geometry, the WebSocket protocol and tool input schemas | Do I/O, or import Excalidraw, Svelte, or Bun APIs                 |
| `apps/server`   | The `drawui` CLI: static files, the `/ws` WebSocket, the stateless `/mcp` endpoint, the scene and config files on disk                        | Lay out or create Excalidraw elements; that happens in the canvas |
| `apps/canvas`   | SvelteKit single-page app hosting Excalidraw as a React island; performs agent edits (`ops.ts`) and reports the scene                         | Talk to anything but its own server                               |

## Invariants

1. **Local only.** The server binds `127.0.0.1` and rejects requests whose Host or Origin isn't this server on a loopback name (DNS rebinding). No CDN, analytics, or other third-party requests from the canvas; Excalidraw's fonts are copied into `static/fonts` at build time.
2. **The canvas performs agent edits.** The server forwards `draw`, `update`, `delete`, `annotate`, and `export` to the tab the user touched last, so edits go through Excalidraw and into the user's undo history. Edits fail with a clear message when no canvas is open.
3. **The file is the drawing.** `drawui.excalidraw` is a plain Excalidraw file without deleted elements; `drawui.json` holds only user settings. Never write anything else into the user's project.
4. **Interpretation is pure and deterministic.** `interpret` and `outline` take elements and return data; same drawing, same outline.
5. **The agent's marks are labeled.** Elements the agent creates carry `customData.drawui.author = "agent"`, and source links live in `customData.drawui.source`.

## Hand-rolled on purpose

- **Static file serving** (`apps/server/src/static.ts`): about 15 lines with path confinement, cheaper than a framework for one SPA directory.
- **Arrow routing and frame placement** (`apps/canvas/src/lib/ops.ts`, `arrowBetween` in core): Excalidraw's `convertToExcalidrawElements` doesn't route arrows, treats a frame at x or y 0 as unset, refits frames to their children, and can bind only rectangles, ellipses, diamonds, and text. `build()` works around each of these; the comments there say where.

## Conventions

- `apps/canvas/svelte.config.js` is JavaScript because SvelteKit loads it before TypeScript is set up; it is the only hand-written `.js` file.
- `apps/canvas/src/lib/asset-path.ts` must be the first import of every module that imports Excalidraw: Excalidraw reads its font path when it is evaluated.
- Tests sit next to the code as `*.test.ts` and run with `bun test`. The canvas has no unit tests yet; check canvas changes by running the server and driving the tools over MCP.
