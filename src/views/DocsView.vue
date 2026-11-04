<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownView from '../components/MarkdownView.vue'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import { API_BASE } from '@/config'
import { useSidebar } from '../composables/useSidebar'

interface DocItem {
  name: string
  path: string
  title?: string
  updatedAt?: string
}

const route = useRoute()
const router = useRouter()
const { onStartEditing, onStopEditing } = useSidebar()

const content = ref<string>('')
const title = ref<string>('Dokumentation')
const currentFilename = ref<string>('')
const availableDocs = ref<DocItem[]>([])
const loading = ref<boolean>(false)
const isEditing = ref<boolean>(false)
const isNewDoc = ref<boolean>(false)
const saving = ref<boolean>(false)
const docSearch = ref<string>('')

// Toast notification state
const toast = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 4000)
}

// LocalStorage keys and helpers
const LOCAL_DOCS_KEY = 'lunaris_custom_docs'

const getLocalDocsMap = (): Record<string, { content: string; title?: string; updatedAt?: string }> => {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const saveDocToLocalStorage = (filename: string, docContent: string) => {
  try {
    const docs = getLocalDocsMap()
    const docTitle = filename.charAt(0).toUpperCase() + filename.slice(1).replace(/_/g, ' ')
    docs[filename] = {
      content: docContent,
      title: docTitle,
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs))
  } catch (err) {
    console.error('Failed to save doc to localStorage:', err)
  }
}

const removeDocFromLocalStorage = (filename: string) => {
  try {
    const docs = getLocalDocsMap()
    if (docs[filename]) {
      delete docs[filename]
      localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs))
    }
  } catch (err) {
    console.error('Failed to remove doc from localStorage:', err)
  }
}

// Fallback import all markdown files statically from assets/docs
const staticDocs = import.meta.glob('../assets/docs/*.md', { as: 'raw', eager: false })

const loadDocsList = async () => {
  const docsMap = new Map<string, DocItem>()

  // 1. Static glob docs
  Object.keys(staticDocs).forEach(key => {
    const name = key.split('/').pop()?.replace('.md', '') || key
    docsMap.set(name, {
      name,
      path: name,
      title: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ')
    })
  })

  // 2. Custom local storage docs
  const localDocs = getLocalDocsMap()
  Object.entries(localDocs).forEach(([name, doc]) => {
    docsMap.set(name, {
      name,
      path: name,
      title: doc.title || (name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ')),
      updatedAt: doc.updatedAt
    })
  })

  // 3. API docs (if available)
  try {
    const res = await fetch(`${API_BASE}/api/markdown/docs`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const name = item.name || item.filename?.replace('.md', '')
          if (name) {
            docsMap.set(name, {
              name,
              path: name,
              title: item.title,
              updatedAt: item.updatedAt
            })
          }
        })
      }
    }
  } catch (err) {
    console.warn('API markdown list fetch failed, falling back to local and static docs:', err)
  }

  availableDocs.value = Array.from(docsMap.values())
}

const filteredDocs = computed(() => {
  if (!docSearch.value.trim()) return availableDocs.value
  const q = docSearch.value.toLowerCase()
  return availableDocs.value.filter(d => 
    d.name.toLowerCase().includes(q) || 
    (d.title && d.title.toLowerCase().includes(q))
  )
})

