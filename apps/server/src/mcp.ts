import {
  type CanvasOp,
  docsFor,
  drawResult,
  elementPatch,
  exportResult,
  interpret,
  MAX_SHAPES_PER_CALL,
  outline,
  parseElements,
  projectPatch,
  selectedSubtrees,
  shapeInput,
} from '@drawui/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Hub } from './hub.ts';
import { INSTRUCTIONS } from './instructions.ts';
import type { ProjectStore } from './project.ts';
import { readStack } from './project.ts';
import type { SceneStore } from './store.ts';

export type Context = {
  root: string;
  scenePath: string;
  canvasUrl: string;
  scene: SceneStore;
  project: ProjectStore;
  hub: Hub;
};

const REQUEST_TIMEOUT_MS = 15_000;
const EXPORT_TIMEOUT_MS = 30_000;
const MAX_WAIT_SECONDS = 300;

const text = (value: string): CallToolResult => ({ content: [{ type: 'text', text: value }] });
const failure = (error: unknown): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
});

/** The drawing as an outline the agent reads, with the version to pass to wait_for_change. */
export function describeCanvas(ctx: Context): string {
  const { elements, selection, version } = ctx.scene.snapshot;
  const tree = interpret(parseElements(elements));
  return `version ${version}\n${outline(tree, new Set(selection))}`;
}

async function run(ctx: Context, op: CanvasOp, activity: string): Promise<unknown> {
  ctx.hub.broadcast({ type: 'activity', text: activity });
  return ctx.hub.request(op, op.kind === 'export' ? EXPORT_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
}

/** Builds an MCP server over the shared state. The HTTP transport is stateless, so this runs per request. */
export function createMcpServer(ctx: Context): McpServer {
  const server = new McpServer(
    { name: 'drawui', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'get_project',
    {
      description:
        'The project root, chosen component library and the URL of its docs, detected stack, preview URL, and drawing file.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const config = ctx.project.current;
      const project = {
        root: ctx.root,
        library: config.library ?? null,
        libraryDocs: docsFor(config) ?? null,
        preview: config.preview ?? null,
        stack: await readStack(ctx.root),
        drawing: ctx.scenePath,
        canvas: ctx.canvasUrl,
        canvasOpen: ctx.hub.connected > 0,
      };
      const hint = config.library
        ? ''
        : '\nNo library chosen yet. Ask the user, or have them pick one in the canvas top bar.';
      return text(JSON.stringify(project, null, 2) + hint);
    },
  );

  server.registerTool(
    'set_project',
    {
      description:
        'Sets the component library, a docs URL for a library drawui does not suggest, or the preview URL (the dev server the canvas shows next to the drawing). An empty string clears a field.',
      inputSchema: projectPatch.shape,
    },
    async (patch) => {
      try {
        const project = await ctx.project.update(patch);
        ctx.hub.broadcast({ type: 'project', project });
        return text(JSON.stringify(project));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get_canvas',
    {
      description:
        'The drawing as an indented outline: containers, labels in quotes, notes after //, element ids in [brackets], positions and sizes in scene coordinates, and arrows. Selected elements are marked with *. Starts with the version for wait_for_change.',
      annotations: { readOnlyHint: true },
    },
    async () => text(describeCanvas(ctx)),
  );

  server.registerTool(
    'get_selection',
    {
      description:
        'The outline of only what the user has selected, for "build this part" requests.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { elements, selection } = ctx.scene.snapshot;
      if (selection.length === 0) return text('Nothing is selected.');
      const parsed = parseElements(elements);
      const roots = selectedSubtrees(interpret(parsed), selection, parsed);
      return text(outline({ roots, arrows: [], owners: new Map() }));
    },
  );

  server.registerTool(
    'get_canvas_image',
    {
      description:
        'A PNG of the drawing, or of just the given elements. Use it to see layout, proportions, and freehand sketches.',
      inputSchema: { ids: z.array(z.string()).max(1000).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ ids }) => {
      try {
        const { png } = exportResult.parse(
          await run(ctx, { kind: 'export', ids }, 'Agent is looking'),
        );
        return { content: [{ type: 'image', data: png, mimeType: 'image/png' }] };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'wait_for_change',
    {
      description: `Waits until the user changes the drawing after the given version, then returns the new outline. Returns "No change" after the timeout (at most ${MAX_WAIT_SECONDS}s).`,
      inputSchema: {
        since: z.number().int().min(0),
        timeoutSeconds: z.number().int().min(1).max(MAX_WAIT_SECONDS).default(120),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ since, timeoutSeconds }, extra) => {
      const changed = await ctx.scene.waitForChange(since, timeoutSeconds * 1000, extra.signal);
      return text(changed ? describeCanvas(ctx) : `No change since version ${since}.`);
    },
  );

  server.registerTool(
    'draw',
    {
      description: `Adds shapes to the drawing (up to ${MAX_SHAPES_PER_CALL} per call). Give shapes an id to point arrows at them in the same call; arrows take "from" and "to" ids. Set "source" to where the shape is implemented: {"file", "line"?, "component"?}, with the file relative to the project root. Returns the ids.`,
      inputSchema: { shapes: z.array(shapeInput).min(1).max(MAX_SHAPES_PER_CALL) },
    },
    async ({ shapes }) => {
      try {
        const { ids } = drawResult.parse(
          await run(ctx, { kind: 'draw', shapes }, 'Agent is drawing'),
        );
        return text(`Drew ${ids.join(', ')}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'update',
    {
      description:
        'Moves, resizes, relabels, or recolors existing elements, or sets their "source": {"file", "line"?, "component"?}, or null to clear it.',
      inputSchema: { patches: z.array(elementPatch).min(1).max(MAX_SHAPES_PER_CALL) },
    },
    async ({ patches }) => {
      try {
        const { ids } = drawResult.parse(
          await run(ctx, { kind: 'update', patches }, 'Agent is editing'),
        );
        return text(`Updated ${ids.join(', ')}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'delete',
    {
      description:
        'Removes elements, with their labels and attached arrows. The user can undo it on the canvas.',
      inputSchema: { ids: z.array(z.string().min(1)).min(1).max(MAX_SHAPES_PER_CALL) },
      annotations: { destructiveHint: true },
    },
    async ({ ids }) => {
      try {
        const result = drawResult.parse(
          await run(ctx, { kind: 'delete', ids }, 'Agent is erasing'),
        );
        return text(`Deleted ${result.ids.join(', ')}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'annotate',
    {
      description:
        'Leaves a note for the user next to an element, with an arrow pointing at it: a question, a guess you made, or something you could not build.',
      inputSchema: { id: z.string().min(1), text: z.string().min(1).max(5000) },
    },
    async ({ id, text: note }) => {
      try {
        const { ids } = drawResult.parse(
          await run(ctx, { kind: 'annotate', id, text: note }, 'Agent left a note'),
        );
        return text(`Added note ${ids.join(', ')}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerPrompt(
    'build',
    {
      description:
        'Build the drawing (or the selected part) in the project with the chosen component library.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Build what I drew in drawui. Start with get_project and get_canvas (get_selection if I selected something), read the library docs, and ask me what the drawing leaves open before you write code. Keep my colors, follow the drawing conventions, then draw back what you changed and wait for my next edit.',
          },
        },
      ],
    }),
  );

  return server;
}
