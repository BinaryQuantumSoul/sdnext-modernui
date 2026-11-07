import { autocompletion, completionStatus, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, type Range } from '@codemirror/state';
import { Decoration, drawSelection, EditorView, keymap, placeholder, ViewPlugin, type DecorationSet } from '@codemirror/view';

const chatCommands = [
  'abort', 'again', 'args', 'cancel', 'caption', 'captioning', 'clear', 'context', 'db', 'details', 'exif', 'file',
  'generate', 'get', 'gpu', 'help', 'history', 'image', 'info', 'interrupt', 'last', 'list', 'mem', 'memory',
  'meta', 'metadata', 'model', 'negative', 'opts', 'p', 'params', 'pause', 'prompt',
  'reprocess', 'reset', 'resume', 'run', 'schedule', 'set', 'skip', 'snap', 'snapshot', 'smi', 'start', 'status', 'stop',
  'storage', 'title', 'use', 'ver', 'version',
];
const chatCommandSet = new Set(chatCommands);
const promptMarkers = new Set(['`', "'", '"', '>']);
const chatCommandCompletions = chatCommands.map((label) => ({ label, type: 'keyword' }));
interface ChatPromptCompletion extends Completion {
  glyph: string;
  color: string;
  count: string;
  category: string;
}

const commandMark = Decoration.mark({ class: 'cm-chat-command' });
const commentMark = Decoration.mark({ class: 'cm-chat-comment' });
const numberMark = Decoration.mark({ class: 'cm-chat-number' });
const networkMark = Decoration.mark({ class: 'cm-chat-network' });
const delimiterMark = Decoration.mark({ class: 'cm-chat-delimiter' });
const wildcardMark = Decoration.mark({ class: 'cm-chat-wildcard' });
const bracketClasses: Record<string, string> = {
  '(': 'cm-chat-bracket-emphasis',
  ')': 'cm-chat-bracket-emphasis',
  '[': 'cm-chat-bracket-deemphasis',
  ']': 'cm-chat-bracket-deemphasis',
  '{': 'cm-chat-bracket-group',
  '}': 'cm-chat-bracket-group',
};
const bracketContentMarks: Record<string, Decoration> = {
  '(': Decoration.mark({ class: 'cm-chat-emphasis' }),
  '[': Decoration.mark({ class: 'cm-chat-deemphasis' }),
  '{': Decoration.mark({ class: 'cm-chat-grouping' }),
};
const bracketClosers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const bracketOpeners: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const networkPattern = /^<([\w-]+):([^\s<>:]+)(?::([-+]?(?:\d+(?:\.\d+)?|\.\d+)))?>/;
const numberPattern = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?![\w.])/;
const wildcardPattern = /^__(?:(?!__).)+__/;

function editableExtensions(disabled: boolean) {
  return [EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)];
}

interface ChatInputCallbacks {
  onChange: (value: string) => void;
  onSubmit: () => void;
  onHistory: (direction: 'previous' | 'next', value: string) => string | null;
  onFiles: (files: File[]) => void;
  getParameters: () => { name: string; type: string }[];
  getChoices: (name: string) => Promise<string[]>;
}

