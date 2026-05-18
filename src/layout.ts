/* Mobile/desktop layout switching, auto-hide behavior, and animation event handling. */
import { state } from './state';
import { getStored, setStored } from './utils';

const isMobile = (): boolean => window.innerWidth < window.innerHeight;

export function trackAsideFocus(): void {
  if (!state.appUiUx) return;
  const aside = state.appUiUx.querySelector('#aside-panel');
  if (!aside) return;
  aside.addEventListener('focusin', () => { state.asideFocusTracker += 1; });
  aside.addEventListener('focusout', () => {
    setTimeout(() => { state.asideFocusTracker -= 1; }, 200);
  });
}

export function applyDefaultLayout(mobile: boolean): void {
  if (!state.appUiUx) return;

  const appUiUx = state.appUiUx;

  appUiUx.querySelectorAll('[mobile]').forEach((tabItem) => {
    if (mobile) {
      if (tabItem.childElementCount === 0) {
        const mobileTarget = appUiUx.querySelector(tabItem.getAttribute('mobile') ?? '');
        if (mobileTarget) {
          const targetParentId = mobileTarget.parentElement?.id;
          if (targetParentId) tabItem.setAttribute('mobile-restore', `#${targetParentId}`);
          tabItem.append(mobileTarget);
        }
      }
    } else if (tabItem.childElementCount > 0) {
      const mobileRestoreTarget = appUiUx.querySelector(tabItem.getAttribute('mobile-restore') ?? '');
      if (mobileRestoreTarget) {
        tabItem.removeAttribute('mobile-restore');
        mobileRestoreTarget.append(tabItem.firstElementChild!);
      }
    }
  });

  if (mobile) {
    appUiUx.querySelector<HTMLElement>('.accordion-vertical.expand #mask-icon-acc-arrow')?.dispatchEvent(new MouseEvent('click'));
    const accArrow = appUiUx.querySelector<HTMLElement>('.accordion-vertical.expand #mask-icon-acc-arrow');
    accArrow?.click();
    if (!appUiUx.querySelector('.accordion-vertical.expand #mask-icon-acc-arrow-control')) {
      appUiUx.querySelector<HTMLElement>('.accordion-vertical #mask-icon-acc-arrow-control')?.click();
    }
    if (state.asideFocusTracker === 0) {
      if (appUiUx.querySelector('#accordion-aside')?.classList.contains('expand')) {
        appUiUx.querySelector<HTMLElement>('#acc-arrow-button')?.click();
      }
    }
    appUiUx.classList.add('media-mobile');
    appUiUx.classList.remove('media-desktop');
  } else {
    appUiUx.classList.add('media-desktop');
    appUiUx.classList.remove('media-mobile');
  }
}

export function switchMobile(): void {
  const optslayout = window.opts.uiux_default_layout as string;
  if (optslayout === 'Auto') {
    window.addEventListener('resize', () => applyDefaultLayout(isMobile()));
    applyDefaultLayout(isMobile());
  } else if (optslayout === 'Mobile') {
    applyDefaultLayout(true);
  } else if (optslayout === 'Desktop') {
    applyDefaultLayout(false);
  }
}

