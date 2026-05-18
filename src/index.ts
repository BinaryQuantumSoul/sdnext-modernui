// Original credits: <https://github.com/anapnoe/stable-diffusion-webui-ux/blob/8307896c59032a9cdac1ab24c975102ff9a674d3/extensions-builtin/anapnoe-sd-uiux/javascript/anapnoe_sd_uiux_core.js>

/* ModernUI entrypoint: orchestrates initialization and window compatibility hooks. */

import {
  initSplitComponents,
  restoreAccordionState,
  initAccordionComponents,
  initTabComponents,
  initButtonComponents,
  setupToolButtons,
  setupDropdowns,
  createButtonsForExtensions,
} from './components';
import { setupGenerateObservers, setupControlDynamicObservers } from './observers';
import { setUserColors } from './color-hue';
import { showContributors } from './contributors';
import { initServerInfo } from './server-info';
import { state } from './state';
import { setupLogger, largeErrorOverlay } from './logger';
import { loadAllTemplates } from './templates';
import { loadAllPortals, loadRetryPortals } from './portals';
import { removeStyleAssets } from './styles';
import { uiuxOptionSettings } from './options';
import { setupAnimationEventListeners, trackAsideFocus, switchMobile, applyAutoHide, extraTweaks } from './layout';
import { functionWaitForFlag } from './utils';

const htmlPath = '/file=extensions-builtin/sdnext-modernui/html';
const rootTemplate = 'template-app-root';
const tabId = '#tab_sdnext_uiux_core';

// Window compatibility hooks
window.getUICurrentTabContent = () => gradioApp().querySelector('.xtabs-item:not(.hidden) > .split');
window.getSettingsTabs = () => gradioApp().querySelectorAll('#layout-settings .tabitem');

window.waitForUiReady = functionWaitForFlag(() => state.uiFlagInitialized);
const waitForUiPortal = functionWaitForFlag(() => state.uiFlagPortalInitialized);

async function mainUiUx(): Promise<void> {
  try {
    const t0 = performance.now();
    log('initModernUi');
    log('userAgent', navigator?.userAgent);
    await removeStyleAssets();
    await setupLogger();
    await loadAllTemplates(htmlPath, rootTemplate, tabId);
    createButtonsForExtensions();
    setupAnimationEventListeners();
    initSplitComponents();
    await loadAllPortals();
    initTabComponents();
    initButtonComponents();
    setupToolButtons();
    setupDropdowns();
    initAccordionComponents();

    const t1 = performance.now();
    await waitForUiPortal();
    const t2 = performance.now();
    log('waitForUiPortal', Math.round(t2 - t1));

    setupGenerateObservers();
    setupControlDynamicObservers();
    uiuxOptionSettings();
    setUserColors();
    showContributors();
    switchMobile();
    restoreAccordionState();
    trackAsideFocus();
    applyAutoHide();
    extraTweaks();
    initServerInfo();

    loadRetryPortals(); // some elements may be late so retrying

    state.uiFlagInitialized = true;
    const t3 = performance.now();
    log('mainUiUx', { total: Math.round(t3 - t0), load: Math.round(t1 - t0), portal: Math.round(t2 - t1), post: Math.round(t3 - t2) });
    timer('waitForUiPortal:total', t3 - t0);
    timer('waitForUiPortal:load', t1 - t0);
    timer('waitForUiPortal:portal', t2 - t1);
    timer('waitForUiPortal:post', t3 - t2);
  } catch (err) {
    const msg = 'An error occurred during ModernUI initialization';
    try {
      error(msg, err);
    } catch {
      console.error(msg, err);
    }
    largeErrorOverlay(msg, err as Error);
  }
}

onUiReady(mainUiUx);
