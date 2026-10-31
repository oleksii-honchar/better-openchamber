/**
 * Shared harness for the composer footer running-elapsed tests.
 *
 * Installs the module stubs the unit runner needs (the real leaf children of
 * ComposerFooter pull the model-control/dictation graphs, which the isolated
 * runner cannot load — same approach as FileAttachment.test.tsx), provides a
 * minimal fake DOM with a tree serializer (the createRoot pattern of
 * components/ui/number-input.test.tsx and
 * components/chat/__tests__/issue-2903-subagent-status-line-only.test.tsx),
 * and exports deterministic fixture renderers.
 *
 * Why mounted renders and not `renderToStaticMarkup`: the live turn-timing
 * store is a client store — React's SERVER path only ever reads a store's
 * initial snapshot, so pre-change goldens AND feature behavior must both be
 * captured through the same mounted path to be comparable.
 *
 * `mock.module` is process-global; consumers of this harness must run as their
 * own unit (`bun test <file>` / one script per process).
 */
import React from 'react';
import { act } from 'react';
import { mock } from 'bun:test';
import { createRoot, type Root } from 'react-dom/client';

import { getSafeStorage } from '@/stores/utils/safeStorage';
import {
  observeSessionActivityTiming,
  resetSessionActivityTiming,
} from '@/sync/session-activity-timing';

const stub = (marker: string) => () => <span data-stub={marker} />;

mock.module('../../ModelControls', () => ({ ModelControls: stub('model-controls') }));
mock.module('./ComposerActionButtons', () => ({
  // The stop/working affordance anchor: the elapsed line belongs to this cluster.
  ComposerActionButtons: (props: { canAbort?: boolean }) => (
    <span data-stub="action-buttons" data-can-abort={String(Boolean(props.canAbort))} />
  ),
}));
mock.module('./ComposerAttachmentControls', () => ({
  ComposerAttachmentControls: stub('attachment-controls'),
}));
mock.module('./FocusModeButton', () => ({ FocusModeButton: stub('focus-mode') }));
mock.module('./PermissionAutoAcceptButton', () => ({
  PermissionAutoAcceptButton: stub('permission-auto-accept'),
}));
mock.module('@/components/chat/SessionGoalButton', () => ({
  SessionGoalButton: stub('session-goal'),
  SessionGoalObjectiveCounter: stub('session-goal-counter'),
}));
mock.module('@/components/dictation/ComposerDictation', () => ({
  ComposerDictation: stub('dictation'),
}));
mock.module('@/components/icon/Icon', () => ({ Icon: () => <i data-stub="icon" /> }));

export const { ComposerFooter } = await import('./ComposerFooter');
export const { I18nProvider } = await import('@/lib/i18n');

export const SESSION_ID = 'ses_elapsed_footer_fixture';
export const ACTION_BUTTONS_ANCHOR = 'data-stub="action-buttons"';

type FooterProps = React.ComponentProps<typeof ComposerFooter>;
type FooterFixtureProps = Omit<FooterProps, 'runningElapsedVisible'> & {
  runningElapsedVisible?: boolean;
};

const noop = () => undefined;

const BASE_PROPS = {
  isMobile: false,
  isVSCode: false,
  sessionId: SESSION_ID,
  directory: '/repo',
  newSessionDraftOpen: false,
  messageLength: 0,
  radius: '14px',
  footerPaddingClass: 'px-2 py-1.5',
  footerGapClass: 'gap-x-2',
  footerIconButtonClass: 'h-7 w-7',
  iconSizeClass: 'h-4 w-4',
  sendIconSizeClass: 'h-4 w-4',
  stopIconSizeClass: 'h-4 w-4',
  canSend: false,
  canAbort: true,
  hasContent: false,
  isExpandedInput: false,
  permissionAutoAcceptEnabled: false,
  isPermissionAutoAcceptInteractive: false,
  dictationActive: false,
  onOpenSettings: noop,
  onPickLocalFiles: noop,
  onOpenIssuePicker: noop,
  onOpenPrPicker: noop,
  onOpenAttachSheet: noop,
  onToggleExpandedInput: noop,
  onTogglePermissionAutoAccept: noop,
  onPrimaryAction: noop,
  onQueueMessage: noop,
  onAbort: noop,
  onStartDictation: noop,
  onDictationInsert: noop,
  onDictationInsertAndSend: noop,
  onDictationContentHeightChange: noop,
} satisfies FooterFixtureProps;

