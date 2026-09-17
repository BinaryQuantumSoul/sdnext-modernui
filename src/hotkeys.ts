async function selectHotKeyElement(e: KeyboardEvent, id: string) {
  const elem = document.querySelector(id);
  if (elem) {
    log('selectHotKey', { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, id, elid: elem?.id, elnode: elem?.nodeName });
    e.preventDefault();
    if (elem.nodeName === 'BUTTON') (elem as HTMLButtonElement).click();
    else (elem as HTMLElement).focus();
  } else {
    error('selectHotKey', { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, id });
  }
}

export async function initHotkeys() {
  log('initHotkeys');
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'C' && e.altKey) selectHotKeyElement(e, '#control_nav');
    if (e.key === '1' && e.altKey) selectHotKeyElement(e, '#control_nav');
    if (e.key === '2' && e.altKey) selectHotKeyElement(e, '#video_nav');
    if (e.key === '3' && e.altKey) selectHotKeyElement(e, '#extras_nav');
    if (e.key === '4' && e.altKey) selectHotKeyElement(e, '#caption_nav');
    if (e.key === '5' && e.altKey) selectHotKeyElement(e, '#gallery_nav');
    if (e.key === '6' && e.altKey) selectHotKeyElement(e, '#btn_server_info');
    if (e.key === '7' && e.altKey) selectHotKeyElement(e, '#btn_extra_networks');
    if (e.key === '8' && e.altKey) selectHotKeyElement(e, '#btn_settings');
    if (e.key === '9' && e.altKey) selectHotKeyElement(e, '#btn_system');
    if (e.key === '0' && e.altKey) selectHotKeyElement(e, '#btn_console');
  });
}
