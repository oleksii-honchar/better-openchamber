import type { DesktopBootOutcome } from '@/lib/desktopBoot';

declare global {
  interface Window {
    __OPENCHAMBER_HOME__?: string;
    __OPENCHAMBER_MACOS_MAJOR__?: number;
    __OPENCHAMBER_LOCAL_ORIGIN__?: string;
    __OPENCHAMBER_ELECTRON__?: { runtime?: string; macVibrancy?: boolean; macVibrancySupported?: boolean };
    __OPENCHAMBER_PLATFORM__?: string;
    __OPENCHAMBER_DESKTOP_BOOT_OUTCOME__?: DesktopBootOutcome;
    __VSCODE_CONFIG__?: {
      workspaceFolder?: string;
      workspaceFolders?: string[];
      theme?: string;
      connectionStatus?: string;
      cliAvailable?: boolean;
      extensionVersion?: string;
      platform?: string;
      arch?: string;
      panelType?: string;
      viewMode?: string;
      initialSessionId?: string | null;
    };
  }

  interface WebviewElement extends HTMLElement {
    loadURL(url: string): void;
    goBack(): void;
    goForward(): void;
    reload(): void;
    getURL(): string;
    getTitle(): string;
    isLoading(): boolean;
    getWebContentsId(): number;
    executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<WebviewElement> & {
          src?: string;
          partition?: string;
          preload?: string;
          nodeintegration?: string;
          allowpopups?: string;
          ref?: React.Ref<WebviewElement>;
        },
        WebviewElement
      >;
    }
  }
}

export {};
