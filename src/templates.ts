/* Template loader and nested template discovery for ModernUI. */
import { state } from './state';

export interface TemplateDescriptor {
  template: string;
  key: string | null;
  target: Element | null;
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

export async function loadCurrentTemplate(data: TemplateDescriptor[], htmlPath: string): Promise<void> {
  const currData = data.shift();
  if (currData) {
    const t0 = performance.now();
    const uiDisabled = Array.isArray(window.opts.ui_disabled) ? window.opts.ui_disabled as string[] : [];
    for (const disabled of uiDisabled) {
      if (currData.template.includes(disabled)) {
        log('loadTemplate', currData.template, 'disabled');
        return loadCurrentTemplate(data, htmlPath);
      }
    }

    const uri = `${window.subpath}${htmlPath}/templates/${currData.template}.html?${Date.now()}`;
    const response = await fetch(uri, { cache: 'reload' });
    if (!response.ok) {
      error('loadTemplate', currData.template, currData.target);
      if (currData.target) currData.target.setAttribute('status', 'error');
    } else {
      const text = await response.text();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currData.key ? text.replace(/\s*\{\{.*?\}\}\s*/g, currData.key) : text;
      const nestedData = await getNestedTemplates(tempDiv);
      data.push(...nestedData);
      if (currData.target) {
        currData.target.setAttribute('status', 'true');
        currData.target.append(tempDiv.firstElementChild!);
      } else {
        error('loadTemplateNoTarget', currData);
      }
    }
    const t1 = performance.now();
    timer(`loadTemplate:${currData.template}`, t1 - t0);
    return loadCurrentTemplate(data, htmlPath);
  }
  return Promise.resolve();
}

export async function loadAllTemplates(htmlPath: string, rootTemplate: string, tabId: string): Promise<void> {
  const data: TemplateDescriptor[] = [
    {
      template: rootTemplate,
      key: null,
      target: document.querySelector(tabId),
    },
  ];

  if (!data[0].target) error('LoadAllTemplates: missing target', data);
  const t0 = performance.now();
  await loadCurrentTemplate(data, htmlPath);
  const t1 = performance.now();
  timer('loadAllTemplates:load', t1 - t0);
  await replaceRootTemplate('#sdnext_app');
  const t2 = performance.now();
  timer('loadAllTemplates:replace', t2 - t1);
  log('loadAllTemplates', `load=${Math.round(t1 - t0)} replace=${Math.round(t2 - t1)}`);
}
