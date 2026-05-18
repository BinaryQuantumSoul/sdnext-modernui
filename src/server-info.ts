/* Server info fetch/render utilities and inline toggle helpers. */
let info: Record<string, unknown> | null = null;
let initial = true;

function toggleHide(name: string): void {
  const el = document.getElementById(name);
  if (el) el.classList.toggle('hide');
}

// Expose toggleHide globally for inline onclick handlers in dynamically rendered HTML
window.toggleHide = toggleHide;

function jsonToHtml(heading: string, json: Record<string, unknown> | null | undefined, cls = ''): string {
  if (!json) return '';
  const entries = Object.entries(json);
  if (entries.length === 0) return '';
  return `
    <h3 onclick="toggleHide('server-info-table-${heading}')">${heading}</h3>
    <div class="server-info-table ${cls}" id="server-info-table-${heading}">
      <table class="table-wrap">
        ${entries
          .map(([key, value]) => `
            <tr>
              <td>${key}</td>
              <td>${typeof value === 'object' ? JSON.stringify(value) : value}</td>
            </tr>
          `).join('')}
      </table>
    </div>
  `;
}

async function renderServerInfo(): Promise<void> {
  if (!info) return;
  const el = document.getElementById('serverinfo');
  if (!el) return;
  el.innerHTML = `
    <div id="server-info-time">
      ${new Date().toLocaleString()}
    </div>
    ${jsonToHtml('Version', info.version as Record<string, unknown>)}
    ${jsonToHtml('Model', info.model as Record<string, unknown>)}
    ${jsonToHtml('Torch', info.torch as Record<string, unknown>)}
    ${jsonToHtml('GPU', info.gpu as Record<string, unknown>)}
    ${jsonToHtml('Platform', info.platform as Record<string, unknown>)}
    ${jsonToHtml('Status', info.status as Record<string, unknown>, 'hide')}
    ${jsonToHtml('Memory', info.memory as Record<string, unknown>, 'hide')}
    ${jsonToHtml('Browser', info.browser as Record<string, unknown>, 'hide')}
  `;
}

async function getServerInfo(): Promise<void> {
  const versionReq = await authFetch(`${window.api}/version`);
  const torchReq = await authFetch(`${window.api}/torch`);
  const gpuReq = await authFetch(`${window.api}/gpu`);
  const statusReq = await authFetch(`${window.api}/status`);
  const memoryReq = await authFetch(`${window.api}/memory`);
  const platformReq = await authFetch(`${window.api}/platform`);
  const modelReq = await authFetch(`${window.api}/checkpoint`);
  info = {
    version: versionReq.ok ? await versionReq.json() : {},
    model: modelReq.ok ? await modelReq.json() : {},
    torch: torchReq.ok ? await torchReq.json() : {},
    gpu: gpuReq.ok ? await gpuReq.json() : {},
    status: statusReq.ok ? await statusReq.json() : {},
    memory: memoryReq.ok ? await memoryReq.json() : {},
    platform: platformReq.ok ? await platformReq.json() : {},
    browser: { agent: navigator.userAgent },
  };
  if (initial) log('getServerInfo', info);
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
        if (!refreshTimer) refreshTimer = setInterval(getServerInfo, 10000);
        initial = false;
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
