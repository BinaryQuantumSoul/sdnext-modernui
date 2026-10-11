/* Scheduler queue and task details for ModernUI. */

import {
  ClientSideRowModelModule,
  CellStyleModule,
  createGrid,
  DateFilterModule,
  ModuleRegistry,
  NumberFilterModule,
  PaginationModule,
  QuickFilterModule,
  RowAutoHeightModule,
  RowDragModule,
  RowSelectionModule,
  RowStyleModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
} from 'ag-grid-community';
import type {
  ColDef,
  GridApi,
  GridOptions,
  ICellRendererParams,
} from 'ag-grid-community';

declare global {
  interface Window {
    galleryClickEventHandler?: (event: MouseEvent) => void;
    serverOnline?: boolean;
  }
}

interface SchedulerTask {
  id: number;
  created_at: string;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  mode?: 'txt2img' | 'img2img' | 'control' | 'video';
  queue_position: number;
  scheduled_by_user: number;
  parameters: Record<string, unknown>;
  results: string[];
  process_stats?: Record<string, number>;
  infotexts?: string[];
  attempts: number;
  max_attempts: number;
  last_error: string | null;
}

interface SchedulerStatus {
  state: 'Active' | 'Paused' | 'Auto';
  start: string;
  end: string;
  window_open: boolean;
  paused: boolean;
  worker_running: boolean;
}

type TaskAction = 'execute' | 'pause' | 'resume' | 'delete';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CellStyleModule,
  DateFilterModule,
  NumberFilterModule,
  PaginationModule,
  QuickFilterModule,
  RowAutoHeightModule,
  RowDragModule,
  RowSelectionModule,
  RowStyleModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
]);

let gridApi: GridApi<SchedulerTask> | null = null;
let selectedTask: SchedulerTask | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let activeObjectUrls: string[] = [];
let refreshInProgress = false;
let nextTaskOffset = 0;
let hasMoreTasks = true;
let taskRowsSnapshot = '[]';

function element<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setMessage(message: string, isError = false): void {
  const target = element('scheduler-message');
  if (!target) return;
  target.textContent = message;
  target.style.color = isError ? 'var(--color-warning)' : '';
}

function releaseObjectUrls(): void {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls = [];
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await authFetch(`${window.api}${path}`, { ...options, headers });
  if (!response) throw new Error('The scheduler API did not return a response');
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the HTTP status as the message when the response is not JSON.
    }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function controlParameters(task: SchedulerTask): Record<string, unknown> {
  const control = task.parameters.control;
  if (control && typeof control === 'object' && !Array.isArray(control)) return control as Record<string, unknown>;
  return task.parameters;
}

function generationParameters(task: SchedulerTask): Record<string, unknown> {
  if (task.mode === 'video') {
    const video = task.parameters.video;
    if (video && typeof video === 'object' && !Array.isArray(video)) {
      const args = (video as Record<string, unknown>).arguments;
      if (args && typeof args === 'object' && !Array.isArray(args)) return args as Record<string, unknown>;
    }
  }
  return controlParameters(task);
}

const hiddenControlParameters = new Set(['state', 'scheduler', 'units', 'input_script_args', 'inputs', 'inits', 'mask', 'unit_type', 'is_generator', 'input_type']);
const commonTextControlFields = ['prompt', 'negative_prompt'] as const;
const commonNumberControlFields = ['steps', 'width_before', 'height_before'] as const;
const commonControlFields = new Set<string>([...commonTextControlFields, ...commonNumberControlFields]);
const commonModelFields = ['sd_model_checkpoint', 'sd_model_refiner', 'sd_unet', 'sd_vae', 'sd_text_encoder'] as const;

function editableControlParameters(task: SchedulerTask): Record<string, unknown> {
  return Object.fromEntries(Object.entries(controlParameters(task)).filter(([key]) => !hiddenControlParameters.has(key) && !commonControlFields.has(key)));
}

