// Original credits: <https://github.com/anapnoe/stable-diffusion-webui-ux/blob/8307896c59032a9cdac1ab24c975102ff9a674d3/extensions-builtin/anapnoe-sd-uiux/javascript/anapnoe_sd_uiux_core.js>

const htmlPath = '/file=extensions-builtin/sdnext-modernui/html';
const rootTemplate = 'template-app-root';
const appId = '#sdnext_app';
const tabId = '#tab_sdnext_uiux_core';

let portalTotal = 0;
let appUiUx;
let isBackendDiffusers;

window.getUICurrentTabContent = () => gradioApp().querySelector('.xtabs-item:not(.hidden) > .split');
window.getSettingsTabs = () => gradioApp().querySelectorAll('#layout-settings .tabitem');

function functionWaitForFlag(checkFlag) {
  return async function () { // eslint-disable-line func-names
    return new Promise((resolve) => {
      const check = () => checkFlag() ? resolve() : setTimeout(check);
      check();
    });
  };
}

let uiFlagInitialized = false;
let uiFlagPortalInitialized = false;

window.waitForUiReady = functionWaitForFlag(() => uiFlagInitialized);
const waitForUiPortal = functionWaitForFlag(() => uiFlagPortalInitialized);
const isMobile = () => window.innerWidth < window.innerHeight;

function logPrettyPrint() {
  let output = '';
  let arg;
  let i;
  const dt = new Date();
  const ts = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}.${dt.getMilliseconds().toString().padStart(3, '0')}`;
  output += `<div class="log-row"><span class="log-date">${ts}</span>`;

  for (i = 0; i < arguments.length; i++) {
    arg = arguments[i];
    if (arg === undefined) arg = 'undefined';
    if (arg === null) arg = 'null';
    const argstr = arg.toString().toLowerCase();
    let acolor = '';
    if (argstr.indexOf('error') !== -1) {
      acolor += ' log-remove';
    } else if (argstr.indexOf('loading') !== -1
      || argstr.indexOf('load') !== -1
      || argstr.indexOf('init') !== -1
      || argstr.indexOf('submit') !== -1
      || argstr.indexOf('success') !== -1) {
      acolor += ' log-load';
    } else if (argstr.indexOf('[') !== -1) {
      acolor += ' log-object';
    }
    if (arg.toString().indexOf('.css') !== -1 || arg.toString().indexOf('.html') !== -1) acolor += ' log-url';
    else if (arg.toString().indexOf('\n') !== -1) output += '<br />';
    output += `<span class="log-${(typeof arg)} ${acolor}">`;
    if (typeof arg === 'object') output += JSON.stringify(arg);
    else output += arg;
    output += ' </span>';
  }
  output += '</div>';
  return output;
}

const setStored = (key, val) => {
  if (!window.opts.uiux_persist_layout) return;
  try {
    localStorage.setItem(`ui-${key}`, JSON.stringify(val));
  } catch { /* unsupported on mobile */ }
};

const getStored = (key) => {
  if (!window.opts.uiux_persist_layout) return undefined;
  let val;
  try {
    val = JSON.parse(localStorage.getItem(`ui-${key}`));
  } catch { /* unsupported on mobile */ }
  return val;
};

function applyDefaultLayout(mobile) {
  appUiUx.querySelectorAll('[mobile]').forEach((tabItem) => {
    if (mobile) {
      if (tabItem.childElementCount === 0) {
        const mobile_target = appUiUx.querySelector(tabItem.getAttribute('mobile'));
        if (mobile_target) {
          const target_parent_id = mobile_target.parentElement.id;
          if (target_parent_id) tabItem.setAttribute('mobile-restore', `#${target_parent_id}`);
          tabItem.append(mobile_target);
        }
      }
    } else if (tabItem.childElementCount > 0) {
      const mobile_restore_target = appUiUx.querySelector(tabItem.getAttribute('mobile-restore'));
      if (mobile_restore_target) {
        tabItem.removeAttribute('mobile-restore');
        mobile_restore_target.append(tabItem.firstElementChild);
      }
    }
  });
  if (mobile) {
    // additional mobile actions
    appUiUx.querySelector('.accordion-vertical.expand #mask-icon-acc-arrow')?.click();
    if (!appUiUx.querySelector('.accordion-vertical.expand #mask-icon-acc-arrow-control')) appUiUx.querySelector('.accordion-vertical #mask-icon-acc-arrow-control')?.click();
    if (appUiUx.querySelector('#accordion-aside')?.classList.contains('expand')) appUiUx.querySelector('#acc-arrow-button')?.click(); // collapse networks in mobile view
    appUiUx.querySelector('#control_dynamic_input:not(:checked)')?.click();
    appUiUx.querySelector('#control_dynamic_control:not(:checked)')?.click();
    appUiUx.classList.add('media-mobile');
    appUiUx.classList.remove('media-desktop');
  } else {
    if (!getStored('control-dynamic-input')) appUiUx.querySelector('#control_dynamic_input:checked')?.click();
    if (!getStored('control-dynamic-control')) appUiUx.querySelector('#control_dynamic_control:checked')?.click();
    appUiUx.classList.add('media-desktop');
    appUiUx.classList.remove('media-mobile');
  }
}

