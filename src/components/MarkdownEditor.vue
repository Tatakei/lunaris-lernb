<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { marked } from 'marked'

interface Props {
  modelValue: string
  title?: string
  filename?: string
  category?: 'docs' | 'modules'
  isNew?: boolean
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  title: '',
  filename: '',
  category: 'docs',
  isNew: false,
  saving: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:filename', value: string): void
  (e: 'save', payload: { content: string; filename?: string }): void
  (e: 'cancel'): void
}>()

const textContent = ref(props.modelValue)
const docFilename = ref(props.filename)
const viewMode = ref<'split' | 'editor' | 'preview'>('split')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)
const initialContent = ref(props.modelValue)

watch(() => props.modelValue, (newVal) => {
  if (newVal !== textContent.value) {
    textContent.value = newVal
    initialContent.value = newVal
  }
})

watch(() => props.filename, (newVal) => {
  docFilename.value = newVal
})

const isDirty = computed(() => {
  return textContent.value !== initialContent.value || (props.isNew && docFilename.value.trim().length > 0)
})

const wordCount = computed(() => {
  const text = textContent.value.trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
})

const charCount = computed(() => textContent.value.length)
const lineCount = computed(() => textContent.value ? textContent.value.split('\n').length : 0)

const renderedHtml = computed(() => {
  if (!textContent.value) return '<p class="empty-preview">Keine Vorschau verfügbar (leerer Inhalt)</p>'
  try {
    return marked.parse(textContent.value, { async: false }) as string
  } catch (err) {
    return `<p class="error-preview">Fehler beim Parsen von Markdown: ${err}</p>`
  }
})

const onInput = () => {
  emit('update:modelValue', textContent.value)
}

