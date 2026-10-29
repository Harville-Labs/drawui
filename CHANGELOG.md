# Changelog

## Unreleased

- Several canvas tabs on one project no longer overwrite each other's edits. The server merges each tab's drawing element by element, keeping the newer copy, and sends a tab that missed an edit the merged drawing.
- A shape the user just drew is marked selected in the outline right away; the tab now sends the new scene before the selection that names it.
- Screens for phone, tablet, and desktop. A frame named `Login (mobile)`, or one drawn at phone width, is the phone version of `Login`; the outline shows each frame's `device=` and lists screens drawn for several devices, and the agent builds one responsive screen from them.
- A `//` note just beside an element, within 32 pixels, is about that element, without an arrow.
- The agent keeps the drawing's colors: the outline reports label and text colors as `text-color=`, separate from strokes, and the instructions say to map each color to the library's closest theme color.
- The agent asks what the drawing leaves open (data, actions, empty and error states) before its first build.
- Library and preview pickers in the top bar. A custom library takes a docs link, saved as `docs` in `drawui.json` and reported by `get_project`.
- Hide or show the preview without clearing its URL.
- Free text alone in a shape becomes that shape's label.
- First version: a local Excalidraw canvas for a project directory, saved to `drawui.excalidraw`, with an MCP server that reads the drawing as a UI outline and lets the agent draw, update, delete, and annotate elements on it.
