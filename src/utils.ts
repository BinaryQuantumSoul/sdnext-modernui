/* Shared localStorage persistence helpers */

export const setStored = (key: string, val: unknown): void => {
  if (!window.opts.uiux_persist_layout) return;
  try {
    localStorage.setItem(`ui-${key}`, JSON.stringify(val));
  } catch { /* unsupported on mobile */ }
};

export const getStored = (key: string): unknown => {
  if (!window.opts.uiux_persist_layout) return undefined;
  let val: unknown;
  try {
    val = JSON.parse(localStorage.getItem(`ui-${key}`) ?? 'null');
  } catch { /* unsupported on mobile */ }
  return val;
};

export function functionWaitForFlag(checkFlag: () => boolean): () => Promise<void> {
  return async () => new Promise((resolve) => {
    const check = () => (checkFlag() ? resolve() : setTimeout(check, 50));
    check();
  });
}
