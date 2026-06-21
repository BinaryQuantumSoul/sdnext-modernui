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

async function audoHideImageControls(): Promise<void> {
  const controls = [
    'control_dynamic_resize',
    'control_before_scale_group',
    'control_before_resize_mask',
  ];
  const el = document.querySelector('#control-template-column-input');
  if (!el) return;
  new MutationObserver(() => {
    const hidden = el.classList.contains('minimize');
    for (const control of controls) {
      const controlEl = document.getElementById(control);
      if (controlEl) {
        if (hidden) controlEl.classList.add('hidden');
        else controlEl.classList.remove('hidden');
      }
    }
  }).observe(el, { childList: false, subtree: false, attributes: true });
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
  audoHideImageControls();
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
