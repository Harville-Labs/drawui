# MCP tools

drawui serves a stateless streamable-HTTP MCP endpoint at `http://localhost:<port>/mcp`. The server's instructions tell the agent the drawing conventions in the [README](../README.md#how-to-draw).

Tools that change the drawing need the canvas open in a browser tab: the tab performs the edit with Excalidraw so it lands in the user's undo history. Without one they fail with a message saying to open the canvas.

| Tool               | What it does                                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_project`      | Project root, chosen library and its docs URL when known, detected stack (from `package.json`), preview URL, drawing file, and whether a canvas tab is open.                                 |
| `set_project`      | Sets `library` or `preview`. An empty string clears a field.                                                                                                                                 |
| `get_canvas`       | The drawing as an indented outline, starting with its version. Ids are in `[brackets]`, labels in quotes, notes after `//`, selected elements marked `*`.                                    |
| `get_selection`    | The outline of only the selected elements. A selected label or note counts as the element it belongs to.                                                                                     |
| `get_canvas_image` | A PNG of the drawing, or of the given ids.                                                                                                                                                   |
| `wait_for_change`  | Blocks until the user changes the drawing after `since`, then returns the new outline. Times out after `timeoutSeconds` (default 120, at most 300).                                          |
| `draw`             | Adds up to 200 rectangles, ellipses, diamonds, text, frames, and arrows. Arrows take `from` and `to` ids and are routed edge to edge. `source` links a shape to the code that implements it. |
| `update`           | Moves, resizes, relabels, recolors, or sets `source` on existing elements.                                                                                                                   |
| `delete`           | Removes elements with their labels and attached arrows. The user can undo it.                                                                                                                |
| `annotate`         | Leaves a note beside an element with an arrow to it.                                                                                                                                         |

The `build` prompt asks the agent to build the drawing (or the selection) and keep drawing back.

## Outline example

```
version 16
screen "Login" [login] 0,0 420x320 column by-agent
  // use the brand font
  rectangle "Email" [email] 40,60 340x48 by-agent
    // Validate on blur?
  rectangle "Sign in" [submit] 40,200 160x48 fill=#a5d8ff by-agent
screen "Home" [home] 560,0 420x320 by-agent

arrows:
  [YQKXMOdGpYMwqQtil3OCf] "Sign in" -> "Home" : "on success" by-agent
```
