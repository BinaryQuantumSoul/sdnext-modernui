/* Split/tab/button UI component initialization and split pane state handling. */
import Split from './vendor/split.js';
import type { SplitInstance } from './vendor/split.js';
import { state } from './state';
import { getStored, setStored } from './utils';

const splitInstances: Record<string, SplitInstance> = {};

export function initSplitComponents(): void {
  const appUiUx = state.appUiUx;
  if (!appUiUx) return;
  appUiUx.querySelectorAll('div.split').forEach((elem) => {
    const id = elem.id;
    const nid = appUiUx.querySelector(`#${id}`);
    const direction = nid?.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
    const gutterSize = nid?.getAttribute('gutterSize') || '8';
    const ids: string[] = [];
    const initSizes: number[] = [];
    const minSizes: number[] = [];
    const maxSizes: number[] = [];
    const containers = appUiUx.querySelectorAll(`#${id} > div.split-container`);
    containers.forEach((c, index) => {
      const initSize = c.getAttribute('data-initSize');
      const minSize = c.getAttribute('data-minSize');
      const maxSize = c.getAttribute('data-maxSize');
      ids.push(`#${c.id}`);
      try {
        const storedSize = getStored(`${id}-sizes`);
        if (storedSize && Array.isArray(storedSize) && storedSize.every((n) => typeof n === 'number') && storedSize.length === containers.length) {
          initSizes.push(storedSize[index]);
        } else {
          initSizes.push(initSize ? parseInt(initSize) : 100 / containers.length);
        }
      } catch {
        initSizes.push(initSize ? parseInt(initSize) : 100 / containers.length);
      }
      minSizes.push(minSize ? parseInt(minSize) : 0);
      maxSizes.push(maxSize ? parseInt(maxSize) : Infinity);
    });
    const onDragEnd = (evt: number[]) => setStored(`${id}-sizes`, evt);
    splitInstances[id] = Split(ids, {
      sizes: initSizes,
      minSize: minSizes,
      maxSize: maxSizes,
      direction,
      gutterSize: parseInt(gutterSize),
      snapOffset: 0,
      dragInterval: 1,
      onDragEnd,
      elementStyle(_dimension: string, size: number, gs: number) {
        return {
          'flex-basis': `calc(${size}% - ${gs}px)`,
        };
      },
      gutterStyle(_dimension: string, gs: number) {
        return {
          'flex-basis': `${gs}px`,
          'min-width': `${gs}px`,
          'min-height': `${gs}px`,
        };
      },
    });
  });
}

export function restoreAccordionState(): void {
  const appUiUx = state.appUiUx;
  if (!appUiUx) return;
  appUiUx.querySelectorAll('.accordion-bar').forEach((elem) => {
    const acc = elem.parentElement;
    const accSplit = acc?.closest('.split-container');
    const accTrigger = acc ? appUiUx.querySelector(acc.getAttribute('iconTrigger') ?? '') : null;
    if (acc && accSplit && acc.className.indexOf('accordion-vertical') !== -1 && accSplit.className.indexOf('split') !== -1) {
      const savedClasses = getStored(`ui-${acc.id}-class`);
      if (savedClasses && !(savedClasses as string).includes('expand')) (accTrigger as HTMLElement | null)?.click();
    }
  });
}