function switchMobile() {
  const optslayout = window.opts.uiux_default_layout;
  if (optslayout === 'Auto') {
    window.addEventListener('resize', () => applyDefaultLayout(isMobile()));
    applyDefaultLayout(isMobile());
  } else if (optslayout === 'Mobile') {
    applyDefaultLayout(true);
  } else if (optslayout === 'Desktop') {
    applyDefaultLayout(false);
  }
}

async function applyAutoHide() {
  const hideSiblings = (elem) => {
    if (!elem || elem.nodeName !== 'DIV') return;
    elem.classList.toggle('hidden-animate');
    const nextEl = elem.nextElementSibling;
    hideSiblings(nextEl);
  };

  appUiUx.querySelectorAll('h2').forEach((elem) => elem.classList.add('auto-hide'));
  appUiUx.querySelectorAll('.auto-hide').forEach((elem) => {
    elem.onclick = (evt) => {
      for (const child of evt.target.children) child.classList.toggle('hidden-animate');
      hideSiblings(evt.target?.nextElementSibling);
    };
  });

  // autohide control panels
  const minimizeToggle = (el, evt) => {
    if (evt.target === el
      || evt.target === el.firstElementChild
      || evt.target.parentElement === el.firstElementChild
      || (el.firstElementChild?.contains(evt.target) && evt.target.nodeName === 'H2')
    ) {
      el.classList.toggle('minimize');
      evt.stopPropagation();
      evt.stopImmediatePropagation();
    }
  };
  const headerControlInput = document.querySelector('#control-template-column-input');
  const headerControlInit = document.querySelector('#control-template-column-init');
  const headerControlOutput = document.querySelector('#control-template-column-output');
  const headerControlPreview = document.querySelector('#control-template-column-preview');
  const headerImg2imgInput = document.querySelector('#img2img-template-column-input');
  const headerImg2imgOutput = document.querySelector('#img2img-template-column-output');
  if (headerControlInput) headerControlInput.addEventListener('click', (evt) => minimizeToggle(headerControlInput, evt));
  if (headerControlInit) headerControlInit.addEventListener('click', (evt) => minimizeToggle(headerControlInit, evt));
  if (headerControlOutput) headerControlOutput.addEventListener('click', (evt) => minimizeToggle(headerControlOutput, evt));
  if (headerControlPreview) headerControlPreview.addEventListener('click', (evt) => minimizeToggle(headerControlPreview, evt));
  if (headerImg2imgInput) headerImg2imgInput.addEventListener('click', (evt) => minimizeToggle(headerImg2imgInput, evt));
  if (headerImg2imgOutput) headerImg2imgOutput.addEventListener('click', (evt) => minimizeToggle(headerImg2imgOutput, evt));
}

