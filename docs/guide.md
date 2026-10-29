# Using drawui

drawui is a canvas you draw a UI on, beside a coding agent that builds it. You sketch screens; the agent reads the sketch, writes the frontend in your project with the component library you picked, and draws what it changed back onto the canvas. This guide covers setting it up, drawing so the agent understands you, and working with the agent from first sketch to finished screen.

## Set up

You need [Bun](https://bun.sh) 1.4 or later and an agent that speaks MCP over streamable HTTP, such as Claude Code or Switchback.

1. Start drawui on your project:

   ```sh
   bunx drawui ~/code/my-app
   ```

   The canvas opens at `http://localhost:4747`. Leave the path off to use the current directory. Pass `--port 5000` to use another port, or `--no-open` to skip opening the browser.

2. Connect your agent. For Claude Code:

   ```sh
   claude mcp add --transport http drawui http://localhost:4747/mcp
   ```

   Or copy drawui's [`.mcp.json`](../.mcp.json) into your project's root, so everyone working in the project gets the server. Change the port there if you changed it above.

   Or, in Claude Code, install the drawui plugin. It connects the server and adds a skill that teaches the agent the drawui workflow:

   ```sh
   claude plugin marketplace add Harville-Labs/drawui
   claude plugin install drawui@drawui
   ```

drawui runs only while the `bunx drawui` command does. Stop it with Ctrl+C; the drawing is already saved.

## The canvas

The top bar, left to right:

- **Status.** Connected, Connecting, or Server stopped. When the server stops, the canvas keeps trying to reconnect, so starting it again is enough.
- **Library.** The component library the agent builds with. Sivir UI, shadcn/ui, and shadcn-svelte are suggested. For anything else, give its name and a link to its docs; the agent reads the docs before building.
- **Preview.** The URL of your dev server, such as `http://localhost:5173`. The page appears beside the drawing so you can watch the agent build it.
- **New screen.** Makes a frame sized for a phone (390 × 844), a tablet (834 × 1194), or a desktop (1440 × 900), named for that device. With a screen selected, the name is filled in, so drawing the same screen at another size takes two clicks.
- **Mark as note.** Turns the selected text into notes for the agent.

Messages, such as "Select some text first" or "Agent is drawing", appear as toasts in the bottom-right corner and go away on their own.

Everything else is Excalidraw: its toolbar, its shortcuts, its library, and its menus all work as usual.

### The preview pane

The preview shows your running app, so it needs your dev server running first. In the pane's header:

- **Phone**, **Tablet**, and **Full** lay the page out at a device's width, scaled down if the pane is narrower, or at the pane's own width.
- **Reload** reloads the page, for dev servers that don't reload on their own.
- **Expand** fills the window with the preview. Press it again to bring the drawing back.
- **Collapse** tucks the preview against the right edge. Drag the edge, or turn the preview back on from the **Preview** menu, to open it again.

Drag the line between the drawing and the preview to resize them. drawui remembers the sizes in this browser.

If the pane stays blank, your dev server may forbid being shown in a frame (an `X-Frame-Options` header or a `frame-ancestors` rule). Allow `http://localhost:4747` in development, or open the app in its own tab.

Below about 730 pixels wide, Excalidraw switches to its phone layout. Keep the drawing wider than that if you'd rather keep the full toolbar.

## Drawing so the agent understands

You don't need a special notation. drawui reads ordinary shapes the way a person would, using a few rules:

| You draw                                           | The agent reads                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| A frame                                            | A screen, named by the frame's name                                               |
| A rectangle, ellipse, or frame around other shapes | A container. What's inside is its content, and rows and columns become the layout |
| Text inside a shape                                | That component's visible text, used word for word                                 |
| Text starting with `//`                            | A note to the agent about what it sits beside, or else the container it's in      |
| An arrow from a note to an element                 | A note about that element                                                         |
| An arrow between elements                          | Navigation or data flow; label the arrow to say which, such as "on submit"        |
| Fill, stroke, and text colors                      | Colors to keep, matched to the library's closest theme color                      |
| A dashed stroke                                    | A deliberate hint, such as "this is optional" or "this appears later"             |
| Freehand lines                                     | A rough sketch; the agent looks at a picture of it                                |
| An image you drop or paste                         | A picture the agent can look at, and save into the project when you ask           |

A few habits help:

- **One frame per screen.** Name it for the screen, like `Settings` or `Checkout`. Shapes outside every frame still count, but frames make it clear which screen they belong to.
- **Label things the way they should read.** A rectangle reading "Save changes" becomes a button that says "Save changes". Text inside a shape is copied exactly, so write the real copy, not "button".
- **Say what the drawing can't.** Where data comes from, what a button does, what happens on error: write a `//` note beside it. Notes are the most direct way to tell the agent something.
- **Use real components' names when you mean them.** "// use a Select" or "// a Tabs control" points the agent at a specific component in your library.

### Notes

Type `//` at the start of any text to make it a note, or select text and press **Mark as note**. A note attaches to the closest element beside it, within a short reach, inside the same container. If nothing is that close, it attaches to the container. To be exact, draw an arrow from the note to the element it's about.

The agent also leaves notes, with an arrow to the element, when it couldn't build something or had to guess. Answer them by editing the note or adding your own next to it.

### One screen at several sizes

To show how a screen should look on a phone and on a desktop, draw it twice, in frames named `Login (mobile)` and `Login (desktop)`. A `(tablet)` suffix works too. The agent builds one responsive screen, not two separate ones. **New screen** names frames this way for you.

Without a suffix, the frame's width decides: under 600 pixels is a phone, under 1024 is a tablet, and anything wider is a desktop.

Check each size in the preview with **Phone**, **Tablet**, and **Full**.

## Working with the agent

Ask in plain words: "build what I drew in drawui". In Claude Code, the `build` prompt asks the same thing; type `/` to find it.

Before its first build of a drawing, the agent asks the few questions the drawing leaves open, such as where the data comes from or what the empty and error states look like. Answer them, and it starts building.

While it works:

- It reads the drawing as an outline, and looks at a picture when the outline isn't enough.
- It writes code in your project, using your library and your project's existing patterns.
- It draws its changes back onto the canvas. Things the agent drew are tagged as its own, and elements it built link to their source file.
- The preview updates as your dev server reloads.

Then change the drawing and ask again. The agent compares the drawing with what it built and changes only what you changed.

**Build part of the drawing.** Select the screens or elements you want, then ask the agent to build "the selection". It reads only what you selected.

**Let the agent wait for you.** Ask the agent to watch the canvas ("tell me when I've changed the drawing" or "keep building as I draw"). It waits until you edit the drawing, then picks up the change.

**Several tabs.** You can open the canvas in more than one tab or window. They stay in sync, and the agent works in the tab you used last. If no tab is open, the agent tells you to open one, since it needs the canvas to lay out what it draws.

## What's saved, and where

Everything stays on your machine. The server listens only on `127.0.0.1` and answers only requests addressed to localhost. drawui sends nothing anywhere.

- `drawui.excalidraw`, in your project: the drawing. It's a normal Excalidraw file, so it opens in Excalidraw too.
- `drawui.json`, in your project: the library, the docs link for a library drawui doesn't suggest, and the preview URL.
- The size of the preview pane, in your browser's storage for `localhost:4747`.

Commit `drawui.excalidraw` and `drawui.json` if you want the drawing to live with the code.

## When something goes wrong

| What you see                          | What to do                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `couldn't listen on port 4747`        | Something else uses the port. Start drawui with `--port 4748`, and change the port in your agent's MCP settings to match    |
| The status says **Server stopped**    | Start drawui again. The canvas reconnects on its own                                                                        |
| The agent says no canvas is open      | Open `http://localhost:4747` in a browser                                                                                   |
| The agent can't find the drawui tools | Check that drawui is running, and that the MCP URL ends in `/mcp` with the right port                                       |
| The preview is blank                  | Check that your dev server is running at that URL, and that it allows being shown in a frame                                |
| The agent built the wrong thing       | Add a `//` note where it went wrong and ask again. Notes beat long chat messages, because they stay attached to the drawing |

For the full list of tools the agent uses, see [mcp.md](mcp.md).