const loadDoc = async (filename: string) => {
  loading.value = true
  currentFilename.value = filename

  // 1. Try API first
  try {
    const res = await fetch(`${API_BASE}/api/markdown/docs/${filename}`)
    if (res.ok) {
      const data = await res.json()
      content.value = data.content || ''
      title.value = data.title || (filename.charAt(0).toUpperCase() + filename.slice(1).replace(/_/g, ' '))
      loading.value = false
      return
    }
  } catch (err) {
    console.warn('API doc fetch failed, falling back to local and static docs:', err)
  }

  // 2. Check LocalStorage
  const localDocs = getLocalDocsMap()
  if (localDocs[filename]) {
    content.value = localDocs[filename].content
    title.value = localDocs[filename].title || (filename.charAt(0).toUpperCase() + filename.slice(1).replace(/_/g, ' '))
    loading.value = false
    return
  }

  // 3. Fallback to static glob
  const filePath = `../assets/docs/${filename}.md`
  if (staticDocs[filePath]) {
    try {
      const rawContent = await staticDocs[filePath]()
      content.value = rawContent as string
      title.value = filename.charAt(0).toUpperCase() + filename.slice(1).replace(/_/g, ' ')
    } catch (error) {
      console.error('Error loading markdown file statically:', error)
      content.value = '# Fehler\nDas angeforderte Dokument konnte nicht geladen werden.'
      title.value = 'Fehler'
    }
  } else {
    content.value = '# Dokument nicht gefunden\nBitte wählen Sie ein Dokument aus der Liste links aus oder erstellen Sie ein neues.'
    title.value = 'Dokumentation'
  }
  loading.value = false
}

const startEdit = () => {
  isEditing.value = true
  isNewDoc.value = false
  onStartEditing()
}

const startNewDoc = () => {
  isEditing.value = true
  isNewDoc.value = true
  currentFilename.value = ''
  title.value = 'Neues Dokument'
  content.value = `# Neues Dokument\n\nSchreiben Sie hier Ihre Dokumentation...\n\n## Kapitel 1\n\n- Punkt 1\n- Punkt 2\n`
  onStartEditing()
}

const handleCancelEdit = () => {
  isEditing.value = false
  isNewDoc.value = false
  onStopEditing()
  if (route.params.filename) {
    loadDoc(route.params.filename as string)
  } else {
    content.value = ''
    title.value = 'Dokumentation'
  }
}

const handleSave = async (payload: { content: string; filename?: string }) => {
  saving.value = true
  try {
    if (isNewDoc.value) {
      const rawName = (payload.filename || 'neues_dokument').replace(/\.md$/, '').trim()
      const targetFilename = rawName.replace(/[^\p{L}\p{N}_\-\.]/gu, '_').replace(/_+/g, '_').trim() || 'neues_dokument'

      try {
        const res = await fetch(`${API_BASE}/api/markdown/docs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: targetFilename,
            content: payload.content
          })
        })

        if (!res.ok) {
          if (res.status === 409) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error || 'Datei existiert bereits')
          }
          console.warn('API post failed with status:', res.status)
        }
      } catch (apiErr: any) {
        if (apiErr.message === 'Datei existiert bereits') {
          throw apiErr
        }
        console.warn('API save failed, falling back to local storage:', apiErr)
      }

      saveDocToLocalStorage(targetFilename, payload.content)
      showToast(`Dokument "${targetFilename}" erfolgreich erstellt!`, 'success')
      await loadDocsList()
      isEditing.value = false
      isNewDoc.value = false
      onStopEditing()
      router.push(`/docs/${targetFilename}`)
    } else {
      const targetFilename = currentFilename.value

      try {
        const res = await fetch(`${API_BASE}/api/markdown/docs/${targetFilename}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: payload.content
          })
        })

        if (!res.ok) {
          console.warn('API put failed with status:', res.status)
        }
      } catch (apiErr) {
        console.warn('API update failed, saving locally:', apiErr)
      }

      saveDocToLocalStorage(targetFilename, payload.content)
      content.value = payload.content
      showToast(`Dokument "${targetFilename}" erfolgreich gespeichert!`, 'success')
      await loadDocsList()
      isEditing.value = false
      onStopEditing()
    }
  } catch (err: any) {
    console.error('Save failed:', err)
    showToast(err.message || 'Speichern fehlgeschlagen', 'error')
  } finally {
    saving.value = false
  }
}

