/* Mutation observer wiring for generate and control button behaviors. */
export async function setupControlDynamicObservers(): Promise<void> {
  // Dead code preserved from original — dynamic control observer wiring is currently disabled
}

export async function setupGenerateObservers(): Promise<void> {
  function addButtonIcon(button: Element, iconClass: string): void {
    const icon = document.createElement('div');
    icon.classList.add('mask-icon', iconClass);
    button.appendChild(icon);
  }

  function addButtonSpan(button: Element, spanText: string): void {
    const span = document.createElement('span');
    span.textContent = spanText;
    if (!spanText) span.style.display = 'none';
    button.appendChild(span);
  }

  function enableButtonAnimation(parentButton: Element | null, enable: boolean): void {
    if (!parentButton) return;
    if (enable) parentButton.classList.add('active');
    else parentButton.classList.remove('active');
  }

  const keys = ['#txt2img', '#img2img', '#extras', '#control', '#video'];
  keys.forEach((key) => {
    const loop = document.querySelector(`${key}_loop`);
    if (loop) loop.addEventListener('click', () => generateForever(`${key}_generate`));

    const tgb = document.querySelector(`${key}_generate`);
    if (tgb) {
      const tg = tgb.closest('.sd-button');

      new MutationObserver(() => {
        if (tgb.textContent && !tgb.querySelector('span')) {
          if (tgb.textContent === 'Generate') {
            enableButtonAnimation(tg, false);
            addButtonIcon(tgb, 'icon-generate');
          } else {
            enableButtonAnimation(tg, true);
          }
          addButtonSpan(tgb, tgb.textContent);
        }
      }).observe(tgb, { childList: true, subtree: true });
    }

    const teb = document.querySelector(`${key}_enqueue`);
    if (teb) {
      const te = teb.closest('.sd-button');

      new MutationObserver(() => {
        if (teb.textContent && !teb.querySelector('span')) {
          if (teb.textContent === 'Enqueue') {
            enableButtonAnimation(te, false);
            addButtonIcon(teb, 'icon-enqueue');
          } else {
            enableButtonAnimation(te, true);
          }
          addButtonSpan(teb, '');
        }
      }).observe(teb, { childList: true, subtree: true });
    }

    const tpb = document.querySelector(`${key}_pause`);
    if (tpb) {
      new MutationObserver(() => {
        if (tpb.textContent && !tpb.querySelector('span')) {
          if (tpb.textContent === 'Pause') addButtonIcon(tpb, 'icon-pause');
          else addButtonIcon(tpb, 'icon-play');
          addButtonSpan(tpb, '');
        }
      }).observe(tpb, { childList: true, subtree: true });
    }
  });

  // Caption button observer (separate handling due to different ID pattern)
  const captionBtn = document.querySelector('#btn_vlm_caption');
  if (captionBtn) {
    const captionButton = captionBtn.closest('.sd-button');

    new MutationObserver(() => {
      if (captionBtn.textContent && !captionBtn.querySelector('span')) {
        if (captionBtn.textContent === 'Caption') {
          enableButtonAnimation(captionButton, false);
          addButtonIcon(captionBtn, 'icon-caption');
        } else {
          enableButtonAnimation(captionButton, true);
        }
        addButtonSpan(captionBtn, captionBtn.textContent);
      }
    }).observe(captionBtn, { childList: true, subtree: true });
  }
}
