/**
 * Mechanical containment check for the A-v9.1 D-5 mount gate: exactly the
 * MainLayout and VSCodeLayout ChatView mounts may enable `runningElapsedVisible`
 * (two occurrences in MainLayout, three in VSCodeLayout). Every other root that
 * reaches ChatView/ChatContainer — App.tsx embedded panels, MobileApp,
 * MiniChatLayout, AgentGroupDetail — must not mention the prop at all, and the
 * component chain must keep the default OFF.
 *
 * Reading sources of the named mount files is an established pattern here
 * (see components/chat/__tests__/issue-2903-subagent-status-line-only.test.tsx).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const uiSrc = join(here, '..', '..', '..', '..');

const read = (relativeFromUiSrc: string): string =>
  readFileSync(join(uiSrc, relativeFromUiSrc), 'utf-8');

const countMatches = (source: string, pattern: RegExp): number =>
  (source.match(pattern) ?? []).length;

const PROP_MENTIONS = /runningElapsedVisible/g;

const sourceOf = (relative: string, expected: number): Array<{ file: string; count: number }> => {
  const count = countMatches(read(relative), PROP_MENTIONS);
  return count === expected ? [] : [{ file: relative, count }];
};

/** Returns [] when containment holds; otherwise one entry per violation. */
export const runningElapsedMountViolations = (): string[] => {
  const violations: string[] = [];

  // The two named roots: JSX-prop occurrences, exactly at ChatView mounts.
  const mainLayout = read('components/layout/MainLayout.tsx');
  const vsCodeLayout = read('components/layout/VSCodeLayout.tsx');
  const mainProps = countMatches(mainLayout, /<ChatView\b[^>]*runningElapsedVisible\b/g);
  const vsCodeProps = countMatches(vsCodeLayout, /<ChatView\b[^>]*runningElapsedVisible\b/g);
  if (mainProps !== 2) violations.push(`MainLayout ChatView mounts with the prop: ${mainProps} (expected 2)`);
  if (countMatches(mainLayout, PROP_MENTIONS) !== mainProps) {
    violations.push('MainLayout mentions runningElapsedVisible outside ChatView mounts');
  }
  if (vsCodeProps !== 3) violations.push(`VSCodeLayout ChatView mounts with the prop: ${vsCodeProps} (expected 3)`);
  if (countMatches(vsCodeLayout, PROP_MENTIONS) !== vsCodeProps) {
    violations.push('VSCodeLayout mentions runningElapsedVisible outside ChatView mounts');
  }

  // Surfaces that must keep the default (zero mentions anywhere in the file).
  for (const surface of [
    'App.tsx',
    'apps/MobileApp.tsx',
    'apps/renderElectronMiniChatApp.tsx',
    'components/mini-chat/MiniChatLayout.tsx',
    'components/views/agent-manager/AgentGroupDetail.tsx',
  ]) {
    violations.push(...sourceOf(surface, 0).map((v) => `${v.file} mentions the prop ${v.count}× (expected 0)`));
  }

  // The threading chain wires the prop but defaults it OFF.
  const chainDefaults = [
    'components/views/ChatView.tsx',
    'components/chat/ChatContainer.tsx',
    'components/chat/ChatInput.tsx',
    'components/chat/composer/ui/ComposerFooter.tsx',
  ];
  for (const file of chainDefaults) {
    const source = read(file);
    if (countMatches(source, /runningElapsedVisible\s*=\s*false/g) === 0) {
      violations.push(`${file} does not default runningElapsedVisible to false`);
    }
  }

  // Cross-workspace consumers must not have adopted the prop (the extension
  // only repackages the shared UI; zero edits in packages/web | vscode).
  const packagesRoot = join(uiSrc, '..', '..');
  for (const pkg of ['web/src', 'vscode/src', 'vscode/webview', 'mobile/src', 'electron']) {
    const root = join(packagesRoot, pkg);
    let dir: string;
    try {
      dir = root;
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of walkTs(dir)) {
      const source = readFileSync(file, 'utf-8');
      if (source.includes('runningElapsedVisible')) {
        violations.push(`${file.slice(packagesRoot.length + 1)} mentions runningElapsedVisible`);
      }
    }
  }

  return violations;
};

function* walkTs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTs(full);
    } else if (/\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}
