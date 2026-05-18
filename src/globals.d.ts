/* Global declarations for SD.Next runtime context */

declare function gradioApp(): HTMLElement;
declare function log(...args: unknown[]): void;
declare function error(...args: unknown[]): void;
declare function debug(...args: unknown[]): void;
declare function timer(name: string, duration: number): void;
declare function generateForever(id: string): void;
declare function onUiReady(fn: () => Promise<void> | void): void;
declare function authFetch(url: string, options?: RequestInit): Promise<Response>;

interface Window {
  opts: Record<string, unknown>; // SD.Next options object
  api: string;
  subpath: string;
  logger: HTMLElement | null;
  logPrettyPrint?: (...args: unknown[]) => string;
  waitForUiReady: () => Promise<void>;
  getUICurrentTabContent: () => Element | null;
  getSettingsTabs: () => NodeListOf<Element>;
  toggleHide: (name: string) => void;
}
