'use client'

import { useState } from 'react'
import styles from '@/styles/importModal.module.css'

const LANG_COLORS: Record<string, string> = {
  js:   'var(--lang-js)',   ts:   'var(--lang-ts)',
  py:   'var(--lang-py)',   css:  'var(--lang-css)',
  bash: 'var(--lang-bash)', sql:  'var(--lang-sql)',
  html: 'var(--lang-html)', json: 'var(--lang-json)',
  other:'var(--lang-other)',
}

interface GistFile {
  filename: string
  content:  string
  language: string
}

interface Props {
  onImported: (snippet: { title: string; code: string; lang: string; gist_url: string }) => void
  onClose: () => void
}

export default function ImportModal({ onImported, onClose }: Props) {
  const [gistUrl, setGistUrl]       = useState('')
  const [importing, setImporting]   = useState(false)
  const [importError, setImportError] = useState('')
  const [pickerFiles, setPickerFiles] = useState<GistFile[]>([])
  const [pickerGistUrl, setPickerGistUrl] = useState('')

  async function handleImport() {
    if (!gistUrl.trim()) return
    setImporting(true)
    setImportError('')

    const res = await fetch('/api/gist/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gistUrl: gistUrl.trim() }),
    })

    const data = await res.json()
    setImporting(false)

    if (!res.ok) {
      setImportError(data.error ?? 'Something went wrong')
      return
    }

    if (data.files.length === 1) {
      onImported({
        title:    data.title,
        code:     data.files[0].content,
        lang:     data.files[0].language,
        gist_url: data.gist_url,
      })
      onClose()
    } else {
      // Multiple files → show picker
      setPickerFiles(data.files)
      setPickerGistUrl(data.gist_url)
    }
  }

  function handlePickFile(file: GistFile) {
    onImported({
      title:    file.filename,
      code:     file.content,
      lang:     file.language,
      gist_url: pickerGistUrl,
    })
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {pickerFiles.length === 0 ? (
          /* ── URL input view ── */
          <>
            <div className={styles.title}>Import from Gist</div>
            <div className={styles.subtitle}>
              Paste a GitHub Gist URL to import it as a snippet.
            </div>

            <input
              autoFocus
              className={`${styles.urlInput} ${importError ? styles.urlInputError : ''}`}
              value={gistUrl}
              onChange={e => { setGistUrl(e.target.value); setImportError('') }}
              onKeyDown={e => e.key === 'Enter' && handleImport()}
              placeholder="https://gist.github.com/user/abc123"
            />

            {importError && (
              <div className={styles.errorMsg}>{importError}</div>
            )}

            <div className={styles.buttonRow}>
              <button className={styles.btnCancel} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.btnImport}
                onClick={handleImport}
                disabled={importing || !gistUrl.trim()}
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        ) : (
          /* ── Multi-file picker view ── */
          <>
            <div className={styles.title}>Pick a file</div>
            <div className={styles.subtitle}>
              This Gist has multiple files. Which one do you want to import?
            </div>

            <div className={styles.fileList}>
              {pickerFiles.map(file => (
                <div
                  key={file.filename}
                  className={styles.fileItem}
                  onClick={() => handlePickFile(file)}
                >
                  <span className={styles.fileName}>{file.filename}</span>
                  <span
                    className={styles.fileLang}
                    style={{
                      background: `color-mix(in srgb, ${LANG_COLORS[file.language] ?? 'var(--lang-other)'} 15%, transparent)`,
                      color: LANG_COLORS[file.language] ?? 'var(--lang-other)',
                    }}
                  >
                    {file.language}
                  </span>
                </div>
              ))}
            </div>

            <button className={styles.btnCancelFull} onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}