async function extraTweaks() {
  // System tab click second tab
  document.querySelectorAll('#system .tab-nav button')[1].click();

  // Control tab flex row
  async function adjustFlexDirection(flexContainer) {
    if (!flexContainer || !flexContainer.firstElementChild) return;
    const childCount = flexContainer.childElementCount;
    const firstChildMinWidth = parseFloat(getComputedStyle(flexContainer.firstElementChild).minWidth);
    const gapWidth = parseFloat(getComputedStyle(flexContainer).gap);
    const minWidth = childCount * firstChildMinWidth + (childCount - 1) * gapWidth;
    const currentDirection = getComputedStyle(flexContainer).flexDirection;
    const currentWidth = flexContainer.clientWidth;
    if (currentWidth < minWidth && !flexContainer.classList.contains('flex-force-column')) flexContainer.classList.add('flex-force-column');
    else if (currentWidth >= minWidth && flexContainer.classList.contains('flex-force-column')) flexContainer.classList.remove('flex-force-column');
  }

  const controlColumns = document.getElementById('control-columns');
  adjustFlexDirection(controlColumns);
  new ResizeObserver(() => adjustFlexDirection(controlColumns)).observe(controlColumns);

  // Extra networks tab
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

  logoNav.addEventListener('click', () => controlNav.click());
  const buttonCurrent = document.getElementById(getStored('tab-main_group-current')) || logoNav;
  buttonCurrent.click();

  const handleTabChange = (evt) => { // required to keep js detection code happy
    const tabname = evt.target.id.split('_')[0];
    for (const tab of ['txt2img', 'img2img', 'control', 'video']) {
      const el = document.getElementById(`tab_${tab}`);
      if (el) el.style.display = tabname === tab ? 'block' : 'none';
    }
  };

  txt2imgNav.addEventListener('click', handleTabChange);
  img2imgNav.addEventListener('click', handleTabChange);
  controlNav.addEventListener('click', handleTabChange);
  videoNav.addEventListener('click', handleTabChange);

  // Log wrapping
  const serverLog = document.getElementById('logMonitorData');
  document.getElementById('btn_console_log_server_wrap').onclick = () => {
    if (serverLog) serverLog.style.whiteSpace = serverLog.style.whiteSpace === 'nowrap' ? 'break-spaces' : 'nowrap';
  };
  const clientLog = document.getElementById('logMonitorJS');
  document.getElementById('btn_console_log_client_wrap').onclick = () => {
    if (clientLog) clientLog.classList.toggle('wrap-div');
  };

  // disable logs
  const ui_disabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled : [];
  if (ui_disabled?.includes('logs')) {
    if (serverLog) serverLog.style.display = 'none';
    if (clientLog) clientLog.style.display = 'none';
  }

  // disable spellchecks
  document.querySelectorAll('input[type="text"], textarea').forEach((elem) => { elem.setAttribute('spellcheck', 'false'); });
}
extraTweaks = logFn(extraTweaks); // eslint-disable-line no-func-assign

async function uiuxOptionSettings() {
  let el;
  // settings input ranges
  function showInputRangeTicks() {
    gradioApp().querySelectorAll("input[type='range']").forEach((elem) => {
      const spacing = (elem.step / (elem.max - elem.min)) * 100.0;
      const tsp = `max(3px, calc(${spacing}% - 1px))`;
      const fsp = `max(4px, calc(${spacing}% + 0px))`;
      const overlay = `repeating-linear-gradient(90deg, transparent, transparent ${tsp}, var(--sd-input-border-color) ${tsp}, var(--sd-input-border-color) ${fsp})`;
      elem.style.setProperty('--sd-slider-bg-overlay', overlay);
    });
  }
  showInputRangeTicks();

  // settings looks
  function setupUiUxSetting(settingId, className) {
    function updateUiUxClass(cn, value) {
      if (value) appUiUx.classList.add(cn);
      else appUiUx.classList.remove(cn);
    }
    el = gradioApp().querySelector(`#setting_${settingId} input`);
    if (el) el.addEventListener('click', (e) => updateUiUxClass(className, e.target.checked));
    updateUiUxClass(className, window.opts[settingId]);
  }

  setupUiUxSetting('uiux_hide_legacy', 'option-hide-legacy');
  setupUiUxSetting('uiux_no_slider_layout', 'option-no-slider-layout');
  setupUiUxSetting('uiux_show_labels_aside', 'option-aside-labels');
  setupUiUxSetting('uiux_show_labels_main', 'option-main-labels');
  setupUiUxSetting('uiux_show_labels_tabs', 'option-tab-labels');
  setupUiUxSetting('uiux_show_labels_tabs', 'option-txt2img-labels');
  setupUiUxSetting('uiux_show_labels_tabs', 'option-img2img-labels');
  setupUiUxSetting('uiux_show_labels_tabs', 'option-control-labels');
  setupUiUxSetting('uiux_show_labels_tabs', 'option-video-labels');
  setupUiUxSetting('uiux_no_headers_params', 'option-hide-headers-params');
  setupUiUxSetting('uiux_show_outline_params', 'option-show-outline-params');

  // hide legacy and activate control tab
  log('hideLegacy', window.opts.uiux_hide_legacy);
  // gradioApp().getElementById('tab_txt2img').style.display = window.opts.uiux_hide_legacy ? 'none' : 'block';
  // gradioApp().getElementById('tab_img2img').style.display = window.opts.uiux_hide_legacy ? 'none' : 'block';
  // gradioApp().getElementById('tab_control').style.display = window.opts.uiux_hide_legacy ? 'block' : 'none';

  // settings mobile scale
  function mobileScale(value) {
    const viewport = document.head.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', `width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=${value}`);
  }
  el = gradioApp().querySelector('#setting_uiux_mobile_scale input[type=number]');
  if (el) el.addEventListener('change', (e) => mobileScale(e.target.value));
  mobileScale(window.opts.uiux_mobile_scale);

  // set panel min width
  const panelMinWidth = (value) => document.documentElement.style.setProperty('--sd-panel-min-width', `${value}em`);
  el = gradioApp().querySelector('#setting_uiux_panel_min_width input[type=number]');
  if (el) el.addEventListener('change', (e) => panelMinWidth(e.target.value));
  panelMinWidth(window.opts.uiux_panel_min_width);

  // set grid image size
  const gridImageSize = (value) => document.documentElement.style.setProperty('--sd-grid-image-size', `${value}px`);
  el = gradioApp().querySelector('#setting_uiux_grid_image_size input[type=number]');
  if (el) el.addEventListener('change', (e) => gridImageSize(e.target.value));
  gridImageSize(window.opts.uiux_grid_image_size);
}

