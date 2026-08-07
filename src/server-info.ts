/* Server info fetch/render utilities and inline toggle helpers. */
let initial = true;
const refreshInterval = 5000;
let info: Record<string, unknown> | null = null;
const visibility: Record<string, boolean> = {};

function toggleHide(heading: string): void {
  const tableName = `server-info-table-${heading}`;
  const el = document.getElementById(tableName);
  if (el) {
    el.classList.toggle('hide');
    visibility[heading] = !el.classList.contains('hide');
  }
}

function jsontoStr(json: Record<string, unknown> | Record<string, unknown>[] | null | undefined): string {
  if (!json) return '';
  let lst = json;
  if (!Array.isArray(json)) lst = [json];
  if (lst.length === 0) return '';
  return (lst as Record<string, unknown>[]).map((item) => {
    if (typeof item === 'string') return item;
    if (Array.isArray(item)) return item.join(', ');
    const entries = Object.entries(item);
    return entries.map(([key, value]) => `${key}: ${typeof value === 'object' ? jsontoStr(value as Record<string, unknown>) : value}`).join(' | ');
  }).join('<br>');
}

function jsonToHtml(heading: string, json: Record<string, unknown> | Record<string, unknown>[] | null | undefined, visible = true): string {
  if (!json) return '';
  let lst = json;
  if (!Array.isArray(json)) lst = [json];
  if (lst.length === 0) return '';
  const isVisible = visibility[heading] === undefined ? visible : visibility[heading];
  return `
    <h3 onclick="toggleHide('${heading}')">${heading}</h3>
    <div class="server-info-table ${isVisible ? '' : 'hide'}" id="server-info-table-${heading}">
      ${(lst as Record<string, unknown>[]).map((item) => {
        const entries = Object.entries(item);
        return `
          <table class="table-wrap">
            ${entries
              .map(([key, value]) => `
                <tr>
                  <td>${key}</td>
                  <td>${typeof value === 'object' ? jsontoStr(value as Record<string, unknown>) : value}</td>
                </tr>
              `).join('')}
          </table>
        `;
      }).join('')}
    </div>
  `;
}

// the memory endpoint reports every size in bytes; these keys are the only counts in it
const memoryCounters = new Set(['retries', 'oom']);

