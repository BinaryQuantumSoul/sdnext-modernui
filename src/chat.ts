/* Session-backed deterministic chat client for ModernUI. */

import { ChatInputEditor } from './chat-input';

interface ChatSession {
  id: string;
  title: string;
  context: 'image' | 'video' | 'process' | 'caption';
  drafts: Record<string, Record<string, unknown>>;
  last_generation_prompt: string | null;
  last_generation_snapshot: Record<string, unknown> | null;
  selected_image_id: string | null;
  selected_image_ids: string[];
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ChatArtifact {
  id: string;
  message_id: string | null;
  media_type: string;
  display_name: string;
  role: 'input' | 'result';
  source_artifact_id: string | null;
  source_deleted: boolean;
  created_at: string;
  available: boolean;
}

interface ChatSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
  operations: Record<string, unknown>[];
  artifacts: ChatArtifact[];
  restore_errors: string[];
}

interface ChatSubmission {
  session: ChatSession;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  result: {
    kind: 'text' | 'operation' | 'schedule' | 'endpoint' | 'error';
    text: string;
    data: Record<string, unknown>;
    sections?: ChatMessageSection[];
  };
  artifacts: ChatArtifact[];
}

interface ChatEndpointResult {
  content: string;
  metadata: Record<string, unknown>;
}

interface ChatMessageSection {
  title: string;
  content: string;
  format?: string;
}

interface ChatParameterEntry {
  name: string;
  type: string;
  value: string;
  is_set: boolean;
  is_none?: boolean;
}

interface ChatLocaleEntry {
  id: string;
  label: string;
  localized: string;
  hint?: string;
}

function chatText(id: string, fallback: string): string {
  const entries = window.localization?._;
  if (Array.isArray(entries)) {
    const entry = entries.find((item: unknown): item is ChatLocaleEntry => Boolean(
      item && typeof item === 'object' && 'id' in item && item.id === id,
    ));
    if (entry?.localized) return entry.localized;
    if (entry?.label) return entry.label;
  }
  return fallback;
}

function setChatHint(element: HTMLElement, id: string): void {
  const entries = window.localization?._;
  if (!Array.isArray(entries)) return;
  const entry = entries.find((item: unknown): item is ChatLocaleEntry => Boolean(
    item && typeof item === 'object' && 'id' in item && item.id === id,
  ));
  if (!entry?.hint) return;
  if (window.opts.tooltips === 'Browser default') element.title = entry.hint;
  else if (window.opts.tooltips === 'UI tooltips') element.dataset.hint = entry.hint;
}

const CHAT_HTML_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'kbd', 'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'sup', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]);
const CHAT_HTML_BLOCKED_TAGS = new Set(['iframe', 'object', 'script', 'style', 'svg', 'template']);

function appendSafeHtml(target: Node, html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const copyNode = (node: Node, parent: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();
    if (CHAT_HTML_BLOCKED_TAGS.has(tagName)) return;
    if (!CHAT_HTML_TAGS.has(tagName)) {
      element.childNodes.forEach((child) => copyNode(child, parent));
      return;
    }
    const safeElement = document.createElement(tagName);
    if (tagName === 'span' && element.classList.contains('chat-file-line')) {
      safeElement.classList.add('chat-file-line');
    }
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href) {
        try {
          const url = new URL(href, document.baseURI);
          if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
            safeElement.setAttribute('href', url.href);
            safeElement.setAttribute('target', '_blank');
            safeElement.setAttribute('rel', 'noopener noreferrer');
          }
        } catch {
          // Ignore invalid link targets.
        }
      }
    }
    element.childNodes.forEach((child) => copyNode(child, safeElement));
    parent.appendChild(safeElement);
  };
  parsed.body.childNodes.forEach((node) => copyNode(node, target));
}

async function getResponseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json() as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    // Keep the HTTP status when the response is not JSON.
  }
  return `${response.status} ${response.statusText}`;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await authFetch(`${window.api}${path}`, { ...options, headers });
  if (!response) throw new Error('The chat API did not return a response');
  if (!response.ok) throw new Error(await getResponseErrorDetail(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function setMessageContent(content: HTMLElement, message: ChatMessage): void {
  content.replaceChildren();
  content.classList.remove('chat-message-params');
  const rawData = message.metadata.data;
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    const data = rawData as Record<string, unknown>;
    if (data.format === 'params' && Array.isArray(data.parameters)) {
      const parameters = data.parameters.filter((entry): entry is ChatParameterEntry => Boolean(
        entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string'
        && 'type' in entry && typeof entry.type === 'string'
        && 'value' in entry && typeof entry.value === 'string'
        && 'is_set' in entry && typeof entry.is_set === 'boolean',
      ));
      if (parameters.length > 0) {
        content.classList.remove('chat-message-sections');
        content.classList.add('chat-message-params');
        const table = document.createElement('table');
        table.className = 'chat-parameter-table';
        const head = document.createElement('thead');
        const heading = document.createElement('tr');
        ['Key', 'Type', 'Value'].forEach((label) => {
          const cell = document.createElement('th');
          cell.scope = 'col';
          cell.textContent = label;
          heading.append(cell);
        });
        head.append(heading);
        const body = document.createElement('tbody');
        parameters.forEach((parameter) => {
          const row = document.createElement('tr');
          row.className = 'chat-parameter-row';
          if (parameter.is_set) row.dataset.set = 'true';
          const name = document.createElement('th');
          name.scope = 'row';
          name.textContent = parameter.name;
          const type = document.createElement('td');
          type.className = 'chat-parameter-type';
          type.textContent = parameter.type;
          const valueCell = document.createElement('td');
          const value = document.createElement('span');
          value.className = 'chat-parameter-value';
          value.dataset.type = parameter.type;
          value.dataset.none = String(parameter.is_none ?? parameter.value === 'None');
          value.textContent = parameter.value;
          valueCell.append(value);
          row.append(name, type, valueCell);
          body.append(row);
        });
        table.append(head, body);
        content.append(table);
        return;
      }
    }
  }
  const rawSections = message.metadata.sections;
  if (Array.isArray(rawSections)) {
    const sections = rawSections.filter((section): section is ChatMessageSection => Boolean(
      section && typeof section === 'object' && 'title' in section && typeof section.title === 'string'
      && 'content' in section && typeof section.content === 'string',
    ));
    if (sections.length > 0) {
      content.classList.add('chat-message-sections');
      sections.forEach((section) => {
        const sectionElement = document.createElement('section');
        sectionElement.className = 'chat-message-section';
        const title = document.createElement('h3');
        title.className = 'chat-message-section-title';
        title.textContent = section.title;
        const sectionContent = document.createElement('div');
        sectionContent.className = 'chat-message-section-content';
        if (section.format === 'html') {
          appendSafeHtml(sectionContent, section.content);
        } else if (section.format === 'json' || section.format === 'key-value') {
          const pre = document.createElement('pre');
          pre.textContent = section.content;
          sectionContent.append(pre);
        } else {
          sectionContent.textContent = section.content;
        }
        sectionElement.append(title, sectionContent);
        content.append(sectionElement);
      });
      return;
    }
  }
  content.classList.remove('chat-message-sections');
  if (message.metadata.format === 'html') {
    appendSafeHtml(content, message.content);
  } else if (message.metadata.format === 'json' || message.metadata.format === 'key-value') {
    const pre = document.createElement('pre');
    pre.textContent = message.content;
    content.append(pre);
  } else {
    content.textContent = message.content;
  }
}

function appendMessage(container: HTMLElement, message: ChatMessage): void {
  document.getElementById('chat-empty-state')?.remove();
  const article = document.createElement('article');
  article.className = 'chat-message';
  article.dataset.messageId = message.id;
  article.dataset.role = message.role;
  const kind = message.metadata.kind;
  if (typeof kind === 'string') article.dataset.kind = kind;
  if (message.metadata.failed === true) article.dataset.error = 'true';

  const author = document.createElement('span');
  author.className = 'chat-message-author';
  author.textContent = message.role === 'user' ? chatText('chat-you', 'You') : chatText('chat-assistant', 'Assistant');

  const timestamp = document.createElement('time');
  timestamp.dateTime = message.created_at;
  timestamp.textContent = new Date(message.created_at).toLocaleTimeString();
  timestamp.className = 'chat-message-time';
  author.append(' ', timestamp);

  const content = document.createElement('div');
  content.className = 'chat-message-content';
  setMessageContent(content, message);
  article.append(author, content);
  container.append(article);
  container.scrollTop = container.scrollHeight;
}

function replaceMessage(container: HTMLElement, previousId: string, message: ChatMessage, moveToEnd = false): boolean {
  const article = Array.from(container.querySelectorAll<HTMLElement>('.chat-message'))
    .find((item) => item.dataset.messageId === previousId);
  if (!article) return false;
  article.dataset.messageId = message.id;
  article.dataset.role = message.role;
  if (typeof message.metadata.kind === 'string') article.dataset.kind = message.metadata.kind;
  else delete article.dataset.kind;
  if (message.metadata.failed === true) article.dataset.error = 'true';
  else delete article.dataset.error;
  const timestamp = article.querySelector<HTMLTimeElement>('.chat-message-time');
  if (timestamp) {
    timestamp.dateTime = message.created_at;
    timestamp.textContent = new Date(message.created_at).toLocaleTimeString();
  }
  const content = article.querySelector<HTMLElement>('.chat-message-content');
  if (!content) return false;
  setMessageContent(content, message);
  if (moveToEnd) container.append(article);
  container.scrollTop = container.scrollHeight;
  return true;
}

function updateProcessingMessage(container: HTMLElement, messageId: string, text: string): void {
  const article = Array.from(container.querySelectorAll<HTMLElement>('.chat-message'))
    .find((item) => item.dataset.messageId === messageId);
  const content = article?.querySelector<HTMLElement>('.chat-message-content');
  if (!content) return;
  const previous = content.dataset.lastProgressText ?? 'Processing...';
  if (previous === text) {
    content.dataset.lastProgressText = text;
    return;
  }
  const suffix = text.startsWith(previous) ? text.slice(previous.length) : `\n${text}`;
  const appended = content.dataset.lastProgressText === undefined && suffix ? `\n${suffix.trimStart()}` : suffix;
  if (!appended) return;
  content.dataset.lastProgressText = text;
  content.textContent = `${content.textContent}${appended}`;
  container.scrollTop = container.scrollHeight;
}

function updateProcessingProgressMessage(container: HTMLElement, messageId: string, progressLabel: string): void {
  if (!progressLabel) return;
  const article = Array.from(container.querySelectorAll<HTMLElement>('.chat-message'))
    .find((item) => item.dataset.messageId === messageId);
  const content = article?.querySelector<HTMLElement>('.chat-message-content');
  if (!content) return;
  const current = content.textContent || '';
  const firstLine = current.split('\n', 1)[0] || 'Processing...';
  const next = `${firstLine}\n${progressLabel}`;
  if (current === next) return;
  content.textContent = next;
  container.scrollTop = container.scrollHeight;
}

function watchImportProgress(container: HTMLElement, messageId: string): void {
  if (!window.requestProgress) return;
  window.requestProgress('undefined', null, null, null, (progress: unknown) => {
    if (
      progress && typeof progress === 'object'
      && 'active' in progress && progress.active === true
      && 'textinfo' in progress && typeof progress.textinfo === 'string'
      && progress.textinfo.startsWith('Processing...')
    ) {
      updateProcessingMessage(container, messageId, progress.textinfo);
    }
  });
}

function formatEndpointJson(value: unknown): string {
  const isRecord = (item: unknown): item is Record<string, unknown> => Boolean(
    item && typeof item === 'object' && !Array.isArray(item),
  );
  const scalar = (item: unknown): string => (item === null ? 'null' : String(item));
  const formatValue = (item: unknown, indent: string, key?: string, recordItem = false): string[] => {
    const prefix = key === undefined ? indent : `${indent}${key}:`;
    const valuePrefix = key === undefined ? indent : `${prefix} `;
    if (isRecord(item)) {
      const entries = Object.entries(item);
      if (entries.length === 0) return [`${valuePrefix}{}`];
      if (recordItem) {
        const [[firstKey, firstValue], ...remaining] = entries;
        return [
          ...formatValue(firstValue, indent, firstKey),
          ...remaining.flatMap(([childKey, child]) => formatValue(child, `${indent}  `, childKey)),
        ];
      }
      return [
        ...(key === undefined ? [] : [prefix]),
        ...entries.flatMap(([childKey, child]) => formatValue(child, key === undefined ? indent : `${indent}  `, childKey)),
      ];
    }
    if (Array.isArray(item)) {
      return item.length === 0
        ? [`${valuePrefix}[]`]
        : [
          ...(key === undefined ? [] : [prefix]),
          ...item.flatMap((child) => formatValue(child, key === undefined ? indent : `${indent}  `, undefined, isRecord(child))),
        ];
    }
    return [`${valuePrefix}${scalar(item)}`];
  };
  return formatValue(value, '').join('\n');
}

function formatGpuSections(value: unknown): ChatMessageSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const gpu = item as Record<string, unknown>;
    const name = typeof gpu.name === 'string' ? gpu.name : 'GPU';
    const data = gpu.data && typeof gpu.data === 'object' && !Array.isArray(gpu.data)
      ? gpu.data as Record<string, unknown>
      : {};
    return [{ title: name, content: formatEndpointJson(data), format: 'key-value' }];
  });
}

