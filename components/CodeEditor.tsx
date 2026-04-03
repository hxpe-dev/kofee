'use client'

import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { css } from '@codemirror/lang-css'
import { sql } from '@codemirror/lang-sql'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { java } from "@codemirror/lang-java"
import { csharp } from "@replit/codemirror-lang-csharp"
import { cpp } from "@codemirror/lang-cpp"
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { EditorView } from '@codemirror/view'
import { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { createTheme } from '@uiw/codemirror-themes'

const palette = {
  bg: '#1c1410', // matches --color-bg
  text: '#e8d8c0', // matches --color-text
  textFaint: '#7a6555', // matches --color-text-faint
  textDim: '#b89880', // matches --color-text-dim
  accent: '#c8965a', // matches --color-accent
  accent2: '#e8b878', // matches --color-accent-2
  string: '#98c090',
  number: '#d4a870',
  comment: '#6a5040',
  punctuation: '#8a6848',
  operator: '#a07858',
  border: 'transparent',
}

// Kofee theme
const kofeeTheme = createTheme({
  theme: 'dark',
  settings: {
    background: palette.bg,
    foreground: palette.text,
    caret: palette.accent,
    selection: 'rgba(200,150,90,0.2)',
    selectionMatch: 'rgba(200,150,90,0.12)',
    lineHighlight: 'rgba(200,150,90,0.04)',
    gutterBackground: palette.bg,
    gutterForeground: palette.textFaint,
    gutterBorder: palette.border,
  },
  styles: [
    { tag: tags.comment, color: palette.comment, fontStyle: 'italic' },
    { tag: tags.keyword, color: palette.accent },
    { tag: tags.operator, color: palette.operator },
    { tag: tags.punctuation, color: palette.punctuation },
    { tag: tags.string, color: palette.string },
    { tag: tags.number, color: palette.number },
    { tag: tags.bool, color: palette.accent },
    { tag: tags.null, color: palette.accent },
    { tag: tags.variableName, color: palette.text },
    { tag: tags.definition(tags.variableName), color: '#d8c8a8' },
    { tag: tags.function(tags.variableName), color: palette.accent2 },
    { tag: tags.className, color: palette.accent2 },
    { tag: tags.typeName, color: palette.textDim },
    { tag: tags.propertyName, color: '#c0a878' },
    { tag: tags.attributeName, color: palette.accent },
    { tag: tags.attributeValue, color: palette.string },
    { tag: tags.tagName, color: palette.accent2 },
    { tag: tags.angleBracket, color: palette.punctuation },
    { tag: tags.meta, color: palette.comment },
    { tag: tags.regexp, color: palette.string },
  ],
})

// Editor base styles
const editorStyles = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    fontFamily: '"JetBrains Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    padding: '24px 0',
    lineHeight: '1.8',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '.cm-content': {
    caretColor: palette.accent,
    minHeight: '100%',
    paddingRight: '28px',
  },
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
    height: 'calc(13px * 1.8)',
    boxSizing: 'content-box',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(200,150,90,0.04) !important',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: `${palette.textDim} !important`,
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(200,150,90,0.2) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(200,150,90,0.25) !important',
  },
  '.cm-cursor': {
    borderLeftColor: `${palette.accent} !important`,
    borderLeftWidth: '2px'
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(200,150,90,0.2)',
    outline: '1px solid rgba(200,150,90,0.4)',
    borderRadius: '2px',
  },
  '.cm-placeholder': {
    color: palette.textFaint,
    fontStyle: 'italic',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

// Language resolver
function getLanguage(lang: string): Extension {
  switch (lang) {
    case 'js': return javascript()
    case 'ts': return javascript({ typescript: true })
    case 'py': return python()
    case 'rs': return rust()
    case 'css': return css()
    case 'sql': return sql()
    case 'html': return html()
    case 'json': return json()
    case 'java': return java()
    case 'cs': return csharp()
    case 'cpp': return cpp()
    case 'bash': return StreamLanguage.define(shell)
    default: return javascript() // js fallback 
  }
}

// Props
interface Props {
  value: string
  lang: string
  onChange: (value: string) => void
}

// Code Editor component
export default function CodeEditor({ value, lang, onChange }: Props) {
  return (
    <div 
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <CodeMirror
        value={value}
        height="100%"
        theme={kofeeTheme}
        extensions={[getLanguage(lang), editorStyles]}
        onChange={onChange}
        placeholder="Paste or write your code here..."
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: false,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          searchKeymap: false,
          foldKeymap: false,
          completionKeymap: true,
          lintKeymap: false,
        }}
        style={
          {
            height: '100%',
            overflow: 'hidden',
          }
        }
      />
    </div>
  )
}