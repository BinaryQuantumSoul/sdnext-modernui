/* Portal loader for moving external UI fragments into the ModernUI shell. */
import { state } from './state';

const failedPortals: Element[] = [];

function rememberFailedPortal(portalElem: Element): void {
  if (!failedPortals.includes(portalElem)) {
    failedPortals.push(portalElem);
  }
}

function movePortal(portalElem: Element, tries: number, index: number, length: number): void {
  const MAX_TRIES = 3;
  const parentSelector = portalElem.getAttribute('data-parent-selector');
  const dataSelector = portalElem.getAttribute('data-selector');
  const dataOptional = portalElem.getAttribute('data-optional');
  const targetElem = document.querySelector(`${parentSelector} ${dataSelector}`);
  if (portalElem && !targetElem && dataSelector?.endsWith('_enqueue')) {
    state.portalTotal += 1;
    (portalElem as HTMLElement).style.display = 'none';
  } else if (portalElem && targetElem) {
    portalElem.append(targetElem);
    state.portalTotal += 1;
    const droppable = portalElem.getAttribute('droppable');
    if (droppable) {
      Array.from(portalElem.children).forEach((child) => {
        if (child !== targetElem) {
          if (targetElem.className.indexOf('gradio-accordion') !== -1) targetElem.children[2].append(child);
          else targetElem.append(child);
        }
      });
    }
    const showButton = portalElem.getAttribute('show-button');
    if (showButton) document.querySelector(showButton)?.classList.remove('hidden');
  } else if (dataOptional === 'true') {
    state.portalTotal += 1;
    rememberFailedPortal(portalElem);
  } else if (tries < MAX_TRIES) {
    log('retryPortal', portalElem, tries);
    const timeout = portalElem.getAttribute('data-timeout');
    const delay = timeout ? parseInt(timeout) : 500;
    setTimeout(() => movePortal(portalElem, tries + 1, index, length), delay);
  } else {
    error('Element not found', { index, parent: parentSelector, id: dataSelector, el: portalElem, tgt: targetElem });
    (portalElem as HTMLElement).style.backgroundColor = 'var(--color-error)';
    state.portalTotal += 1;
    rememberFailedPortal(portalElem);
  }

  if (state.portalTotal === length) state.uiFlagPortalInitialized = true;
}

export async function loadAllPortals(): Promise<void> {
  if (!state.appUiUx) {
    error('loadAllPortals: appUiUx not found');
    return;
  }

  const t0 = performance.now();
  const portals = state.appUiUx.querySelectorAll('.portal');
  portals.forEach((elem, index, array) => movePortal(elem, 1, index, array.length));
  const t1 = performance.now();
  log('loadAllPortals', `time=${Math.round(t1 - t0)} portals=${portals.length}`);
  timer('loadAllPortals', t1 - t0);
}

export function loadRetryPortals(): void {
  log('loadRetryPortals', { portals: failedPortals.length });
  if (failedPortals.length === 0) return;
  const pending = failedPortals.splice(0, failedPortals.length);
  pending.forEach((portalElem) => {
    const parentSelector = portalElem.getAttribute('data-parent-selector');
    const dataSelector = portalElem.getAttribute('data-selector');
    const targetElem = document.querySelector(`${parentSelector} ${dataSelector}`);
    if (portalElem && targetElem) {
      portalElem.append(targetElem);
      const droppable = portalElem.getAttribute('droppable');
      if (droppable) {
        Array.from(portalElem.children).forEach((child) => {
          if (child !== targetElem) {
            if (targetElem.className.indexOf('gradio-accordion') !== -1) targetElem.children[2].append(child);
            else portalElem.append(child);
          }
        });
      }
      const showButton = portalElem.getAttribute('show-button');
      if (showButton) document.querySelector(showButton)?.classList.remove('hidden');
    } else {
      rememberFailedPortal(portalElem);
    }
  });
}
