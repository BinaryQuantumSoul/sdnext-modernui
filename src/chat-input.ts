import { autocompletion, completionStatus, type CompletionContext } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import { Decoration, drawSelection, EditorView, keymap, placeholder, ViewPlugin, type DecorationSet } from '@codemirror/view';

const chatCommands = [
  'abort', 'again', 'args', 'cancel', 'caption', 'captioning', 'context', 'db', 'details', 'exif', 'file',
  'generate', 'get', 'gpu', 'help', 'history', 'image', 'info', 'interrupt', 'last', 'list', 'mem', 'memory',
  'meta', 'metadata', 'model', 'negative', 'opts', 'p', 'params', 'pause', 'prompt',
  'reprocess', 'reset', 'resume', 'run', 'schedule', 'set', 'skip', 'smi', 'start', 'status', 'stop',
  'storage', 'title', 'use', 'ver', 'version',
];
const chatCommandSet = new Set(chatCommands);
const chatCommandCompletions = chatCommands.map((label) => ({ label, type: 'keyword' }));
const commandMark = Decoration.mark({ class: 'cm-chat-command' });
const commentMark = Decoration.mark({ class: 'cm-chat-comment' });

function editableExtensions(disabled: boolean) {
  return [EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)];
}

interface ChatInputCallbacks {
  onChange: (value: string) => void;
  onSubmit: () => void;
  onHistory: (direction: 'previous' | 'next', value: string) => string | null;
  onFiles: (files: File[]) => void;
}

function completeChatCommand(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const prefix = context.state.sliceDoc(line.from, context.pos);
  if (prefix.trim() !== prefix || prefix.includes(' ')) return null;
  const word = context.matchBefore(/[\w-]*/);
  if (!word) return null;
  return {
    from: word.from,
    options: chatCommandCompletions,
    validFor: /^[\w-]*$/,
  };
}

function commandHighlights(view: EditorView): DecorationSet {
  const line = view.state.doc.line(1);
  const match = /^(\s*)(\S+)/.exec(line.text);
  if (!match) return Decoration.none;
  const from = line.from + match[1].length;
  const token = match[2].toLowerCase();
  if (token.startsWith('#') || token.startsWith('//')) {
    return Decoration.set([commentMark.range(from, line.to)]);
  }
  if (!chatCommandSet.has(token)) return Decoration.none;
  return Decoration.set([commandMark.range(from, from + match[2].length)]);
}

const chatHighlightPlugin = ViewPlugin.define((view) => ({
  decorations: commandHighlights(view),
  update(update) {
    if (update.docChanged) this.decorations = commandHighlights(update.view);
  },
}), {
  decorations: (plugin) => plugin.decorations,
});

export class ChatInputEditor {
  readonly view: EditorView;

  private readonly editable = new Compartment();

  private suppressChange = false;

  constructor(parent: HTMLElement, placeholderText: string, ariaLabel: string, disabled: boolean, callbacks: ChatInputCallbacks) {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        extensions: [
          this.editable.of(editableExtensions(disabled)),
          history(),
          drawSelection(),
          EditorView.domEventHandlers({
            keydown: (event, view) => {
              if (completionStatus(view.state) !== 'active'
                && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                && view.state.selection.main.empty && view.state.selection.main.head === 0) {
                const direction = event.key === 'ArrowUp' ? 'previous' : 'next';
                const value = callbacks.onHistory(direction, view.state.doc.toString());
                if (value !== null) {
                  event.preventDefault();
                  this.setValue(value, 0);
                  return true;
                }
              }
              if (event.key === 'Enter' && !event.shiftKey && !event.isComposing
                && completionStatus(view.state) !== 'active') {
                event.preventDefault();
                callbacks.onSubmit();
                return true;
              }
              return false;
            },
            paste: (event) => {
              const files = Array.from(event.clipboardData?.files || []);
              if (files.length === 0) return false;
              event.preventDefault();
              callbacks.onFiles(files);
              return true;
            },
          }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          autocompletion({ override: [completeChatCommand], activateOnTyping: false }),
          placeholder(placeholderText),
          chatHighlightPlugin,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !this.suppressChange) callbacks.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    this.view.contentDOM.setAttribute('role', 'textbox');
    this.view.contentDOM.setAttribute('aria-label', ariaLabel);
    this.view.contentDOM.setAttribute('aria-multiline', 'true');
    this.view.contentDOM.setAttribute('aria-disabled', String(disabled));
    this.view.contentDOM.setAttribute('aria-autocomplete', 'list');
    this.view.contentDOM.setAttribute('spellcheck', 'false');
    this.view.contentDOM.setAttribute('autocomplete', 'off');
  }

  get value(): string {
    return this.view.state.doc.toString();
  }

  set value(value: string) {
    this.setValue(value, 0);
  }

  focus(): void {
    this.view.focus();
  }

  setDisabled(disabled: boolean): void {
    this.view.dispatch({ effects: this.editable.reconfigure(editableExtensions(disabled)) });
    this.view.contentDOM.setAttribute('aria-disabled', String(disabled));
  }

  private setValue(value: string, cursor: number): void {
    this.suppressChange = true;
    try {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: value },
        selection: { anchor: cursor },
      });
    } finally {
      this.suppressChange = false;
    }
  }
}
