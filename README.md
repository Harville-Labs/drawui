# drawui

Draw a UI on a canvas, and your coding agent builds it in your project.

drawui is a local canvas (Excalidraw) with an MCP server. You sketch screens freeform: rectangles are containers, text inside a shape is its label, and text starting with `//` is a note to the agent. The agent reads the drawing, writes the frontend with the component library you chose, and draws its changes back onto the canvas, so the drawing and the code stay in step.

It works with any MCP client that speaks streamable HTTP, such as Claude Code and Switchback.

## Run it

You need [Bun](https://bun.sh) 1.4 or later.

```sh
git clone https://github.com/Harville-Labs/drawui
cd drawui
bun install
bun run build
bun start ~/code/my-app
```

That opens the canvas at `http://localhost:4747` for `~/code/my-app`. Leave the path off to use the current directory, or point it at an empty folder to start from a blank canvas. Then connect your agent:

```sh
claude mcp add --transport http drawui http://localhost:4747/mcp
```

Or copy [`.mcp.json`](.mcp.json) into your project's root so everyone working in it gets the server. Change the port there if you start drawui with `--port`.

Pick a component library in the top bar. Sivir UI, shadcn/ui, and shadcn-svelte are suggested; for any other library, give its name and a link to its docs, and the agent reads them before building. If you like, set the URL of your dev server too, so the preview sits beside the drawing (you can hide it from the same menu); switch it between phone, tablet, and full width to check each size. Then ask the agent to "build what I drew in drawui", or use the `build` prompt.

Before its first build of a drawing, the agent asks the few questions the drawing leaves open, such as where data comes from, what a button does, or what the empty and error states look like.

## How to draw

| You draw                                            | The agent reads                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A rectangle, ellipse, or frame around other shapes  | A container. Nesting is layout; rows and columns are inferred.                                       |
| A frame                                             | A screen, named by the frame's name. **New screen** in the top bar makes one sized for a device      |
| Frames named `Login (mobile)` and `Login (desktop)` | One screen at two sizes; the agent builds it responsive. Without a suffix, the frame's width decides |
| Text inside a shape                                 | That component's visible text, used verbatim                                                         |
| Text starting with `//`                             | A note to the agent about the element just beside it, or else the container it sits in               |
| An arrow from a note to an element                  | A note about that element                                                                            |
| An arrow between elements                           | Navigation or data flow; its label says which                                                        |
| Fill, stroke, and text colors                       | Colors to keep, mapped to the library's closest theme color                                          |
| Dashed strokes                                      | Deliberate hints                                                                                     |
| Freehand lines                                      | A rough sketch; the agent looks at an image of it                                                    |

Select text and use **Mark as note** to turn it into a note without typing `//`. Select part of the drawing to ask the agent to build only that part.

Things the agent draws are tagged as its own, and elements it implemented link to their source file. When it can't build something or had to guess, it leaves a note with an arrow pointing at the element.

## What's saved

Everything stays on your machine. The server listens only on `127.0.0.1` and answers only requests addressed to localhost.

- `drawui.excalidraw`: the drawing, in the project directory. Open it in Excalidraw too.
- `drawui.json`: the chosen `library`, the `docs` link for a library drawui doesn't suggest, and the `preview` URL.

Commit both if you want the drawing to live with the code.

## MCP tools

`get_project`, `set_project`, `get_canvas`, `get_selection`, `get_canvas_image`, `get_image`, `wait_for_change`, `draw`, `update`, `delete`, and `annotate`. See [docs/mcp.md](docs/mcp.md).

## Develop

```sh
bun run check   # lint, typecheck, tests, build, file length; what CI runs
bun run dev     # build the canvas and start the server on the current directory
```

See [AGENTS.md](AGENTS.md) for the layout and the rules changes must follow.

## License

[Apache 2.0](LICENSE).
