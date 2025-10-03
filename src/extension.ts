import * as vscode from 'vscode';

interface Rule { path: string; foreground?: string; background?: string; }

function nameRangeAt(doc: vscode.TextDocument, nameStart: number, nameEnd: number): vscode.Range {
  return new vscode.Range(doc.positionAt(nameStart), doc.positionAt(nameEnd));
}

function applyHighlights(editor: vscode.TextEditor, rules: Rule[]) {
  const text = editor.document.getText();
  const ranges: { range: vscode.Range; fg?: string; bg?: string }[] = [];

  const compiled = rules.map(r => {
    const trimmed = r.path.trim();
    const isPrefix = trimmed.endsWith('*');
    const literal = isPrefix ? trimmed.slice(0, -1) : trimmed;
    return { raw: r, isPrefix, literal };
  });

  const stack: string[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    if (text.charCodeAt(i) === 0x3C) { // '<'
      if (text.startsWith('<!--', i)) { const j = text.indexOf('-->', i + 4); i = j >= 0 ? j + 3 : len; continue; }
      if (text.startsWith('<![CDATA[', i)) { const j = text.indexOf(']]>', i + 9); i = j >= 0 ? j + 3 : len; continue; }
      if (text.startsWith('<!DOCTYPE', i) || text.startsWith('<!', i)) { const j = text.indexOf('>', i + 2); i = j >= 0 ? j + 1 : len; continue; }
      if (text.startsWith('<?', i)) { const j = text.indexOf('?>', i + 2); i = j >= 0 ? j + 2 : len; continue; }

      if (text.charCodeAt(i + 1) === 0x2F) { // closing
        let k = i + 2; while (k < len && /[A-Za-z0-9_:.\-]/.test(text[k])) k++;
        const name = text.slice(i + 2, k);
        if (stack.length && stack[stack.length - 1] === name) stack.pop();
        const close = text.indexOf('>', k); i = close >= 0 ? close + 1 : len; continue;
      }

      let k = i + 1; if (k < len && /\s/.test(text[k])) { i++; continue; }
      const nameStart = k; while (k < len && /[A-Za-z0-9_:.\-]/.test(text[k])) k++;
      const nameEnd = k; const name = text.slice(nameStart, nameEnd);
      const path = (stack.length ? stack.join('/') + '/' : '') + name;

      for (const r of compiled) {
        if ((r.isPrefix && path.startsWith(r.literal)) || (!r.isPrefix && path === r.literal)) {
          ranges.push({ range: nameRangeAt(editor.document, nameStart, nameEnd), fg: r.raw.foreground, bg: r.raw.background });
          break;
        }
      }

      let selfClose = false;
      while (k < len) {
        const c = text.charCodeAt(k);
        if (c === 0x3E) { k++; break; }
        if (c === 0x2F && text.charCodeAt(k + 1) === 0x3E) { selfClose = true; k += 2; break; }
        k++;
      }
      if (!selfClose) stack.push(name);
      i = k; continue;
    }
    i++;
  }

  const byKey = new Map<string, { type: vscode.TextEditorDecorationType; ranges: vscode.Range[] }>();
  for (const item of ranges) {
    const key = (item.fg||'') + '|' + (item.bg||'');
    if (!byKey.has(key)) {
      byKey.set(key, {
        type: vscode.window.createTextEditorDecorationType({ color: item.fg, backgroundColor: item.bg }),
        ranges: []
      });
    }
    byKey.get(key)!.ranges.push(item.range);
  }

  activeDecorationTypes.forEach(t => t.dispose());
  activeDecorationTypes = [];
  for (const { type, ranges: rs } of byKey.values()) {
    editor.setDecorations(type, rs);
    activeDecorationTypes.push(type);
  }
}

let activeDecorationTypes: vscode.TextEditorDecorationType[] = [];

function getRules(): Rule[] {
  const raw = vscode.workspace.getConfiguration().get<any[]>('xmlPathColors.rules') || [];
  const out: Rule[] = [];
  for (const r of raw) {
    if (r && typeof r.path === 'string') {
      out.push({ path: r.path, foreground: r.foreground, background: r.background });
    }
  }
  return out;
}

function refresh() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'xml') return;
  applyHighlights(editor, getRules());
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.workspace.onDidChangeTextDocument(e => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document && editor.document.languageId === 'xml') refresh();
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('xmlPathColors.rules')) refresh();
    }),
    vscode.commands.registerCommand('xmlPathColors.reload', () => refresh())
  );
  refresh();
}

export function deactivate() {
  activeDecorationTypes.forEach(t => t.dispose());
}
