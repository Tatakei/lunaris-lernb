<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { API_BASE } from '@/config'
import { getPdfModules, idlePreloadPdf } from '@/utils/pdf'

interface LexikonEntry {
  id?: number
  word: string
  definition: string
  number?: string
  tags?: string
  image?: string
}

const entries = ref<LexikonEntry[]>([])
const searchQuery = ref('')
const selectedModules = ref<string[]>([])
const selectedNoModule = ref(false)
const sortBy = ref<'word-asc' | 'word-desc' | 'number-asc' | 'number-desc'>('word-asc')

const newWord = ref('')
const newDefinition = ref('')
const newNumber = ref('')
const newTags = ref('')
const newImage = ref('')
const showForm = ref(false)
const isLoading = ref(false)

// Delete Confirmation Modal State
const showDeleteModal = ref(false)
const entryToDelete = ref<LexikonEntry | null>(null)

// Edit Modal State
const showEditModal = ref(false)
const entryToEdit = ref<LexikonEntry | null>(null)
const editWord = ref('')
const editDefinition = ref('')
const editNumber = ref('')
const editTags = ref('')
const editImage = ref('')

// Override Confirmation Modal State
const showOverrideModal = ref(false)
const wordToOverride = ref('')

const formatNumber = (num?: string | number | null) => {
  if (!num && num !== 0) return ''
  const str = String(num).trim()
  if (!str) return ''
  const cleaned = str.replace(/^m/i, '').trim()
  return cleaned ? `M${cleaned}` : ''
}

const getModuleDigit = (num?: string | number | null): string => {
  if (!num && num !== 0) return ''
  const str = String(num).trim().replace(/^m/i, '').trim()
  if (!str) return ''
  const firstChar = str.charAt(0)
  if (/\d/.test(firstChar)) {
    return firstChar
  }
  return 'other'
}

const getModuleBadgeClass = (num?: string | number | null): string => {
  const digit = getModuleDigit(num)
  if (digit && digit !== 'other') {
    return `module-badge-${digit}`
  }
  return 'module-badge-default'
}

const getModuleSortKey = (num?: string | number | null): { num: number; suffix: string } | null => {
  if (!num && num !== 0) return null
  const cleaned = String(num).trim().replace(/^m/i, '')
  if (!cleaned) return null
  const match = cleaned.match(/^(\d+)(.*)$/)
  if (match && match[1] !== undefined) {
    return { num: parseInt(match[1], 10), suffix: match[2] || '' }
  }
  return { num: NaN, suffix: cleaned }
}

const availableModules = computed(() => {
  const map = new Map<string, number>()
  let noModuleCount = 0

  for (const entry of entries.value) {
    const formatted = formatNumber(entry.number)
    if (formatted) {
      map.set(formatted, (map.get(formatted) || 0) + 1)
    } else {
      noModuleCount++
    }
  }

  const sorted = Array.from(map.entries()).sort((a, b) => {
    const keyA = getModuleSortKey(a[0])
    const keyB = getModuleSortKey(b[0])
    if (keyA && keyB && !isNaN(keyA.num) && !isNaN(keyB.num)) {
      if (keyA.num !== keyB.num) return keyA.num - keyB.num
      return keyA.suffix.localeCompare(keyB.suffix)
    }
    return a[0].localeCompare(b[0])
  })

  return {
    modules: sorted.map(([module, count]) => ({ module, count })),
    noModuleCount
  }
})

const toggleModuleFilter = (module?: string | number | null) => {
  const formatted = formatNumber(module)
  if (!formatted) {
    selectedNoModule.value = !selectedNoModule.value
    return
  }
  const index = selectedModules.value.indexOf(formatted)
  if (index >= 0) {
    selectedModules.value.splice(index, 1)
  } else {
    selectedModules.value.push(formatted)
  }
}

const selectAllModules = () => {
  selectedModules.value = []
  selectedNoModule.value = false
}

const isModuleSelected = (module: string) => {
  const formatted = formatNumber(module)
  return selectedModules.value.includes(formatted)
}

const isFilterActive = computed(() => {
  return selectedModules.value.length > 0 || selectedNoModule.value || !!searchQuery.value.trim() || sortBy.value !== 'word-asc'
})

const resetAllFilters = () => {
  searchQuery.value = ''
  selectedModules.value = []
  selectedNoModule.value = false
  sortBy.value = 'word-asc'
}

const toggleColumnSort = (column: 'word' | 'number') => {
  if (column === 'word') {
    sortBy.value = sortBy.value === 'word-asc' ? 'word-desc' : 'word-asc'
  } else if (column === 'number') {
    sortBy.value = sortBy.value === 'number-asc' ? 'number-desc' : 'number-asc'
  }
}

