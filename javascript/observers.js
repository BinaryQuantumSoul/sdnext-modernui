async function setupControlDynamicObservers() {
  const dynamicInput = document.getElementById('control_dynamic_input');
  const dynamicInit = document.getElementById('control_dynamic_init');
  const dynamicControl = document.getElementById('control_dynamic_control');

  const qInputCtrl = '#control-template-column-input, #control_params_mask, #control_dynamic_resize';
  const qInputBtn = '[tabitemid="#control_resize_mask_tabitem"], [tabitemid="#control_before_scale_by_tabitem"], [tabitemid="#control_before_scale_to_tabitem"]';
  const inputElems = document.querySelectorAll(`${qInputCtrl}, ${qInputBtn}`);
  const initElems = document.querySelectorAll('#control-template-column-init');
  const controlElems = document.querySelectorAll('#control-template-column-preview');

  function setupDynamicListener(dynamic, elems, storedKey) {
    function toggleDynamicElements(dynamicEl) {
      elems.forEach((elem) => {
        if (dynamicEl.checked) elem.classList.remove('hidden');
        else elem.classList.add('hidden');
      });
    }

    dynamic.addEventListener('click', () => {
      setStored(storedKey, dynamic.checked);
      toggleDynamicElements(dynamic, elems);
    });
    dynamic.checked = getStored(storedKey) || false;
    toggleDynamicElements(dynamic, elems);
  }

  setupDynamicListener(dynamicInput, inputElems, 'control-dynamic-input');
  setupDynamicListener(dynamicInit, initElems, 'control-dynamic-init');
  setupDynamicListener(dynamicControl, controlElems, 'control-dynamic-control');
}

async function setupGenerateObservers() {
  function addButtonIcon(button, iconClass) {
    const icon = document.createElement('div');
    icon.classList.add('mask-icon', iconClass);
    button.appendChild(icon);
  }

  function addButtonSpan(button, spanText) {
    const span = document.createElement('span');
    span.textContent = spanText;
    if (!spanText) span.style.display = 'none';
    button.appendChild(span);
  }

  function enableButtonAnimation(parentButton, enable) {
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
}