export const footerElement = (overrides: Partial<FooterFixtureProps> = {}): React.ReactElement => (
  <I18nProvider>
    <ComposerFooter {...(BASE_PROPS as FooterProps)} {...(overrides as Partial<FooterProps>)} />
  </I18nProvider>
);

// ---------------------------------------------------------------------------
// Minimal fake DOM (pattern: components/ui/number-input.test.tsx) with an
// attribute-recording node model and a deterministic tree serializer.
// ---------------------------------------------------------------------------

interface FakeNode {
  nodeType: number;
  nodeName: string;
  tagName: string;
  ownerDocument: FakeDocument;
  parentNode: FakeNode | null;
  childNodes: FakeNode[];
  style: Record<string, unknown>;
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  appendChild(c: FakeNode): FakeNode;
  insertBefore(c: FakeNode, ref: FakeNode | null): FakeNode;
  removeChild(c: FakeNode): FakeNode;
  addEventListener(): void;
  removeEventListener(): void;
  textContent: string;
  [key: string]: unknown;
}

interface FakeDocument {
  nodeType: number;
  defaultView: unknown;
  body: FakeNode;
  documentElement: FakeNode;
  activeElement: FakeNode | null;
  createTextNode(text: string): FakeNode;
  createElement(tag: string): FakeNode;
  createElementNS(ns: string, tag: string): FakeNode;
  [key: string]: unknown;
}

const makeNode = (tag: string, owner: FakeDocument): FakeNode => {
  const node: FakeNode = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    ownerDocument: owner,
    parentNode: null,
    childNodes: [],
    style: {
      setProperty() { /* noop */ },
      getPropertyValue() { return ''; },
    },
    attributes: {},
    setAttribute(name: string, value: string) {
      (this as FakeNode).attributes[name] = String(value);
    },
    removeAttribute(name: string) {
      delete (this as FakeNode).attributes[name];
    },
    getAttribute(name: string) {
      return (this as FakeNode).attributes[name] ?? null;
    },
    hasAttribute(name: string) {
      return name in (this as FakeNode).attributes;
    },
    appendChild(c: FakeNode) {
      (this as FakeNode).childNodes.push(c);
      c.parentNode = this as FakeNode;
      return c;
    },
    insertBefore(c: FakeNode, ref: FakeNode | null) {
      const parent = this as FakeNode;
      const i = ref === null ? parent.childNodes.length : parent.childNodes.indexOf(ref);
      if (i < 0) parent.childNodes.push(c);
      else parent.childNodes.splice(i, 0, c);
      c.parentNode = parent;
      return c;
    },
    removeChild(c: FakeNode) {
      const parent = this as FakeNode;
      const i = parent.childNodes.indexOf(c);
      if (i >= 0) parent.childNodes.splice(i, 1);
      c.parentNode = null;
      return c;
    },
    addEventListener() { /* noop */ },
    removeEventListener() { /* noop */ },
    textContent: '',
  };
  return node;
};