const confirmDelete = (entry: LexikonEntry) => {
  entryToDelete.value = entry
  showDeleteModal.value = true
}

const cancelDelete = () => {
  showDeleteModal.value = false
  entryToDelete.value = null
}

const openEditModal = (entry: LexikonEntry) => {
  entryToEdit.value = entry
  editWord.value = entry.word
  editDefinition.value = entry.definition
  editNumber.value = entry.number ? entry.number.replace(/^M/i, '') : ''
  editTags.value = entry.tags || ''
  editImage.value = entry.image || ''
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  entryToEdit.value = null
  editWord.value = ''
  editDefinition.value = ''
  editNumber.value = ''
  editTags.value = ''
  editImage.value = ''
}

const cancelOverride = () => {
  showOverrideModal.value = false
  wordToOverride.value = ''
}

const proceedOverride = async () => {
  const word = wordToOverride.value
  cancelOverride()
  await addWord(true, word)
}

const filteredEntries = computed(() => {
  let result = [...entries.value]

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(entry => 
      entry.word.toLowerCase().includes(query) || 
      entry.definition.toLowerCase().includes(query) ||
      (entry.number && entry.number.toLowerCase().includes(query)) ||
      (entry.tags && entry.tags.toLowerCase().includes(query))
    )
  }

  // Filter by selected modules
  if (selectedModules.value.length > 0 || selectedNoModule.value) {
    result = result.filter(entry => {
      const formatted = formatNumber(entry.number)
      if (formatted) {
        return selectedModules.value.includes(formatted)
      } else {
        return selectedNoModule.value
      }
    })
  }

  // Sort entries
  return result.sort((a, b) => {
    if (sortBy.value === 'word-desc') {
      return b.word.localeCompare(a.word, 'de', { sensitivity: 'base' })
    }
    if (sortBy.value === 'number-asc') {
      const numA = getModuleSortKey(a.number)
      const numB = getModuleSortKey(b.number)
      if (numA === null && numB === null) return a.word.localeCompare(b.word, 'de', { sensitivity: 'base' })
      if (numA === null) return 1
      if (numB === null) return -1
      if (!isNaN(numA.num) && !isNaN(numB.num)) {
        if (numA.num !== numB.num) return numA.num - numB.num
        const suffixCmp = numA.suffix.localeCompare(numB.suffix)
        if (suffixCmp !== 0) return suffixCmp
      }
      return a.word.localeCompare(b.word, 'de', { sensitivity: 'base' })
    }
    if (sortBy.value === 'number-desc') {
      const numA = getModuleSortKey(a.number)
      const numB = getModuleSortKey(b.number)
      if (numA === null && numB === null) return a.word.localeCompare(b.word, 'de', { sensitivity: 'base' })
      if (numA === null) return 1
      if (numB === null) return -1
      if (!isNaN(numA.num) && !isNaN(numB.num)) {
        if (numA.num !== numB.num) return numB.num - numA.num
        const suffixCmp = numB.suffix.localeCompare(numA.suffix)
        if (suffixCmp !== 0) return suffixCmp
      }
      return a.word.localeCompare(b.word, 'de', { sensitivity: 'base' })
    }
    // Default: word-asc
    return a.word.localeCompare(b.word, 'de', { sensitivity: 'base' })
  })
})