function mediaReferences(value: unknown, references = new Map<number, { marker: string; filename: string; mediaType: string }>()): { id: number; marker: string; filename: string; mediaType: string }[] {
  if (Array.isArray(value)) {
    value.forEach((item) => mediaReferences(item, references));
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const marker = Object.getOwnPropertyDescriptor(record, '__sd_scheduler_type__')?.value;
    let mediaType = 'application/octet-stream';
    if (typeof record.media_type === 'string') mediaType = record.media_type;
    else if (marker === 'image') mediaType = 'image/png';
    if ((marker === 'image' || marker === 'file' || marker === 'blob') && typeof record.id === 'number') {
      references.set(record.id, {
        marker,
        filename: typeof record.filename === 'string' ? record.filename : `media-${record.id}`,
        mediaType,
      });
    } else Object.values(record).forEach((item) => mediaReferences(item, references));
  }
  return [...references.entries()].sort(([left], [right]) => left - right).map(([id, media]) => ({ id, ...media }));
}

function editableTaskParameters(task: SchedulerTask): Record<string, unknown> {
  if (task.mode !== 'video') return editableControlParameters(task);
  return Object.fromEntries(Object.entries(generationParameters(task)).filter(([key, value]) => key !== 'task_id' && key !== '_ui_state' && mediaReferences(value).length === 0));
}

function populateTaskEditor(task: SchedulerTask): void {
  const parameters = element<HTMLTextAreaElement>('scheduler-parameters');
  if (parameters) parameters.value = JSON.stringify(editableTaskParameters(task), null, 2);
  const isVideo = task.mode === 'video';
  const commonSection = element<HTMLElement>('scheduler-control-common');
  if (commonSection) commonSection.hidden = isVideo;
  const control = controlParameters(task);
  [...commonTextControlFields, ...commonNumberControlFields].forEach((key) => {
    const input = element<HTMLInputElement | HTMLTextAreaElement>(`scheduler-common-${key}`);
    if (input) input.value = control[key] === undefined || control[key] === null ? '' : String(control[key]);
  });
  commonModelFields.forEach((key) => {
    const input = element<HTMLInputElement>(`scheduler-common-${key}`);
    const value = task.parameters[key];
    if (input) input.value = value === undefined || value === null ? '' : String(value);
  });
}

function populateTaskResults(task: SchedulerTask): void {
  const stats = element<HTMLElement>('scheduler-process-stats');
  const infotexts = element<HTMLElement>('scheduler-infotexts');
  if (stats) stats.textContent = JSON.stringify(task.process_stats ?? {}, null, 2);
  if (infotexts) {
    infotexts.replaceChildren();
    (task.infotexts ?? []).forEach((infotext) => {
      const entry = document.createElement('pre');
      entry.textContent = infotext;
      infotexts.append(entry);
    });
  }
}

function promptFor(task: SchedulerTask): string {
  const prompt = generationParameters(task).prompt;
  return typeof prompt === 'string' ? prompt : '';
}

function stylesFor(task: SchedulerTask): string {
  const styles = generationParameters(task).styles;
  if (Array.isArray(styles)) return styles.filter((style): style is string => typeof style === 'string').join(', ');
  return typeof styles === 'string' ? styles : '';
}

function appendEmpty(target: HTMLElement, message: string): void {
  target.replaceChildren();
  const empty = document.createElement('span');
  empty.className = 'scheduler-media-empty';
  empty.textContent = message;
  target.append(empty);
}

async function loadInputImages(task: SchedulerTask): Promise<void> {
  const target = element('scheduler-input-previews');
  if (!target) return;
  const references = mediaReferences(task.parameters);
  target.replaceChildren();
  if (references.length === 0) {
    appendEmpty(target, 'No stored input media');
    return;
  }
  for (const reference of references) {
    const label = document.createElement('label');
    label.className = 'scheduler-media-editor';
    label.textContent = `Replace ${reference.filename} `;
    const input = document.createElement('input');
    input.type = 'file';
    input.disabled = task.status === 'running';
    input.dataset.schedulerMediaId = String(reference.id);
    if (reference.mediaType.startsWith('image/')) input.accept = 'image/*';
    else if (reference.mediaType.startsWith('video/')) input.accept = 'video/*';
    else if (reference.mediaType.startsWith('audio/')) input.accept = 'audio/*';
    label.append(input);
    target.append(label);

    const response = await authFetch(`${window.api}/scheduler/tasks/${task.id}/media/${reference.id}`);
    if (!response?.ok || selectedTask?.id !== task.id) continue;
    const objectUrl = URL.createObjectURL(await response.blob());
    activeObjectUrls.push(objectUrl);
    if (reference.mediaType.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = objectUrl;
      image.alt = `Input image ${reference.id + 1} for task ${task.id}`;
      target.append(image);
    } else if (reference.mediaType.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = objectUrl;
      video.controls = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', `Input video ${reference.filename}`);
      target.append(video);
    } else if (reference.mediaType.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = objectUrl;
      audio.controls = true;
      audio.setAttribute('aria-label', `Input audio ${reference.filename}`);
      target.append(audio);
    } else {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = reference.filename;
      link.textContent = reference.filename;
      target.append(link);
    }
  }
  if (!target.childElementCount) appendEmpty(target, 'Input media could not be loaded');
}