export async function applyAutoHide(): Promise<void> {
  if (!state.appUiUx) return;

  const hideSiblings = (elem: Element | null): void => {
    if (!elem || elem.nodeName !== 'DIV') return;
    elem.classList.toggle('hidden-animate');
    hideSiblings(elem.nextElementSibling);
  };

  state.appUiUx.querySelectorAll('h2').forEach((elem) => elem.classList.add('auto-hide'));
  state.appUiUx.querySelectorAll('.auto-hide').forEach((elem) => {
    const id = elem.id || (elem as HTMLElement).innerText;
    (elem as HTMLElement).onclick = (evt: MouseEvent) => {
      elem.classList.toggle('minimize');
      setStored(`hide_${id}`, elem.classList.contains('minimize'));
      for (const child of (evt.target as Element).children) child.classList.toggle('hidden-animate');
      hideSiblings((evt.target as Element)?.nextElementSibling);
      log('autoHide', { id, hide: elem.classList.contains('minimize') });
    };
    if (getStored(`hide_${id}`)) {
      (elem as HTMLElement).click();
    }
  });

  const minimizeToggle = (el: Element, evt: MouseEvent): void => {
    if (evt.target === el
      || evt.target === el.firstElementChild
      || (evt.target as Element).parentElement === el.firstElementChild
      || (el.firstElementChild?.contains(evt.target as Node) && (evt.target as Element).nodeName === 'H2')
    ) {
      const id = el.id || (el as HTMLElement).innerText;
      el.classList.toggle('minimize');
      setStored(`hide_${id}`, el.classList.contains('minimize'));
      log('autoHide', { id, hide: el.classList.contains('minimize') });
      evt.stopPropagation();
      evt.stopImmediatePropagation();
    }
  };

  const panels = [
    document.querySelector('#control-template-column-input'),
    document.querySelector('#control-template-column-output'),
    document.querySelector('#img2img-template-column-input'),
    document.querySelector('#img2img-template-column-output'),
  ];
  panels.forEach((panel) => {
    if (panel) {
      const id = panel.id || (panel as HTMLElement).innerText;
      panel.addEventListener('click', (evt) => minimizeToggle(panel, evt as MouseEvent));
      if (getStored(`hide_${id}`)) (panel as HTMLElement).click();
    }
  });
}

export function setupAnimationEventListeners(): void {
  document.addEventListener('animationstart', (e: AnimationEvent) => {
    if (e.animationName === 'fade-in') {
      (e.target as Element).classList.remove('hidden');
    }
  });
  document.addEventListener('animationend', (e: AnimationEvent) => {
    if (e.animationName === 'fade-out') {
      (e.target as Element).classList.add('hidden');
    }
  });
}

