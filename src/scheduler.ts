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
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
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

const hiddenControlParameters = new Set(['state', 'scheduler', 'units', 'input_script_args', 'inputs', 'inits', 'mask', 'unit_type', 'is_generator', 'input_type']);
const commonTextControlFields = ['prompt', 'negative_prompt'] as const;
const commonNumberControlFields = ['steps', 'width_before', 'height_before'] as const;
const commonControlFields = new Set<string>([...commonTextControlFields, ...commonNumberControlFields]);
const commonModelFields = ['sd_model_checkpoint', 'sd_model_refiner', 'sd_unet', 'sd_vae', 'sd_text_encoder'] as const;

function editableControlParameters(task: SchedulerTask): Record<string, unknown> {
  return Object.fromEntries(Object.entries(controlParameters(task)).filter(([key]) => !hiddenControlParameters.has(key) && !commonControlFields.has(key)));
}

function populateTaskEditor(task: SchedulerTask): void {
  const parameters = element<HTMLTextAreaElement>('scheduler-parameters');
  if (parameters) parameters.value = JSON.stringify(editableControlParameters(task), null, 2);
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
  const prompt = controlParameters(task).prompt;
  return typeof prompt === 'string' ? prompt : '';
}

function imageReferences(value: unknown, indices = new Set<number>()): number[] {
  if (Array.isArray(value)) {
    value.forEach((item) => imageReferences(item, indices));
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Object.getOwnPropertyDescriptor(record, '__sd_scheduler_type__')?.value === 'image' && typeof record.id === 'number') indices.add(record.id);
    else Object.values(record).forEach((item) => imageReferences(item, indices));
  }
  return [...indices].sort((left, right) => left - right);
}

function stylesFor(task: SchedulerTask): string {
  const styles = controlParameters(task).styles;
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
  const indices = imageReferences(task.parameters);
  target.replaceChildren();
  if (indices.length === 0) {
    appendEmpty(target, 'No stored input images');
    return;
  }
  for (const index of indices) {
    const response = await authFetch(`${window.api}/scheduler/tasks/${task.id}/images/${index}`);
    if (!response?.ok || selectedTask?.id !== task.id) continue;
    const objectUrl = URL.createObjectURL(await response.blob());
    activeObjectUrls.push(objectUrl);
    const image = document.createElement('img');
    image.src = objectUrl;
    image.alt = `Input image ${index + 1} for task ${task.id}`;
    target.append(image);
  }
  if (!target.childElementCount) appendEmpty(target, 'Input images could not be loaded');
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
    const mimeTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
    const imageBlob = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: mimeTypes[extension] ?? 'application/octet-stream' });
    const objectUrl = URL.createObjectURL(imageBlob);
    activeObjectUrls.push(objectUrl);
    const image = document.createElement('img');
    image.src = objectUrl;
    image.alt = `Result from task ${task.id}: ${path.split(/[\\/]/).pop() ?? path}`;
    image.title = path;
    image.addEventListener('click', (event) => window.galleryClickEventHandler?.(event), true);
    target.append(image);
  }
  if (!target.childElementCount) appendEmpty(target, 'Saved result previews are unavailable');
}