const safeJson = async (response: Response) => {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

const removeEntry = async () => {
  if (!entryToDelete.value || entryToDelete.value.id === undefined) return
  
  isLoading.value = true
  try {
    const response = await fetch(`${API_BASE}/api/lexikon/${entryToDelete.value.id}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      await fetchEntries()
      showDeleteModal.value = false
      entryToDelete.value = null
    } else {
      const errorData = await safeJson(response)
      alert(`Fehler beim Löschen: ${errorData.error || response.statusText}`)
    }
  } catch (error) {
    console.error('Error removing entry:', error)
    alert('Netzwerkfehler: Konnte den Server nicht erreichen.')
  } finally {
    isLoading.value = false
  }
}

const handleImageUpload = async (event: Event, target: 'new' | 'edit') => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  const formData = new FormData()
  formData.append('image', file)

  try {
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData
    })
    if (response.ok) {
      const data = await response.json()
      if (target === 'new') {
        newImage.value = data.url
      } else {
        editImage.value = data.url
      }
    } else {
      alert('Fehler beim Hochladen des Bildes.')
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    alert('Netzwerkfehler beim Bild-Upload.')
  }
}

const updateEntry = async () => {
  if (!entryToEdit.value || entryToEdit.value.id === undefined) {
    alert('Fehler: Kein Eintrag zum Bearbeiten ausgewählt.')
    return
  }
  
  if (!editWord.value.trim() || !editDefinition.value.trim()) {
    alert('Bitte füllen Sie beide Felder aus.')
    return
  }
  
  isLoading.value = true
  try {
    const response = await fetch(`${API_BASE}/api/lexikon/${entryToEdit.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: editWord.value.trim(),
        definition: editDefinition.value.trim(),
        number: formatNumber(editNumber.value),
        tags: editTags.value.trim(),
        image: editImage.value
      })
    })

    if (response.status === 409) {
      alert('Dieser Begriff existiert bereits.')
      return
    }

    if (response.ok) {
      await fetchEntries()
      closeEditModal()
    } else {
      const errorData = await safeJson(response)
      alert(`Fehler beim Aktualisieren: ${errorData.error || response.statusText}`)
    }
  } catch (error) {
    console.error('Error updating entry:', error)
    alert('Netzwerkfehler: Konnte den Server nicht erreichen.')
  } finally {
    isLoading.value = false
  }
}

const fetchEntries = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/lexikon`)
    if (response.ok) {
      const data = await safeJson(response)
      if (Array.isArray(data)) {
        entries.value = data
        try {
          localStorage.setItem('cached_lexikon', JSON.stringify(data))
        } catch {}
      }
    }
  } catch (error) {
    console.error('Error fetching lexikon entries:', error)
    try {
      const cached = localStorage.getItem('cached_lexikon')
      if (cached) {
        entries.value = JSON.parse(cached)
      }
    } catch {}
  }
}

const addWord = async (overwrite = false, wordValue?: string) => {
  const word = (wordValue || newWord.value).trim()
  const definition = newDefinition.value.trim()
  const number = formatNumber(newNumber.value)
  const tags = newTags.value.trim()
  const image = newImage.value

  if (!word || !definition) {
    alert('Bitte füllen Sie beide Felder aus.')
    return
  }

  isLoading.value = true
  try {
    const response = await fetch(`${API_BASE}/api/lexikon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: word,
        definition: definition,
        number: number,
        tags: tags,
        image: image,
        overwrite
      })
    })

    if (response.status === 409) {
      wordToOverride.value = word
      showOverrideModal.value = true
      return
    }

    if (response.ok) {
      newWord.value = ''
      newDefinition.value = ''
      newNumber.value = ''
      newTags.value = ''
      newImage.value = ''
      showForm.value = false
      await fetchEntries()
    } else {
      const errorData = await safeJson(response)
      alert(`Fehler beim Speichern: ${errorData.error || response.statusText}`)
    }
  } catch (error) {
    console.error('Error adding word:', error)
    alert('Netzwerkfehler: Konnte den Server nicht erreichen.')
  } finally {
    isLoading.value = false
  }
}

const isExportingPDF = ref(false)
const pdfDesign = ref<'modern' | 'classic' | 'compact'>('modern')

const exportToPDF = async () => {
  if (isExportingPDF.value) return
  isExportingPDF.value = true
  try {
    const [{ default: jsPDF }, { default: autoTable }] = await getPdfModules()
    const doc = new jsPDF()
    
    const date = new Date().toLocaleDateString('de-DE')
    const title = 'Lunaris Lexikon'
    
    // Design-specific settings
    let headStyles: any = { fillColor: [48, 43, 99], textColor: [255, 255, 255] }
    let bodyStyles: any = {}
    let alternateRowStyles: any = { fillColor: [245, 245, 255] }
    let theme: 'striped' | 'grid' | 'plain' = 'striped'
    
    if (pdfDesign.value === 'classic') {
      doc.setFont('times', 'bold')
      theme = 'grid'
      headStyles = { fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1 }
      alternateRowStyles = { fillColor: [255, 255, 255] }
    } else if (pdfDesign.value === 'compact') {
      theme = 'plain'
      headStyles = { fillColor: [100, 100, 100], textColor: [255, 255, 255] }
      alternateRowStyles = { fillColor: [250, 250, 250] }
      bodyStyles = { fontSize: 9, cellPadding: 2 }
    }

    // Add title
    doc.setFontSize(pdfDesign.value === 'compact' ? 14 : 18)
    doc.text(title, 14, 22)
    
    doc.setFontSize(pdfDesign.value === 'compact' ? 9 : 11)
    doc.setTextColor(100)
    
    // Add generation date & filter info
    let subtitle = `Exportiert am: ${date} | Design: ${pdfDesign.value.charAt(0).toUpperCase() + pdfDesign.value.slice(1)}`
    if (selectedModules.value.length > 0 || selectedNoModule.value || searchQuery.value.trim()) {
      subtitle += ` (${filteredEntries.value.length} Einträge, gefiltert)`
    } else {
      subtitle += ` (${filteredEntries.value.length} Einträge)`
    }
    doc.text(subtitle, 14, 30)

    // Prepare data for autoTable
    const tableRows = filteredEntries.value.map(entry => [
      entry.word, 
      entry.number ? formatNumber(entry.number) : '-', 
      entry.definition,
      entry.tags || ''
    ])
    
    autoTable(doc, {
      startY: 40,
      head: [['Begriff', 'Modul', 'Definition', 'Tags']],
      body: tableRows,
      theme: theme,
      headStyles: headStyles,
      bodyStyles: bodyStyles,
      alternateRowStyles: alternateRowStyles,
      margin: { top: 40 },
      styles: {
        overflow: 'linebreak',
        cellWidth: 'auto'
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' }, // Word
        1: { cellWidth: 20 },                   // Module
        2: { cellWidth: 'auto' },               // Definition
        3: { cellWidth: 30 }                    // Tags
      }
    })

    doc.save(`lunaris-lexikon-${pdfDesign.value}-${date}.pdf`)
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('Fehler beim Erstellen des PDFs.')
  } finally {
    isExportingPDF.value = false
  }
}

