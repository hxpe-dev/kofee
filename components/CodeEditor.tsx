'use client'

import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { css } from '@codemirror/lang-css'
import { sql } from '@codemirror/lang-sql'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { EditorView } from '@codemirror/view'
import { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { createTheme } from '@uiw/codemirror-themes'

// ── Kofee warm theme ──────────────────────────────────────────────
const kofeeTheme = createTheme({
  theme: 'dark',
  settings: {
    background:        'transparent',
    foreground:        '#e8d8c0',
    caret:             '#c8965a',
    selection:         'rgba(200,150,90,0.2)',
    selectionMatch:    'rgba(200,150,90,0.12)',
    lineHighlight:     'rgba(200,150,90,0.04)',
    gutterBackground:  'transparent',
    gutterForeground:  '#5a4838',
    gutterBorder:      'transparent',
  },
  styles: [
    { tag: tags.comment,              color: '#6a5040', fontStyle: 'italic' },
    { tag: tags.keyword,              color: '#c8965a' },
    { tag: tags.operator,             color: '#a07858' },
    { tag: tags.punctuation,          color: '#8a6848' },
    { tag: tags.string,               color: '#98c090' },
    { tag: tags.number,               color: '#d4a870' },
    { tag: tags.bool,                 color: '#c8965a' },
    { tag: tags.null,                 color: '#c8965a' },
    { tag: tags.variableName,         color: '#e8d8c0' },
    { tag: tags.definition(tags.variableName), color: '#d8c8a8' },
    { tag: tags.function(tags.variableName),   color: '#e8b878' },
    { tag: tags.className,            color: '#e8b878' },
    { tag: tags.typeName,             color: '#b8a888' },
    { tag: tags.propertyName,         color: '#c0a878' },
    { tag: tags.attributeName,        color: '#c8965a' },
    { tag: tags.attributeValue,       color: '#98c090' },
    { tag: tags.tagName,              color: '#e8b878' },
    { tag: tags.angleBracket,         color: '#8a6848' },
    { tag: tags.meta,                 color: '#6a5040' },
    { tag: tags.regexp,               color: '#98c090' },
  ],
})

// ── Editor base styles ────────────────────────────────────────────
const editorStyles = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '.cm-scroller': {
    overflow: 'auto',
    padding: '24px 0 24px 0',
    lineHeight: '1.8',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '.cm-content': {
    caretColor: '#c8965a',
    minHeight: '100%',
    paddingRight: '28px',
  },
  // ── Fix: match gutter line height to editor line height ──
  '.cm-gutters': {
    paddingRight: '0',
    paddingLeft: '28px',
    minWidth: '56px',
    display: 'flex',
    alignItems: 'flex-start',
  },
  '.cm-gutter.cm-lineNumbers': {
    minWidth: '28px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    fontSize: '11px',
    lineHeight: '1.8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 8px 0 0',
    // Match the exact line height of the editor
    height: 'calc(13px * 1.8)',
    boxSizing: 'content-box',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(200,150,90,0.04) !important',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#9a8070 !important',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(200,150,90,0.2) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(200,150,90,0.25) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#c8965a !important',
    borderLeftWidth: '2px',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(200,150,90,0.2)',
    outline: '1px solid rgba(200,150,90,0.4)',
    borderRadius: '2px',
  },
  '.cm-placeholder': {
    color: '#5a4838',
    fontStyle: 'italic',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

// ── Language resolver ─────────────────────────────────────────────
function getLanguage(lang: string): Extension {
  switch (lang) {
    case 'js':   return javascript()
    case 'ts':   return javascript({ typescript: true })
    case 'py':   return python()
    case 'css':  return css()
    case 'sql':  return sql()
    case 'html': return html()
    case 'json': return json()
    case 'bash': return StreamLanguage.define(shell)
    default:     return javascript()
  }
}

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  value: string
  lang: string
  onChange: (value: string) => void
}

// ── Component ─────────────────────────────────────────────────────
export default function CodeEditor({ value, lang, onChange }: Props) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <CodeMirror
        value={value}
        height="100%"
        theme={kofeeTheme}
        extensions={[getLanguage(lang), editorStyles]}
        onChange={onChange}
        placeholder="Paste or write your code here..."
        basicSetup={{
          lineNumbers:               true,
          highlightActiveLineGutter: true,
          highlightSpecialChars:     true,
          foldGutter:                false,
          drawSelection:             true,
          dropCursor:                true,
          allowMultipleSelections:   false,
          indentOnInput:             true,
          syntaxHighlighting:        true,
          bracketMatching:           true,
          closeBrackets:             true,
          autocompletion:            true,
          rectangularSelection:      false,
          crosshairCursor:           false,
          highlightActiveLine:       true,
          highlightSelectionMatches: true,
          closeBracketsKeymap:       true,
          searchKeymap:              false,
          foldKeymap:                false,
          completionKeymap:          true,
          lintKeymap:                false,
        }}
        style={{ height: '100%', overflow: 'hidden' }}
      />
    </div>
  )
}