export async function extraTweaks(): Promise<void> {
  const t0 = performance.now();
  (document.querySelectorAll('#system .tab-nav button')[1] as HTMLElement | undefined)?.click();
  const controlColumns = document.getElementById('control-columns');
  if (!controlColumns) return;
  const controlColumnsElement = controlColumns;

  const anyControlColumns = controlColumnsElement as unknown as { prevWidth?: number; resizeObserver?: ResizeObserver };

  async function adjustFlexDirection(evt: ResizeObserverEntry[]): Promise<void> {
    const w = Math.floor((evt[0]?.contentRect.width ?? 0) / 8);
    if (w === anyControlColumns.prevWidth) return;
    anyControlColumns.prevWidth = w;
    const firstElementChild = controlColumnsElement.firstElementChild;
    if (!firstElementChild) return;
    const childCount = controlColumnsElement.childElementCount;
    const firstChildMinWidth = parseFloat(getComputedStyle(firstElementChild).minWidth);
    const gapWidth = parseFloat(getComputedStyle(controlColumnsElement).gap);
    const minWidth = childCount * firstChildMinWidth + (childCount - 1) * gapWidth;
    const currentWidth = controlColumnsElement.clientWidth;

    if (currentWidth < minWidth && !controlColumnsElement.classList.contains('flex-force-column')) {
      controlColumnsElement.classList.add('flex-force-column');
      controlColumnsElement.classList.remove('flex-force-row');
    } else if (currentWidth >= minWidth && controlColumnsElement.classList.contains('flex-force-column')) {
      controlColumnsElement.classList.remove('flex-force-column');
      controlColumnsElement.classList.add('flex-force-row');
    }
  }

  async function toggleControlOrientation(forceRow = false, disconnectObserver = false): Promise<void> {
    if (forceRow) {
      document.documentElement.style.setProperty('--sd-panel-min-width', '512px');
      controlColumnsElement.classList.add('flex-force-column');
      controlColumnsElement.classList.remove('flex-force-row');
    } else if (controlColumnsElement.classList.contains('flex-force-column')) {
      document.documentElement.style.setProperty('--sd-panel-min-width', '128px');
      controlColumnsElement.classList.remove('flex-force-column');
      controlColumnsElement.classList.add('flex-force-row');
    } else {
      document.documentElement.style.setProperty('--sd-panel-min-width', '512px');
      controlColumnsElement.classList.add('flex-force-column');
      controlColumnsElement.classList.remove('flex-force-row');
    }
    if (disconnectObserver && anyControlColumns.resizeObserver) {
      anyControlColumns.resizeObserver.disconnect();
      delete anyControlColumns.resizeObserver;
    }
  }

  anyControlColumns.resizeObserver = new ResizeObserver(adjustFlexDirection);
  anyControlColumns.resizeObserver.observe(controlColumnsElement);
  const controlOrientationBtn = document.getElementById('control_panel_orientation');
  controlOrientationBtn?.addEventListener('click', () => toggleControlOrientation(false, true));

  setTimeout(() => {
    const panelInput = document.getElementById('control-template-column-input');
    const panelOutput = document.getElementById('control-template-column-output');
    const forceRow = panelInput?.classList.contains('minimize') || panelOutput?.classList.contains('minimize');
    toggleControlOrientation(forceRow, false);
  }, 10);

  ['txt2img', 'img2img', 'control', 'video'].forEach((key) => {
    const buttonNav = document.getElementById(`${key}_nav`);
    const buttonEN = document.getElementById(`btn-en-layout-${key}`);
    buttonNav?.addEventListener('click', () => buttonEN?.click());
  });

  const logoNav = document.getElementById('logo_nav');
  const txt2imgNav = document.getElementById('txt2img_nav');
  const img2imgNav = document.getElementById('img2img_nav');
  const controlNav = document.getElementById('control_nav');
  const videoNav = document.getElementById('video_nav');

  logoNav?.addEventListener('click', () => controlNav?.click());
  const buttonCurrent = document.getElementById((getStored('tab-main_group-current') as string) ?? '') || logoNav;
  buttonCurrent?.click();

  const handleTabChange = (evt: Event): void => {
    const tabname = (evt.target as HTMLElement).id.split('_')[0];
    for (const tab of ['txt2img', 'img2img', 'control', 'video']) {
      const el = document.getElementById(`tab_${tab}`);
      if (el) el.style.display = tabname === tab ? 'block' : 'none';
    }
  };

  txt2imgNav?.addEventListener('click', handleTabChange);
  img2imgNav?.addEventListener('click', handleTabChange);
  controlNav?.addEventListener('click', handleTabChange);
  videoNav?.addEventListener('click', handleTabChange);

  const serverLog = document.getElementById('logMonitorData');
  const btnWrap = document.getElementById('btn_console_log_server_wrap');
  if (btnWrap) {
    btnWrap.onclick = () => {
      if (serverLog) serverLog.style.whiteSpace = serverLog.style.whiteSpace === 'nowrap' ? 'break-spaces' : 'nowrap';
    };
  }
  const clientLog = document.getElementById('logMonitorJS');
  const btnClientWrap = document.getElementById('btn_console_log_client_wrap');
  if (btnClientWrap) {
    btnClientWrap.onclick = () => {
      if (clientLog) clientLog.classList.toggle('wrap-div');
    };
  }

  const uiDisabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled as string[] : [];
  if (uiDisabled?.includes('logs')) {
    if (serverLog) serverLog.style.display = 'none';
    if (clientLog) clientLog.style.display = 'none';
  }

  document.querySelectorAll('input[type="text"], textarea').forEach((elem) => { (elem as HTMLElement).setAttribute('spellcheck', 'false'); });
  const t1 = performance.now();
  log('extraTweaks', Math.round(t1 - t0));
  timer('extraTweaks', t1 - t0);
}
