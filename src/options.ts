/* UI option setting initialization and ModernUI-specific config bindings. */
import { state } from './state';

export async function uiuxOptionSettings(): Promise<void> {
  let el: Element | null;

  function showInputRangeTicks(): void {
    gradioApp().querySelectorAll("input[type='range']").forEach((elem) => {
      const rangeElem = elem as HTMLInputElement;
      const spacing = (Number(rangeElem.step) / (Number(rangeElem.max) - Number(rangeElem.min))) * 100.0;
      const tsp = `max(3px, calc(${spacing}% - 1px))`;
      const fsp = `max(4px, calc(${spacing}% + 0px))`;
      const overlay = `repeating-linear-gradient(90deg, transparent, transparent ${tsp}, var(--sd-input-border-color) ${tsp}, var(--sd-input-border-color) ${fsp})`;
      rangeElem.style.setProperty('--sd-slider-bg-overlay', overlay);
    });
  }

  showInputRangeTicks();

  function setupUiUxSetting(settingId: string, className: string): void {
    const appUiUx = state.appUiUx;
    function updateUiUxClass(cn: string, value: unknown): void {
      if (!appUiUx) return;
      if (value) appUiUx.classList.add(cn);
      else appUiUx.classList.remove(cn);
    }
    el = gradioApp().querySelector(`#setting_${settingId} input`);
    if (el) el.addEventListener('click', (e) => updateUiUxClass(className, (e.target as HTMLInputElement).checked));
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

  log('hideLegacy', window.opts.uiux_hide_legacy);

  function mobileScale(value: unknown): void {
    const viewport = document.head.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', `width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=${value}`);
  }
  el = gradioApp().querySelector('#setting_uiux_mobile_scale input[type=number]');
  if (el) el.addEventListener('change', (e) => mobileScale((e.target as HTMLInputElement).value));
  mobileScale(window.opts.uiux_mobile_scale);

  const panelMinWidth = (value: unknown) => document.documentElement.style.setProperty('--sd-panel-min-width', `${value}em`);
  el = gradioApp().querySelector('#setting_uiux_panel_min_width input[type=number]');
  if (el) el.addEventListener('change', (e) => panelMinWidth((e.target as HTMLInputElement).value));
  panelMinWidth(window.opts.uiux_panel_min_width);

  const gridImageSize = (value: unknown) => document.documentElement.style.setProperty('--sd-grid-image-size', `${value}px`);
  el = gradioApp().querySelector('#setting_uiux_grid_image_size input[type=number]');
  if (el) el.addEventListener('change', (e) => gridImageSize((e.target as HTMLInputElement).value));
  gridImageSize(window.opts.uiux_grid_image_size);
}