function formatMemorySections(value: unknown): ChatMessageSection[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const memory = value as Record<string, unknown>;
  return [
    { title: 'RAM', content: formatEndpointJson(memory.ram), format: 'key-value' },
    { title: 'CUDA', content: formatEndpointJson(memory.cuda), format: 'key-value' },
    { title: 'Model', content: formatEndpointJson(memory.model), format: 'key-value' },
  ];
}

function formatSectionsText(sections: ChatMessageSection[]): string {
  return sections.map((section) => `${section.title}\n${section.content}`).join('\n\n');
}

function emptyMessageList(container: HTMLElement): void {
  const empty = document.createElement('div');
  empty.id = 'chat-empty-state';
  empty.className = 'chat-empty-state';
  const icon = document.createElement('div');
  icon.className = 'mask-icon icon-chat';
  icon.setAttribute('aria-hidden', 'true');
  const title = document.createElement('strong');
  title.textContent = chatText('chat-empty-title', 'No messages yet');
  const prompt = document.createElement('span');
  prompt.textContent = chatText('chat-empty-prompt', 'Send a message to begin.');
  empty.append(icon, title, prompt);
  container.append(empty);
}

export function initChat(): void {
  const t0 = performance.now();
  const container = document.getElementById('chat-messages');
  const form = document.getElementById('chat-composer');
  const input = document.getElementById('chat-input');
  const fileButton = document.getElementById('chat-file-button');
  const filePicker = document.getElementById('chat-file-picker');
  const workspace = document.querySelector<HTMLElement>('.chat-workspace');
  const help = document.getElementById('chat-help');
  const heading = document.getElementById('chat-heading');
  const currentSessionLabel = document.getElementById('chat-current-session-label');
  const currentSessionName = document.getElementById('chat-current-session-name');
  const resultsContent = document.querySelector<HTMLElement>('#layout-chat-results .chat-results-content');
  const resultInfoButton = document.getElementById('chat-result-info');
  const resultOpenFolderButton = document.getElementById('chat-result-open-folder');
  const resultSaveButton = document.getElementById('chat-result-save');
  const resultDeleteButton = document.getElementById('chat-result-delete');
  const resultInfoDetails = document.getElementById('chat-result-info-details');
  const resultActionToolbar = document.querySelector<HTMLElement>('#accordion-chat-results [role="toolbar"]');
  const chatGenerate = document.getElementById('chat_generate');
  const chatSchedule = document.getElementById('chat-schedule');
  const chatReprocess = document.getElementById('chat-reprocess');
  const chatLoop = document.getElementById('chat-loop');
  const chatSkip = document.getElementById('chat-skip');
  const chatPause = document.getElementById('chat-pause');
  const chatInterrupt = document.getElementById('chat-interrupt');
  const sessionLabel = document.getElementById('chat-session-label');
  const sessionToggle = document.getElementById('chat-session-toggle');
  const sessionPanel = document.getElementById('chat-session-panel');
  const sessionList = document.getElementById('chat-session-list');
  const newSession = document.getElementById('chat-new-session');
  const closeSessionPanel = document.getElementById('chat-close-sessions');
  const renameDialog = document.getElementById('chat-rename-session-dialog');
  const renameForm = document.getElementById('chat-rename-session-form');
  const renameInput = document.getElementById('chat-rename-session-input');
  const renameHeading = document.getElementById('chat-rename-session-heading');
  const renameLabel = document.getElementById('chat-rename-session-label');
  const renameCancel = document.getElementById('chat-rename-session-cancel');
  const renameSave = document.getElementById('chat-rename-session-save');
  if (!(container instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(input instanceof HTMLElement)
    || !(fileButton instanceof HTMLButtonElement) || !(filePicker instanceof HTMLInputElement)
    || !(workspace instanceof HTMLElement)
    || !(help instanceof HTMLButtonElement) || !(heading instanceof HTMLElement)
    || !(currentSessionLabel instanceof HTMLElement) || !(currentSessionName instanceof HTMLElement)
    || !(resultInfoButton instanceof HTMLButtonElement) || !(resultOpenFolderButton instanceof HTMLButtonElement)
    || !(resultSaveButton instanceof HTMLButtonElement) || !(resultDeleteButton instanceof HTMLButtonElement)
    || !(resultInfoDetails instanceof HTMLElement)
    || !(resultActionToolbar instanceof HTMLElement)
    || !(sessionLabel instanceof HTMLElement)
    || !(chatGenerate instanceof HTMLButtonElement) || !(chatSchedule instanceof HTMLButtonElement)
    || !(chatReprocess instanceof HTMLButtonElement) || !(chatLoop instanceof HTMLButtonElement)
    || !(chatSkip instanceof HTMLButtonElement) || !(chatPause instanceof HTMLButtonElement)
    || !(chatInterrupt instanceof HTMLButtonElement)
    || !(sessionToggle instanceof HTMLButtonElement)
    || !(sessionPanel instanceof HTMLElement) || !(sessionList instanceof HTMLElement)
    || !(newSession instanceof HTMLButtonElement) || !(closeSessionPanel instanceof HTMLButtonElement)
    || !(renameDialog instanceof HTMLDialogElement) || !(renameForm instanceof HTMLFormElement)
    || !(renameInput instanceof HTMLInputElement) || !(renameHeading instanceof HTMLHeadingElement)
    || !(renameLabel instanceof HTMLLabelElement)
    || !(renameCancel instanceof HTMLButtonElement) || !(renameSave instanceof HTMLButtonElement)) return;
  const chatGenerateLabel = chatGenerate.querySelector('span');
  if (!(chatGenerateLabel instanceof HTMLSpanElement)) return;
  const initialGenerateLabel = chatGenerateLabel.textContent || 'Generate';
  const setGenerateLabel = (label: string): void => {
    chatGenerateLabel.textContent = label;
    chatGenerate.title = label;
    chatGenerate.setAttribute('aria-label', label);
    setChatHint(chatGenerate, 'chat_generate');
  };

  let activeSession: ChatSession | null = null;
  let activeArtifacts: ChatArtifact[] = [];
  let activeMessages: ChatMessage[] = [];
  let parameterSessionId: string | null = null;
  let parameterContext: ChatSession['context'] | null = null;
  let parameterEntries: ChatParameterEntry[] = [];
  const parameterChoiceCache = new Map<string, Promise<string[]>>();
  let visibleResultMessageId: string | null = null;
  let artifactSelectionUpdates = Promise.resolve();
  let renamingSession: ChatSession | null = null;
  const commandHistory: string[] = [];
  let commandHistoryIndex = 0;
  let commandHistoryDraft = '';
  let inputEditor: ChatInputEditor | null = null;
  let submitting = false;
  let latestGeneratedImage: string | null = null;
  const latestGeneratedImages = new Map<string, string>();
  const sessionResultImages = new Map<string, string[]>();
  const artifactObjectUrls = new Map<string, string>();
  let activeGenerations = 0;
  let loopEnabled = false;
  let generationPaused = false;
  const disabled = window.opts.chat_enabled !== true;
  const storageKey = `sdnext-chat-session:${window.subpath || ''}`;
  setChatHint(input, 'chat-input');
  setChatHint(renameInput, 'chat-rename-session-input');
  heading.textContent = chatText('chat-header', 'Chat');

  const selectedImageIds = (): string[] => {
    const ids = activeSession?.selected_image_ids;
    if (Array.isArray(ids) && ids.length > 0) return ids;
    return activeSession?.selected_image_id ? [activeSession.selected_image_id] : [];
  };

  const getSelectedArtifact = (): ChatArtifact | undefined => {
    const results = activeArtifacts.filter((artifact) => (
      artifact.role === 'result'
      && artifact.media_type.startsWith('image/')
      && artifact.available
      && (!visibleResultMessageId || artifact.message_id === visibleResultMessageId)
    ));
    const selectedIds = selectedImageIds();
    return results.find((artifact) => selectedIds.includes(artifact.id)) || results[0];
  };

  const getParameterEntries = (): ChatParameterEntry[] => (
    activeSession?.id === parameterSessionId && activeSession.context === parameterContext ? parameterEntries : []
  );

  const refreshParameterEntries = async (session: ChatSession): Promise<void> => {
    if (session.id === parameterSessionId && session.context === parameterContext) return;
    parameterChoiceCache.clear();
    try {
      const result = await apiRequest<{ context: ChatSession['context']; parameters: ChatParameterEntry[] }>(
        `/chat/sessions/${encodeURIComponent(session.id)}/parameters`,
      );
      if (activeSession?.id === session.id && activeSession.context === result.context) {
        parameterSessionId = session.id;
        parameterContext = result.context;
        parameterEntries = result.parameters;
      }
    } catch (err) {
      console.warn('Chat parameter autocomplete is unavailable', err);
    }
  };

  const getParameterChoices = (name: string): Promise<string[]> => {
    const session = activeSession;
    if (!session) return Promise.resolve([]);
    const key = `${session.id}:${session.context}:${name.toLowerCase()}`;
    const cached = parameterChoiceCache.get(key);
    if (cached) return cached;
    const request = apiRequest<{ name: string; choices: string[] }>(
      `/chat/sessions/${encodeURIComponent(session.id)}/choices?name=${encodeURIComponent(name)}`,
    ).then((result) => result.choices).catch((err: unknown) => {
      parameterChoiceCache.delete(key);
      console.warn('Chat choice autocomplete is unavailable', err);
      return [];
    });
    parameterChoiceCache.set(key, request);
    return request;
  };

  const updateResultActionButtons = (): void => {
    const selected = getSelectedArtifact();
    const actionDisabled = disabled || submitting || !selected;
    resultInfoButton.disabled = actionDisabled;
    resultOpenFolderButton.disabled = actionDisabled;
    resultSaveButton.disabled = actionDisabled;
    resultDeleteButton.disabled = actionDisabled;
  };

  const updateToolbarButtons = (): void => {
    const context = activeSession?.context;
    const isBusy = disabled || submitting;
    const hasSnapshot = Boolean(activeSession?.last_generation_snapshot);
    const canGenerate = context === 'image' || context === 'video' || Boolean(latestGeneratedImage);
    chatGenerate.disabled = isBusy || activeGenerations > 0 || !canGenerate;
    chatSchedule.disabled = isBusy || activeGenerations > 0 || !['image', 'video'].includes(String(context));
    chatReprocess.disabled = isBusy || activeGenerations > 0 || !(hasSnapshot || (['process', 'caption'].includes(String(context)) && Boolean(latestGeneratedImage)));
    chatLoop.disabled = isBusy || !canGenerate;
    chatSkip.disabled = isBusy || activeGenerations === 0;
    chatPause.disabled = isBusy || activeGenerations === 0;
    chatInterrupt.disabled = isBusy || activeGenerations === 0;
    updateResultActionButtons();
    if (activeGenerations === 0) setGenerateLabel(initialGenerateLabel);
    chatLoop.setAttribute('aria-pressed', String(loopEnabled));
    chatPause.setAttribute('aria-pressed', String(generationPaused));
  };

  const updateSessionTitle = (): void => {
    const label = chatText('chat-sessions-heading', 'Sessions');
    sessionLabel.textContent = label;
    sessionToggle.title = activeSession ? `${label}: ${activeSession.title}` : label;
    sessionToggle.setAttribute('aria-label', sessionToggle.title);
    setChatHint(sessionToggle, 'chat-session-toggle');
    currentSessionLabel.textContent = `${chatText('chat-session', 'Session')}:`;
    currentSessionName.textContent = disabled
      ? chatText('chat-disabled', 'Disabled')
      : activeSession?.title || chatText('chat-new-session', 'New chat');
    updateToolbarButtons();
  };

  updateSessionTitle();

  const setBusy = (busy: boolean): void => {
    submitting = busy;
    inputEditor?.setDisabled(disabled || busy);
    fileButton.disabled = disabled || busy;
    filePicker.disabled = disabled || busy;
    help.disabled = disabled || busy;
    sessionToggle.disabled = disabled || busy;
    newSession.disabled = disabled || busy;
    renameInput.disabled = disabled || busy;
    renameCancel.disabled = disabled || busy;
    renameSave.disabled = disabled || busy;
    sessionList.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = disabled || busy;
    });
    updateToolbarButtons();
  };

  const closePanel = (focusComposer: boolean): void => {
    sessionPanel.hidden = true;
    sessionToggle.setAttribute('aria-expanded', 'false');
    if (focusComposer && !disabled) inputEditor?.focus();
  };

  const openRenameDialog = (session: ChatSession): void => {
    renamingSession = session;
    renameInput.value = session.title;
    renameDialog.showModal();
    renameInput.focus();
    renameInput.select();
  };

  let deleteSessionById: (sessionId: string) => Promise<void>;

  const renderMessages = (messages: ChatMessage[]): void => {
    activeMessages = [...messages];
    container.replaceChildren();
    if (messages.length === 0) {
      emptyMessageList(container);
      return;
    }
    messages.forEach((message) => appendMessage(container, message));
  };

  const rememberMessages = (...messages: ChatMessage[]): void => {
    const updatedIds = new Set(messages.map((message) => message.id));
    activeMessages = [...activeMessages.filter((message) => !updatedIds.has(message.id)), ...messages];
  };

  const localErrorMessage = (err: unknown): ChatMessage => ({
    id: `error-${Date.now()}`,
    role: 'assistant',
    content: `${chatText('chat-request-failed', 'Chat request failed:')} ${err instanceof Error ? err.message : String(err)}`,
    metadata: { kind: 'error' },
    created_at: new Date().toISOString(),
  });
  const appendErrorMessage = (err: unknown): void => appendMessage(container, localErrorMessage(err));

  const rememberGeneratedImage = (image: string | null): void => {
    latestGeneratedImage = image;
    if (!activeSession) return;
    if (image) latestGeneratedImages.set(activeSession.id, image);
    else latestGeneratedImages.delete(activeSession.id);
  };

  const clearGenerationResults = (clearImage = true): void => {
    if (clearImage) {
      rememberGeneratedImage(null);
      if (activeSession) sessionResultImages.delete(activeSession.id);
    }
    if (!resultsContent) return;
    resultsContent.replaceChildren();
    resultsContent.dataset.hasImages = 'false';
    const icon = document.createElement('div');
    icon.className = 'mask-icon icon-results';
    icon.setAttribute('aria-hidden', 'true');
    resultsContent.append(icon);
    updateToolbarButtons();
  };

  const showGeneratedImages = (value: unknown): void => {
    if (!resultsContent) return;
    const images = Array.isArray(value)
      ? value.filter((image): image is string => typeof image === 'string' && image.length > 0)
      : [];
    rememberGeneratedImage(images[0] || null);
    if (activeSession) {
      if (images.length > 0) sessionResultImages.set(activeSession.id, images);
      else sessionResultImages.delete(activeSession.id);
    }
    resultsContent.replaceChildren();
    resultsContent.dataset.hasImages = String(images.length > 0);
    if (images.length === 0) {
      const icon = document.createElement('div');
      icon.className = 'mask-icon icon-results';
      icon.setAttribute('aria-hidden', 'true');
      resultsContent.append(icon);
      updateToolbarButtons();
      return;
    }
    images.forEach((image, index) => {
      const element = document.createElement('img');
      element.className = 'chat-result-image';
      element.alt = `Generated image ${index + 1}`;
      element.loading = 'lazy';
      element.src = image.startsWith('data:image/') ? image : `data:image/png;base64,${image}`;
      resultsContent.append(element);
    });
    updateToolbarButtons();
  };

  const artifactObjectUrl = async (sessionId: string, artifactId: string): Promise<string | null> => {
    const cached = artifactObjectUrls.get(artifactId);
    if (cached) return cached;
    const response = await authFetch(
      `${window.api}/chat/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}/content`,
    );
    if (!response?.ok) return null;
    const url = URL.createObjectURL(await response.blob());
    artifactObjectUrls.set(artifactId, url);
    return url;
  };

  const updateArtifactSelection = (): void => {
    const selectedIds = new Set(selectedImageIds());
    [container, resultsContent].forEach((root) => {
      root?.querySelectorAll<HTMLElement>('[data-chat-artifact-id]').forEach((element) => {
        const selected = selectedIds.has(element.dataset.chatArtifactId || '');
        element.dataset.selected = String(selected);
        if (element instanceof HTMLImageElement && element.getAttribute('role') === 'button') {
          element.setAttribute('aria-pressed', String(selected));
        }
        const status = element.querySelector<HTMLElement>('.chat-artifact-selected');
        if (status) status.hidden = !selected;
      });
    });
    updateResultActionButtons();
  };

  const selectArtifact = (artifactId: string): Promise<void> => {
    if (!activeSession) return Promise.resolve();
    const artifact = activeArtifacts.find((item) => item.id === artifactId && item.media_type.startsWith('image/') && item.available);
    if (!artifact || (selectedImageIds().length === 1 && selectedImageIds()[0] === artifactId)) return Promise.resolve();
    const sessionId = activeSession.id;
    const previousIds = selectedImageIds();
    activeSession.selected_image_id = artifactId;
    activeSession.selected_image_ids = [artifactId];
    updateArtifactSelection();
    updateResultActionButtons();
    artifactSelectionUpdates = artifactSelectionUpdates.then(async () => {
      try {
        const updated = await apiRequest<ChatSession>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ selected_image_ids: [artifactId] }),
        });
        if (activeSession?.id === sessionId && selectedImageIds().length === 1 && selectedImageIds()[0] === artifactId) {
          activeSession = updated;
          updateSessionTitle();
        }
      } catch (err) {
        if (activeSession?.id === sessionId && selectedImageIds().length === 1 && selectedImageIds()[0] === artifactId) {
          activeSession.selected_image_id = previousIds[0] || null;
          activeSession.selected_image_ids = previousIds;
          updateArtifactSelection();
          updateResultActionButtons();
        }
        appendErrorMessage(err);
      }
    });
    return artifactSelectionUpdates;
  };

  const selectArtifactFromEvent = (artifactId: string): void => {
    selectArtifact(artifactId).catch(appendErrorMessage);
  };

  const openArtifactFolder = async (artifactId: string): Promise<void> => {
    const artifact = activeArtifacts.find((item) => item.id === artifactId && item.available);
    if (!activeSession || !artifact) throw new Error('Selected image is unavailable');
    await apiRequest(`/chat/sessions/${encodeURIComponent(activeSession.id)}/artifacts/${encodeURIComponent(artifact.id)}/open-folder`, {
      method: 'POST',
    });
  };

  const saveArtifact = async (artifactId: string): Promise<void> => {
    const artifact = activeArtifacts.find((item) => item.id === artifactId && item.available);
    if (!activeSession || !artifact) throw new Error('Selected image is unavailable');
    await apiRequest(`/chat/sessions/${encodeURIComponent(activeSession.id)}/artifacts/${encodeURIComponent(artifact.id)}/save`, {
      method: 'POST',
    });
  };

  const downloadArtifact = async (artifactId: string): Promise<void> => {
    const artifact = activeArtifacts.find((item) => item.id === artifactId && item.available);
    if (!activeSession || !artifact) throw new Error('Selected image is unavailable');
    const url = await artifactObjectUrl(activeSession.id, artifact.id);
    if (!url) throw new Error('Selected image is unavailable');
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.display_name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const showSelectedArtifactInfo = (): void => {
    const artifact = getSelectedArtifact();
    resultInfoDetails.replaceChildren();
    if (!artifact?.message_id) return;
    const sourceIndex = activeMessages.findIndex((message) => message.id === artifact.message_id);
    if (sourceIndex < 0) return;
    const completion = activeMessages.slice(sourceIndex + 1).find((message) => message.role === 'assistant');
    if (completion) {
      setMessageContent(resultInfoDetails, {
        ...completion,
        content: completion.content.replace(/^Generated \d+ image\(s\)(?:\r?\n|$)/, ''),
      });
    }
  };

  let renderArtifactResults: (items: ChatArtifact[], sessionId: string, messageId?: string) => Promise<void>;

  const deleteSelectedArtifact = async (): Promise<void> => {
    const artifact = getSelectedArtifact();
    if (!activeSession || !artifact) return;
    const sessionId = activeSession.id;
    await apiRequest<{ deleted: boolean; id: string }>(
      `/chat/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifact.id)}`,
      { method: 'DELETE' },
    );
    const cachedUrl = artifactObjectUrls.get(artifact.id);
    if (cachedUrl) URL.revokeObjectURL(cachedUrl);
    artifactObjectUrls.delete(artifact.id);
    window.chatImageViewer?.remove(artifact.id);
    activeArtifacts = activeArtifacts
      .filter((item) => item.id !== artifact.id)
      .map((item) => {
        if (item.source_artifact_id === artifact.id) return { ...item, source_deleted: true };
        return item;
      });
    if (activeSession?.id === sessionId && selectedImageIds().includes(artifact.id)) {
      const remainingIds = selectedImageIds().filter((id) => id !== artifact.id);
      activeSession.selected_image_ids = remainingIds;
      activeSession.selected_image_id = remainingIds[0] || null;
    }
    resultInfoDetails.replaceChildren();
    container.querySelectorAll<HTMLElement>('.chat-message-attachment[data-chat-artifact-id]').forEach((element) => {
      if (element.dataset.chatArtifactId === artifact.id) element.remove();
    });
    if (visibleResultMessageId) await renderArtifactResults(activeArtifacts, sessionId, visibleResultMessageId);
    else updateArtifactSelection();
  };

  window.chatImageViewer = {
    navigate: async (artifactId, offset) => {
      if (!activeSession) return null;
      const images = activeArtifacts.filter((artifact) => artifact.media_type.startsWith('image/') && artifact.available);
      if (images.length === 0) return null;
      const currentIndex = images.findIndex((artifact) => artifact.id === artifactId);
      if (currentIndex < 0) return null;
      const nextIndex = (currentIndex + offset + images.length) % images.length;
      const next = images[nextIndex];
      const sessionId = activeSession.id;
      await selectArtifact(next.id);
      const src = await artifactObjectUrl(sessionId, next.id);
      return src ? { artifactId: next.id, src } : null;
    },
    download: downloadArtifact,
    remove: (artifactId) => {
      const root = window.gradioApp();
      const modalImage = root.querySelector<HTMLImageElement>('#modalImage');
      if (!modalImage || modalImage.dataset.chatArtifactId !== artifactId) return;
      const modal = root.querySelector<HTMLElement>('#lightboxModal');
      if (modal) {
        modal.style.display = 'none';
        modal.style.removeProperty('background-image');
      }
      delete modalImage.dataset.chatArtifactId;
      modalImage.removeAttribute('src');
    },
  };

  const renderInputAttachments = async (items: ChatArtifact[], sessionId: string): Promise<void> => {
    for (const artifact of items) {
      if (artifact.role !== 'input' || !artifact.message_id) continue;
      const article = Array.from(container.querySelectorAll<HTMLElement>('.chat-message'))
        .find((message) => message.dataset.messageId === artifact.message_id);
      const content = article?.querySelector<HTMLElement>('.chat-message-content');
      if (!content || content.querySelector(`[data-chat-artifact-id="${artifact.id}"]`)) continue;
      const attachment = document.createElement('div');
      attachment.className = 'chat-message-attachment';
      attachment.dataset.chatArtifactId = artifact.id;
      if (artifact.available) {
        const url = await artifactObjectUrl(sessionId, artifact.id);
        if (url) {
          if (artifact.media_type.startsWith('image/')) {
            const image = document.createElement('img');
            image.src = url;
            image.dataset.chatArtifactId = artifact.id;
            image.alt = artifact.display_name;
            image.loading = 'lazy';
            image.tabIndex = 0;
            image.setAttribute('role', 'button');
            image.setAttribute('aria-pressed', String(selectedImageIds().includes(artifact.id)));
            setChatHint(image, 'chat-image-select');
            image.addEventListener('focus', () => selectArtifactFromEvent(artifact.id));
            image.addEventListener('click', (event) => {
              selectArtifactFromEvent(artifact.id);
              window.galleryClickEventHandler?.(event);
            });
            image.addEventListener('keydown', (event: KeyboardEvent) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              image.click();
            });
            attachment.append(image);
          } else {
            const download = document.createElement('a');
            download.href = url;
            download.download = artifact.display_name;
            download.textContent = artifact.display_name;
            setChatHint(download, 'chat-file-download');
            attachment.append(download);
          }
        }
      }
      if (!artifact.available || !attachment.hasChildNodes()) {
        const unavailable = document.createElement('span');
        unavailable.className = 'chat-message-attachment-unavailable';
        unavailable.textContent = chatText('chat-attachment-unavailable', 'Attachment unavailable');
        attachment.append(unavailable);
      }
      if (artifact.media_type.startsWith('image/')) {
        const name = document.createElement('span');
        name.className = 'chat-message-attachment-name';
        name.textContent = artifact.display_name;
        attachment.append(name);
      }
      const selected = document.createElement('span');
      selected.className = 'chat-artifact-selected';
      selected.textContent = chatText('chat-image-selected', 'Selected');
      selected.hidden = true;
      attachment.append(selected);
      content.append(attachment);
    }
    updateArtifactSelection();
  };

  renderArtifactResults = async (items: ChatArtifact[], sessionId: string, messageId?: string): Promise<void> => {
    if (!resultsContent) return;
    if (activeSession?.id === sessionId) activeArtifacts = items;
    if (messageId !== undefined) visibleResultMessageId = messageId;
    if (activeSession?.id === sessionId) {
      rememberGeneratedImage(null);
      sessionResultImages.delete(sessionId);
    }
    const results = items.filter((artifact) => (
      artifact.role === 'result' && (!messageId || artifact.message_id === messageId)
    ));
    resultsContent.replaceChildren();
    resultsContent.dataset.hasImages = String(results.length > 0);
    for (const artifact of results) {
      if (!artifact.available) {
        const unavailable = document.createElement('span');
        unavailable.className = 'chat-message-attachment-unavailable';
        unavailable.textContent = `${artifact.display_name}: ${chatText('chat-image-unavailable', 'Image unavailable')}`;
        resultsContent.append(unavailable);
        continue;
      }
      const url = await artifactObjectUrl(sessionId, artifact.id);
      if (!url) continue;
      const image = document.createElement('img');
      image.className = 'chat-result-image';
      image.dataset.chatArtifactId = artifact.id;
      image.alt = artifact.source_deleted ? `${artifact.display_name} (source image deleted)` : artifact.display_name;
      image.title = image.alt;
      image.loading = 'lazy';
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-pressed', String(selectedImageIds().includes(artifact.id)));
      image.setAttribute('aria-label', image.alt);
      setChatHint(image, 'chat-image-select');
      image.addEventListener('focus', () => selectArtifactFromEvent(artifact.id));
      image.addEventListener('click', (event) => {
        selectArtifactFromEvent(artifact.id);
        window.galleryClickEventHandler?.(event);
      });
      image.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        image.click();
      });
      image.src = url;
      resultsContent.append(image);
    }
    if (results.length === 0) {
      const icon = document.createElement('div');
      icon.className = 'mask-icon icon-results';
      icon.setAttribute('aria-hidden', 'true');
      resultsContent.append(icon);
    }
    updateArtifactSelection();
    updateToolbarButtons();
  };

  const showGeneratedVideo = (data: Record<string, unknown>): void => {
    if (!resultsContent) return;
    const video = typeof data.video === 'string' ? data.video : '';
    const thumbnail = typeof data.thumbnail === 'string' ? data.thumbnail : '';
    const frames = Array.isArray(data.frames) ? data.frames : [];
    if (frames.length > 0) {
      showGeneratedImages(frames);
      return;
    }
    if (activeSession) sessionResultImages.delete(activeSession.id);
    rememberGeneratedImage(thumbnail || null);
    resultsContent.replaceChildren();
    const videoPath = typeof data.video_path === 'string' ? data.video_path : '';
    if (video || videoPath) {
      const player = document.createElement('video');
      player.className = 'chat-result-video';
      player.controls = true;
      player.preload = 'metadata';
      setChatHint(player, 'chat-video-preview');
      if (video) {
        player.src = video.startsWith('data:') ? video : `data:video/mp4;base64,${video}`;
      } else {
        player.src = `${window.api}/video/file?file=${encodeURIComponent(videoPath)}`;
      }
      resultsContent.append(player);
    } else if (thumbnail) {
      const image = document.createElement('img');
      image.className = 'chat-result-image';
      image.alt = 'Generated video thumbnail';
      image.src = thumbnail.startsWith('data:') ? thumbnail : `data:image/png;base64,${thumbnail}`;
      resultsContent.append(image);
      if (activeSession) sessionResultImages.set(activeSession.id, [image.src]);
    } else {
      clearGenerationResults();
      return;
    }
    updateToolbarButtons();
  };

  const executeEndpoint = async (data: Record<string, unknown>): Promise<ChatEndpointResult> => {
    const allowedMethods: Record<string, readonly string[]> = {
      '/sdapi/v1/version': ['GET'],
      '/sdapi/v1/platform': ['GET'],
      '/sdapi/v1/torch': ['GET'],
      '/sdapi/v1/gpu': ['GET'],
      '/sdapi/v1/gpu-smi': ['GET'],
      '/sdapi/v1/memory': ['GET'],
      '/sdapi/v1/status': ['GET'],
      '/sdapi/v1/progress': ['GET'],
      '/sdapi/v1/storage': ['GET'],
    };
    const descriptors = data.endpoints;
    if (!Array.isArray(descriptors) || descriptors.length === 0) {
      throw new Error('Invalid validated endpoint group');
    }

    const executeOne = async (descriptor: unknown): Promise<ChatEndpointResult> => {
      if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
        throw new Error('Invalid validated endpoint descriptor');
      }
      const endpoint = descriptor as Record<string, unknown>;
      const alias = endpoint.alias;
      const method = endpoint.method;
      const path = endpoint.path;
      const location = endpoint.location;
      const args = endpoint.arguments;
      const methods = typeof path === 'string' ? allowedMethods[path] : undefined;
      if (typeof alias !== 'string' || typeof path !== 'string'
        || typeof method !== 'string' || !methods?.includes(method)
        || !['none', 'query', 'body'].includes(String(location))
        || !args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('Invalid validated endpoint descriptor');
      }

      const parameters = new URLSearchParams();
      if (location === 'query') {
        Object.entries(args as Record<string, unknown>).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (Array.isArray(value)) value.forEach((item) => parameters.append(key, String(item)));
          else if (typeof value === 'object') parameters.set(key, JSON.stringify(value));
          else parameters.set(key, String(value));
        });
      }
      const query = parameters.toString();
      const endpointUrl = `${window.subpath || ''}${path}${query ? `?${query}` : ''}`;
      const options: RequestInit = { method };
      if (location === 'body' && Object.keys(args).length > 0) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(args);
      }
      const response = await authFetch(endpointUrl, options);
      if (!response) throw new Error('The endpoint did not return a response');

      const contentType = response.headers.get('Content-Type') || '';
      let output: string;
      let outputFormat = 'text';
      let endpointSections: ChatMessageSection[] | undefined;
      if (contentType.startsWith('image/')) {
        output = `HTTP ${response.status}: image response omitted from chat output (${contentType}).`;
      } else {
        const body = await response.text();
        if (!body) output = `HTTP ${response.status} ${response.statusText || 'completed'} (no response body).`;
        else {
          try {
            const value: unknown = JSON.parse(body);
            if (path === '/sdapi/v1/gpu-smi') {
              endpointSections = formatGpuSections(value);
              output = formatSectionsText(endpointSections);
            } else if (path === '/sdapi/v1/memory') {
              endpointSections = formatMemorySections(value);
              output = formatSectionsText(endpointSections);
            } else {
              output = formatEndpointJson(value);
            }
            outputFormat = 'key-value';
          } catch {
            output = body;
          }
        }
      }
      const maxOutputLength = 12000;
      if (output.length > maxOutputLength) output = `${output.slice(0, maxOutputLength)}\n[Output truncated]`;
      return {
        content: output,
        metadata: {
          kind: 'endpoint',
          alias,
          method,
          path,
          status: response.status,
          format: outputFormat,
          ...(endpointSections ? { sections: endpointSections } : {}),
        },
      };
    };

    const results: ChatEndpointResult[] = [];
    for (const descriptor of descriptors) results.push(await executeOne(descriptor));
    const alias = typeof data.alias === 'string' ? data.alias : 'endpoint';
    const sectionTitles: Record<string, string> = {
      version: 'Version', platform: 'Platform', torch: 'Torch', gpu: 'GPU', status: 'Status', progress: 'Progress',
    };
    const isInfo = ['info', 'ver', 'version'].includes(alias.toLowerCase());
    const isStatusCommand = alias.toLowerCase() === 'status';
    const isGpuCommand = ['gpu', 'smi'].includes(alias.toLowerCase());
    const isMemoryCommand = ['mem', 'memory'].includes(alias.toLowerCase());
    let sections: ChatMessageSection[] = [];
    if (isInfo || isStatusCommand) {
      sections = results.map((result) => {
        const endpointAlias = String(result.metadata.alias);
        return {
          title: sectionTitles[endpointAlias] || endpointAlias,
          content: result.content,
          format: String(result.metadata.format || 'text'),
        };
      });
    } else if (isGpuCommand || isMemoryCommand) {
      sections = results.flatMap((result) => {
        const rawSections = result.metadata.sections;
        if (!Array.isArray(rawSections)) return [];
        return rawSections.filter((section): section is ChatMessageSection => Boolean(
          section && typeof section === 'object' && 'title' in section && typeof section.title === 'string'
          && 'content' in section && typeof section.content === 'string',
        ));
      });
    }
    const content = sections.length > 0
      ? formatSectionsText(sections)
      : results.map((result) => result.content).join('\n\n');
    const maxOutputLength = 12000;
    return {
      content: content.length > maxOutputLength ? `${content.slice(0, maxOutputLength)}\n[Output truncated]` : content,
      metadata: {
        kind: 'endpoint',
        alias,
        endpoints: results.map((result) => result.metadata),
        ...(sections.length > 0 ? { sections } : {}),
      },
    };
  };

  const selectSession = async (sessionId: string, focusComposer: boolean): Promise<void> => {
    const detail = await apiRequest<ChatSessionDetail>(`/chat/sessions/${encodeURIComponent(sessionId)}/restore`, { method: 'POST' });
    activeSession = detail.session;
    await refreshParameterEntries(detail.session);
    activeArtifacts = detail.artifacts;
    visibleResultMessageId = null;
    latestGeneratedImage = latestGeneratedImages.get(activeSession.id) || null;
    window.localStorage.setItem(storageKey, activeSession.id);
    updateSessionTitle();
    sessionList.querySelectorAll<HTMLButtonElement>('.chat-session-item').forEach((button) => {
      button.setAttribute('aria-current', button.dataset.sessionId === activeSession?.id ? 'true' : 'false');
    });
    clearGenerationResults(false);
    const savedImages = sessionResultImages.get(activeSession.id);
    renderMessages(detail.messages);
    await renderInputAttachments(detail.artifacts, activeSession.id);
    const resultMessageIds = new Set(
      detail.artifacts.filter((artifact) => artifact.role === 'result' && artifact.message_id)
        .map((artifact) => artifact.message_id),
    );
    const lastResultMessage = [...detail.messages].reverse().find((message) => resultMessageIds.has(message.id));
    if (lastResultMessage) {
      visibleResultMessageId = lastResultMessage.id;
      await renderArtifactResults(detail.artifacts, activeSession.id, lastResultMessage.id);
    } else if (savedImages) {
      showGeneratedImages(savedImages);
    }
    const restoredSettings = Object.keys(detail.session.drafts[detail.session.context] ?? {}).length;
    if (restoredSettings > 0) {
      appendMessage(container, {
        id: 'restore-summary',
        role: 'assistant',
        content: `Restored session: "${detail.session.title}" settings: ${restoredSettings}`,
        metadata: {},
        created_at: new Date().toISOString(),
      });
    }
    if (detail.restore_errors.length > 0) {
      appendMessage(container, {
        id: 'restore-error',
        role: 'assistant',
        content: `${chatText('chat-restore-failed', `Restore session: "${detail.session.title}" failed: ${detail.restore_errors.length}`)}\n${detail.restore_errors.join('  \n')}`,
        metadata: { kind: 'error' },
        created_at: new Date().toISOString(),
      });
    }
    if (focusComposer && !disabled) inputEditor?.focus();
  };

  const refreshSessionList = async (): Promise<void> => {
    const sessions = await apiRequest<ChatSession[]>('/chat/sessions?limit=100');
    sessionList.replaceChildren();
    if (sessions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'chat-session-empty';
      empty.textContent = chatText('chat-no-sessions', 'No saved sessions');
      sessionList.append(empty);
      return;
    }
    sessions.forEach((session) => {
      const row = document.createElement('div');
      row.className = 'chat-session-item-row';
      row.setAttribute('role', 'listitem');

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'chat-session-item';
      selectButton.dataset.sessionId = session.id;
      selectButton.setAttribute('aria-current', session.id === activeSession?.id ? 'true' : 'false');
      setChatHint(selectButton, 'chat-session-item');
      const title = document.createElement('span');
      title.className = 'chat-session-item-title';
      title.textContent = session.title === 'New chat' ? chatText('chat-new-session', 'New chat') : session.title;
      const timestamps = document.createElement('span');
      timestamps.className = 'chat-session-item-times';
      [
        { id: 'chat-session-created', label: 'Created', value: session.created_at },
        { id: 'chat-session-updated', label: 'Updated', value: session.updated_at },
      ].forEach((item) => {
        const time = document.createElement('time');
        time.className = 'chat-session-item-time';
        time.dateTime = item.value;
        time.textContent = `${chatText(item.id, item.label)}: ${new Date(item.value).toLocaleString()}`;
        timestamps.append(time);
      });
      selectButton.append(title, timestamps);
      selectButton.addEventListener('click', () => {
        setBusy(true);
        selectSession(session.id, true)
          .catch(appendErrorMessage)
          .finally(() => {
            setBusy(false);
            inputEditor?.focus();
          });
      });

      const actions = document.createElement('div');
      actions.className = 'chat-session-item-actions';
      const renameButton = document.createElement('button');
      renameButton.type = 'button';
      renameButton.className = 'sd-button';
      renameButton.title = chatText('chat-rename-session', 'Rename session');
      renameButton.setAttribute('aria-label', renameButton.title);
      setChatHint(renameButton, 'chat-rename-session');
      const renameIcon = document.createElement('div');
      renameIcon.className = 'mask-icon icon-styles-edit';
      renameIcon.setAttribute('aria-hidden', 'true');
      renameButton.append(renameIcon);
      renameButton.addEventListener('click', () => openRenameDialog(session));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'sd-button';
      deleteButton.dataset.sessionAction = 'delete';
      deleteButton.dataset.sessionId = session.id;
      deleteButton.disabled = false;
      deleteButton.title = chatText('chat-delete-session', 'Delete session');
      deleteButton.setAttribute('aria-label', deleteButton.title);
      setChatHint(deleteButton, 'chat-delete-session');
      const deleteIcon = document.createElement('div');
      deleteIcon.className = 'mask-icon icon-delete';
      deleteIcon.setAttribute('aria-hidden', 'true');
      deleteButton.append(deleteIcon);
      deleteButton.addEventListener('click', () => deleteSessionById(session.id).catch(appendErrorMessage));

      actions.append(renameButton, deleteButton);
      row.append(selectButton, actions);
      sessionList.append(row);
    });
    setBusy(submitting);
  };

  const createSession = async (): Promise<void> => {
    const session = await apiRequest<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ context: 'image' }),
    });
    await selectSession(session.id, true);
    await refreshSessionList();
  };

  async function saveRenameSession(): Promise<void> {
    if (!renamingSession || !(renameInput instanceof HTMLInputElement)
      || !(renameDialog instanceof HTMLDialogElement)) return;
    const session = renamingSession;
    const title = renameInput.value.trim();
    if (!title) {
      renameInput.reportValidity();
      return;
    }
    if (title === session.title) {
      renameDialog.close();
      return;
    }
    setBusy(true);
    try {
      const updated = await apiRequest<ChatSession>(`/chat/sessions/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      if (activeSession?.id === updated.id) {
        activeSession = updated;
        updateSessionTitle();
      }
      await refreshSessionList();
      renameDialog.close();
    } finally {
      setBusy(false);
    }
  }

  deleteSessionById = async (sessionId: string): Promise<void> => {
    const deletingActive = sessionId === activeSession?.id;
    setBusy(true);
    try {
      if (deletingActive) {
        const replacement = await apiRequest<ChatSession>('/chat/sessions', {
          method: 'POST',
          body: JSON.stringify({ context: 'image' }),
        });
        try {
          await apiRequest<void>(`/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
        } catch (err) {
          try {
            await apiRequest<void>(`/chat/sessions/${encodeURIComponent(replacement.id)}`, { method: 'DELETE' });
          } catch {
            // Preserve the original deletion error.
          }
          throw err;
        }
        latestGeneratedImages.delete(sessionId);
        sessionResultImages.delete(sessionId);
        await selectSession(replacement.id, true);
      } else {
        await apiRequest<void>(`/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      }
      await refreshSessionList();
    } finally {
      setBusy(false);
      sessionList.querySelector<HTMLButtonElement>('.chat-session-item')?.focus();
    }
  };

  const submitCommand = async (text: string): Promise<void> => {
    const content = text.trim();
    if (!content || disabled || submitting || !activeSession) return;
    if (content.toLowerCase() === 'loop') {
      loopEnabled = !loopEnabled;
      updateToolbarButtons();
      if (loopEnabled && activeGenerations === 0) {
        submitCommand('run').catch(appendErrorMessage);
      }
      return;
    }
    const sessionId = activeSession.id;
    const context = activeSession.context;
    const commandName = content.replace(/^\/(?!\/)/, '').split(/\s+/, 1)[0].toLowerCase();
    if (commandName === 'clear') {
      renderMessages([]);
      return;
    }
    const displayContent = ['use', 'file'].includes(commandName)
      ? chatText('chat-server-file-import', 'Server file import')
      : content;
    const isGenerationCommand = ['run', 'generate', 'start', 'again', 'reprocess'].includes(commandName);
    if (isGenerationCommand && activeGenerations > 0) {
      appendErrorMessage(new Error('A chat generation is already in progress'));
      return;
    }
    const keepsComposerAvailable = isGenerationCommand;
    if (isGenerationCommand) {
      activeGenerations += 1;
      updateToolbarButtons();
    }
    if (commandName === 'cancel' || commandName === 'abort' || commandName === 'stop' || commandName === 'interrupt') {
      loopEnabled = false;
      updateToolbarButtons();
    }
    const userMessage: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: displayContent,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    const processingId = `processing-${Date.now()}`;
    appendMessage(container, userMessage);
    appendMessage(container, {
      id: processingId,
      role: 'assistant',
      content: chatText('chat-processing', 'Processing...'),
      metadata: { kind: 'processing' },
      created_at: new Date().toISOString(),
    });
    if (isGenerationCommand && context !== 'caption' && window.requestProgress) {
      window.requestProgress('undefined', null, resultsContent, null, (progress: unknown) => {
        if (!progress || typeof progress !== 'object') return;
        if ('paused' in progress && typeof progress.paused === 'boolean') {
          generationPaused = progress.paused;
          updateToolbarButtons();
        }
        if ('active' in progress && progress.active) {
          updateProcessingProgressMessage(container, processingId, chatGenerateLabel.textContent || '');
        }
      });
    }
    if (commandName === 'file' || commandName === 'use') watchImportProgress(container, processingId);
    if (!keepsComposerAvailable) setBusy(true);
    try {
      const requestBody: { content: string; image?: string } = { content };
      if ((context === 'process' || context === 'caption') && !activeSession.selected_image_id && latestGeneratedImage) {
        requestBody.image = latestGeneratedImage;
      }
      const submission = await apiRequest<ChatSubmission>(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      if (activeSession?.id === sessionId) {
        activeSession = submission.session;
        activeArtifacts = submission.artifacts;
        if (activeSession.context !== context) await refreshParameterEntries(activeSession);
        window.localStorage.setItem(storageKey, activeSession.id);
        updateSessionTitle();
      }
      replaceMessage(container, userMessage.id, submission.user_message);
      await renderInputAttachments(submission.artifacts, sessionId);
      updateArtifactSelection();
      let assistantMessage = submission.assistant_message;
      if (submission.result.kind === 'operation') {
        if (activeSession?.id === sessionId) {
          if (context === 'video') showGeneratedVideo(submission.result.data);
          else if (submission.artifacts.some((artifact) => (
            artifact.role === 'result' && artifact.message_id === submission.user_message.id
          ))) {
            await renderArtifactResults(submission.artifacts, sessionId, submission.user_message.id);
          } else showGeneratedImages(submission.result.data.images);
        }
      } else if (submission.result.kind === 'endpoint') {
        let endpointResult: ChatEndpointResult;
        try {
          endpointResult = await executeEndpoint(submission.result.data);
        } catch (err) {
          endpointResult = {
            content: `${chatText('chat-endpoint-failed', 'Endpoint request failed:')} ${err instanceof Error ? err.message : String(err)}`,
            metadata: {
              kind: 'endpoint',
              alias: submission.result.data.alias,
              failed: true,
            },
          };
        }
        try {
          assistantMessage = await apiRequest<ChatMessage>(
            `/chat/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(assistantMessage.id)}`,
            { method: 'PATCH', body: JSON.stringify(endpointResult) },
          );
        } catch {
          assistantMessage = {
            ...assistantMessage,
            content: `${endpointResult.content}\n\n${chatText('chat-endpoint-unsaved', 'Result shown but could not be saved to chat history.')}`,
            metadata: { ...endpointResult.metadata, persistence_error: true },
          };
        }
      }
      if (activeSession?.id === sessionId) {
        rememberMessages(submission.user_message, assistantMessage);
        if (!replaceMessage(container, processingId, assistantMessage, keepsComposerAvailable)) appendMessage(container, assistantMessage);
        if (!sessionPanel.hidden) await refreshSessionList();
      }
    } catch (err) {
      const errorMessage = localErrorMessage(err);
      if (activeSession?.id === sessionId) {
        if (!replaceMessage(container, processingId, errorMessage, keepsComposerAvailable)) appendMessage(container, errorMessage);
      }
    } finally {
      if (isGenerationCommand) {
        activeGenerations = Math.max(0, activeGenerations - 1);
        updateToolbarButtons();
      }
      if (!keepsComposerAvailable) setBusy(false);
      if (activeSession?.id === sessionId) {
        inputEditor?.focus();
      }
      if (loopEnabled && isGenerationCommand && activeSession?.id === sessionId) {
        submitCommand('again').catch(appendErrorMessage);
      }
    }
  };

  const uploadChatFile = async (file: File): Promise<void> => {
    if (disabled || submitting || !activeSession) return;
    const sessionId = activeSession.id;
    const displayName = file.name.replace(/\\/g, '/').split('/').pop() || 'upload';
    const userMessage: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: `${chatText('chat-uploading-file', 'Uploading file:')} ${displayName}`,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    const processingId = `processing-${Date.now()}`;
    appendMessage(container, userMessage);
    appendMessage(container, {
      id: processingId,
      role: 'assistant',
      content: chatText('chat-processing', 'Processing...'),
      metadata: { kind: 'processing' },
      created_at: new Date().toISOString(),
    });
    watchImportProgress(container, processingId);
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file, displayName);
      const response = await authFetch(
        `${window.api}/chat/sessions/${encodeURIComponent(sessionId)}/files`,
        { method: 'POST', body },
      );
      if (!response) throw new Error('The chat API did not return a response');
      if (!response.ok) {
        throw new Error(`${chatText('chat-file-upload-failed', 'File import failed:')} ${await getResponseErrorDetail(response)}`);
      }
      const submission = await response.json() as ChatSubmission;
      if (activeSession?.id === sessionId) {
        const previousContext = activeSession.context;
        activeSession = submission.session;
        activeArtifacts = submission.artifacts;
        if (activeSession.context !== previousContext) await refreshParameterEntries(activeSession);
        updateSessionTitle();
      }
      rememberMessages(submission.user_message, submission.assistant_message);
      replaceMessage(container, userMessage.id, submission.user_message);
      replaceMessage(container, processingId, submission.assistant_message, true);
      await renderInputAttachments(submission.artifacts, sessionId);
      if (submission.artifacts.some((artifact) => (
        artifact.role === 'result' && artifact.message_id === submission.user_message.id
      ))) {
        await renderArtifactResults(submission.artifacts, sessionId, submission.user_message.id);
      }
      if (!sessionPanel.hidden) await refreshSessionList();
    } catch (err) {
      replaceMessage(container, processingId, localErrorMessage(err), true);
    } finally {
      setBusy(false);
      if (activeSession?.id === sessionId) inputEditor?.focus();
    }
  };

  const uploadChatFiles = async (files: File[]): Promise<void> => {
    for (const file of files) await uploadChatFile(file);
  };

  chatGenerate.addEventListener('click', () => submitCommand('run').catch(appendErrorMessage));
  chatSchedule.addEventListener('click', () => submitCommand('schedule').catch(appendErrorMessage));
  chatReprocess.addEventListener('click', () => submitCommand('reprocess').catch(appendErrorMessage));
  chatLoop.addEventListener('click', () => submitCommand('loop').catch(appendErrorMessage));
  chatSkip.addEventListener('click', () => submitCommand('skip').catch(appendErrorMessage));
  chatPause.addEventListener('click', () => submitCommand(generationPaused ? 'resume' : 'pause').catch(appendErrorMessage));
  chatInterrupt.addEventListener('click', () => submitCommand('cancel').catch(appendErrorMessage));
  resultInfoButton.addEventListener('click', showSelectedArtifactInfo);
  resultOpenFolderButton.addEventListener('click', () => {
    const artifact = getSelectedArtifact();
    if (artifact) openArtifactFolder(artifact.id).catch(appendErrorMessage);
  });
  resultSaveButton.addEventListener('click', () => {
    const artifact = getSelectedArtifact();
    if (artifact) saveArtifact(artifact.id).catch(appendErrorMessage);
  });
  resultDeleteButton.addEventListener('click', () => deleteSelectedArtifact().catch(appendErrorMessage));

  inputEditor = new ChatInputEditor(
    input,
    chatText('chat-placeholder', 'Write a command...'),
    chatText('chat-input', 'Message'),
    disabled,
    {
      onChange: (value) => {
        commandHistoryIndex = commandHistory.length;
        commandHistoryDraft = value;
      },
      onSubmit: () => form.requestSubmit(),
      getParameters: getParameterEntries,
      getChoices: getParameterChoices,
      onHistory: (direction, value) => {
        if (commandHistory.length === 0) return null;
        if (direction === 'previous') {
          if (commandHistoryIndex === commandHistory.length) commandHistoryDraft = value;
          commandHistoryIndex = Math.max(0, commandHistoryIndex - 1);
          return commandHistory[commandHistoryIndex] ?? null;
        }
        if (commandHistoryIndex < commandHistory.length - 1) {
          commandHistoryIndex += 1;
          return commandHistory[commandHistoryIndex] ?? null;
        }
        if (commandHistoryIndex === commandHistory.length - 1) {
          commandHistoryIndex = commandHistory.length;
          return commandHistoryDraft;
        }
        return null;
      },
      onFiles: (files) => uploadChatFiles(files).catch(appendErrorMessage),
    },
  );

  if (disabled) {
    fileButton.disabled = true;
    filePicker.disabled = true;
    help.disabled = true;
    sessionToggle.disabled = true;
    newSession.disabled = true;
    renameInput.disabled = true;
    renameCancel.disabled = true;
    renameSave.disabled = true;
  } else {
    fileButton.title = chatText('chat-attach-file', 'Attach file');
    fileButton.setAttribute('aria-label', fileButton.title);
    help.title = chatText('chat-help', 'Help');
    help.setAttribute('aria-label', help.title);
    newSession.title = chatText('chat-new-session', 'New chat');
    newSession.setAttribute('aria-label', newSession.title);
    closeSessionPanel.title = chatText('chat-close-sessions', 'Close sessions');
    closeSessionPanel.setAttribute('aria-label', closeSessionPanel.title);
    renameHeading.textContent = chatText('chat-rename-session', 'Rename session');
    renameLabel.textContent = chatText('chat-session-name', 'Session name');
    renameCancel.textContent = chatText('chat-rename-cancel', 'Cancel');
    renameSave.textContent = chatText('chat-rename-save', 'Save');
    resultActionToolbar.setAttribute('aria-label', chatText('chat-image-actions', 'Image actions'));
    [
      [resultInfoButton, 'chat-image-info', 'Info'],
      [resultOpenFolderButton, 'chat-image-open-folder', 'Open folder'],
      [resultSaveButton, 'chat-image-save', 'Save image'],
      [resultDeleteButton, 'chat-image-delete', 'Delete'],
    ].forEach(([button, id, label]) => {
      if (!(button instanceof HTMLButtonElement) || typeof id !== 'string' || typeof label !== 'string') return;
      const localized = chatText(id, label);
      button.title = localized;
      button.setAttribute('aria-label', localized);
    });

    fileButton.addEventListener('click', () => filePicker.click());
    filePicker.addEventListener('change', () => {
      const files = Array.from(filePicker.files || []);
      filePicker.value = '';
      uploadChatFiles(files).catch(appendErrorMessage);
    });
    workspace.addEventListener('dragover', (event: DragEvent) => {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault();
      form.dataset.dragover = 'true';
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    workspace.addEventListener('dragleave', (event: DragEvent) => {
      if (!(event.relatedTarget instanceof Node) || !workspace.contains(event.relatedTarget)) {
        delete form.dataset.dragover;
      }
    });
    workspace.addEventListener('drop', (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length === 0) return;
      event.preventDefault();
      delete form.dataset.dragover;
      uploadChatFiles(files).catch(appendErrorMessage);
    });
    sessionToggle.addEventListener('click', () => {
      const opening = sessionPanel.hidden;
      sessionPanel.hidden = !opening;
      sessionToggle.setAttribute('aria-expanded', String(opening));
      if (opening) refreshSessionList().catch(appendErrorMessage);
      else inputEditor?.focus();
    });
    closeSessionPanel.addEventListener('click', () => closePanel(true));
    newSession.addEventListener('click', () => createSession().catch(appendErrorMessage));
    renameCancel.addEventListener('click', () => renameDialog.close());
    renameDialog.addEventListener('close', () => { renamingSession = null; });
    renameForm.addEventListener('submit', (event: SubmitEvent) => {
      event.preventDefault();
      saveRenameSession().catch(appendErrorMessage);
    });
    form.addEventListener('submit', (event: SubmitEvent) => {
      event.preventDefault();
      const text = inputEditor?.value || '';
      if (!text.trim()) return;
      commandHistory.push(text);
      if (commandHistory.length > 100) commandHistory.shift();
      commandHistoryIndex = commandHistory.length;
      commandHistoryDraft = '';
      if (inputEditor) inputEditor.value = '';
      submitCommand(text).catch(appendErrorMessage);
    });
    help.addEventListener('click', () => submitCommand('help').catch(appendErrorMessage));
    const initialize = async (): Promise<void> => {
      const loadStart = performance.now();
      const sessions = await apiRequest<ChatSession[]>('/chat/sessions?limit=100');
      const sessionsLoaded = performance.now();
      const preferredId = window.localStorage.getItem(storageKey);
      const preferred = sessions.find((session) => session.id === preferredId);
      if (preferred) await selectSession(preferred.id, false);
      else if (sessions.length > 0) await selectSession(sessions[0].id, false);
      else await createSession();
      const sessionsAvailable = performance.now();
      log('loadChatSessions', {
        count: sessions.length,
        loaded: Math.round(sessionsLoaded - loadStart),
        available: Math.round(sessionsAvailable - loadStart),
      });
      timer('loadChatSessions', sessionsAvailable - loadStart);
    };
    initialize().catch(appendErrorMessage);
  }
  updateSessionTitle();
  const t1 = performance.now();
  log('initChat', Math.round(t1 - t0));
  timer('initChat', t1 - t0);
}