const installDomStub = (): { container: FakeNode; restore: () => void } => {
  const documentStub = {
    nodeType: 9,
    nodeName: '#document',
    childNodes: [],
    activeElement: null,
    addEventListener() { /* noop */ },
    removeEventListener() { /* noop */ },
    createTextNode(text: string) {
      return {
        nodeType: 3,
        nodeName: '#text',
        TEXT_NODE: 3,
        textContent: text,
        parentNode: null,
        childNodes: [],
      } as unknown as FakeNode;
    },
    HTMLIFrameElement: class {},
    HTMLFrameSetElement: class {},
    HTMLInputElement: class { setSelectionRange() { /* noop */ } },
    HTMLTextAreaElement: class { setSelectionRange() { /* noop */ } },
    HTMLSelectElement: class {},
    HTMLOptionElement: class {},
    HTMLAnchorElement: class {},
  } as unknown as FakeDocument;
  documentStub.createElement = (tag: string) => makeNode(tag, documentStub);
  documentStub.createElementNS = (_ns: string, tag: string) => makeNode(tag, documentStub);
  documentStub.defaultView = {
    document: documentStub,
    navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0 },
    matchMedia: () => ({ matches: false, addEventListener() { /* noop */ }, removeEventListener() { /* noop */ } }),
    addEventListener() { /* noop */ },
    removeEventListener() { /* noop */ },
    // The duration ticker schedules through window.setInterval.
    setInterval: (callback: () => void, ms: number) => setInterval(callback, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
    HTMLIFrameElement: class {},
    HTMLFrameSetElement: class {},
    HTMLInputElement: class { setSelectionRange() { /* noop */ } },
    HTMLTextAreaElement: class { setSelectionRange() { /* noop */ } },
    HTMLSelectElement: class {},
    HTMLOptionElement: class {},
    HTMLAnchorElement: class {},
  };
  documentStub.body = makeNode('body', documentStub);
  documentStub.documentElement = makeNode('html', documentStub);

  const g = globalAsGlobalThis();
  const previous = {
    document: g.document,
    window: g.window,
    navigator: g.navigator,
    IS_REACT_ACT_ENVIRONMENT: g.IS_REACT_ACT_ENVIRONMENT,
  };
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.document = documentStub as unknown as Document;
  g.window = documentStub.defaultView as unknown as Window & typeof globalThis;
  g.navigator = (documentStub.defaultView as { navigator: Navigator }).navigator;
  g.requestAnimationFrame ??= (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number;

  const container = makeNode('div', documentStub);
  documentStub.body.appendChild(container);

  return {
    container,
    restore: () => {
      g.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
      g.document = previous.document;
      g.window = previous.window;
      g.navigator = previous.navigator;
    },
  };
};

const globalAsGlobalThis = (): {
  document: unknown;
  window: unknown;
  navigator: unknown;
  IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
} => globalThis as never;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input']);

const serialize = (node: FakeNode): string => {
  if (node.nodeType === 3) return String(node.textContent ?? '');
  const tag = node.nodeName.toLowerCase();
  const attrs = Object.entries(node.attributes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ` ${name}=${JSON.stringify(String(value))}`)
    .join('');
  const childNodes = node.childNodes ?? [];
  // React writes a single static text child via `textContent =` (no #text
  // node), so an element with no child nodes must surface its textContent.
  const inner = childNodes.length > 0
    ? childNodes.map(serialize).join('')
    : String(node.textContent ?? '');
  if (VOID_TAGS.has(tag) && inner === '') return `<${tag}${attrs}/>`;
  return `<${tag}${attrs}>${inner}</${tag}>`;
};

export type MountedFixture = {
  html: string;
  rerender: (element: React.ReactElement) => Promise<void>;
  cleanup: () => Promise<void>;
};

/** Mount at fixture-time `now`, serialize the committed tree, keep it mounted. */
export const mountFixture = async (element: React.ReactElement): Promise<MountedFixture> => {
  const dom = installDomStub();
  const root: Root = createRoot(dom.container as unknown as Element);
  await act(async () => {
    root.render(element);
  });
  return {
    get html() {
      return serialize(dom.container);
    },
    rerender: async (next: React.ReactElement) => {
      await act(async () => {
        root.render(next);
      });
    },
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      dom.restore();
    },
  };
};

/** One-shot mount + serialize + unmount (renders the clock value at `now`). */
export const renderMounted = async (element: React.ReactElement): Promise<string> => {
  const fixture = await mountFixture(element);
  const { html } = fixture;
  await fixture.cleanup();
  return html;
};

export const renderFooter = async (overrides: Partial<FooterFixtureProps> = {}): Promise<string> =>
  renderMounted(footerElement(overrides));

// ---------------------------------------------------------------------------
// Fixture clock and store seeding — shared so the golden capture and the tests
// describe identical state. Same Date.now idiom as session-activity-timing.
// ---------------------------------------------------------------------------

const realNow = Date.now.bind(Date);
const STORAGE_KEY = 'oc.session-activity.v1';

let nowMs = 0;

/** Install the fixture clock at `t0` and reset the timing store to empty. */
export const startFixtureClock = (t0: number): void => {
  nowMs = t0;
  Date.now = () => nowMs;
  getSafeStorage().removeItem(STORAGE_KEY);
  resetSessionActivityTiming();
};

export const stopFixtureClock = (): void => {
  Date.now = realNow;
  getSafeStorage().removeItem(STORAGE_KEY);
  resetSessionActivityTiming();
};

export const nowOffset = (t0: number, ms: number): void => {
  nowMs = t0 + ms;
};

/** A turn this client watched begin (event path = known provenance). */
export const seedObservedRunningTurn = (): void => {
  observeSessionActivityTiming(SESSION_ID, 'active');
};

export const resolveSessionActivity = (
  phase: 'active' | 'settled',
  sessionId: string = SESSION_ID,
): void => {
  observeSessionActivityTiming(sessionId, phase);
};
