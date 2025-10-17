const splitInstances = [];

function initSplitComponents() {
  appUiUx.querySelectorAll('div.split').forEach((elem) => {
    const id = elem.id;
    const nid = appUiUx.querySelector(`#${id}`);
    const direction = nid?.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
    const gutterSize = nid?.getAttribute('gutterSize') || '8';
    const ids = [];
    const initSizes = [];
    const minSizes = [];
    const maxSizes = [];
    const containers = appUiUx.querySelectorAll(`#${id} > div.split-container`);
    containers.forEach(((c) => {
      const initSize = c.getAttribute('data-initSize');
      const minSize = c.getAttribute('data-minSize');
      const maxSize = c.getAttribute('data-maxSize');
      ids.push(`#${c.id}`);
      try {
        const storedSize = getStored(`${id}-sizes`);
        if (storedSize && Array.isArray(storedSize) && storedSize.every((n) => typeof n === 'number')) {
          initSizes.push(storedSize[c.id.includes('left') || c.id.includes('up') ? 0 : 1]);
        } else {
          initSizes.push(initSize ? parseInt(initSize) : 100 / containers.length);
        }
      } catch {
        initSizes.push(initSize ? parseInt(initSize) : 100 / containers.length);
      }
      minSizes.push(minSize ? parseInt(minSize) : 0);
      maxSizes.push(maxSize ? parseInt(maxSize) : Infinity);
    }));
    // log('splitComponent', ids, initSizes, minSizes, direction, gutterSize);
    const onDragEnd = (evt) => setStored(`${id}-sizes`, evt);
    // log('splitSizes', id, initSizes, minSizes, maxSizes);
    splitInstances[id] = Split(ids, { // eslint-disable-line no-undef
      sizes: initSizes,
      minSize: minSizes,
      maxSize: maxSizes,
      direction,
      gutterSize: parseInt(gutterSize),
      snapOffset: 0,
      dragInterval: 1,
      onDragEnd,
      elementStyle(dimension, size, gs) {
        return {
          'flex-basis': `calc(${size}% - ${gs}px)`,
        };
      },
      gutterStyle(dimension, gs) {
        return {
          'flex-basis': `${gs}px`,
          'min-width': `${gs}px`,
          'min-height': `${gs}px`,
        };
      },
    });
  });
}

