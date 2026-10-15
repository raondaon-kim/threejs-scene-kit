import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KIT_DIR = join(PLUGIN_ROOT, 'kit');
export const TEMPLATE_DIR = join(PLUGIN_ROOT, 'template');

export function pluginVersion() {
  return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
}
