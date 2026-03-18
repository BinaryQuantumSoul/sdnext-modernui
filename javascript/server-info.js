let info = null;
let initial = true;

function toggleHide(name) {
  const el = document.getElementById(name);
  if (el) el.classList.toggle('hide');
}

function jsonToHtml(heading, json, cls = '') {
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

async function renderServerInfo() {
  if (!info) return;
  const el = document.getElementById('serverinfo');
  el.innerHTML = `
    <div id="server-info-time">
      ${new Date().toLocaleString()}
    </div>
    ${jsonToHtml('Version', info.version)}
    ${jsonToHtml('Model', info.model)}
    ${jsonToHtml('Torch', info.torch)}
    ${jsonToHtml('GPU', info.gpu)}
    ${jsonToHtml('Platform', info.platform)}
    ${jsonToHtml('Status', info.status, 'hide')}
    ${jsonToHtml('Memory', info.memory, 'hide')}
    ${jsonToHtml('Browser', info.browser, 'hide')}
  `;
}

async function getServerInfo() {
  const version_req = await authFetch(`${window.api}/version`);
  const torch_req = await authFetch(`${window.api}/torch`);
  const gpu_req = await authFetch(`${window.api}/gpu`);
  const status_req = await authFetch(`${window.api}/status`);
  const memory_req = await authFetch(`${window.api}/memory`);
  const platform_req = await authFetch(`${window.api}/platform`);
  const model_req = await authFetch(`${window.api}/checkpoint`);
  info = {
    version: version_req.ok ? await version_req.json() : {},
    model: model_req.ok ? await model_req.json() : {},
    torch: torch_req.ok ? await torch_req.json() : {},
    gpu: gpu_req.ok ? await gpu_req.json() : {},
    status: status_req.ok ? await status_req.json() : {},
    memory: memory_req.ok ? await memory_req.json() : {},
    platform: platform_req.ok ? await platform_req.json() : {},
    browser: navigator.userAgent,
  };
  log('getServerInfo', info);
  renderServerInfo();
}

async function initServerInfo() {
  let refreshTimer;
  const el = document.getElementById('serverinfo');
  // monitor el and if its visible, refresh the info every 5 seconds
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (initial) getServerInfo();
        if (!refreshTimer) refreshTimer = setInterval(getServerInfo, 2000);
        initial = false;
      } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    });
  });
  observer.observe(el);
}