async function loadAllPortals() {
  appUiUx.querySelectorAll('.portal').forEach((elem, index, array) => movePortal(elem, 1, index, array.length)); // eslint-disable-line no-use-before-define
}
loadAllPortals = logFn(loadAllPortals); // eslint-disable-line no-func-assign

function movePortal(portalElem, tries, index, length) {
  const MAX_TRIES = 3;
  const parentSelector = portalElem.getAttribute('data-parent-selector');
  const dataSelector = portalElem.getAttribute('data-selector');
  const dataOptional = portalElem.getAttribute('data-optional');
  const targetElem = document.querySelector(`${parentSelector} ${dataSelector}`);
  // const allElements = document.querySelectorAll(`${parentSelector} ${dataSelector}`);
  // if (allElements.length > 1) error(`Multiple elements num=${allElements.length} selector=${parentSelector} ${dataSelector}`, allElements);
  if (portalElem && !targetElem && dataSelector?.endsWith('_enqueue')) {
    portalTotal += 1;
    portalElem.style.display = 'none';
  } else if (portalElem && targetElem) {
    // log('registerPortal', index, parentSelector, dataSelector, tries);
    portalElem.append(targetElem);
    portalTotal += 1;
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
    portalTotal += 1;
  } else if (tries < MAX_TRIES) {
    log('retryPortal', portalElem, tries);
    const timeout = portalElem.getAttribute('data-timeout');
    const delay = timeout ? parseInt(timeout) : 500;
    setTimeout(() => movePortal(portalElem, tries + 1, index, length), delay);
  } else {
    error('Element not found', { index, parent: parentSelector, id: dataSelector, el: portalElem, tgt: targetElem });
    portalElem.style.backgroundColor = 'var(--color-error)';
    portalTotal += 1;
  }
  if (portalTotal === length) uiFlagPortalInitialized = true;
}

async function setupAnimationEventListeners() {
  document.addEventListener('animationstart', (e) => {
    if (e.animationName === 'fade-in') {
      e.target.classList.remove('hidden');
    }
  });
  document.addEventListener('animationend', (e) => {
    if (e.animationName === 'fade-out') {
      e.target.classList.add('hidden');
    }
  });
}

async function replaceRootTemplate() {
  appUiUx = document.querySelector(appId);
  gradioApp().insertAdjacentElement('afterbegin', appUiUx);
}

async function getNestedTemplates(container) {
  const nestedData = [];
  container.querySelectorAll('.template').forEach((el) => {
    nestedData.push({
      template: el.getAttribute('template'),
      key: el.getAttribute('key'),
      target: el,
    });
  });
  return nestedData;
}