export function initAccordionComponents(): void {
  const appUiUx = state.appUiUx;
  if (!appUiUx) return;
  appUiUx.querySelectorAll('.accordion-bar').forEach((elem) => {
    const acc = elem.parentElement;
    if (!acc) return;
    const accSplit = acc.closest('.split-container');
    const accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger') ?? '');
    if (accTrigger) elem.classList.add('pointer-events-none');
    if (accSplit && acc.className.indexOf('accordion-vertical') !== -1 && accSplit.className.indexOf('split') !== -1) {
      acc.classList.add('expand');
      const splitInstance = splitInstances[accSplit.parentElement?.id ?? ''];
      accSplit.setAttribute('data-sizes', JSON.stringify(splitInstance.getSizes()));
      accTrigger?.addEventListener('click', () => {
        acc.classList.toggle('expand');
        setStored(`ui-${acc.id}-class`, acc.className);
        if (accSplit.className.indexOf('v-expand') !== -1) {
          accSplit.classList.remove('v-expand');
          (accSplit as HTMLElement).style.removeProperty('min-width');
          splitInstance.setSizes(JSON.parse(accSplit.getAttribute('data-sizes') ?? '[]'));
        } else {
          accSplit.classList.add('v-expand');
          const sizes = splitInstance.getSizes();
          accSplit.setAttribute('data-sizes', JSON.stringify(sizes));
          if (acc.className.indexOf('left') !== -1) {
            sizes[sizes.length - 1] = 100;
            sizes[sizes.length - 2] = 0;
          } else {
            sizes[sizes.length - 1] = 0;
            sizes[sizes.length - 2] = 100;
          }
          const padding = parseFloat(window.getComputedStyle(elem, null).getPropertyValue('padding-left')) * 2;
          (accSplit as HTMLElement).style.minWidth = `${(elem as HTMLElement).offsetWidth + padding}px`;
          splitInstance.setSizes(sizes);
        }
      });
    } else {
      accTrigger?.addEventListener('click', () => {
        acc.classList.toggle('expand');
        setStored(`ui-${acc.id}-class`, acc.className);
      });
    }

    const fullTrigger = acc.getAttribute('iconFullTrigger');
    if (fullTrigger) {
      appUiUx.querySelector(fullTrigger)?.addEventListener('click', () => {
        acc.classList.toggle('full-expand');
        setStored(`ui-${acc.id}-class`, acc.className);
      });
    }
  });
}

