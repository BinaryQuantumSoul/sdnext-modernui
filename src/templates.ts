/* Template loader and nested template discovery for ModernUI. */
import { state } from './state';

export interface TemplateDescriptor {
  template: string;
  key: string | null;
  target: Element | null;
}

const MAX_CONCURRENT_TEMPLATE_LOADS = 16;
const LEGACY_HTML_PATH = '/file=extensions-builtin/sdnext-modernui/html';

function getServerTiming(response: Response): number {
  const duration = response.headers.get('Server-Timing')?.match(/dur=([\d.]+)/)?.[1];
  return duration ? Number(duration) : 0;
}

export async function replaceRootTemplate(appId: string): Promise<void> {
  state.appUiUx = document.querySelector(appId);
  if (!state.appUiUx) {
    throw new Error(`Root element with id "${appId}" not found`);
  }
  gradioApp().insertAdjacentElement('afterbegin', state.appUiUx);
}

export async function getNestedTemplates(container: Element): Promise<TemplateDescriptor[]> {
  const nestedData: TemplateDescriptor[] = [];
  container.querySelectorAll('.template').forEach((el) => {
    nestedData.push({
      template: el.getAttribute('template') ?? '',
      key: el.getAttribute('key'),
      target: el,
    });
  });
  return nestedData;
}

export async function loadCurrentTemplate(data: TemplateDescriptor[], htmlPath: string, templateVersions: Record<string, string>, templateContents: Record<string, string>): Promise<void> {
  while (data.length > 0) {
    const batch = data.splice(0, MAX_CONCURRENT_TEMPLATE_LOADS);
    const nestedTemplates = await Promise.all(batch.map(async (currData) => {
      const t0 = performance.now();
      const uiDisabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled as string[] : [];
      if (uiDisabled.some((disabled) => currData.template.includes(disabled))) {
        log('loadTemplate', { template: currData.template, status: 'disabled' });
        return [];
      }

      const templatePath = `templates/${currData.template}.html`;
      const version = templateVersions[templatePath];
      const uri = `${window.subpath}${htmlPath}/${templatePath}${version ? `?v=${version}` : ''}`;
      const fetchStart = performance.now();
      let response: Response | undefined;
      let text = templateContents[templatePath];
      if (text === undefined) response = await authFetch(uri, version ? {} : { cache: 'no-cache' });
      const fetchEnd = performance.now();
      let nestedData: TemplateDescriptor[] = [];
      let bodyMs = 0;
      let parseMs = 0;
      let appendMs = 0;
      if (text === undefined && !response?.ok) {
        error('loadTemplate', { template: currData.template, target: currData.target, status: 'error' });
        if (currData.target) currData.target.setAttribute('status', 'error');
      } else {
        if (text === undefined && response) {
          const bodyStart = performance.now();
          text = await response.text();
          bodyMs = performance.now() - bodyStart;
        }
        const parseStart = performance.now();
        const tempDiv = document.createElement('div');
        const templateText = text ?? '';
        tempDiv.innerHTML = currData.key ? templateText.replace(/\s*\{\{.*?\}\}\s*/g, currData.key) : templateText;
        nestedData = await getNestedTemplates(tempDiv);
        parseMs = performance.now() - parseStart;
        if (currData.target) {
          const appendStart = performance.now();
          currData.target.setAttribute('status', 'true');
          currData.target.append(tempDiv.firstElementChild!);
          appendMs = performance.now() - appendStart;
        } else {
          error('loadTemplateNoTarget', { template: currData.template, key: currData.key, status: 'error' });
        }
      }
      const t1 = performance.now();
      timer(`loadTemplate:${currData.template}`, t1 - t0);
      timer(`loadTemplate:${currData.template}:fetch`, fetchEnd - fetchStart);
      timer(`loadTemplate:${currData.template}:server`, response ? getServerTiming(response) : 0);
      timer(`loadTemplate:${currData.template}:body`, bodyMs);
      timer(`loadTemplate:${currData.template}:parse`, parseMs);
      timer(`loadTemplate:${currData.template}:append`, appendMs);
      return nestedData;
    }));
    nestedTemplates.forEach((nestedData) => data.push(...nestedData));
  }
}

export async function loadAllTemplates(htmlPath: string, rootTemplate: string, tabId: string): Promise<void> {
  const data: TemplateDescriptor[] = [
    {
      template: rootTemplate,
      key: null,
      target: document.querySelector(tabId),
    },
  ];

  if (!data[0].target) error('LoadAllTemplates: missing target', { template: rootTemplate, target: data[0].target, status: 'error' });
  const t0 = performance.now();
  let templateVersions: Record<string, string> = {};
  let templateContents: Record<string, string> = {};
  let templateHtmlPath = htmlPath;
  const manifestFetchStart = performance.now();
  let manifestFetchEnd = manifestFetchStart;
  let manifestServerMs = 0;
  try {
    const manifestResponse = await authFetch(`${window.subpath}${htmlPath}`, { cache: 'no-cache' });
    manifestFetchEnd = performance.now();
    manifestServerMs = manifestResponse ? getServerTiming(manifestResponse) : 0;
    if (!manifestResponse?.ok) throw new Error(`Manifest request failed: ${manifestResponse?.status ?? 'no response'}`);
    const manifestBody = await manifestResponse.text();
    const manifestBodyEnd = performance.now();
    const payload = JSON.parse(manifestBody) as unknown;
    const manifestParsed = performance.now();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid manifest payload');
    const payloadData = payload as Record<string, unknown>;
    const versions = payloadData.manifest;
    const contents = payloadData.templates;
    if (!versions || typeof versions !== 'object' || Array.isArray(versions) || !contents || typeof contents !== 'object' || Array.isArray(contents)) {
      throw new Error('Manifest does not include bundled templates');
    }
    templateVersions = Object.fromEntries(Object.entries(versions).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    templateContents = Object.fromEntries(Object.entries(contents).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    timer('loadAllTemplates:manifest:fetch', manifestFetchEnd - manifestFetchStart);
    timer('loadAllTemplates:manifest:body', manifestBodyEnd - manifestFetchEnd);
    timer('loadAllTemplates:manifest:json', manifestParsed - manifestBodyEnd);
  } catch (err) {
    if (manifestFetchEnd === manifestFetchStart) manifestFetchEnd = performance.now();
    templateHtmlPath = LEGACY_HTML_PATH;
    templateVersions = {};
    templateContents = {};
    log('loadTemplateManifestFallback', { path: templateHtmlPath, error: String(err) });
    timer('loadAllTemplates:manifest:fetch', manifestFetchEnd - manifestFetchStart);
    timer('loadAllTemplates:manifest:body', 0);
    timer('loadAllTemplates:manifest:json', 0);
  }
  const t1 = performance.now();
  timer('loadAllTemplates:manifest', t1 - t0);
  timer('loadAllTemplates:manifest-server', manifestServerMs);
  await loadCurrentTemplate(data, templateHtmlPath, templateVersions, templateContents);
  const t2 = performance.now();
  timer('loadAllTemplates:templates', t2 - t1);
  timer('loadAllTemplates:load', t2 - t0);
  await replaceRootTemplate('#sdnext_app');
  const t3 = performance.now();
  timer('loadAllTemplates:replace', t3 - t2);
  log('loadAllTemplates', { manifest: Math.round(t1 - t0), load: Math.round(t2 - t1), replace: Math.round(t3 - t2) });
}
