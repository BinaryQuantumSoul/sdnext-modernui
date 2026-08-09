/* Global declarations for SD.Next runtime context */

declare function gradioApp(): HTMLElement;
declare function log(...args: unknown[]): void;
declare function error(...args: unknown[]): void;
declare function debug(...args: unknown[]): void;
declare function timer(name: string, duration: number): void;
declare function onUiReady(fn: () => Promise<void> | void): void;
declare function authFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response | undefined>;
declare function generateForever(id: string): void;
declare function getSelectedNetworks(): Record<string, unknown> | null;

interface Window {
  opts: Record<string, unknown>; // options object
  api: string; // base api path
  subpath: string; // base api subpath
  logger: HTMLElement | null; // global logger element
  authFetch: (url: RequestInfo | URL, options?: RequestInit) => Promise<Response | undefined>;
  logPrettyPrint?: (...args: unknown[]) => string;
  waitForUiReady: () => Promise<void>;
  toggleHide: (name: string) => void;
  getUICurrentTabContent: () => Element | null;
  getSettingsTabs: () => NodeListOf<Element>;
  getServerInfo: () => Promise<void>;
  getSelectedNetworks: () => Record<string, unknown> | null;
}