function formatBytes(value: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let scaled = value;
  let unit = 0;
  while (Math.abs(scaled) >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${scaled} ${units[unit]}` : `${scaled.toFixed(2)} ${units[unit]}`;
}

function formatMemoryInfo(value: unknown, key = ''): unknown {
  if (typeof value === 'number') return memoryCounters.has(key) ? value : formatBytes(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, formatMemoryInfo(v, k)]));
  }
  return value; // error strings and anything else pass through
}

function updateNetworksInfo(loras: string[] | null): Record<string, unknown> {
  const networks: Record<string, unknown> = getSelectedNetworks() || {};
  if (networks.lora) {
    networks['lora selected'] = networks.lora;
    delete networks.lora;
  }
  if (loras && loras.length > 0) {
    networks['lora loaded'] = loras.join('<br>');
  }
  return networks;
}

function updateModelInfo(modelInfo: Record<string, unknown>): void {
  if (!info) info = {};
  if (modelInfo.class === null) delete modelInfo.class;
  if (modelInfo.type === null) modelInfo.type = 'Not loaded';
  if (modelInfo.checkpoint) delete modelInfo.checkpoint;
  if (modelInfo.title) delete modelInfo.title;
  if (modelInfo.filename) delete modelInfo.filename;
  modelInfo.selected = window.opts.sd_model_checkpoint;
  if (modelInfo.name) {
    modelInfo.loaded = modelInfo.name;
    delete modelInfo.name;
  }
  if (window.opts.sd_unet_secondary !== 'Default') {
    modelInfo['unet primary'] = window.opts.sd_unet;
    modelInfo['unet secondary'] = window.opts.sd_unet_secondary;
  } else {
    modelInfo.unet = window.opts.sd_unet;
  }
  modelInfo.te = window.opts.sd_text_encoder;
  modelInfo.vae = window.opts.sd_vae;
  info.model = modelInfo;
}

function updateVersionInfo(versionInfo: Record<string, unknown>): void {
  if (!info) info = {};
  versionInfo.version = `${versionInfo.updated || 'Unknown'} ${versionInfo.commit || ''}`;
  versionInfo.url = `<a href="${versionInfo.url || '#'}" target="_blank">${versionInfo.url || 'Unknown'}</a>`;
  versionInfo.branch = `Core: ${versionInfo.branch || 'Unknown'} | UI: ${versionInfo.ui || 'Unknown'} | Kanvas: ${versionInfo.kanvas || 'Unknown'}`;
  if (versionInfo.kanvas) delete versionInfo.kanvas;
  if (versionInfo.ui) delete versionInfo.ui;
  if (versionInfo.commit) delete versionInfo.commit;
  if (versionInfo.updated) delete versionInfo.updated;
  info.version = versionInfo;
}

async function renderServerInfo(): Promise<void> {
  if (!info) return;
  const el = document.getElementById('serverinfo');
  if (!el) return;
  updateModelInfo(info.model as Record<string, unknown>);
  updateVersionInfo(info.version as Record<string, unknown>);
  el.innerHTML = `
    <div id="server-info-time" class="server-info-time" onclick="getServerInfo()" title="Click to refresh server info">
      Updated: ${new Date().toLocaleString()}
    </div>
    ${jsonToHtml('Model', info.model as Record<string, unknown>)}
    ${jsonToHtml('LoRA', info.lora as Record<string, unknown>)}
    ${jsonToHtml('Networks', info.networks as Record<string, unknown>)}
    ${jsonToHtml('Version', info.version as Record<string, unknown>)}
    ${jsonToHtml('Torch', info.torch as Record<string, unknown>, false)}
    ${jsonToHtml('GPU', info.gpu as Record<string, unknown>, false)}
    ${jsonToHtml('Platform', info.platform as Record<string, unknown>, false)}
    ${jsonToHtml('Status', info.status as Record<string, unknown>, false)}
    ${jsonToHtml('Memory', formatMemoryInfo(info.memory) as Record<string, unknown>, false)}
    ${jsonToHtml('Browser', info.browser as Record<string, unknown>, false)}
  `;
}

async function getServerInfo(): Promise<void> {
  const requests = [
    authFetch(`${window.api}/version`),
    authFetch(`${window.api}/checkpoint`),
    authFetch(`${window.api}/loaded-loras`),
    authFetch(`${window.api}/torch`),
    authFetch(`${window.api}/gpu`),
    authFetch(`${window.api}/status`),
    authFetch(`${window.api}/memory`),
    authFetch(`${window.api}/platform`),
  ];
  const responses = await Promise.all(requests);
  info = {
    version: responses[0]?.ok ? await responses[0].json() : {},
    model: responses[1]?.ok ? await responses[1].json() : {},
    networks: updateNetworksInfo(responses[2]?.ok ? await responses[2].json() : []),
    torch: responses[3]?.ok ? await responses[3].json() : {},
    gpu: responses[4]?.ok ? await responses[4].json() : {},
    status: responses[5]?.ok ? await responses[5].json() : {},
    memory: responses[6]?.ok ? await responses[6].json() : {},
    platform: responses[7]?.ok ? await responses[7].json() : {},
    browser: { agent: navigator.userAgent },
  };
  if (initial) log('getServerInfo', info);
  initial = false;
  renderServerInfo();
}

export async function initServerInfo(): Promise<void> {
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  const el = document.getElementById('serverinfo');
  if (!el) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (initial) getServerInfo();
        if (!refreshTimer) refreshTimer = setInterval(getServerInfo, refreshInterval);
      } else {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = null;
      }
    });
  });
  observer.observe(el);

  const btnCopy = document.getElementById('serverinfo-copy');
  if (!btnCopy) return;
  btnCopy.addEventListener('click', (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (!info) return;
    const infoToCopy = {
      version: info.version,
      model: info.model,
      torch: info.torch,
      gpu: info.gpu,
      platform: info.platform,
    };
    navigator.clipboard.writeText(JSON.stringify(infoToCopy, null, 2));
    log('infoCopy', infoToCopy);
  });
}

// Expose toggleHide globally for inline onclick handlers in dynamically rendered HTML
window.toggleHide = toggleHide;
window.getServerInfo = getServerInfo;