const insertFormatting = (prefix: string, suffix = '', defaultText = '') => {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textContent.value.substring(start, end)
  const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${defaultText}${suffix}`

  const newText = textContent.value.substring(0, start) + replacement + textContent.value.substring(end)
  textContent.value = newText
  emit('update:modelValue', newText)

  nextTick(() => {
    textarea.focus()
    const newCursorPos = selected ? start + prefix.length + selected.length + suffix.length : start + prefix.length
    textarea.setSelectionRange(newCursorPos, selected ? newCursorPos : newCursorPos + defaultText.length)
  })
}

const insertLinePrefix = (prefix: string) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textContent.value.substring(0, start)
  const lineStart = before.lastIndexOf('\n') + 1

  const newText = textContent.value.substring(0, lineStart) + prefix + textContent.value.substring(lineStart)
  textContent.value = newText
  emit('update:modelValue', newText)

  nextTick(() => {
    textarea.focus()
    const newPos = end + prefix.length
    textarea.setSelectionRange(newPos, newPos)
  })
}

const insertTable = () => {
  const tableTemplate = '\n| Spalte 1 | Spalte 2 | Spalte 3 |\n| :--- | :--- | :--- |\n| Zeile 1 | Daten | Information |\n| Zeile 2 | Daten | Information |\n'
  insertFormatting('', '', tableTemplate)
}

const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl+S / Cmd+S -> Save
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleSave()
    return
  }

  // Ctrl+B / Cmd+B -> Bold
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    insertFormatting('**', '**', 'Fetter Text')
    return
  }

  // Ctrl+I / Cmd+I -> Italic
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault()
    insertFormatting('*', '*', 'Kursiver Text')
    return
  }

  // Tab key -> Indent with 2 spaces
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (e.shiftKey) {
      // Shift+Tab -> Outdent
      const before = textContent.value.substring(0, start)
      const lineStart = before.lastIndexOf('\n') + 1
      const lineText = textContent.value.substring(lineStart, start)
      if (lineText.startsWith('  ')) {
        const newText = textContent.value.substring(0, lineStart) + textContent.value.substring(lineStart + 2)
        textContent.value = newText
        emit('update:modelValue', newText)
        nextTick(() => {
          textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2))
        })
      }
    } else {
      // Regular Tab -> Insert 2 spaces
      const newText = textContent.value.substring(0, start) + '  ' + textContent.value.substring(end)
      textContent.value = newText
      emit('update:modelValue', newText)
      nextTick(() => {
        textarea.setSelectionRange(start + 2, start + 2)
      })
    }
  }
}

const handleSave = () => {
  if (props.isNew && !docFilename.value.trim()) {
    alert('Bitte geben Sie einen Dateinamen an.')
    return
  }
  emit('save', {
    content: textContent.value,
    filename: props.isNew ? docFilename.value.trim() : undefined
  })
}

const handleCancel = () => {
  if (isDirty.value) {
    if (!confirm('Möchten Sie die Bearbeitung wirklich abbrechen? Ungespeicherte Änderungen gehen verloren.')) {
      return
    }
  }
  emit('cancel')
}

onMounted(() => {
  initialContent.value = props.modelValue
  if (textareaRef.value) {
    textareaRef.value.focus()
  }
})
</script>

<template>
  <div class="markdown-editor-container">
    <!-- Header / Filename Bar -->
    <div class="editor-header">
      <div class="header-left">
        <span class="editor-badge">{{ category === 'docs' ? '📄 Dokument' : '📦 Modul' }}</span>
        <div v-if="isNew" class="filename-input-wrapper">
          <input
            v-model="docFilename"
            type="text"
            placeholder="dateiname (ohne .md)"
            class="filename-input"
            @input="emit('update:filename', docFilename)"
          />
          <span class="filename-suffix">.md</span>
        </div>
        <span v-else class="doc-title">{{ title || filename || 'Markdown Datei' }}</span>
        <span v-if="isDirty" class="dirty-badge" title="Ungespeicherte Änderungen">• Nicht gespeichert</span>
      </div>

      <div class="header-actions">
        <div class="view-mode-buttons">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: viewMode === 'editor' }"
            @click="viewMode = 'editor'"
            title="Nur Editor"
          >
            ✏️ Editor
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: viewMode === 'split' }"
            @click="viewMode = 'split'"
            title="Geteilte Ansicht"
          >
            ⚡ Split
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: viewMode === 'preview' }"
            @click="viewMode = 'preview'"
            title="Nur Vorschau"
          >
            👁️ Vorschau
          </button>
        </div>

        <button type="button" class="btn btn-cancel" @click="handleCancel" :disabled="saving">
          Abbrechen
        </button>
        <button type="button" class="btn btn-save" @click="handleSave" :disabled="saving">
          <span v-if="saving" class="spinner"></span>
          <span v-else>💾</span>
          {{ saving ? 'Speichert...' : 'Speichern' }}
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div v-if="viewMode !== 'preview'" class="editor-toolbar">
      <div class="toolbar-group">
        <button type="button" class="tb-btn" @click="insertLinePrefix('# ')" title="Überschrift 1 (H1)">H1</button>
        <button type="button" class="tb-btn" @click="insertLinePrefix('## ')" title="Überschrift 2 (H2)">H2</button>
        <button type="button" class="tb-btn" @click="insertLinePrefix('### ')" title="Überschrift 3 (H3)">H3</button>
      </div>
      <div class="tb-divider"></div>
      <div class="toolbar-group">
        <button type="button" class="tb-btn" @click="insertFormatting('**', '**', 'Fett')" title="Fett (Ctrl+B)"><b>B</b></button>
        <button type="button" class="tb-btn" @click="insertFormatting('*', '*', 'Kursiv')" title="Kursiv (Ctrl+I)"><i>I</i></button>
        <button type="button" class="tb-btn" @click="insertFormatting('~~', '~~', 'Durchgestrichen')" title="Durchgestrichen"><s>S</s></button>
        <button type="button" class="tb-btn" @click="insertFormatting('`', '`', 'code')" title="Inline Code">`c`</button>
      </div>
      <div class="tb-divider"></div>
      <div class="toolbar-group">
        <button type="button" class="tb-btn" @click="insertLinePrefix('- ')" title="Aufzählungsliste">• Liste</button>
        <button type="button" class="tb-btn" @click="insertLinePrefix('1. ')" title="Nummerierte Liste">1. Liste</button>
        <button type="button" class="tb-btn" @click="insertLinePrefix('- [ ] ')" title="Checkliste">☑ Task</button>
        <button type="button" class="tb-btn" @click="insertLinePrefix('> ')" title="Zitat">❝ Zitat</button>
      </div>
      <div class="tb-divider"></div>
      <div class="toolbar-group">
        <button type="button" class="tb-btn" @click="insertFormatting('[', '](https://)', 'Link-Text')" title="Link einfügen">🔗 Link</button>
        <button type="button" class="tb-btn" @click="insertFormatting('```\n', '\n```', 'Code hier...')" title="Code-Block">📋 Code</button>
        <button type="button" class="tb-btn" @click="insertTable" title="Tabelle einfügen">📊 Tabelle</button>
        <button type="button" class="tb-btn" @click="insertFormatting('\n---\n', '')" title="Trennlinie">― Linie</button>
      </div>
    </div>

    <!-- Main Workspace Area -->
    <div class="editor-workspace" :class="[`mode-${viewMode}`]">
      <!-- Editor Pane -->
      <div v-show="viewMode !== 'preview'" class="editor-pane">
        <textarea
          ref="textareaRef"
          v-model="textContent"
          class="editor-textarea"
          placeholder="Schreiben Sie hier Ihr Markdown..."
          spellcheck="false"
          @input="onInput"
          @keydown="handleKeyDown"
        ></textarea>
      </div>

      <!-- Preview Pane -->
      <div v-show="viewMode !== 'editor'" class="preview-pane" ref="previewRef">
        <div class="preview-header">
          <span class="preview-label">Live-Vorschau</span>
        </div>
        <div class="markdown-body preview-content" v-html="renderedHtml"></div>
      </div>
    </div>

    <!-- Footer Stats Bar -->
    <div class="editor-footer">
      <div class="footer-stats">
        <span>{{ charCount }} Zeichen</span>
        <span>•</span>
        <span>{{ wordCount }} Wörter</span>
        <span>•</span>
        <span>{{ lineCount }} Zeilen</span>
      </div>
      <div class="footer-shortcuts">
        <span><kbd>Ctrl</kbd> + <kbd>S</kbd> Speichern</span>
        <span>•</span>
        <span><kbd>Ctrl</kbd> + <kbd>B</kbd> Fett</span>
        <span>•</span>
        <span><kbd>Tab</kbd> Einrücken</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.markdown-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 520px;
  background: #0f172a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Header */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: #1e293b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-wrap: wrap;
  gap: 0.75rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.editor-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  border: 1px solid rgba(165, 180, 252, 0.25);
  letter-spacing: 0.02em;
}

.doc-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
}

.filename-input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
}

.filename-input-wrapper:focus-within {
  border-color: #818cf8;
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.25);
}

.filename-input {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 0.9rem;
  outline: none;
  width: 180px;
}

.filename-suffix {
  color: #94a3b8;
  font-size: 0.85rem;
}

.dirty-badge {
  font-size: 0.75rem;
  color: #fbbf24;
  font-weight: 600;
  background: rgba(251, 191, 36, 0.12);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.view-mode-buttons {
  display: flex;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.mode-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover {
  color: #ffffff;
}

.mode-btn.active {
  background: #334155;
  color: #ffffff;
  font-weight: 600;
}

.btn {
  padding: 0.45rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: none;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.btn-save {
  background: #4f46e5;
  color: #ffffff;
}

.btn-save:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Toolbar */
.editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.45rem 1rem;
  background: #141c2e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.tb-btn {
  background: transparent;
  border: 1px solid transparent;
  color: #cbd5e1;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tb-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.15);
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 0.3rem;
}

/* Workspace */
.editor-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: #0b1120;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 1.25rem;
  background: transparent;
  border: none;
  outline: none;
  color: #f1f5f9;
  font-family: 'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 0.92rem;
  line-height: 1.65;
  resize: none;
  tab-size: 2;
  overflow-y: auto;
}

.editor-textarea::placeholder {
  color: #475569;
}

.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  background: #ffffff;
  overflow-y: auto;
}

.preview-header {
  padding: 0.45rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.preview-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
}

.preview-content {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.empty-preview {
  color: #94a3b8;
  font-style: italic;
}

.error-preview {
  color: #ef4444;
}

/* Mode layouts */
.mode-editor .editor-pane {
  width: 100%;
}

.mode-preview .preview-pane {
  width: 100%;
  border-left: none;
}

/* Footer */
.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 1.25rem;
  background: #1e293b;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.78rem;
  color: #94a3b8;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.footer-stats, .footer-shortcuts {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

kbd {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.72rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
}

@media (max-width: 768px) {
  .editor-workspace.mode-split {
    flex-direction: column;
  }

  .preview-pane {
    border-left: none;
    border-top: 1px solid #e2e8f0;
  }

  .editor-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: space-between;
  }

  .footer-shortcuts {
    display: none;
  }
}
</style>
