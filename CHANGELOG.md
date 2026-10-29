# Changelog

## Unreleased

- The agent keeps the drawing's colors: the outline reports label and text colors as `text-color=`, separate from strokes, and the instructions say to map each color to the library's closest theme color.
- The agent asks what the drawing leaves open (data, actions, empty and error states) before its first build.
- Library and preview pickers in the top bar. A custom library takes a docs link, saved as `docs` in `drawui.json` and reported by `get_project`.
- Hide or show the preview without clearing its URL.
- Free text alone in a shape becomes that shape's label.
- First version: a local Excalidraw canvas for a project directory, saved to `drawui.excalidraw`, with an MCP server that reads the drawing as a UI outline and lets the agent draw, update, delete, and annotate elements on it.
