import { join } from 'node:path';
import {
  applyProjectPatch,
  detectStack,
  type ProjectConfig,
  type ProjectPatch,
  projectConfig,
  type Stack,
} from '@drawui/core';
import type { TextFile } from './store.ts';

export const CONFIG_FILE = 'drawui.json';
export const SCENE_FILE = 'drawui.excalidraw';

/** The project's `drawui.json`: which component library to build with and where the live site runs. */
export class ProjectStore {
  private constructor(
    private readonly file: TextFile,
    private config: ProjectConfig,
  ) {}

  static async open(file: TextFile): Promise<ProjectStore> {
    const text = await file.read();
    if (text === undefined) return new ProjectStore(file, {});
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (cause) {
      throw new Error(`${file.path} is not valid JSON.`, { cause });
    }
    const parsed = projectConfig.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(
        `${file.path}: ${issue?.path.join('.') || 'config'} ${issue?.message ?? 'is invalid'}. It takes "library" and "preview".`,
      );
    }
    return new ProjectStore(file, parsed.data);
  }

  get current(): ProjectConfig {
    return this.config;
  }

  async update(patch: ProjectPatch): Promise<ProjectConfig> {
    this.config = applyProjectPatch(this.config, patch);
    await this.file.write(`${JSON.stringify(this.config, null, 2)}\n`);
    return this.config;
  }
}

/** Reads package.json and components.json from the project root. A missing or broken package.json is a blank project. */
export async function readStack(root: string): Promise<Stack> {
  const pkg = Bun.file(join(root, 'package.json'));
  let json: unknown;
  if (await pkg.exists()) {
    try {
      json = await pkg.json();
    } catch {
      // A package.json that doesn't parse tells us nothing about the stack; the agent will see it anyway.
      json = undefined;
    }
  }
  return detectStack(json, await Bun.file(join(root, 'components.json')).exists());
}