async function loadCurrentTemplate(data) {
  const curr_data = data.shift();
  if (curr_data) {
    const t0 = performance.now();
    const ui_disabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled : [];
    for (const disabled of ui_disabled) {
      if (curr_data.template.includes(disabled)) {
        log('loadTemplate', curr_data.template, 'disabled');
        return loadCurrentTemplate(data);
      }
    }
    // log('loadTemplate', curr_data.template);
    const uri = `${window.subpath}${htmlPath}/templates/${curr_data.template}.html?${Date.now()}`;
    const response = await fetch(uri, { cache: 'reload' });
    // const response = await fetch(uri);
    if (!response.ok) {
      error('loadTemplate', curr_data.template, curr_data.target);
      if (curr_data.target) curr_data.target.setAttribute('status', 'error');
    } else {
      const text = await response.text();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = curr_data.key ? text.replace(/\s*\{\{.*?\}\}\s*/g, curr_data.key) : text;
      const nestedData = await getNestedTemplates(tempDiv);
      data.push(...nestedData);
      if (curr_data.target) {
        curr_data.target.setAttribute('status', 'true');
        curr_data.target.append(tempDiv.firstElementChild);
      }
    }
    const t1 = performance.now();
    // log('loadTemplate', curr_data.template, `time=${Math.round(t1 - t0)}`);
    return loadCurrentTemplate(data);
  }
  return Promise.resolve();
}

async function loadAllTemplates() {
  const data = [
    {
      template: rootTemplate,
      target: document.querySelector(tabId),
    },
  ];
  const t0 = performance.now();
  await loadCurrentTemplate(data);
  const t1 = performance.now();
  await replaceRootTemplate();
  const t2 = performance.now();
  log('loadAllTemplates', `load=${Math.round(t1 - t0)} replace=${Math.round(t2 - t1)}`);
}

async function removeStyleAssets() {
  // Remove specific stylesheets
  const t0 = performance.now();
  let removedStylesheets = 0;
  document.querySelectorAll(`
    [rel="stylesheet"][href*="/assets/"], 
    [rel="stylesheet"][href*="theme.css"],
    [rel="stylesheet"][href*="base.css"],
    [rel="stylesheet"][href*="file=style.css"]
  `).forEach((stylesheet) => {
    stylesheet.remove();
    removedStylesheets++;
    if (window.opts.uiux_enable_console_log) log('removeStylesheet', stylesheet.getAttribute('href'));
  });

  // Remove inline styles and svelte classes
  const stylers = document.querySelectorAll('.styler, [class*="svelte"]:not(input)');
  let count = 0;
  let removedCount = 0;

  stylers.forEach((element) => {
    if (element.style.display !== 'none' && element.style.display !== 'block') {
      element.removeAttribute('style');
      removedCount++;
    }

    [...element.classList].filter((className) => className.match(/^svelte.*/)).forEach((svelteClass) => element.classList.remove(svelteClass));
    count++;
  });
  log('removeElements', `elements=${removedCount}/${count} stylesheets=${removedStylesheets} time=${Math.round(performance.now() - t0)}`);
}

function logStartup() {
  log('userAgent', navigator.userAgent);
  const filteredOpts = Object.entries(window.opts).filter(([key, value]) => key.startsWith('uiux') && typeof value !== 'string');
  const uiOpts = {};
  for (const [key, value] of filteredOpts) uiOpts[key] = value;
  log('settings', uiOpts);
}

async function setupLogger() {
  const ui_disabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled : [];
  if (ui_disabled?.includes('logs')) return;
  const logMonitorJS = document.createElement('div');
  logMonitorJS.id = 'logMonitorJS';
  document.body.append(logMonitorJS);
  window.logger = logMonitorJS;
}

async function mainUiUx() {
  logStartup();
  await removeStyleAssets();
  await loadAllTemplates();
  createButtonsForExtensions();
  setupAnimationEventListeners();
  initSplitComponents();
  await loadAllPortals();
  initTabComponents();
  initButtonComponents();
  setupToolButtons();
  setupDropdowns();
  initAccordionComponents();
  const t0 = performance.now();
  await waitForUiPortal();
  const t1 = performance.now();
  log('waitForUiPortal', `time=${Math.round(t1 - t0)}`);
  setupGenerateObservers();
  setupControlDynamicObservers();
  uiuxOptionSettings();
  setUserColors();
  showContributors();
  switchMobile();
  extraTweaks();
  applyAutoHide();
  uiFlagInitialized = true;
}

mainUiUx = logFn(mainUiUx); // eslint-disable-line no-func-assign
onUiReady(mainUiUx);
