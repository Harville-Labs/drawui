#!/usr/bin/env bun
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_CANVAS_DIR, serve } from './http.ts';
import { Hub } from './hub.ts';
import { openBrowser } from './open.ts';
import { CONFIG_FILE, ProjectStore, SCENE_FILE } from './project.ts';
import { diskFile, SceneStore } from './store.ts';

const USAGE = `Usage: drawui [project-dir] [--port 4747] [--no-open]

Starts the drawui canvas for a project (the current directory by default).
The drawing is saved to ${SCENE_FILE} and settings to ${CONFIG_FILE} in that directory.`;

function fail(message: string): never {
  console.error(`drawui: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  let args: ReturnType<typeof parse>;
  try {
    args = parse();
  } catch (error) {
    fail(`${error instanceof Error ? error.message : error}\n\n${USAGE}`);
  }
  if (args.values.help) {
    console.log(USAGE);
    return;
  }
  const port = Number(args.values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    fail(`--port must be a number from 1 to 65535, not "${args.values.port}".`);
  if (args.positionals.length > 1)
    fail(`expected one project directory, got ${args.positionals.length}.\n\n${USAGE}`);

  const root = resolve(args.positionals[0] ?? '.');
  const info = await stat(root).catch(() => undefined);
  if (!info?.isDirectory()) fail(`${root} is not a directory.`);

  const scenePath = join(root, SCENE_FILE);
  const url = `http://localhost:${port}`;
  let scene: SceneStore;
  let project: ProjectStore;
  try {
    scene = await SceneStore.open(diskFile(scenePath));
    project = await ProjectStore.open(diskFile(join(root, CONFIG_FILE)));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  try {
    serve(
      { root, scenePath, canvasUrl: url, scene, project, hub: new Hub(url) },
      { port, canvasDir: DEFAULT_CANVAS_DIR },
    );
  } catch (error) {
    fail(
      `couldn't listen on port ${port} (${error instanceof Error ? error.message : error}). Pass --port to use another.`,
    );
  }

  console.log(`drawui is running for ${root}

  Canvas:  ${url}
  MCP:     ${url}/mcp

Connect Claude Code:
  claude mcp add --transport http drawui ${url}/mcp
`);
  if (!args.values['no-open']) openBrowser(url);

  const stop = async () => {
    await scene.flush();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

function parse() {
  return parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p', default: '4747' },
      'no-open': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
}

await main();