const handleDeleteDoc = async () => {
  if (!currentFilename.value) return
  if (!confirm(`Möchten Sie das Dokument "${currentFilename.value}" wirklich unwiderruflich löschen?`)) {
    return
  }

  try {
    try {
      const res = await fetch(`${API_BASE}/api/markdown/docs/${currentFilename.value}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        console.warn('Backend delete returned status:', res.status)
      }
    } catch (apiErr) {
      console.warn('Backend delete request failed:', apiErr)
    }

    removeDocFromLocalStorage(currentFilename.value)
    showToast(`Dokument "${currentFilename.value}" gelöscht`, 'info')
    await loadDocsList()
    router.push('/docs')
  } catch (err: any) {
    console.error('Delete failed:', err)
    showToast(err.message || 'Löschen fehlgeschlagen', 'error')
  }
}

onMounted(() => {
  loadDocsList()
  if (route.params.filename) {
    loadDoc(route.params.filename as string)
  }
})

onUnmounted(() => {
  if (isEditing.value) {
    onStopEditing()
  }
})

watch(() => route.params.filename, (newFilename) => {
  if (isEditing.value) {
    isEditing.value = false
    isNewDoc.value = false
    onStopEditing()
  }
  if (newFilename) {
    loadDoc(newFilename as string)
  } else {
    content.value = ''
    title.value = 'Dokumentation'
    currentFilename.value = ''
  }
})
</script>

<template>
  <div class="docs-container" :class="{ 'is-editing-mode': isEditing }">
    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toast" class="toast-notification" :class="toast.type">
        <span class="toast-icon">
          {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️' }}
        </span>
        <span class="toast-text">{{ toast.message }}</span>
      </div>
    </Transition>

    <!-- Docs Internal Sidebar (hidden when editing for maximum workspace) -->
    <aside v-show="!isEditing" class="docs-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-group">
          <span class="sidebar-icon">📄</span>
          <h3 class="sidebar-title">Dokumente</h3>
          <span class="docs-badge">{{ availableDocs.length }}</span>
        </div>
        <button type="button" class="btn-new-doc" @click="startNewDoc" title="Neues Dokument anlegen">
          + Neu
        </button>
      </div>

      <div class="docs-search-bar">
        <input
          v-model="docSearch"
          type="text"
          placeholder="Dokumente filtern..."
          class="docs-search-input"
        />
        <span v-if="docSearch" class="clear-filter" @click="docSearch = ''">✕</span>
      </div>

      <ul class="docs-list">
        <li v-for="doc in filteredDocs" :key="doc.path" class="doc-list-item">
          <router-link
            :to="'/docs/' + doc.path"
            class="doc-link"
            active-class="active"
            :class="{ active: currentFilename === doc.path && !isNewDoc }"
          >
            <span class="doc-icon">📝</span>
            <div class="doc-info">
              <span class="doc-name">{{ doc.title || doc.name }}</span>
              <span class="doc-file-tag">{{ doc.name }}.md</span>
            </div>
          </router-link>
        </li>
      </ul>

      <div v-if="filteredDocs.length === 0" class="empty-docs">
        <p>{{ docSearch ? 'Keine Treffer für den Filter.' : 'Keine Dokumente gefunden.' }}</p>
        <button v-if="!docSearch" type="button" class="btn-create-first" @click="startNewDoc">
          + Erstes Dokument erstellen
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="docs-content" :class="{ 'full-workspace': isEditing }">
      <!-- Editor Mode -->
      <div v-if="isEditing" class="editor-wrapper">
        <MarkdownEditor
          :model-value="content"
          :title="title"
          :filename="currentFilename"
          category="docs"
          :is-new="isNewDoc"
          :saving="saving"
          @save="handleSave"
          @cancel="handleCancelEdit"
        />
      </div>

      <!-- View Mode with Document -->
      <div v-else-if="content && currentFilename" class="doc-view-wrapper">
        <div class="doc-action-bar">
          <div class="doc-meta">
            <span class="doc-badge">Dokument</span>
            <span class="doc-file-path">src/assets/docs/{{ currentFilename }}.md</span>
          </div>

          <div class="doc-buttons">
            <button type="button" class="action-btn btn-edit" @click="startEdit" title="Dokument bearbeiten">
              ✏️ Bearbeiten
            </button>
            <button type="button" class="action-btn btn-delete" @click="handleDeleteDoc" title="Dokument löschen">
              🗑️
            </button>
          </div>
        </div>

        <div v-if="loading" class="loading-indicator">
          <div class="loading-spinner"></div>
          <p>Lade Dokument...</p>
        </div>
        <MarkdownView v-else :markdown="content" :title="title" />
      </div>

      <!-- Welcome / No Document Selected -->
      <div v-else class="no-doc">
        <div class="no-doc-card">
          <div class="welcome-icon">📚</div>
          <h2>Dokumentation & Wissenssammlung</h2>
          <p>Wählen Sie ein Dokument aus der Liste links aus, oder erstellen Sie direkt ein neues Markdown-Dokument.</p>
          <div class="no-doc-actions">
            <button type="button" class="btn-hero-new" @click="startNewDoc">
              ➕ Neues Markdown-Dokument anlegen
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.docs-container {
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
  background-color: #f8fafc;
  overflow: hidden;
}

/* Toast */
.toast-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  z-index: 2000;
  font-weight: 500;
  font-size: 0.9rem;
}

.toast-notification.success {
  background: #065f46;
  color: #ecfdf5;
  border: 1px solid #10b981;
}

.toast-notification.error {
  background: #991b1b;
  color: #fef2f2;
  border: 1px solid #ef4444;
}

.toast-notification.info {
  background: #1e293b;
  color: #f1f5f9;
  border: 1px solid #475569;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* Docs Internal Sidebar */
.docs-sidebar {
  width: 280px;
  min-width: 280px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 1.25rem 1rem;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.sidebar-title-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sidebar-icon {
  font-size: 1.1rem;
}

.sidebar-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.docs-badge {
  font-size: 0.7rem;
  background: #f1f5f9;
  color: #64748b;
  padding: 0.15rem 0.45rem;
  border-radius: 12px;
  font-weight: 600;
}

.btn-new-doc {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-new-doc:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

.docs-search-bar {
  position: relative;
  margin-bottom: 0.85rem;
}

.docs-search-input {
  width: 100%;
  padding: 0.45rem 1.8rem 0.45rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.82rem;
  background: #f8fafc;
  color: #1e293b;
  outline: none;
  transition: all 0.15s;
}

.docs-search-input:focus {
  border-color: #818cf8;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2);
}

.clear-filter {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.75rem;
}

.docs-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.doc-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  color: #334155;
  text-decoration: none;
  transition: all 0.15s;
}

.doc-link:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.doc-link.active {
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #4f46e5;
}

.doc-icon {
  font-size: 1rem;
}

.doc-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doc-name {
  font-size: 0.88rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-file-tag {
  font-size: 0.7rem;
  color: #94a3b8;
}

.empty-docs {
  text-align: center;
  padding: 2rem 0.5rem;
  color: #94a3b8;
  font-size: 0.85rem;
}

.btn-create-first {
  margin-top: 0.75rem;
  background: #4f46e5;
  color: white;
  border: none;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

/* Docs Main Content */
.docs-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: #f8fafc;
}

.docs-content.full-workspace {
  padding: 1rem;
}

.editor-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.doc-view-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.doc-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 2rem;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.doc-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
}

.doc-file-path {
  font-size: 0.8rem;
  color: #64748b;
  font-family: monospace;
}

.doc-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid transparent;
}

.btn-edit {
  background: #4f46e5;
  color: #ffffff;
}

.btn-edit:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

.btn-delete {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
  padding: 0.45rem 0.65rem;
}

.btn-delete:hover {
  background: #fecaca;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #64748b;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* No Doc Screen */
.no-doc {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.no-doc-card {
  text-align: center;
  max-width: 480px;
  background: #ffffff;
  padding: 2.5rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.welcome-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-doc-card h2 {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.no-doc-card p {
  color: #64748b;
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0 0 1.5rem 0;
}

.btn-hero-new {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.btn-hero-new:hover {
  background: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35);
}

@media (max-width: 768px) {
  .docs-container {
    flex-direction: column;
  }

  .docs-sidebar {
    width: 100%;
    min-width: 0;
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem;
  }

  .doc-action-bar {
    padding: 0.75rem 1rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .doc-buttons {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