export function initTabComponents(): void {
  function hideActive(tab: Element): void {
    const appUiUx = state.appUiUx;
    if (!appUiUx) return;
    tab.classList.remove('active');
    const tabItemId = tab.getAttribute('tabItemId');
    if (tabItemId) {
      appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
        tabItem.classList.remove('fade-in');
        tabItem.classList.add('fade-out');
      });
    }
  }

  function showActive(tab: Element): void {
    const appUiUx = state.appUiUx;
    if (!appUiUx) return;
    tab.classList.add('active');
    const tabItemId = tab.getAttribute('tabItemId');
    if (tabItemId) {
      appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
        tabItem.classList.add('fade-in');
        tabItem.classList.remove('fade-out');
      });
    }
  }

  function triggerAccordion(elem: Element, wasActive: boolean, checkStored: boolean): void {
    const appUiUx = state.appUiUx;
    const accBar = elem.closest('.accordion-bar');
    if (!accBar || !appUiUx) return;
    const acc = accBar.parentElement;
    if (!acc) return;
    const accTriggerSelector = acc.getAttribute('iconTrigger');
    const accFullTriggerSelector = acc.getAttribute('iconFullTrigger');
    const accTrigger = accTriggerSelector ? appUiUx.querySelector(accTriggerSelector) : null;
    const accFullTrigger = accFullTriggerSelector ? appUiUx.querySelector(accFullTriggerSelector) : null;
    const accStoredClasses = (getStored(`ui-${acc.id}-class`) as string) || '';
    const storedAsCollapsed = accStoredClasses && (accStoredClasses.indexOf('expand') === -1);
    const storedAsFullExpanded = accStoredClasses && accStoredClasses.indexOf('full-expand') !== -1;

    const shouldExpand = !acc.classList.contains('expand');
    const shouldCollapse = acc.classList.contains('expand') && !acc.classList.contains('full-expand') && (wasActive || (checkStored && storedAsCollapsed));
    const shouldFullExpand = acc.classList.contains('expand') && !acc.classList.contains('full-expand') && (checkStored && storedAsFullExpanded);

    if (shouldExpand || shouldCollapse) {
      if (accTrigger) (accTrigger as HTMLElement).click();
      else (accBar as HTMLElement).click();
    }
    if (shouldFullExpand) {
      if (accFullTrigger) (accFullTrigger as HTMLElement).click();
    }
  }

  const appUiUx = state.appUiUx;
  if (!appUiUx) return;
  appUiUx.querySelectorAll('.xtabs-tab').forEach((elem) => {
    const tabGroup = elem.getAttribute('tabGroup');
    const tabParent = elem.parentElement;
    const uid = tabGroup || tabParent?.id;
    const siblingTabs = [...(tabGroup ? appUiUx.querySelectorAll(`[tabGroup="${tabGroup}"]`) : tabParent ? tabParent.children : [])].filter((tab) => tab !== elem); // eslint-disable-line no-nested-ternary

    elem.addEventListener('click', () => {
      if (uid) setStored(`tab-${uid}-current`, elem.id);
      siblingTabs.filter((tab) => tab.classList.contains('active')).forEach(hideActive);
      const wasActive = elem.classList.contains('active');
      showActive(elem);
      triggerAccordion(elem, wasActive, false);
    });

    const storedTab = uid ? (getStored(`tab-${uid}-current`) as string) || '' : '';
    const active = storedTab ? storedTab === elem.id : elem.getAttribute('active');

    if (active) {
      showActive(elem);
      triggerAccordion(elem, false, true);
    } else {
      hideActive(elem);
    }
  });

  function showHideAnchors(anchor: Element, index: number): void {
    Array.from(anchor.children).forEach((elem) => {
      if (elem.matches(`[anchor*="${index}"]`)) (elem as HTMLElement).style.display = 'flex';
      else (elem as HTMLElement).style.display = 'none';
    });
  }

  appUiUx.querySelectorAll('.xtabs-anchor').forEach((anchor) => {
    const tabNav = document.querySelector(anchor.getAttribute('anchorNav') ?? '');
    if (tabNav) {
      const observer = new MutationObserver(() => {
        const index = Array.from(tabNav.children).findIndex((btn) => btn.classList.contains('selected')) + 1;
        showHideAnchors(anchor, index);
      });
      observer.observe(tabNav, { attributes: true, attributeFilter: ['class'], childList: true });
    }
    showHideAnchors(anchor, 1);
  });
}

export function initButtonComponents(): void {
  const appUiUx = state.appUiUx;
  if (!appUiUx) return;
  appUiUx.querySelectorAll('.sd-button').forEach((elem) => {
    const toggle = elem.getAttribute('toggle');
    const active = elem.getAttribute('active');
    const input = elem.querySelector('input');

    if (input) {
      if (input.checked === true && !active) input.click();
      else if (input.checked === false && active) input.click();
    }
    if (active) elem.classList.add('active');
    else elem.classList.remove('active');
    if (toggle) {
      elem.addEventListener('click', () => {
        const inputEl = elem.querySelector('input');
        if (inputEl) {
          inputEl.click();
          if (inputEl.checked === true) {
            elem.classList.add('active');
          } else if (inputEl.checked === false) {
            elem.classList.remove('active');
          }
        } else {
          elem.classList.toggle('active');
        }
      });
    }
    const extraClicks = elem.getAttribute('data-click');
    if (extraClicks) {
      elem.addEventListener('click', () => {
        document.querySelectorAll(extraClicks).forEach((el) => (el as HTMLElement).click());
      });
    }
  });
}