function normalizedChoice(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function choiceCompletion(from: number, rawValue: string, choices: string[], quoteValues = false) {
  const comma = rawValue.lastIndexOf(',');
  const segmentStart = comma + 1;
  const segment = rawValue.slice(segmentStart);
  const leading = segment.length - segment.trimStart().length;
  const trimmed = segment.trim();
  const quote = trimmed[0] === '"' || trimmed[0] === "'" ? trimmed[0] : '';
  const query = trimmed.replace(/^['"]|['"]$/g, '');
  const normalizedQuery = normalizedChoice(query);
  const options = choices
    .filter((choice) => !normalizedQuery || normalizedChoice(choice).includes(normalizedQuery))
    .map((choice) => ({
      label: choice,
      type: 'enum',
      apply(view: EditorView, _completion: Completion, start: number, end: number) {
        let value = choice;
        if (quote) value = `${quote}${choice.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`;
        else if (quoteValues) value = JSON.stringify(choice);
        view.dispatch({ changes: { from: start, to: end, insert: value } });
      },
    }));
  if (options.length === 0) return null;
  return {
    from: from + segmentStart + leading,
    filter: false,
    validFor: /^[^,\n]*$/,
    options,
  };
}

function currentShellArgument(text: string): { index: number; from: number; value: string } {
  let index = 0;
  let from = text.length;
  let started = false;
  let quote = '';
  for (let offset = 0; offset < text.length; offset += 1) {
    const character = text[offset];
    if (quote) {
      if (character === '\\') offset += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      if (!started) from = offset;
      started = true;
      quote = character;
    } else if (/\s/.test(character)) {
      if (started) {
        index += 1;
        started = false;
      }
    } else {
      if (!started) from = offset;
      started = true;
    }
  }
  return { index, from: started ? from : text.length, value: text.slice(started ? from : text.length) };
}

function completeChatInput(
  context: CompletionContext,
  getParameters: ChatInputCallbacks['getParameters'],
  getChoices: ChatInputCallbacks['getChoices'],
) {
  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = context.state.sliceDoc(line.from, context.pos);
  const command = context.matchBefore(/\/[\w-]*/);
  const promptLine = promptMarkers.has(line.text.trimStart()[0] ?? '');
  const commandPrefix = command?.text.slice(1).toLowerCase() ?? '';
  const commandStart = command ? context.state.sliceDoc(line.from, command.from) : '';
  if (!promptLine && command && !commandStart.trim()
    && chatCommands.some((name) => name.startsWith(commandPrefix))) {
    return { from: command.from + 1, options: chatCommandCompletions, validFor: /^[\w-]*$/ };
  }

  if (!context.state.sliceDoc(0, line.from).trim()) {
    const setCommand = /^\s*\/?set\s+/i.exec(linePrefix);
    const optsCommand = /^\s*\/?opts\s+/i.exec(linePrefix);
    const valueCommand = setCommand || optsCommand;
    if (valueCommand) {
      const args = linePrefix.slice(valueCommand[0].length);
      const assignment = /^([^\s=:]+)(?:\s*[=:]\s*|\s+)([\s\S]*)$/.exec(args);
      if (assignment) {
        const name = assignment[1].toLowerCase();
        const value = assignment[2].replace(/^to\s+/i, '');
        const from = line.from + valueCommand[0].length + assignment[0].length - assignment[2].length
          + (assignment[2].length - value.length);
        return getChoices(name).then((choices) => (
          context.aborted ? null : choiceCompletion(from, value, choices)
        ));
      }
    }

    const modelCommand = /^\s*\/?model(?:\s+|$)/i.exec(linePrefix);
    if (modelCommand) {
      const args = linePrefix.slice(modelCommand[0].length);
      const argument = currentShellArgument(args);
      if (argument.index <= 1) {
        const name = argument.index === 0 ? 'model' : 'unet';
        const from = line.from + modelCommand[0].length + argument.from;
        return getChoices(name).then((choices) => (
          context.aborted ? null : choiceCompletion(from, argument.value, choices, true)
        ));
      }
    }
  }

  if (!context.state.sliceDoc(0, line.from).trim() && /^\s*\/?(?:set|get)(?:\s+|$)/i.test(linePrefix)) {
    const parameterCommand = /^\s*\/?(?:set|get)\s+([^\s=]*)$/i.exec(linePrefix);
    if (!parameterCommand) return null;
    const query = parameterCommand[1].toLowerCase();
    const options = getParameters()
      .filter((parameter) => parameter.name.toLowerCase().startsWith(query))
      .map((parameter) => ({ label: parameter.name, type: 'property', detail: parameter.type }));
    return { from: context.pos - parameterCommand[1].length, options, validFor: /^[\w-]*$/ };
  }

  const commandLine = /^\s*\/?([\w-]+)(?:\s|$)/.exec(linePrefix);
  if (!promptLine && !context.state.sliceDoc(0, line.from).trim()
    && commandLine && chatCommandSet.has(commandLine[1].toLowerCase())) return null;

  const selection = context.state.selection.main;
  const suggestions = window.chatPromptAutocomplete?.search(
    context.state.doc.toString(),
    selection.from,
    selection.to,
  );
  if (!suggestions || suggestions.options.length === 0) return null;
  return {
    from: suggestions.from,
    to: suggestions.to,
    filter: false,
    getMatch(completion: Completion) {
      const query = suggestions.query.toLowerCase().replace(/ /g, '_');
      if (!query) return [];
      const label = completion.label.toLowerCase().replace(/ /g, '_');
      const match = label.indexOf(query);
      return match < 0 ? [] : [match, match + query.length];
    },
    options: suggestions.options.map((suggestion) => {
      let type = 'text';
      if (suggestion.kind === 'lora') type = 'class';
      else if (suggestion.kind === 'wildcard') type = 'constant';
      else if (suggestion.kind === 'embed') type = 'type';
      return {
        label: suggestion.label,
        type,
        glyph: suggestion.glyph,
        color: suggestion.color,
        count: suggestion.count,
        category: suggestion.detail,
        apply(view: EditorView) {
          view.dispatch({
            changes: { from: suggestion.from, to: suggestion.to, insert: suggestion.insert },
            selection: { anchor: suggestion.cursor },
          });
        },
      };
    }),
  };
}

function chatHighlights(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const bracketStack: { character: string; from: number }[] = [];
  const bracketPositions: { character: string; from: number }[] = [];
  const bracketWarnings = new Set<number>();
  let inHtmlComment = false;
  const add = (mark: Decoration, from: number, to: number): void => {
    if (to > from) decorations.push(mark.range(from, to));
  };
  const document = view.state.doc;

  for (let lineNumber = 1; lineNumber <= document.lines; lineNumber += 1) {
    const line = document.line(lineNumber);
    let offset = 0;
    if (inHtmlComment) {
      const commentEnd = line.text.indexOf('-->');
      if (commentEnd < 0) {
        add(commentMark, line.from, line.to);
        continue;
      }
      add(commentMark, line.from, line.from + commentEnd + 3);
      inHtmlComment = false;
      offset = commentEnd + 3;
    }

    const comment = /^(\s*)#/.exec(line.text);
    if (comment) {
      add(commentMark, line.from + comment[1].length, line.to);
      continue;
    }

    if (lineNumber === 1) {
      const command = /^(\s*)(\S+)/.exec(line.text);
      if (command && !promptMarkers.has(command[2][0]) && chatCommandSet.has(command[2].toLowerCase())) {
        const from = line.from + command[1].length;
        add(commandMark, from, from + command[2].length);
      }
    }

    for (; offset < line.text.length;) {
      const remaining = line.text.slice(offset);
      const from = line.from + offset;
      if (remaining.startsWith('<!--')) {
        const commentEnd = line.text.indexOf('-->', offset + 4);
        if (commentEnd < 0) {
          add(commentMark, from, line.to);
          inHtmlComment = true;
          break;
        }
        add(commentMark, from, line.from + commentEnd + 3);
        offset = commentEnd + 3;
        continue;
      }
      if (remaining.startsWith('//')) {
        add(commentMark, from, line.to);
        break;
      }
      const network = networkPattern.exec(remaining);
      if (network) {
        const token = network[0];
        add(networkMark, from, from + token.length);
        for (let tokenOffset = 0; tokenOffset < token.length; tokenOffset += 1) {
          if (token[tokenOffset] === ':') add(delimiterMark, from + tokenOffset, from + tokenOffset + 1);
        }
        if (network[3]) {
          const weightFrom = from + token.length - 1 - network[3].length;
          add(numberMark, weightFrom, weightFrom + network[3].length);
        }
        offset += token.length;
        continue;
      }

      const wildcard = wildcardPattern.exec(remaining);
      if (wildcard) {
        add(wildcardMark, from, from + wildcard[0].length);
        offset += wildcard[0].length;
        continue;
      }

      const character = line.text[offset];
      if (bracketClasses[character]) {
        bracketPositions.push({ character, from });
        if (bracketClosers[character]) {
          bracketStack.push({ character, from });
        } else {
          const expectedOpener = bracketOpeners[character];
          let openerIndex = -1;
          for (let stackIndex = bracketStack.length - 1; stackIndex >= 0; stackIndex -= 1) {
            if (bracketClosers[bracketStack[stackIndex].character] === character) {
              openerIndex = stackIndex;
              break;
            }
          }
          if (openerIndex < 0) {
            bracketWarnings.add(from);
          } else {
            while (bracketStack.length - 1 > openerIndex) {
              const unmatched = bracketStack.pop();
              if (unmatched) bracketWarnings.add(unmatched.from);
            }
            const matched = bracketStack.pop();
            if (matched) add(bracketContentMarks[matched.character], matched.from + 1, from);
          }
          if (!expectedOpener) bracketWarnings.add(from);
        }
        offset += 1;
        continue;
      }

      if (character === ':' && bracketStack.length > 0) add(delimiterMark, from, from + 1);
      const previousCharacter = offset > 0 ? line.text[offset - 1] : '';
      const number = numberPattern.exec(remaining);
      if (number && !/[\w.]/.test(previousCharacter)) {
        add(numberMark, from, from + number[0].length);
        offset += number[0].length;
        continue;
      }
      offset += 1;
    }
  }

  bracketStack.forEach((unmatched) => bracketWarnings.add(unmatched.from));
  bracketPositions.forEach(({ character, from }) => {
    const warning = bracketWarnings.has(from);
    const mark = Decoration.mark({
      class: `${bracketClasses[character]}${warning ? ' cm-chat-bracket-warning' : ''}`,
      attributes: warning ? { title: 'Mismatched or unclosed bracket' } : undefined,
    });
    add(mark, from, from + 1);
  });
  return decorations.length > 0 ? Decoration.set(decorations, true) : Decoration.none;
}

const chatHighlightPlugin = ViewPlugin.define((view) => ({
  decorations: chatHighlights(view),
  update(update) {
    if (update.docChanged) this.decorations = chatHighlights(update.view);
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
          autocompletion({
            override: [(context) => completeChatInput(context, callbacks.getParameters, callbacks.getChoices)],
            activateOnTyping: true,
            selectOnOpen: false,
            maxRenderedOptions: 8,
            icons: false,
            addToOptions: [
              {
                position: 20,
                render(completion) {
                  const option = completion as Partial<ChatPromptCompletion>;
                  if (!option.glyph) return null;
                  const glyph = document.createElement('span');
                  glyph.className = 'cm-chat-completion-glyph';
                  glyph.textContent = option.glyph;
                  glyph.style.color = option.color ?? '';
                  glyph.title = option.category ?? '';
                  return glyph;
                },
              },
              {
                position: 90,
                render(completion) {
                  const count = (completion as Partial<ChatPromptCompletion>).count;
                  if (!count) return null;
                  const element = document.createElement('span');
                  element.className = 'cm-chat-completion-count';
                  element.textContent = count;
                  return element;
                },
              },
            ],
          }),
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
