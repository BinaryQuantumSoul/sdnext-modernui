import { getStored, setStored } from './utils';

export async function applyTweaks(): Promise<void> {
  const t0 = performance.now();
  (document.querySelectorAll('#system .tab-nav button')[1] as HTMLElement | undefined)?.click();
  const controlColumns = document.getElementById('control-columns');
  if (!controlColumns) return;
  const controlColumnsElement = controlColumns;

  const anyControlColumns = controlColumnsElement as unknown as { prevWidth?: number; resizeObserver?: ResizeObserver };

  async function setOrientation(mode: 'portrait' | 'landscape' | 'toggle' | 'auto'): Promise<void> {
    if (!mode) mode = 'auto';
    log('setPanelOrientation', mode);
    if (mode === 'auto') {
      if (window.innerHeight > window.innerWidth) { // device portrait mode
        controlColumnsElement.classList.add('flex-force-column');
        controlColumnsElement.classList.remove('flex-force-row');
      } else if (controlColumnsElement.clientWidth > controlColumnsElement.clientHeight) { // wide panel
        controlColumnsElement.classList.add('flex-force-column');
        controlColumnsElement.classList.remove('flex-force-row');
      } else {
        controlColumnsElement.classList.add('flex-force-column');
        controlColumnsElement.classList.remove('flex-force-row');
      }
    } else if (mode === 'portrait') {
      controlColumnsElement.classList.add('flex-force-column');
      controlColumnsElement.classList.remove('flex-force-row');
    } else if (mode === 'landscape') {
      controlColumnsElement.classList.add('flex-force-row');
      controlColumnsElement.classList.remove('flex-force-column');
    } else if (mode === 'toggle') {
      if (controlColumnsElement.classList.contains('flex-force-column')) {
        setStored('control-panel-orientation', 'landscape');
        controlColumnsElement.classList.remove('flex-force-column');
        controlColumnsElement.classList.add('flex-force-row');
      } else {
        setStored('control-panel-orientation', 'portrait');
        controlColumnsElement.classList.add('flex-force-column');
        controlColumnsElement.classList.remove('flex-force-row');
      }
    }
  }

  const stored = getStored('control-panel-orientation');
  setOrientation(stored);
  const controlOrientationBtn = document.getElementById('control_panel_orientation');
  controlOrientationBtn?.addEventListener('click', () => setOrientation('toggle'));

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