async function loadResultImages(task: SchedulerTask): Promise<void> {
  const target = element('scheduler-result-previews');
  if (!target) return;
  target.replaceChildren();
  if (task.results.length === 0) {
    appendEmpty(target, task.last_error || 'No saved result files');
    return;
  }
  for (const path of task.results) {
    const params = new URLSearchParams({ file: path, exif: 'false' });
    const response = await authFetch(`${window.api}/file?${params.toString()}`);
    if (!response?.ok || selectedTask?.id !== task.id) continue;
    const blob = await response.blob();
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };
    const resultBlob = blob.type === 'application/octet-stream' ? new Blob([blob], { type: mimeTypes[extension] ?? blob.type }) : blob;
    const objectUrl = URL.createObjectURL(resultBlob);
    activeObjectUrls.push(objectUrl);
    if (resultBlob.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = objectUrl;
      video.controls = true;
      video.preload = 'metadata';
      video.title = path;
      target.append(video);
    } else if (resultBlob.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = objectUrl;
      audio.controls = true;
      audio.title = path;
      target.append(audio);
    } else if (resultBlob.type.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = objectUrl;
      image.alt = `Result from task ${task.id}: ${path.split(/[\\/]/).pop() ?? path}`;
      image.title = path;
      image.addEventListener('click', (event) => window.galleryClickEventHandler?.(event), true);
      target.append(image);
    }
  }
  if (!target.childElementCount) appendEmpty(target, 'Saved result previews are unavailable');
}

function setActionState(task: SchedulerTask | null): void {
  const canReschedule = Boolean(task && ['scheduled', 'paused', 'failed'].includes(task.status));
  const canEdit = Boolean(task && task.status !== 'running');
  const button = element<HTMLButtonElement>('scheduler-parameters-save');
  if (button) button.disabled = !canEdit;
  const input = element<HTMLInputElement>('scheduler-reschedule-at');
  if (input) input.disabled = !canReschedule;
}