function setActionState(task: SchedulerTask | null): void {
  const canReschedule = Boolean(task && ['scheduled', 'paused', 'failed'].includes(task.status));
  const canEdit = Boolean(task && task.status !== 'running');
  ['scheduler-common-parameters-save', 'scheduler-parameters-save'].forEach((id) => {
    const button = element<HTMLButtonElement>(id);
    if (button) button.disabled = !canEdit;
  });
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
    gridApi.setGridOption('rowData', taskRows);
    const loadMore = element<HTMLButtonElement>('scheduler-load-more');
    if (loadMore) loadMore.hidden = !hasMoreTasks;
    if (selectedTask) {
      const refreshed = taskRows.find((task) => task.id === selectedTask?.id);
      if (refreshed) setSelectedTask(refreshed, false);
      else {
        selectedTask = null;
        setActionState(null);
      }
    }
    const statusTarget = element('scheduler-worker-status');
    const windowStatus = status.state === 'Auto' ? ` ${status.start}-${status.end} | Window ${status.window_open ? 'open' : 'closed'}` : '';
    if (statusTarget) statusTarget.textContent = `${status.worker_running ? 'Worker online' : 'Worker offline'} | ${status.state}${windowStatus}`;
    (['Active', 'Paused', 'Auto'] as const).forEach((state) => {
      const button = element<HTMLButtonElement>(`scheduler-mode-${state.toLowerCase()}`);
      if (button) button.setAttribute('aria-pressed', String(status.state === state));
    });
    const start = element<HTMLInputElement>('scheduler-window-start');
    const end = element<HTMLInputElement>('scheduler-window-end');
    if (start && document.activeElement !== start) start.value = status.start;
    if (end && document.activeElement !== end) end.value = status.end;
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
    gridApi.setGridOption('rowData', [...tasks, ...page]);
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
    { field: 'id', headerName: 'ID', width: 88, filter: false, rowDrag: (params) => params.data?.status === 'scheduled' || params.data?.status === 'paused' },
    { field: 'created_at', headerName: 'Created', width: 122, cellClass: 'scheduler-datetime-cell', valueFormatter: (params) => formatDateTime(params.value) },
    {
      headerName: 'Scheduled',
      field: 'scheduled_at',
      width: 122,
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
    { field: 'started_at', headerName: 'Executed', width: 122, cellClass: 'scheduler-datetime-cell', valueFormatter: (params) => formatDateTime(params.value) },
    {
      headerName: 'Model',
      valueGetter: (params) => (typeof params.data?.parameters.model === 'string' ? params.data.parameters.model : ''),
      width: 180,
      wrapText: true,
      autoHeight: true,
      cellClass: 'scheduler-wrap-cell',
      tooltip: (params) => (typeof params.value === 'string' ? params.value : ''),
    },
    { headerName: 'Prompt', valueGetter: (params) => (params.data ? promptFor(params.data) : ''), flex: 1, minWidth: 180, wrapText: true, autoHeight: true, cellClass: 'scheduler-wrap-cell' },
    { headerName: 'Styles', valueGetter: (params) => (params.data ? stylesFor(params.data) : ''), width: 180 },
    { field: 'status', headerName: 'Status', width: 124, tooltip: (params) => (params.data ? `Task ${params.data.id}: ${params.data.status}` : '') },
    {
      headerName: 'Actions',
      width: 164,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: taskActionsCell,
      cellRendererParams: { suppressMouseEventHandling: () => true },
    },
  ];
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
  element('scheduler-common-parameters-save')?.addEventListener('click', () => {
    if (!selectedTask || selectedTask.status === 'running') return;
    const taskId = selectedTask.id;
    const control = controlParameters(selectedTask);
    const changed: Record<string, unknown> = {};
    commonTextControlFields.forEach((key) => {
      const value = element<HTMLTextAreaElement>(`scheduler-common-${key}`)?.value;
      if (value !== undefined && control[key] !== value) changed[key] = value;
    });
    try {
      commonNumberControlFields.forEach((key) => {
        const input = element<HTMLInputElement>(`scheduler-common-${key}`);
        if (!input) return;
        const value = input.valueAsNumber;
        if (!Number.isInteger(value) || value < 1) throw new Error(`${key} must be a positive whole number`);
        if (control[key] !== value) changed[key] = value;
      });
      commonModelFields.forEach((key) => {
        const input = element<HTMLInputElement>(`scheduler-common-${key}`);
        if (!input) return;
        const value = input.value;
        if (!Object.hasOwn(selectedTask?.parameters ?? {}, key) && value === '') return;
        if (selectedTask?.parameters[key] !== value) changed[key] = value;
      });
      if (Object.keys(changed).length === 0) {
        setMessage('No parameter changes');
        return;
      }
      performAction(`/scheduler/tasks/${taskId}/parameters`, 'PATCH', { parameters: changed }, `Task ${taskId} common parameters saved`).then((saved) => {
        if (saved && selectedTask?.id === taskId) populateTaskEditor(selectedTask);
      }).catch(() => undefined);
    } catch (err) {
      setMessage(`Invalid common parameters: ${String(err)}`, true);
    }
  });
  element<HTMLInputElement>('scheduler-reschedule-at')?.addEventListener('change', (event) => {
    const scheduledAt = (event.target as HTMLInputElement).value;
    if (!selectedTask || !scheduledAt) return;
    performAction(`/scheduler/tasks/${selectedTask.id}/reschedule`, 'POST', { scheduled_at: new Date(scheduledAt).toISOString() }, `Task ${selectedTask.id} rescheduled`).catch(() => undefined);
  });
  element('scheduler-parameters-save')?.addEventListener('click', () => {
    if (!selectedTask) return;
    try {
      const parameters = JSON.parse(element<HTMLTextAreaElement>('scheduler-parameters')?.value ?? '') as Record<string, unknown>;
      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('Parameters must be a JSON object');
      const current = editableControlParameters(selectedTask);
      const immutable = new Set(['state', 'scheduler', 'units', 'inputs', 'inits', 'mask', 'input_script_args', 'override_script_args']);
      const removed = Object.keys(current).filter((key) => !Object.hasOwn(parameters, key));
      if (removed.length) throw new Error(`Removing parameters is not supported: ${removed.join(', ')}`);
      const changed: Record<string, unknown> = {};
      Object.entries(parameters).forEach(([key, value]) => {
        if (!Object.hasOwn(current, key)) throw new Error(`Adding parameter "${key}" is not supported`);
        if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
          if (immutable.has(key)) throw new Error(`Updating "${key}" is not supported`);
          changed[key] = value;
        }
      });
      if (Object.keys(changed).length === 0) {
        setMessage('No parameter changes');
        return;
      }
      const taskId = selectedTask.id;
      performAction(`/scheduler/tasks/${taskId}/parameters`, 'PATCH', { parameters: changed }, `Task ${taskId} parameters saved`).then((saved) => {
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