export async function setupToolButtons(): Promise<void> {
  const appUiUx = state.appUiUx;
  const htmlPath = '/file=extensions-builtin/sdnext-modernui/html';
  const buttonMap: Record<string, string> = {
    apply: 'paste',
    clear: 'empty-set',
    close: 'square-xmark',
    list: 'list',
    load: 'floppy-disk-circle-arrow-right',
    model: 'database',
    override: 'sliders',
    preview: 'aperture',
    random: 'shuffle',
    refresh: 'arrows-rotate',
    remove: 'eraser',
    reset: 'empty-set',
    reuse: 'recycle',
    save: 'floppy-disk',
    scan: 'radar',
    search: 'magnifying-glass',
    select: 'pen-swirl',
    size: 'ruler-triangle',
    sort: 'sort',
    swap: 'arrow-up-arrow-down',
    upload: 'upload',
    view: 'grid',
  };
  const t0 = performance.now();
  if (!appUiUx) return;
  const processed = new Set<Element>();
  for (const key of Object.keys(buttonMap)) {
    const iconName = buttonMap[key];
    const nodes = appUiUx.querySelectorAll(`.tool[id$="${key}"]`);
    nodes.forEach((el) => {
      if (processed.has(el)) return;
      processed.add(el);
      const wrapper = document.createElement('div');
      wrapper.className = 'mask-icon';
      wrapper.style.maskImage = `url(${htmlPath}/svg/${iconName}.svg)`;
      while (el.firstChild) wrapper.appendChild(el.firstChild);
      el.appendChild(wrapper);
    });
  }
  const t1 = performance.now();
  log('setupToolButtons', Math.round(t1 - t0));
  timer('setupToolButtons', t1 - t0);
}

export async function setupDropdowns(): Promise<void> {
  const appUiUx = state.appUiUx;
  if (!appUiUx) return;
  appUiUx.querySelectorAll('.gradio-dropdown').forEach((el) => {
    el.addEventListener('click', () => {
      const options = el.querySelector('.options');
      if (!options) return;
      const rect = options.getBoundingClientRect();
      if (el.id.startsWith('setting_')) {
        (options as HTMLElement).style.cssText = 'top: 2.2em;';
      } else if (rect.bottom > window.innerHeight) {
        const offset = Math.min(500, rect.height);
        (options as HTMLElement).style.cssText = `top: -${offset}px !important;`;
      } else {
        (options as HTMLElement).style.cssText = 'top: 2.2em;';
      }
    });
  });
}

export async function createButtonsForExtensions(): Promise<void> {
  const otherExtensions = document.querySelector('#other_extensions');
  const otherViews = document.querySelector('#split-left');
  const noButtonTabs = [
    'tab_txt2img',
    'tab_img2img',
    'tab_control',
    'tab_video',
    'tab_process',
    'tab_caption',
    'tab_gallery',
    'tab_models',
    'tab_extensions',
    'tab_system',
    'tab_info',
    'tab_sdnext_uiux_core',
  ];
  const snakeToCamel = (str: string) => str.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  document.querySelectorAll('#tabs > .tabitem').forEach((c) => {
    const cid = c.id;
    const nid = cid.replace('tab_', '').replace('_tab', '');
    if (!noButtonTabs.includes(cid)) {
      const temp = document.createElement('div');
      let button;
      if (nid === 'agent_scheduler') button = '<div class="mask-icon icon-calendar"></div>';
      if (nid === 'framepack') button = '<div class="mask-icon icon-video"></div>';
      if (!button) button = `<div class="icon-letters">${nid.slice(0, 2)}</div>`;
      temp.innerHTML = `
        <button tabItemId="#split-app, #${cid}_tabitem"
          tabGroup="main_group" 
          data-click="#tabs" 
          class="xtabs-tab">${button}<span>${snakeToCamel(nid)}</span>
        </button>
      `;
      otherExtensions?.append(temp.firstElementChild!);
      temp.innerHTML = `
        <div id="${cid}_tabitem" class="xtabs-item other">
          <div data-parent-selector="gradio-app" data-selector="#${cid} > div" class="portal"></div>
        </div>
      `;
      otherViews?.append(temp.firstElementChild!);
    }
  });
}