function initAccordionComponents() {
  appUiUx.querySelectorAll('.accordion-bar').forEach((elem) => {
    const acc = elem.parentElement;
    const accSplit = acc.closest('.split-container');
    const accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger'));
    if (accTrigger) elem.classList.add('pointer-events-none');
    if (acc.className.indexOf('accordion-vertical') !== -1 && accSplit.className.indexOf('split') !== -1) {
      acc.classList.add('expand');
      const splitInstance = splitInstances[accSplit.parentElement.id];
      accSplit.setAttribute('data-sizes', JSON.stringify(splitInstance.getSizes()));
      accTrigger?.addEventListener('click', () => {
        acc.classList.toggle('expand');
        setStored(`ui-${acc.id}-class`, acc.className);
        if (accSplit.className.indexOf('v-expand') !== -1) {
          accSplit.classList.remove('v-expand');
          accSplit.style.removeProperty('min-width');
          splitInstance.setSizes(JSON.parse(accSplit.getAttribute('data-sizes')));
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
          accSplit.style.minWidth = `${elem.offsetWidth + padding}px`;
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

function initTabComponents() {
  function hideActive(tab) {
    tab.classList.remove('active');
    const tabItemId = tab.getAttribute('tabItemId');
    appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
      tabItem.classList.remove('fade-in');
      tabItem.classList.add('fade-out');
    });
  }

  function showActive(tab) {
    tab.classList.add('active');
    const tabItemId = tab.getAttribute('tabItemId');
    appUiUx.querySelectorAll(tabItemId).forEach((tabItem) => {
      tabItem.classList.add('fade-in');
      tabItem.classList.remove('fade-out');
    });
  }

  function triggerAccordion(elem, wasActive, checkStored) {
    const accBar = elem.closest('.accordion-bar');
    if (!accBar) return;
    const acc = accBar.parentElement;
    const accTrigger = appUiUx.querySelector(acc.getAttribute('iconTrigger'));
    const accFullTrigger = appUiUx.querySelector(acc.getAttribute('iconFullTrigger'));
    const accStoredClasses = getStored(`ui-${acc.id}-class`) || '';
    const storedAsCollapsed = accStoredClasses && (accStoredClasses.indexOf('expand') === -1);
    const storedAsFullExpanded = accStoredClasses && accStoredClasses.indexOf('full-expand') !== -1;

    const shouldExpand = !acc.classList.contains('expand');
    const shouldCollapse = acc.classList.contains('expand') && !acc.classList.contains('full-expand') && (wasActive || (checkStored && storedAsCollapsed));
    const shouldFullExpand = acc.classList.contains('expand') && !acc.classList.contains('full-expand') && (checkStored && storedAsFullExpanded);

    if (shouldExpand || shouldCollapse) {
      if (accTrigger) accTrigger.click();
      else accBar.click();
    }
    if (shouldFullExpand) {
      if (accFullTrigger) accFullTrigger.click();
    }
  }

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

    const storedTab = uid ? getStored(`tab-${uid}-current`) || '' : '';
    const active = storedTab ? storedTab === elem.id : elem.getAttribute('active');

    if (active) {
      showActive(elem);
      triggerAccordion(elem, false, true);
    } else {
      hideActive(elem);
    }
  });

  function showHideAnchors(anchor, index) {
    Array.from(anchor.children).forEach((elem) => {
      if (elem.matches(`[anchor*="${index}"]`)) elem.style.display = 'flex';
      else elem.style.display = 'none';
    });
  }

  appUiUx.querySelectorAll('.xtabs-anchor').forEach((anchor) => {
    const tabNav = document.querySelector(anchor.getAttribute('anchorNav'));
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

function initButtonComponents() {
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
      elem.addEventListener('click', (e) => {
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
        document.querySelectorAll(extraClicks).forEach((el) => el.click());
      });
    }
  });
}

const buttonMap = {
  apply: 'paste',
  clear: 'empty-set',
  close: 'square-xmark',
  list: 'list',
  load: 'floppy-disk-circle-arrow-right',
  model: 'database',
  override: 'sliders',
  preview: 'image',
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
const iconKeys = Object.keys(buttonMap);

async function setupToolButtons() {
  const t0 = performance.now();
  if (!appUiUx) return;
  const processed = new Set();
  for (const key of iconKeys) {
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
  // appUiUx.querySelectorAll('.tool').forEach((el) => {
  //   if (!vprocessed.has(el)) error('toolButton', el.id);
  // });
}

async function setupDropdowns() {
  appUiUx.querySelectorAll('.gradio-dropdown').forEach((el) => {
    el.addEventListener('click', () => {
      const options = el.querySelector('.options');
      if (!options) return;
      const rect = options.getBoundingClientRect();
      if (el.id.startsWith('setting_')) {
        options.style.cssText = 'top: 2.2em;'; // dont move components inside settings
      } else if (rect.bottom > window.innerHeight) {
        const offset = Math.min(500, rect.height);
        options.style.cssText = `top: -${offset}px !important;`; // dropdrop top offset
      } else {
        options.style.cssText = 'top: 2.2em;'; // dropdown bellow, not over
      }
    });
  });
}

async function createButtonsForExtensions() {
  const other_extensions = document.querySelector('#other_extensions');
  const other_views = document.querySelector('#split-left');
  const no_button_tabs = ['tab_txt2img', 'tab_img2img', 'tab_control', 'tab_video', 'tab_process', 'tab_caption', 'tab_gallery', 'tab_models', 'tab_extensions', 'tab_system', 'tab_info', 'tab_sdnext_uiux_core'];
  const snakeToCamel = (str) => str.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  document.querySelectorAll('#tabs > .tabitem').forEach((c) => {
    const cid = c.id;
    const nid = cid.replace('tab_', '').replace('_tab', '');
    if (!no_button_tabs.includes(cid)) {
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
      other_extensions.append(temp.firstElementChild);
      temp.innerHTML = `
        <div id="${cid}_tabitem" class="xtabs-item other">
          <div data-parent-selector="gradio-app" data-selector="#${cid} > div" class="portal"></div>
        </div>
      `;
      other_views.append(temp.firstElementChild);
    }
  });
}