function setSelectedTask(task: SchedulerTask, refreshDetails = true): void {
  selectedTask = task;
  populateTaskResults(task);
  if (refreshDetails) {
    populateTaskEditor(task);
    const reschedule = element<HTMLInputElement>('scheduler-reschedule-at');
    if (reschedule) {
      if (task.scheduled_by_user) {
        const date = new Date(task.scheduled_at);
        reschedule.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      } else {
        reschedule.value = '';
      }
    }
  }
  setActionState(task);
  if (refreshDetails) {
    releaseObjectUrls();
    loadInputImages(task).catch((err: unknown) => setMessage(`Input preview error: ${String(err)}`, true));
    loadResultImages(task).catch((err: unknown) => setMessage(`Result preview error: ${String(err)}`, true));
  }
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()}\n${date.toLocaleTimeString()}`;
}

async function refreshTasks(): Promise<void> {
  if (!gridApi || refreshInProgress || window.serverOnline !== true) return;
  refreshInProgress = true;
  try {
    const taskRows: SchedulerTask[] = [];
    const targetCount = Math.max(1000, nextTaskOffset);
    let lastPageSize = 0;
    for (let offset = 0; offset < targetCount; offset += 1000) {
      if (window.serverOnline !== true) return;
      const page = await apiRequest<SchedulerTask[]>(`/scheduler/tasks?limit=1000&offset=${offset}`);
      taskRows.push(...page);
      lastPageSize = page.length;
      if (page.length < 1000) break;
    }
    if (window.serverOnline !== true) return;
    const status = await apiRequest<SchedulerStatus>('/scheduler');
    nextTaskOffset = taskRows.length;
    hasMoreTasks = lastPageSize === 1000;
    const snapshot = JSON.stringify(taskRows);
    if (snapshot !== taskRowsSnapshot) {
      gridApi.setGridOption('rowData', taskRows);
      taskRowsSnapshot = snapshot;
    }
    const loadMore = element<HTMLButtonElement>('scheduler-load-more');
    if (loadMore) loadMore.hidden = !hasMoreTasks;
    if (selectedTask) {
      const refreshed = taskRows.find((task) => task.id === selectedTask?.id);
      if (refreshed) {
        if (JSON.stringify(refreshed) !== JSON.stringify(selectedTask)) setSelectedTask(refreshed, false);
      } else {
        selectedTask = null;
        setActionState(null);
      }
    }
    const statusTarget = element('scheduler-worker-status');
    const windowStatus = status.state === 'Auto' ? ` ${status.start}-${status.end} | Window ${status.window_open ? 'open' : 'closed'}` : '';
    const statusText = `${status.worker_running ? 'Worker online' : 'Worker offline'} | ${status.state}${windowStatus}`;
    if (statusTarget && statusTarget.textContent !== statusText) statusTarget.textContent = statusText;
    (['Active', 'Paused', 'Auto'] as const).forEach((state) => {
      const button = element<HTMLButtonElement>(`scheduler-mode-${state.toLowerCase()}`);
      const pressed = String(status.state === state);
      if (button && button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    });
    const start = element<HTMLInputElement>('scheduler-window-start');
    const end = element<HTMLInputElement>('scheduler-window-end');
    if (start && document.activeElement !== start && start.value !== status.start) start.value = status.start;
    if (end && document.activeElement !== end && end.value !== status.end) end.value = status.end;
  } catch (err) {
    setMessage(`Refresh failed: ${String(err)}`, true);
  } finally {
    refreshInProgress = false;
  }
}

async function loadMoreTasks(): Promise<void> {
  if (!gridApi || refreshInProgress || !hasMoreTasks || window.serverOnline !== true) return;
  refreshInProgress = true;
  const loadMore = element<HTMLButtonElement>('scheduler-load-more');
  if (loadMore) loadMore.disabled = true;
  try {
    const page = await apiRequest<SchedulerTask[]>(`/scheduler/tasks?limit=1000&offset=${nextTaskOffset}`);
    const tasks = gridApi.getGridOption('rowData') ?? [];
    const updatedTasks = [...tasks, ...page];
    gridApi.setGridOption('rowData', updatedTasks);
    taskRowsSnapshot = JSON.stringify(updatedTasks);
    nextTaskOffset += page.length;
    hasMoreTasks = page.length === 1000;
    if (loadMore) loadMore.hidden = !hasMoreTasks;
  } catch (err) {
    setMessage(`Could not load more tasks: ${String(err)}`, true);
  } finally {
    refreshInProgress = false;
    if (loadMore) loadMore.disabled = false;
  }
}

async function performAction(path: string, method = 'POST', body?: unknown, message = 'Scheduler updated'): Promise<boolean> {
  try {
    await apiRequest(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    setMessage(message);
    await refreshTasks();
    return true;
  } catch (err) {
    setMessage(String(err), true);
    return false;
  }
}

function confirmButton(target: string | HTMLButtonElement, label: string): boolean {
  const button = typeof target === 'string' ? element<HTMLButtonElement>(target) : target;
  if (!button) return false;
  const iconOnly = Boolean(button.querySelector('.mask-icon'));
  const setLabel = (value: string): void => {
    if (iconOnly) {
      button.setAttribute('aria-label', value);
      button.title = value;
    } else {
      button.textContent = value;
    }
  };
  if (button.dataset.confirmArmed === 'true') {
    button.dataset.confirmArmed = 'false';
    setLabel(label);
    return true;
  }
  button.dataset.confirmArmed = 'true';
  setLabel(iconOnly ? `Confirm ${label.toLowerCase()}` : 'Confirm');
  window.setTimeout(() => {
    if (button.dataset.confirmArmed === 'true') {
      button.dataset.confirmArmed = 'false';
      setLabel(label);
    }
  }, 5000);
  return false;
}

function performTaskAction(action: TaskAction, task: SchedulerTask): void {
  const paths: Record<TaskAction, string> = {
    execute: `/scheduler/tasks/${task.id}/execute`,
    pause: `/scheduler/tasks/${task.id}/pause`,
    resume: `/scheduler/tasks/${task.id}/resume`,
    delete: `/scheduler/tasks/${task.id}`,
  };
  const messages: Record<TaskAction, string> = {
    execute: `Task ${task.id} execution requested`,
    pause: `Task ${task.id} paused`,
    resume: `Task ${task.id} resumed`,
    delete: `Task ${task.id} deleted`,
  };
  performAction(paths[action], action === 'delete' ? 'DELETE' : 'POST', undefined, messages[action]).catch(() => undefined);
}

function taskActionsCell(params: ICellRendererParams<SchedulerTask>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'scheduler-row-actions';
  const task = params.data;
  if (!task) return container;

  const actions: { action: TaskAction; label: string; icon: string; enabled: boolean }[] = [
    { action: 'execute', label: 'Execute', icon: 'icon-forward', enabled: ['scheduled', 'paused', 'completed', 'failed'].includes(task.status) },
    { action: 'pause', label: 'Pause', icon: 'icon-pause', enabled: task.status === 'scheduled' },
    { action: 'resume', label: 'Resume', icon: 'icon-play', enabled: task.status === 'paused' },
    { action: 'delete', label: 'Delete', icon: 'icon-delete', enabled: task.status !== 'running' },
  ];
  actions.forEach(({ action, label, icon, enabled }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sd-button scheduler-row-action';
    button.disabled = !enabled;
    button.setAttribute('aria-label', label);
    button.title = label;
    const iconElement = document.createElement('div');
    iconElement.classList.add('mask-icon', icon);
    iconElement.setAttribute('aria-hidden', 'true');
    button.append(iconElement);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      performTaskAction(action, task);
    });
    container.append(button);
  });
  return container;
}

function columnDefinitions(): ColDef<SchedulerTask>[] {
  return [
    {
      field: 'id',
      headerName: 'ID',
      width: 64,
      filter: false,
      rowDrag: (params) => params.data?.status === 'scheduled' || params.data?.status === 'paused',
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 90,
      cellClass: 'scheduler-datetime-cell',
      valueFormatter: (params) => formatDateTime(params.value),
    },
    {
      headerName: 'Scheduled',
      field: 'scheduled_at',
      width: 90,
      cellClass: 'scheduler-datetime-cell',
      tooltip: (params) => {
        const task = params.data;
        if (!task || !task.scheduled_by_user) return 'Runs when it reaches the queue head';
        return `User scheduled for ${new Date(task.scheduled_at).toLocaleString()}`;
      },
      valueFormatter: (params) => {
        if (params.data?.status !== 'scheduled') return '';
        if (!params.data?.scheduled_by_user) return 'Queued';
        return formatDateTime(params.value);
      },
      cellClassRules: {
        'scheduler-overdue': (params) => Boolean(params.data?.scheduled_by_user && params.data.status === 'scheduled' && params.value && new Date(params.value).getTime() < Date.now()),
        'scheduler-soon': (params) => {
          if (!params.data?.scheduled_by_user || params.data.status !== 'scheduled' || !params.value) return false;
          const delay = new Date(params.value).getTime() - Date.now();
          return delay >= 0 && delay <= 30 * 60 * 1000;
        },
      },
    },
    {
      field: 'started_at',
      headerName: 'Executed',
      width: 90,
      cellClass: 'scheduler-datetime-cell',
      valueFormatter: (params) => formatDateTime(params.value),
    },
    {
      field: 'mode',
      headerName: 'Mode',
      width: 68,
      valueFormatter: (params) => (typeof params.value === 'string' ? params.value : 'control'),
    },
    {
      headerName: 'Model',
      valueGetter: (params) => (typeof params.data?.parameters.model === 'string' ? params.data.parameters.model : ''),
      width: 180,
      wrapText: true,
      autoHeight: true,
      cellClass: 'scheduler-wrap-cell',
      tooltip: (params) => (typeof params.value === 'string' ? params.value : ''),
    },
    {
      headerName: 'Prompt',
      valueGetter: (params) => (params.data ? promptFor(params.data) : ''),
      flex: 1,
      minWidth: 180,
      wrapText: true,
      autoHeight: true,
      cellClass: 'scheduler-wrap-cell',
    },
    {
      headerName: 'Styles',
      valueGetter: (params) => (params.data ? stylesFor(params.data) : ''),
      width: 180,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 84,
      tooltip: (params) => (params.data ? `Task ${params.data.id}: ${params.data.status}` : ''),
    },
    {
      headerName: 'Actions',
      width: 130,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: taskActionsCell,
      cellRendererParams: { suppressMouseEventHandling: () => true },
    },
  ];
}

async function saveTaskParameters(taskId: number, parameters: Record<string, unknown>, includeMedia = false): Promise<boolean> {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('#scheduler-input-previews input[type="file"][data-scheduler-media-id]'));
  const selected = includeMedia ? inputs.flatMap((input) => {
    const file = input.files?.[0];
    return file ? [{ id: Number(input.dataset.schedulerMediaId), file }] : [];
  }) : [];
  if (selected.length === 0) {
    return performAction(`/scheduler/tasks/${taskId}/parameters`, 'PATCH', { parameters }, `Task ${taskId} parameters saved`);
  }
  const form = new FormData();
  form.set('parameters', JSON.stringify(parameters));
  form.set('media_ids', JSON.stringify(selected.map(({ id }) => id)));
  selected.forEach(({ file }) => form.append('media', file, file.name));
  try {
    await apiRequest(`/scheduler/tasks/${taskId}/parameters/media`, { method: 'PATCH', body: form });
    setMessage(`Task ${taskId} parameters and media saved`);
    await refreshTasks();
    return true;
  } catch (err) {
    setMessage(String(err), true);
    return false;
  }
}

function bindControls(): void {
  element<HTMLInputElement>('scheduler-search')?.addEventListener('input', (event) => {
    gridApi?.setGridOption('quickFilterText', (event.target as HTMLInputElement).value);
  });
  element<HTMLSelectElement>('scheduler-status-filter')?.addEventListener('change', (event) => {
    const status = (event.target as HTMLSelectElement).value;
    gridApi?.setColumnFilterModel('status', status ? { filter: status, type: 'equals' } : null)
      .then(() => gridApi?.onFilterChanged())
      .catch((err: unknown) => setMessage(`Status filter failed: ${String(err)}`, true));
  });
  element('scheduler-refresh')?.addEventListener('click', () => refreshTasks().catch(() => undefined));
  element('scheduler-load-more')?.addEventListener('click', () => loadMoreTasks().catch(() => undefined));
  (['Active', 'Paused', 'Auto'] as const).forEach((state) => {
    element(`scheduler-mode-${state.toLowerCase()}`)?.addEventListener('click', () => {
      performAction('/scheduler/state', 'POST', { state }, `Scheduler set to ${state}`).catch(() => undefined);
    });
  });
  ([
    { id: 'scheduler-window-start', field: 'start' },
    { id: 'scheduler-window-end', field: 'end' },
  ] as const).forEach(({ id, field }) => {
    element<HTMLInputElement>(id)?.addEventListener('change', (event) => {
      const value = (event.target as HTMLInputElement).value;
      if (!value) {
        setMessage('Choose a valid server-local time', true);
        return;
      }
      performAction('/scheduler/state', 'POST', { [field]: value }, `Scheduler ${field} time saved`).catch(() => undefined);
    });
  });
  element('scheduler-prune')?.addEventListener('click', () => {
    const before = element<HTMLInputElement>('scheduler-prune-before')?.value;
    if (!before || !confirmButton('scheduler-prune', 'Prune tasks')) return;
    performAction('/scheduler/prune', 'POST', { before: new Date(before).toISOString() }, 'Old tasks pruned').catch(() => undefined);
  });
  element<HTMLInputElement>('scheduler-reschedule-at')?.addEventListener('change', (event) => {
    const scheduledAt = (event.target as HTMLInputElement).value;
    if (!selectedTask || !scheduledAt) return;
    performAction(`/scheduler/tasks/${selectedTask.id}/reschedule`, 'POST', { scheduled_at: new Date(scheduledAt).toISOString() }, `Task ${selectedTask.id} rescheduled`).catch(() => undefined);
  });
  element('scheduler-parameters-save')?.addEventListener('click', () => {
    if (!selectedTask || selectedTask.status === 'running') return;
    const task = selectedTask;
    try {
      const parameters = JSON.parse(element<HTMLTextAreaElement>('scheduler-parameters')?.value ?? '') as Record<string, unknown>;
      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('Parameters must be a JSON object');
      const current = editableTaskParameters(task);
      const immutable = new Set(['state', 'scheduler', 'units', 'inputs', 'inits', 'mask', 'input_script_args', 'override_script_args']);
      const removed = Object.keys(current).filter((key) => !Object.hasOwn(parameters, key));
      if (removed.length) throw new Error(`Removing parameters is not supported: ${removed.join(', ')}`);
      const changed: Record<string, unknown> = {};
      const control = generationParameters(task);
      if (task.mode !== 'video') {
        commonTextControlFields.forEach((key) => {
          const value = element<HTMLTextAreaElement>(`scheduler-common-${key}`)?.value;
          if (value !== undefined && control[key] !== value) changed[key] = value;
        });
        commonNumberControlFields.forEach((key) => {
          const input = element<HTMLInputElement>(`scheduler-common-${key}`);
          if (!input) return;
          const value = input.valueAsNumber;
          if (!Number.isInteger(value) || value < 1) throw new Error(`${key} must be a positive whole number`);
          if (control[key] !== value) changed[key] = value;
        });
      }
      commonModelFields.forEach((key) => {
        const input = element<HTMLInputElement>(`scheduler-common-${key}`);
        if (!input) return;
        const value = input.value;
        if (!Object.hasOwn(task.parameters, key) && value === '') return;
        if (task.parameters[key] !== value) changed[key] = value;
      });
      Object.entries(parameters).forEach(([key, value]) => {
        if (!Object.hasOwn(current, key)) throw new Error(`Adding parameter "${key}" is not supported`);
        if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
          if (immutable.has(key)) throw new Error(`Updating "${key}" is not supported`);
          changed[key] = value;
        }
      });
      const hasMediaReplacement = Array.from(document.querySelectorAll<HTMLInputElement>('#scheduler-input-previews input[type="file"][data-scheduler-media-id]')).some((input) => Boolean(input.files?.length));
      if (Object.keys(changed).length === 0 && !hasMediaReplacement) {
        setMessage('No parameter changes');
        return;
      }
      const taskId = task.id;
      saveTaskParameters(taskId, changed, true).then((saved) => {
        if (saved && selectedTask?.id === taskId) populateTaskEditor(selectedTask);
      }).catch(() => undefined);
    } catch (err) {
      setMessage(`Invalid parameters JSON: ${String(err)}`, true);
    }
  });
}

export function initScheduler(): void {
  const t0 = performance.now();
  const host = element('scheduler-grid');
  if (!host || gridApi) return;
  const options: GridOptions<SchedulerTask> = {
    columnDefs: columnDefinitions(),
    rowClassRules: {
      'scheduler-status-scheduled': (params) => params.data?.status === 'scheduled',
      'scheduler-status-running': (params) => params.data?.status === 'running',
      'scheduler-status-paused': (params) => params.data?.status === 'paused',
      'scheduler-status-completed': (params) => params.data?.status === 'completed',
      'scheduler-status-failed': (params) => params.data?.status === 'failed',
    },
    defaultColDef: { sortable: false, filter: true, resizable: true },
    getRowId: (params) => String(params.data.id),
    rowSelection: { mode: 'singleRow', checkboxes: false, enableClickSelection: true },
    rowHeight: 46,
    suppressCellFocus: true,
    rowData: [],
    paginationPageSize: 20,
    animateRows: false,
    rowDragManaged: true,
    rowDragEntireRow: true,
    theme: themeQuartz.withParams({
      backgroundColor: 'var(--sd-main-background-color)',
      foregroundColor: 'var(--sd-input-text-color)',
      accentColor: 'var(--sd-main-accent-color)',
      selectedRowBackgroundColor: 'transparent',
      borderColor: 'var(--sd-panel-border-color)',
      headerBackgroundColor: 'var(--sd-panel-background-color)',
      oddRowBackgroundColor: 'var(--sd-input-background-color)',
    }),
    onRowClicked: (event) => {
      if (event.data) setSelectedTask(event.data);
    },
    onRowDragEnd: (event) => {
      const moved = event.node.data;
      const target = event.overNode?.data;
      if (!moved || !target || moved.id === target.id) return;
      const position = event.vDirection === 'up' ? 'before' : 'after';
      performAction(`/scheduler/tasks/${moved.id}/move`, 'POST', { target_id: target.id, position }, 'Queue order updated').catch(() => undefined);
    },
    overlayNoRowsTemplate: '<span class="scheduler-media-empty">No scheduler tasks</span>',
  };
  gridApi = createGrid(host, options);
  bindControls();
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible) {
      refreshTasks().catch(() => undefined);
      if (!refreshTimer) refreshTimer = setInterval(() => refreshTasks().catch(() => undefined), 5000);
    } else if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });
  observer.observe(host);
  const t1 = performance.now();
  log('initScheduler', Math.round(t1 - t0));
  timer('initScheduler', t1 - t0);
}