onMounted(() => {
  fetchEntries()
  idlePreloadPdf()
})
</script>

<template>
  <div class="lexikon-view">
    <div class="lexikon-header">
      <div class="title-row">
        <div class="title-group">
          <h2 class="lexikon-title">Lexikon</h2>
          <p class="lexikon-description">Übersicht aller Fachbegriffe und Definitionen.</p>
        </div>
        <div class="header-actions">
          <div class="pdf-export-group">
            <select v-model="pdfDesign" class="design-select">
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="compact">Compact</option>
            </select>
            <button class="export-button" @click="exportToPDF" :disabled="entries.length === 0">
              <span class="icon">📥</span> Export PDF
            </button>
          </div>
          <button class="add-button" @click="showForm = true">
            <span class="icon">＋</span> Begriff hinzufügen
          </button>
        </div>
      </div>
      
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Suchen nach Begriffen oder Definitionen..."
          class="search-input"
        />
        <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">×</button>
      </div>

      <!-- Filters & Sorting Section -->
      <div class="filters-container">
        <!-- Module Filter Pills -->
        <div class="filter-section">
          <div class="filter-label-row">
            <span class="filter-label">
              <span class="filter-label-icon">🏷️</span> Modul-Auswahl:
            </span>
            <span v-if="selectedModules.length > 0 || selectedNoModule" class="active-filter-hint">
              ({{ selectedModules.length + (selectedNoModule ? 1 : 0) }} ausgewählt)
            </span>
          </div>

          <div class="module-pills-list">
            <button 
              class="module-pill all-pill" 
              :class="{ active: selectedModules.length === 0 && !selectedNoModule }"
              @click="selectAllModules"
            >
              Alle Module
              <span class="pill-count">{{ entries.length }}</span>
            </button>

            <button 
              v-for="item in availableModules.modules" 
              :key="item.module"
              class="module-pill"
              :class="[getModuleBadgeClass(item.module), { active: isModuleSelected(item.module) }]"
              @click="toggleModuleFilter(item.module)"
              :title="`Nur ${item.module} anzeigen / abwählen`"
            >
              <span class="pill-check" v-if="isModuleSelected(item.module)">✓</span>
              {{ item.module }}
              <span class="pill-count">{{ item.count }}</span>
            </button>

            <button 
              v-if="availableModules.noModuleCount > 0"
              class="module-pill no-module-pill"
              :class="{ active: selectedNoModule }"
              @click="selectedNoModule = !selectedNoModule"
              title="Einträge ohne Modulnummer anzeigen / abwählen"
            >
              <span class="pill-check" v-if="selectedNoModule">✓</span>
              Ohne Modul
              <span class="pill-count">{{ availableModules.noModuleCount }}</span>
            </button>
          </div>
        </div>

        <!-- Sort & Summary Control Row -->
        <div class="controls-row">
          <div class="sort-control">
            <label for="sort-select" class="sort-label">Sortierung:</label>
            <div class="select-wrapper">
              <select id="sort-select" v-model="sortBy" class="sort-select">
                <option value="word-asc">Begriff (A → Z)</option>
                <option value="word-desc">Begriff (Z → A)</option>
                <option value="number-asc">Modulnummer (Niedrigste zuerst)</option>
                <option value="number-desc">Modulnummer (Höchste zuerst)</option>
              </select>
            </div>
          </div>

          <div class="filter-actions-right">
            <span class="results-count">
              <strong>{{ filteredEntries.length }}</strong> von {{ entries.length }} {{ entries.length === 1 ? 'Begriff' : 'Begriffen' }}
            </span>
            <button v-if="isFilterActive" class="reset-filters-btn" @click="resetAllFilters" title="Alle Filter zurücksetzen">
              ✕ Filter zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
        <div class="modal-container">
          <div class="modal-header">
            <h3>Neuen Begriff hinzufügen</h3>
            <button class="close-modal" @click="showForm = false">×</button>
          </div>
          <div class="modal-body">
            <div class="add-form">
              <div class="form-group">
                <label for="word">Begriff</label>
                <input id="word" v-model="newWord" type="text" placeholder="z.B. Singularität" />
              </div>
              <div class="form-group">
                <label for="number">Nummer (z.B. 110 für M110)</label>
                <input id="number" v-model="newNumber" type="text" placeholder="z.B. 110, 301 oder M110" />
              </div>
              <div class="form-group">
                <label for="definition">Definition</label>
                <textarea id="definition" v-model="newDefinition" placeholder="Beschreibung des Begriffs..."></textarea>
              </div>
              <div class="form-group">
                <label for="tags">Tags (kommagetrennt)</label>
                <input id="tags" v-model="newTags" type="text" placeholder="z.B. Weltraum, Physik" />
              </div>
              <div class="form-group">
                <label for="new-image">Bild</label>
                <input id="new-image" type="file" accept="image/*" @change="handleImageUpload($event, 'new')" />
                <div v-if="newImage" class="image-preview">
                  <img :src="API_BASE + newImage" alt="Preview" />
                  <button class="remove-image" @click="newImage = ''">Bild entfernen</button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="showForm = false">Abbrechen</button>
            <button class="confirm-button" :disabled="isLoading" @click="addWord(false)">
              {{ isLoading ? 'Speichere...' : 'Speichern' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div class="lexikon-content">
      <div v-if="filteredEntries.length > 0" class="table-container">
        <table>
          <thead>
            <tr>
              <th class="sortable-th" @click="toggleColumnSort('word')" title="Klicken zum Sortieren nach Begriff">
                Begriff
                <span class="sort-indicator">
                  <span v-if="sortBy === 'word-asc'">▲</span>
                  <span v-else-if="sortBy === 'word-desc'">▼</span>
                  <span v-else class="sort-neutral">↕</span>
                </span>
              </th>
              <th class="sortable-th number-th" @click="toggleColumnSort('number')" title="Klicken zum Sortieren nach Modulnummer">
                Nummer
                <span class="sort-indicator">
                  <span v-if="sortBy === 'number-asc'">▲</span>
                  <span v-else-if="sortBy === 'number-desc'">▼</span>
                  <span v-else class="sort-neutral">↕</span>
                </span>
              </th>
              <th>Bild</th>
              <th>Tags</th>
              <th>Definition</th>
              <th class="actions-column">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in filteredEntries" :key="entry.id || entry.word">
              <td class="word-cell">{{ entry.word }}</td>
              <td class="number-cell">
                <span 
                  v-if="entry.number" 
                  class="number-badge clickable-badge"
                  :class="getModuleBadgeClass(entry.number)"
                  @click="toggleModuleFilter(entry.number)"
                  :title="`Klicken, um nach ${formatNumber(entry.number)} zu filtern`"
                >
                  {{ formatNumber(entry.number) }}
                </span>
                <span v-else class="empty-cell-dash">-</span>
              </td>
              <td class="image-cell">
                <div v-if="entry.image" class="entry-image">
                  <img :src="API_BASE + entry.image" :alt="entry.word" @click="window.open(API_BASE + entry.image, '_blank')" />
                </div>
                <span v-else class="empty-cell-dash">-</span>
              </td>
              <td class="tags-cell">
                <div v-if="entry.tags" class="tags-container">
                  <span v-for="tag in entry.tags.split(',')" :key="tag" class="tag-badge">
                    {{ tag.trim() }}
                  </span>
                </div>
                <span v-else class="empty-cell-dash">-</span>
              </td>
              <td class="definition-cell">{{ entry.definition }}</td>
              <td class="actions-cell">
                <button class="edit-button" title="Bearbeiten" @click="openEditModal(entry)">
                  <span class="edit-icon">✎</span>
                </button>
                <button class="remove-button" title="Löschen" @click="confirmDelete(entry)">
                  <span class="remove-icon">×</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">{{ searchQuery || selectedModules.length > 0 || selectedNoModule ? '🔎' : '📚' }}</div>
        <p v-if="isFilterActive">Keine Treffer für die aktuellen Filterkriterien gefunden.</p>
        <p v-else>Noch keine Begriffe im Lexikon vorhanden.</p>
        <button v-if="isFilterActive" class="text-button" @click="resetAllFilters">Filter zurücksetzen</button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-container">
          <div class="modal-header">
            <h3>Eintrag löschen</h3>
            <button class="close-modal" @click="cancelDelete">×</button>
          </div>
          <div class="modal-body">
            <p>Möchten Sie den Begriff <strong>"{{ entryToDelete?.word }}"</strong> wirklich unwiderruflich löschen?</p>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="cancelDelete">Abbrechen</button>
            <button class="confirm-button delete" :disabled="isLoading" @click="removeEntry">
              {{ isLoading ? 'Lösche...' : 'Löschen' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Edit Modal -->
    <Transition name="fade">
      <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3>Begriff bearbeiten</h3>
            <button class="close-modal" @click="closeEditModal">×</button>
          </div>
          <div class="modal-body">
            <div class="add-form">
              <div class="form-group">
                <label for="edit-word">Begriff</label>
                <input id="edit-word" v-model="editWord" type="text" placeholder="z.B. Singularität" />
              </div>
              <div class="form-group">
                <label for="edit-number">Nummer (z.B. 110 für M110)</label>
                <input id="edit-number" v-model="editNumber" type="text" placeholder="z.B. 110, 301 oder M110" />
              </div>
              <div class="form-group">
                <label for="edit-definition">Definition</label>
                <textarea id="edit-definition" v-model="editDefinition" placeholder="Beschreibung des Begriffs..."></textarea>
              </div>
              <div class="form-group">
                <label for="edit-tags">Tags (kommagetrennt)</label>
                <input id="edit-tags" v-model="editTags" type="text" placeholder="z.B. Weltraum, Physik" />
              </div>
              <div class="form-group">
                <label for="edit-image">Bild</label>
                <input id="edit-image" type="file" accept="image/*" @change="handleImageUpload($event, 'edit')" />
                <div v-if="editImage" class="image-preview">
                  <img :src="API_BASE + editImage" alt="Preview" />
                  <button class="remove-image" @click="editImage = ''">Bild entfernen</button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="closeEditModal">Abbrechen</button>
            <button class="confirm-button" :disabled="isLoading" @click="updateEntry">
              {{ isLoading ? 'Speichere...' : 'Speichern' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Override Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showOverrideModal" class="modal-overlay" @click.self="cancelOverride">
        <div class="modal-container">
          <div class="modal-header">
            <h3>Begriff überschreiben</h3>
            <button class="close-modal" @click="cancelOverride">×</button>
          </div>
          <div class="modal-body">
            <p>Der Begriff <strong>"{{ wordToOverride }}"</strong> existiert bereits. Möchten Sie die bestehende Definition überschreiben?</p>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="cancelOverride">Abbrechen</button>
            <button class="confirm-button" :disabled="isLoading" @click="proceedOverride">
              {{ isLoading ? 'Speichere...' : 'Überschreiben' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.image-preview {
  margin-top: 0.5rem;
  position: relative;
  display: inline-block;
}
.image-preview img {
  max-width: 100%;
  max-height: 150px;
  border-radius: 4px;
  border: 1px solid #ddd;
}
.remove-image {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #d32f2f;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.remove-image:hover {
  text-decoration: underline;
}
.image-cell {
  width: 80px;
  text-align: center;
}
.entry-image img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #eee;
  transition: transform 0.2s;
}
.entry-image img:hover {
  transform: scale(1.1);
}
.lexikon-view {
  padding: 2rem;
  max-width: 90%;
  margin: 0 auto;
}

.lexikon-header {
  margin-bottom: 2rem;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  padding: 0 1rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.search-bar:focus-within {
  border-color: #433af2;
  box-shadow: 0 4px 12px rgba(67, 58, 242, 0.1);
}

.search-icon {
  margin-right: 0.75rem;
  font-size: 1rem;
  color: #9ca3af;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.75rem 0;
  font-size: 0.95rem;
  color: #1f2937;
  outline: none;
}

.clear-search {
  background: #f3f4f6;
  border: none;
  color: #6b7280;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

.clear-search:hover {
  background: #e5e7eb;
  color: #1f2937;
}

/* Filters & Sorting styling */
.filters-container {
  margin-top: 1.25rem;
  background: #ffffff;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.filter-label-icon {
  font-size: 0.95rem;
}

.active-filter-hint {
  font-size: 0.8rem;
  color: #433af2;
  font-weight: 600;
}

.module-pills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.module-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: #f3f4f6;
  color: #4b5563;
  user-select: none;
}

.module-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.module-pill .pill-count {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  opacity: 0.9;
}

.module-pill .pill-check {
  font-size: 0.8rem;
  font-weight: 800;
}

/* All pill active */
.all-pill.active {
  background: #1e293b;
  color: #ffffff;
  border-color: #1e293b;
  box-shadow: 0 2px 6px rgba(30, 41, 59, 0.25);
}

.all-pill.active .pill-count {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* When a module pill is selected/active */
.module-pill.active:not(.all-pill) {
  box-shadow: 0 0 0 2px currentColor;
  font-weight: 700;
  transform: translateY(-1px);
}

.module-pill.active:not(.all-pill) .pill-count {
  background: rgba(0, 0, 0, 0.12);
}

/* No module pill */
.no-module-pill {
  background: #f1f5f9;
  color: #64748b;
  border-color: #e2e8f0;
}

.no-module-pill.active {
  background: #64748b;
  color: #ffffff;
  border-color: #64748b;
  box-shadow: 0 2px 6px rgba(100, 116, 139, 0.25);
}

.no-module-pill.active .pill-count {
  background: rgba(255, 255, 255, 0.2);
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
}

.select-wrapper {
  position: relative;
}

.sort-select {
  appearance: none;
  background: #f9fafb url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 0.75rem center/0.85rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.45rem 2.25rem 0.45rem 0.75rem;
  font-size: 0.88rem;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.sort-select:focus {
  border-color: #433af2;
  box-shadow: 0 0 0 2px rgba(67, 58, 242, 0.15);
}

.filter-actions-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.results-count {
  font-size: 0.85rem;
  color: #6b7280;
}

.reset-filters-btn {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-filters-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.sortable-th {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.sortable-th:hover {
  color: #433af2;
  background-color: #f3f4f6;
}

.sort-indicator {
  display: inline-block;
  margin-left: 0.35rem;
  font-size: 0.75rem;
  color: #433af2;
}

.sort-neutral {
  color: #9ca3af;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.pdf-export-group {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #302b63;
  border-radius: 8px;
  overflow: hidden;
}

.design-select {
  border: none;
  padding: 0 0.5rem;
  font-size: 0.85rem;
  color: #4a5568;
  background: #f8fafc;
  cursor: pointer;
  outline: none;
  border-right: 1px solid #302b63;
  height: 40px;
}

.design-select:hover {
  background: #f1f5f9;
}

.export-button {
  background: white;
  color: #302b63;
  border: none;
  padding: 0 1rem;
  border-radius: 0;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 40px;
}

.export-button:hover:not(:disabled) {
  background: #f3f4f6;
  transform: translateY(-1px);
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lexikon-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #433af2 0%, #fcb9f8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.add-button {
  background: linear-gradient(135deg, #433af2 0%, #302b63 100%);
  border: none;
  color: #ffffff;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 6px rgba(67, 58, 242, 0.2);
}

.add-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(67, 58, 242, 0.3);
  opacity: 0.95;
}

.icon {
  font-size: 1rem;
}

.lexikon-description {
  color: #4b5563;
  margin: 0;
  font-size: 0.95rem;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: #1a1a1a;
  font-size: 0.9rem;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  background: #fcfcfc;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 0.75rem;
  color: #1a1a1a;
  font-family: inherit;
}

.form-group textarea {
  min-height: 100px;
  resize: vertical;
}

.lexikon-content {
  margin-top: 1.5rem;
}

.table-container {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* Table styling mirroring MarkdownView.vue */
table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
}

thead tr {
  background: #f9fafb;
}

th {
  color: #4b5563;
  font-weight: 600;
  text-align: left;
  padding: 1rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

td {
  padding: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  color: #374151;
  line-height: 1.5;
  vertical-align: top;
}

.word-cell {
  font-weight: 700;
  color: #111827;
  width: 22%;
}

.number-cell {
  width: 14%;
  white-space: nowrap;
}

.number-badge {
  display: inline-flex;
  align-items: center;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  letter-spacing: 0.04em;
  transition: all 0.2s ease;
  user-select: none;
}

.clickable-badge {
  cursor: pointer;
}

.clickable-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

/* Module color badges based on starting digit */
/* 0: Teal / Cyan */
.module-badge-0 {
  background: rgba(13, 148, 136, 0.12);
  color: #0f766e;
  border: 1px solid rgba(13, 148, 136, 0.3);
}

/* 1: Indigo / Blue */
.module-badge-1 {
  background: rgba(67, 58, 242, 0.12);
  color: #433af2;
  border: 1px solid rgba(67, 58, 242, 0.3);
}

/* 2: Violet / Purple */
.module-badge-2 {
  background: rgba(147, 51, 234, 0.12);
  color: #9333ea;
  border: 1px solid rgba(147, 51, 234, 0.3);
}

/* 3: Amber / Orange */
.module-badge-3 {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
  border: 1px solid rgba(217, 119, 6, 0.3);
}

/* 4: Emerald / Green */
.module-badge-4 {
  background: rgba(5, 150, 105, 0.12);
  color: #047857;
  border: 1px solid rgba(5, 150, 105, 0.3);
}

/* 5: Rose / Pink */
.module-badge-5 {
  background: rgba(225, 29, 72, 0.12);
  color: #be123c;
  border: 1px solid rgba(225, 29, 72, 0.3);
}

/* 6: Sky Blue */
.module-badge-6 {
  background: rgba(2, 132, 199, 0.12);
  color: #0369a1;
  border: 1px solid rgba(2, 132, 199, 0.3);
}

/* 7: Lime */
.module-badge-7 {
  background: rgba(101, 163, 13, 0.12);
  color: #4d7c0f;
  border: 1px solid rgba(101, 163, 13, 0.3);
}

/* 8: Fuchsia / Magenta */
.module-badge-8 {
  background: rgba(192, 38, 211, 0.12);
  color: #a21caf;
  border: 1px solid rgba(192, 38, 211, 0.3);
}

/* 9: Red */
.module-badge-9 {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

/* Default / Other */
.module-badge-default {
  background: rgba(100, 116, 139, 0.12);
  color: #475569;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.empty-cell-dash {
  color: #9ca3af;
  font-size: 0.95rem;
}

.tags-cell {
  width: 15%;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tag-badge {
  background: #f3f4f6;
  color: #4b5563;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.definition-cell {
  width: 40%;
}

tr:hover td {
  background: #fcfcfd;
}

.actions-column {
  width: 14%;
  text-align: center;
}

.actions-cell {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.edit-button {
  background: rgba(67, 58, 242, 0.1);
  border: 1px solid rgba(67, 58, 242, 0.2);
  color: #433af2;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.edit-button:hover {
  background: #433af2;
  color: #ffffff;
  border-color: #433af2;
}

.edit-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.remove-button {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0 auto;
}

.remove-button:hover {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.remove-icon {
  font-size: 1.2rem;
  line-height: 1;
  margin-top: -2px;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: #ffffff;
  border-radius: 12px;
  border: 2px dashed #e5e7eb;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  color: #6b7280;
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}

.text-button {
  background: none;
  border: none;
  color: #433af2;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

/* Modal Styling */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: #ffffff;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  animation: modal-in 0.3s ease-out;
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #111827;
  font-weight: 700;
}

.close-modal {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #9ca3af;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-modal:hover {
  color: #4b5563;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0;
  color: #4b5563;
  line-height: 1.5;
}

.modal-footer {
  padding: 1rem 1.5rem;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-button {
  background: #ffffff;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button:hover {
  background: #f3f4f6;
}

.confirm-button {
  background: linear-gradient(135deg, #433af2 0%, #fcb9f8 100%);
  border: none;
  color: #ffffff;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-button:hover {
  opacity: 0.9;
}

.confirm-button.delete {
  background: #ef4444;
}

.confirm-button.delete:hover {
  background: #dc2626;
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .lexikon-view {
    padding: 1rem 0.5rem;
  }

  .title-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .lexikon-title {
    font-size: 1.4rem;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .export-button,
  .add-button {
    flex: 1;
    text-align: center;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .filters-container {
    padding: 1rem;
  }

  .controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .sort-control {
    justify-content: space-between;
  }

  .filter-actions-right {
    justify-content: space-between;
  }

  .lexikon-content {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
    margin-top: 0.75rem;
  }

  table {
    min-width: 480px;
    margin: 0.5rem 0;
  }

  th, td {
    padding: 0.5rem 0.75rem;
    font-size: 0.88rem;
  }

  .modal-container {
    width: 95%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-body {
    overflow-y: auto;
    padding: 1rem;
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-footer {
    padding: 0.75rem 1rem;
  }
}
</style>
