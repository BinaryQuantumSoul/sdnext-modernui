/* Logger setup and error overlay helpers for ModernUI. */
export function logPrettyPrint(...args: unknown[]): string {
  let output = '';
  const dt = new Date();
  const [h, m, s, ms] = [dt.getHours().toString(), dt.getMinutes().toString(), dt.getSeconds().toString(), dt.getMilliseconds().toString()];
  const ts = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${ms.padStart(3, '0')}`;
  output += `<div class="log-row"><span class="log-date">${ts}</span>`;

  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (arg === undefined) arg = 'undefined';
    if (arg === null) arg = 'null';
    const argstr = String(arg).toLowerCase();
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
    if (String(arg).indexOf('.css') !== -1 || String(arg).indexOf('.html') !== -1) acolor += ' log-url';
    else if (String(arg).indexOf('\n') !== -1) output += '<br />';
    output += `<span class="log-${(typeof arg)} ${acolor}">`;
    if (typeof arg === 'object') output += JSON.stringify(arg);
    else output += arg;
    output += ' </span>';
  }
  output += '</div>';
  return output;
}

export async function setupLogger(): Promise<void> {
  const uiDisabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled as string[] : [];
  if (uiDisabled?.includes('logs')) return;
  const logMonitorJS = document.createElement('div');
  logMonitorJS.id = 'logMonitorJS';
  document.body.append(logMonitorJS);
  window.logger = logMonitorJS;
  window.logPrettyPrint = logPrettyPrint;
}

export function largeErrorOverlay(msg: string, err: Error): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(255, 0, 0, 0.2);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999;';

  const content = document.createElement('div');
  content.style.cssText = 'background-color:#fff;color:#000;padding:10px;max-width:90%;display:flex;flex-direction:column;gap:10px;pointer-events:auto';

  const header = document.createElement('div');
  header.style.cssText = 'font-size:1.5em;font-weight:bold;margin-bottom:10px;text-align:center;';
  header.textContent = msg;

  const summary = document.createElement('div');
  summary.textContent = String(err);

  const stack = document.createElement('pre');
  stack.style.cssText = 'white-space:pre-wrap;word-break:break-word;max-height:70vh;overflow-y:auto;';
  stack.textContent = err.stack || new Error().stack || '';

  const dismiss = document.createElement('button');
  dismiss.textContent = 'Close';
  dismiss.style.cssText = 'margin-top:10px;align-self:center;padding:5px 10px;background-color:var(--color-error);';
  dismiss.onclick = () => overlay.remove();

  content.append(header, summary, stack, dismiss);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}
