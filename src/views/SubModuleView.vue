<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import MarkdownView from '../components/MarkdownView.vue'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import { API_BASE } from '@/config'
import { useSidebar } from '../composables/useSidebar'

const route = useRoute()
const router = useRouter()
const { onStartEditing, onStopEditing } = useSidebar()

const subId = ref(route.params.subId as string)
const parentModuleId = ref(route.params.id as string)
const content = ref('')
const error = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const loading = ref(false)

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

// LocalStorage helpers for modules
const LOCAL_MODULES_KEY = 'lunaris_custom_modules'

const getLocalModulesMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(LOCAL_MODULES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const saveModuleToLocalStorage = (id: string, moduleContent: string) => {
  try {
    const modules = getLocalModulesMap()
    modules[id] = moduleContent
    localStorage.setItem(LOCAL_MODULES_KEY, JSON.stringify(modules))
  } catch (err) {
    console.error('Failed to save module to localStorage:', err)
  }
}

const loadMarkdown = async (id: string) => {
  loading.value = true
  error.value = false

  // 1. Try fetching from backend API
  try {
    const res = await fetch(`${API_BASE}/api/markdown/modules/${id}`)
    if (res.ok) {
      const data = await res.json()
      content.value = data.content || ''
      loading.value = false
      return
    }
  } catch (err) {
    console.warn(`API module fetch for ${id} failed, attempting local/static fallback:`, err)
  }

  // 2. Check LocalStorage
  const localModules = getLocalModulesMap()
  if (localModules[id]) {
    content.value = localModules[id]
    error.value = false
    loading.value = false
    return
  }

  // 3. Fallback to Vite dynamic asset import
  try {
    const module = await import(`../assets/modules/${id}.md?raw`)
    content.value = module.default
    error.value = false
  } catch (err) {
    console.warn(`Static asset for module ${id} not found:`, err)
    error.value = true
    content.value = ''
  } finally {
    loading.value = false
  }
}

const startEdit = () => {
  if (!content.value && error.value) {
    // Provide a default template for a brand new module
    content.value = `# Modul ${subId.value}\n\nWillkommen bei Modul **${subId.value}**.\n\n## Lernziele\n\n- Ziel 1\n- Ziel 2\n\n## Inhalt\n\nHier den Lerninhalt für dieses Modul einfügen...\n`
  }
  isEditing.value = true
  onStartEditing()
}

const handleCancelEdit = () => {
  isEditing.value = false
  onStopEditing()
  loadMarkdown(subId.value)
}

const handleSave = async (payload: { content: string }) => {
  saving.value = true
  try {
    try {
      const res = await fetch(`${API_BASE}/api/markdown/modules/${subId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: payload.content
        })
      })

      if (!res.ok) {
        // If PUT fails because it didn't exist, try POST
        await fetch(`${API_BASE}/api/markdown/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: subId.value,
            content: payload.content,
            overwrite: true
          })
        })
      }
    } catch (apiErr) {
      console.warn('Backend module save request failed, saving locally:', apiErr)
    }

    saveModuleToLocalStorage(subId.value, payload.content)
    content.value = payload.content
    error.value = false
    isEditing.value = false
    onStopEditing()
    showToast(`Modul ${subId.value} erfolgreich gespeichert!`, 'success')
  } catch (err: any) {
    console.error('Save module failed:', err)
    showToast(err.message || 'Speichern fehlgeschlagen', 'error')
  } finally {
    saving.value = false
  }
}

const goBackToOverview = () => {
  if (parentModuleId.value) {
    router.push(`/module/${parentModuleId.value}`)
  } else {
    router.push('/')
  }
}

onMounted(() => {
  loadMarkdown(subId.value)
})

onUnmounted(() => {
  if (isEditing.value) {
    onStopEditing()
  }
})

watch(() => route.params.subId, (newId) => {
  if (isEditing.value) {
    isEditing.value = false
    onStopEditing()
  }
  if (newId) {
    subId.value = newId as string
    parentModuleId.value = route.params.id as string
    loadMarkdown(subId.value)
  }
})
</script>

<template>
  <div class="sub-module-view" :class="{ 'is-editing': isEditing }">
    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toast" class="toast-notification" :class="toast.type">
        <span class="toast-icon">
          {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️' }}
        </span>
        <span class="toast-text">{{ toast.message }}</span>
      </div>
    </Transition>

    <!-- Editor Mode -->
    <div v-if="isEditing" class="module-editor-wrapper">
      <MarkdownEditor
        :model-value="content"
        :title="`Modul ${subId}`"
        :filename="`${subId}.md`"
        category="modules"
        :saving="saving"
        @save="handleSave"
        @cancel="handleCancelEdit"
      />
    </div>

    <!-- View Mode -->
    <div v-else class="module-content-wrapper">
      <!-- Action Bar -->
      <div class="module-action-bar">
        <div class="module-meta">
          <button type="button" class="btn-back" @click="goBackToOverview" title="Zurück zur Modulübersicht">
            ← Zurück
          </button>
          <span class="module-badge">Modul {{ subId }}</span>
          <span class="module-file-path">src/assets/modules/{{ subId }}.md</span>
        </div>

        <div class="module-buttons">
          <button type="button" class="btn-edit" @click="startEdit" title="Modul im Browser bearbeiten">
            ✏️ Modul bearbeiten
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Lade Modul {{ subId }}...</p>
      </div>

      <!-- Content Rendered -->
      <div v-else-if="content && !error" class="rendered-module">
        <MarkdownView :markdown="content" :title="`Modul ${subId}`" />
      </div>

      <!-- Not Found / Error State -->
      <div v-else class="empty-module-card">
        <span class="empty-icon">📄</span>
        <h3>Modul {{ subId }} existiert noch nicht</h3>
        <p>Für dieses Modul wurde noch keine Markdown-Datei angelegt. Sie können den Inhalt jetzt direkt im Browser verfassen.</p>
        <button type="button" class="btn-create-module" @click="startEdit">
          ➕ Modul {{ subId }} jetzt erstellen
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sub-module-view {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.sub-module-view.is-editing {
  padding: 1rem;
}

.sub-module-view:not(.is-editing) {
  padding: 1.5rem 2rem;
  max-width: 960px;
  margin: 0 auto;
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

.module-editor-wrapper {
  height: calc(100vh - 90px);
  display: flex;
  flex-direction: column;
}

/* Action Bar */
.module-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.module-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-back {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-back:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.module-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.module-file-path {
  font-size: 0.8rem;
  color: #64748b;
  font-family: monospace;
}

.btn-edit {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-edit:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

/* Loading & Empty State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
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

.empty-module-card {
  text-align: center;
  max-width: 520px;
  margin: 3rem auto;
  background: #ffffff;
  padding: 2.5rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.empty-module-card h3 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.empty-module-card p {
  color: #64748b;
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0 0 1.5rem 0;
}

.btn-create-module {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  padding: 0.65rem 1.4rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.btn-create-module:hover {
  background: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35);
}

@media (max-width: 768px) {
  .sub-module-view:not(.is-editing) {
    padding: 1rem 0.75rem;
  }

  .module-action-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .module-buttons {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
