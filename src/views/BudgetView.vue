<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE } from '@/config'
import { getPdfModules, idlePreloadPdf } from '@/utils/pdf'

export interface BudgetItem {
  id?: number
  url: string
  name: string
  price: number
  currency: string
  image: string
  description?: string
  quantity: number
  category: string
  bought: boolean | number
  created_at?: string
}

const items = ref<BudgetItem[]>([])
const inputUrl = ref('')
const isFetchingUrl = ref(false)
const isLoading = ref(false)
const fetchError = ref('')
const searchQuery = ref('')
const filterStatus = ref<'all' | 'planned' | 'bought'>('all')
const viewMode = ref<'grid' | 'table'>('grid')

// Scraped preview modal/state
const showPreviewModal = ref(false)
const previewItem = ref<BudgetItem>({
  url: '',
  name: '',
  price: 0,
  currency: 'CHF',
  image: '',
  description: '',
  quantity: 1,
  category: 'Apfelkiste',
  bought: 0
})

// Manual Add / Edit Modal state
const showEditModal = ref(false)
const isEditing = ref(false)
const currentEditItem = ref<BudgetItem>({
  url: '',
  name: '',
  price: 0,
  currency: 'CHF',
  image: '',
  description: '',
  quantity: 1,
  category: 'Allgemein',
  bought: 0
})

// Delete Modal state
const showDeleteModal = ref(false)
const itemToDelete = ref<BudgetItem | null>(null)

// Image preview modal
const previewImageModalUrl = ref<string | null>(null)

// Computed stats
const totalItemsCount = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
})

const totalPrice = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
})

const totalBoughtPrice = computed(() => {
  return items.value
    .filter(item => Boolean(item.bought))
    .reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
})

const totalPlannedPrice = computed(() => {
  return items.value
    .filter(item => !item.bought)
    .reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
})

const filteredItems = computed(() => {
  return items.value.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.value.toLowerCase()))
    
    if (!matchesSearch) return false

    if (filterStatus.value === 'planned') return !item.bought
    if (filterStatus.value === 'bought') return Boolean(item.bought)
    return true
  })
})

const safeJson = async (res: Response) => {
  try {
    const text = await res.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

const fetchItems = async () => {
  try {
    isLoading.value = true
    const res = await fetch(`${API_BASE}/api/budget`)
    if (res.ok) {
      const data = await safeJson(res)
      if (Array.isArray(data)) {
        items.value = data
        try {
          localStorage.setItem('cached_budget_items', JSON.stringify(data))
        } catch {}
      }
    }
  } catch (error) {
    console.error('Error fetching budget items:', error)
    try {
      const cached = localStorage.getItem('cached_budget_items')
      if (cached) {
        items.value = JSON.parse(cached)
      }
    } catch {}
  } finally {
    isLoading.value = false
  }
}

const handleScrapeUrl = async () => {
  const url = inputUrl.value.trim()
  if (!url) {
    fetchError.value = 'Bitte geben Sie eine gültige URL ein.'
    return
  }

  fetchError.value = ''
  isFetchingUrl.value = true

  try {
    const res = await fetch(`${API_BASE}/api/budget/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })

    const data = await safeJson(res)

    if (!res.ok) {
      throw new Error(data.error || `Fehler beim Abrufen der Produktdaten (${res.status})`)
    }
    previewItem.value = {
      url: data.url || url,
      name: data.name || 'Unbenanntes Produkt',
      price: typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0,
      currency: data.currency || 'CHF',
      image: data.image || '',
      description: data.description || '',
      quantity: 1,
      category: url.includes('apfelkiste.ch') ? 'Apfelkiste' : 'Shop',
      bought: 0
    }

    showPreviewModal.value = true
    inputUrl.value = ''
  } catch (err: any) {
    console.error('Scrape error:', err)
    fetchError.value = err.message || 'Konnte Produktdaten von der URL nicht laden.'
  } finally {
    isFetchingUrl.value = false
  }
}

const savePreviewItem = async () => {
  try {
    isLoading.value = true
    const res = await fetch(`${API_BASE}/api/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewItem.value)
    })

    if (res.ok) {
      await fetchItems()
      showPreviewModal.value = false
    } else {
      const err = await safeJson(res)
      alert(`Fehler beim Speichern: ${err.error || res.statusText}`)
    }
  } catch (error) {
    console.error('Error saving item:', error)
    alert('Netzwerkfehler: Konnte den Server nicht erreichen.')
  } finally {
    isLoading.value = false
  }
}

const openAddModal = () => {
  isEditing.value = false
  currentEditItem.value = {
    url: '',
    name: '',
    price: 0,
    currency: 'CHF',
    image: '',
    description: '',
    quantity: 1,
    category: 'Allgemein',
    bought: 0
  }
  showEditModal.value = true
}

const openEditModal = (item: BudgetItem) => {
  isEditing.value = true
  currentEditItem.value = { ...item }
  showEditModal.value = true
}

const saveItemForm = async () => {
  if (!currentEditItem.value.name.trim()) {
    alert('Bitte geben Sie einen Namen für das Produkt ein.')
    return
  }

  isLoading.value = true
  try {
    if (isEditing.value && currentEditItem.value.id) {
      const res = await fetch(`${API_BASE}/api/budget/${currentEditItem.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentEditItem.value)
      })
      if (res.ok) {
        await fetchItems()
        showEditModal.value = false
      } else {
        const err = await safeJson(res)
        alert(`Fehler: ${err.error || res.statusText}`)
      }
    } else {
      const res = await fetch(`${API_BASE}/api/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentEditItem.value)
      })
      if (res.ok) {
        await fetchItems()
        showEditModal.value = false
      } else {
        const err = await safeJson(res)
        alert(`Fehler: ${err.error || res.statusText}`)
      }
    }
  } catch (error) {
    console.error('Error saving item:', error)
    alert('Netzwerkfehler: Konnte den Server nicht erreichen.')
  } finally {
    isLoading.value = false
  }
}

const toggleBought = async (item: BudgetItem) => {
  if (!item.id) return
  const newStatus = item.bought ? 0 : 1
  try {
    const res = await fetch(`${API_BASE}/api/budget/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bought: newStatus })
    })
    if (res.ok) {
      item.bought = newStatus
    }
  } catch (error) {
    console.error('Error toggling bought status:', error)
  }
}

const updateQuantity = async (item: BudgetItem, delta: number) => {
  if (!item.id) return
  const newQty = Math.max(1, (Number(item.quantity) || 1) + delta)
  if (newQty === item.quantity) return

  try {
    const res = await fetch(`${API_BASE}/api/budget/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty })
    })
    if (res.ok) {
      item.quantity = newQty
    }
  } catch (error) {
    console.error('Error updating quantity:', error)
  }
}

const confirmDelete = (item: BudgetItem) => {
  itemToDelete.value = item
  showDeleteModal.value = true
}

const cancelDelete = () => {
  showDeleteModal.value = false
  itemToDelete.value = null
}

const removeItem = async () => {
  if (!itemToDelete.value?.id) return
  isLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/budget/${itemToDelete.value.id}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      await fetchItems()
      cancelDelete()
    } else {
      const err = await res.json()
      alert(`Fehler beim Löschen: ${err.error || res.statusText}`)
    }
  } catch (error) {
    console.error('Error deleting item:', error)
    alert('Netzwerkfehler: Konnte den Server nicht erreichen.')
  } finally {
    isLoading.value = false
  }
}

const formatCurrency = (val: number, curr = 'CHF') => {
  return `${(Number(val) || 0).toFixed(2)} ${curr}`
}

const isExportingPDF = ref(false)

const exportToPDF = async () => {
  if (isExportingPDF.value) return
  isExportingPDF.value = true
  try {
    const [{ default: jsPDF }, { default: autoTable }] = await getPdfModules()
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Lunaris Budget & Shop Tracker', 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)

    const date = new Date().toLocaleDateString('de-DE')
    doc.text(`Exportiert am: ${date} | Gesamtsumme: ${formatCurrency(totalPrice.value)}`, 14, 30)

    const tableRows = items.value.map(item => [
      item.name,
      item.category || '-',
      `${item.quantity}`,
      formatCurrency(item.price, item.currency),
      formatCurrency(item.price * item.quantity, item.currency),
      item.bought ? 'Gekauft' : 'Geplant'
    ])

    autoTable(doc, {
      startY: 40,
      head: [['Produkt', 'Kategorie', 'Menge', 'Einzelpreis', 'Gesamt', 'Status']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [48, 43, 99], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      margin: { top: 40 }
    })

    doc.save(`lunaris-budget-${date}.pdf`)
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('Fehler beim Erstellen des PDFs.')
  } finally {
    isExportingPDF.value = false
  }
}

onMounted(() => {
  fetchItems()
  idlePreloadPdf()
})
</script>

<template>
  <div class="budget-view">
    <!-- Header -->
    <div class="budget-header">
      <div class="title-row">
        <div>
          <h2 class="budget-title">🛒 Shop & Budget Tracker</h2>
          <p class="budget-description">
            Fügen Sie Produkte via URL von Shops wie <strong>apfelkiste.ch</strong> hinzu, um Preis, Bild und Name automatisch zu erfassen.
          </p>
        </div>
        <div class="header-actions">
          <button class="export-button" @click="exportToPDF" :disabled="items.length === 0">
            Export PDF
          </button>
          <button class="add-button" @click="openAddModal">
            + Manuell hinzufügen
          </button>
        </div>
      </div>

      <!-- URL Scraper Input Box -->
      <div class="scraper-card">
        <label class="scraper-label">🔗 Apfelkiste.ch oder Produkt-URL importieren</label>
        <div class="scraper-input-group">
          <input
            v-model="inputUrl"
            type="url"
            class="scraper-input"
            placeholder="https://www.apfelkiste.ch/..."
            @keyup.enter="handleScrapeUrl"
            :disabled="isFetchingUrl"
          />
          <button
            class="scrape-button"
            :disabled="isFetchingUrl || !inputUrl.trim()"
            @click="handleScrapeUrl"
          >
            <span v-if="isFetchingUrl" class="spinner"></span>
            <span v-else>📥 Produkt laden</span>
          </button>
        </div>
        <p v-if="fetchError" class="scraper-error">{{ fetchError }}</p>
      </div>

      <!-- Stats Overview Dashboard -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">💰</span>
          <div class="stat-info">
            <span class="stat-label">Gesamtsumme</span>
            <span class="stat-value">{{ formatCurrency(totalPrice) }}</span>
          </div>
        </div>
        <div class="stat-card planned">
          <span class="stat-icon">⏳</span>
          <div class="stat-info">
            <span class="stat-label">Noch geplant</span>
            <span class="stat-value">{{ formatCurrency(totalPlannedPrice) }}</span>
          </div>
        </div>
        <div class="stat-card bought">
          <span class="stat-icon">✅</span>
          <div class="stat-info">
            <span class="stat-label">Bereits gekauft</span>
            <span class="stat-value">{{ formatCurrency(totalBoughtPrice) }}</span>
          </div>
        </div>
        <div class="stat-card count">
          <span class="stat-icon">📦</span>
          <div class="stat-info">
            <span class="stat-label">Artikel Gesamt</span>
            <span class="stat-value">{{ totalItemsCount }} Stück ({{ items.length }} Produkte)</span>
          </div>
        </div>
      </div>

      <!-- Filters and Controls -->
      <div class="controls-row">
        <div class="filter-group">
          <button
            class="filter-tab"
            :class="{ active: filterStatus === 'all' }"
            @click="filterStatus = 'all'"
          >
            Alle ({{ items.length }})
          </button>
          <button
            class="filter-tab"
            :class="{ active: filterStatus === 'planned' }"
            @click="filterStatus = 'planned'"
          >
            Geplant ({{ items.filter(i => !i.bought).length }})
          </button>
          <button
            class="filter-tab"
            :class="{ active: filterStatus === 'bought' }"
            @click="filterStatus = 'bought'"
          >
            Gekauft ({{ items.filter(i => Boolean(i.bought)).length }})
          </button>
        </div>

        <div class="search-and-view">
          <input
            v-model="searchQuery"
            type="text"
            class="filter-search-input"
            placeholder="Nach Name oder Kategorie filtern..."
          />
          <div class="view-toggle">
            <button
              class="view-btn"
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
              title="Kachelansicht"
            >
              ⊞
            </button>
            <button
              class="view-btn"
              :class="{ active: viewMode === 'table' }"
              @click="viewMode = 'table'"
              title="Tabellenansicht"
            >
              ☰
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredItems.length === 0" class="empty-state">
      <div class="empty-icon">🛍️</div>
      <h3>Keine Produkte gefunden</h3>
      <p v-if="items.length === 0">
        Fügen Sie oben eine URL von <strong>apfelkiste.ch</strong> ein, um Ihre Wunschliste oder Ihr Budget zu tracken.
      </p>
      <p v-else>Keine Treffer für die aktuellen Filterkriterien.</p>
    </div>

    <!-- Grid View Mode -->
    <div v-else-if="viewMode === 'grid'" class="items-grid">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="product-card"
        :class="{ 'is-bought': item.bought }"
      >
        <div class="card-image-wrap" @click="item.image && (previewImageModalUrl = item.image)">
          <img
            v-if="item.image"
            :src="item.image"
            :alt="item.name"
            class="product-img"
            loading="lazy"
            @error="(e) => (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23a0aec0\' stroke-width=\'1\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg>'"
          />
          <div v-else class="placeholder-img">
            <span>🛍️</span>
          </div>
          <span class="category-badge">{{ item.category || 'Shop' }}</span>
        </div>

        <div class="card-body">
          <div class="product-title-row">
            <a
              v-if="item.url"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="product-title-link"
              :title="item.name"
            >
              {{ item.name }}
              <span class="external-icon">↗</span>
            </a>
            <h4 v-else class="product-title" :title="item.name">{{ item.name }}</h4>
          </div>

          <div class="price-section">
            <div class="price-main">
              <span class="price-tag">{{ formatCurrency(item.price * item.quantity, item.currency) }}</span>
              <span v-if="item.quantity > 1" class="price-unit">
                ({{ item.quantity }} × {{ formatCurrency(item.price, item.currency) }})
              </span>
            </div>
            
            <!-- Quantity Counter -->
            <div class="quantity-controls">
              <button class="qty-btn" @click="updateQuantity(item, -1)" title="Menge verringern">-</button>
              <span class="qty-display">{{ item.quantity }}</span>
              <button class="qty-btn" @click="updateQuantity(item, 1)" title="Menge erhöhen">+</button>
            </div>
          </div>

          <p v-if="item.description" class="product-desc" :title="item.description">
            {{ item.description }}
          </p>

          <div class="card-footer">
            <label class="bought-checkbox-label">
              <input
                type="checkbox"
                :checked="Boolean(item.bought)"
                @change="toggleBought(item)"
              />
              <span class="checkbox-custom"></span>
              <span class="status-text">{{ item.bought ? 'Gekauft' : 'Geplant' }}</span>
            </label>

            <div class="card-actions">
              <button class="edit-btn" title="Bearbeiten" @click="openEditModal(item)">
                ✎
              </button>
              <button class="delete-btn" title="Löschen" @click="confirmDelete(item)">
                🗑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table View Mode -->
    <div v-else class="table-container">
      <table class="budget-table">
        <thead>
          <tr>
            <th style="width: 50px;">Status</th>
            <th style="width: 70px;">Bild</th>
            <th>Produkt</th>
            <th>Kategorie</th>
            <th style="width: 110px;">Menge</th>
            <th>Einzelpreis</th>
            <th>Gesamtpreis</th>
            <th class="actions-column">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredItems"
            :key="item.id"
            :class="{ 'is-bought-row': item.bought }"
          >
            <td class="center-cell">
              <input
                type="checkbox"
                :checked="Boolean(item.bought)"
                @change="toggleBought(item)"
                class="row-checkbox"
              />
            </td>
            <td class="center-cell">
              <img
                v-if="item.image"
                :src="item.image"
                :alt="item.name"
                class="table-thumb"
                @click="previewImageModalUrl = item.image"
              />
              <div v-else class="table-thumb-placeholder">🛍️</div>
            </td>
            <td>
              <div class="table-product-info">
                <a
                  v-if="item.url"
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="table-link"
                >
                  {{ item.name }}
                  <span class="external-icon">↗</span>
                </a>
                <span v-else class="table-name">{{ item.name }}</span>
              </div>
            </td>
            <td>
              <span class="category-pill">{{ item.category || 'Allgemein' }}</span>
            </td>
            <td>
              <div class="quantity-controls table-qty">
                <button class="qty-btn" @click="updateQuantity(item, -1)">-</button>
                <span class="qty-display">{{ item.quantity }}</span>
                <button class="qty-btn" @click="updateQuantity(item, 1)">+</button>
              </div>
            </td>
            <td>{{ formatCurrency(item.price, item.currency) }}</td>
            <td class="table-total-price">
              {{ formatCurrency(item.price * item.quantity, item.currency) }}
            </td>
            <td class="actions-cell">
              <button class="edit-button" title="Bearbeiten" @click="openEditModal(item)">
                ✎
              </button>
              <button class="remove-button" title="Löschen" @click="confirmDelete(item)">
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Scraped Preview & Add Modal -->
    <Transition name="fade">
      <div v-if="showPreviewModal" class="modal-overlay" @click.self="showPreviewModal = false">
        <div class="modal-container preview-modal">
          <div class="modal-header">
            <h3>🎉 Produkt erfolgreich geladen</h3>
            <button class="close-modal" @click="showPreviewModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="preview-layout">
              <div class="preview-image-box">
                <img
                  v-if="previewItem.image"
                  :src="previewItem.image"
                  :alt="previewItem.name"
                  class="preview-img"
                />
                <div v-else class="preview-placeholder">Kein Bild verfügbar</div>
              </div>

              <div class="preview-fields">
                <div class="form-group">
                  <label>Produktname</label>
                  <input v-model="previewItem.name" type="text" />
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>Preis</label>
                    <input v-model.number="previewItem.price" type="number" step="0.05" />
                  </div>
                  <div class="form-group w-80">
                    <label>Währung</label>
                    <input v-model="previewItem.currency" type="text" />
                  </div>
                  <div class="form-group w-80">
                    <label>Menge</label>
                    <input v-model.number="previewItem.quantity" type="number" min="1" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>Kategorie</label>
                    <input v-model="previewItem.category" type="text" />
                  </div>
                </div>

                <div class="form-group">
                  <label>Shop URL</label>
                  <input v-model="previewItem.url" type="text" />
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="showPreviewModal = false">Abbrechen</button>
            <button class="confirm-button" :disabled="isLoading" @click="savePreviewItem">
              {{ isLoading ? 'Speichere...' : 'In Tracker übernehmen' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Manual Add / Edit Modal -->
    <Transition name="fade">
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-container">
          <div class="modal-header">
            <h3>{{ isEditing ? 'Produkt bearbeiten' : 'Neues Produkt hinzufügen' }}</h3>
            <button class="close-modal" @click="showEditModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="add-form">
              <div class="form-group">
                <label>Produktname *</label>
                <input v-model="currentEditItem.name" type="text" placeholder="z.B. iPhone Hülle" />
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label>Preis *</label>
                  <input v-model.number="currentEditItem.price" type="number" step="0.05" />
                </div>
                <div class="form-group w-80">
                  <label>Währung</label>
                  <input v-model="currentEditItem.currency" type="text" placeholder="CHF" />
                </div>
                <div class="form-group w-80">
                  <label>Menge</label>
                  <input v-model.number="currentEditItem.quantity" type="number" min="1" />
                </div>
              </div>

              <div class="form-group">
                <label>Bild URL</label>
                <input v-model="currentEditItem.image" type="text" placeholder="https://..." />
              </div>

              <div class="form-group">
                <label>Shop / Produkt URL</label>
                <input v-model="currentEditItem.url" type="text" placeholder="https://www.apfelkiste.ch/..." />
              </div>

              <div class="form-group">
                <label>Kategorie</label>
                <input v-model="currentEditItem.category" type="text" placeholder="z.B. Kleidung, Zubehör..." />
              </div>

              <div class="form-group">
                <label>Beschreibung / Notizen</label>
                <textarea v-model="currentEditItem.description" placeholder="Optionale Notizen oder Details..."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="showEditModal = false">Abbrechen</button>
            <button class="confirm-button" :disabled="isLoading" @click="saveItemForm">
              {{ isLoading ? 'Speichere...' : 'Speichern' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-container">
          <div class="modal-header">
            <h3>Produkt löschen</h3>
            <button class="close-modal" @click="cancelDelete">×</button>
          </div>
          <div class="modal-body">
            <p>Möchten Sie das Produkt <strong>"{{ itemToDelete?.name }}"</strong> wirklich aus dem Tracker entfernen?</p>
          </div>
          <div class="modal-footer">
            <button class="cancel-button" @click="cancelDelete">Abbrechen</button>
            <button class="confirm-button delete" :disabled="isLoading" @click="removeItem">
              {{ isLoading ? 'Lösche...' : 'Löschen' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Image Zoom Modal -->
    <Transition name="fade">
      <div v-if="previewImageModalUrl" class="modal-overlay" @click.self="previewImageModalUrl = null">
        <div class="image-modal-content">
          <button class="close-modal-img" @click="previewImageModalUrl = null">×</button>
          <img :src="previewImageModalUrl" alt="Produktbild Großansicht" class="full-img" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.budget-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
}

.budget-header {
  margin-bottom: 2rem;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.budget-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 0.4rem 0;
}

.budget-description {
  color: #718096;
  font-size: 0.95rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.add-button {
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(106, 17, 203, 0.2);
}

.add-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(106, 17, 203, 0.3);
}

.export-button {
  background-color: #f7fafc;
  color: #4a5568;
  border: 1px solid #e2e8f0;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-button:hover:not(:disabled) {
  background-color: #edf2f7;
  color: #2d3748;
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Scraper Box */
.scraper-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.scraper-label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  font-size: 0.95rem;
  margin-bottom: 0.6rem;
}

.scraper-input-group {
  display: flex;
  gap: 0.75rem;
}

.scraper-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1.5px solid #cbd5e0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-color: #f8fafc;
}

.scraper-input:focus {
  outline: none;
  border-color: #6a11cb;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(106, 17, 203, 0.15);
}

.scrape-button {
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  color: white;
  border: none;
  padding: 0 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.scrape-button:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.scrape-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scraper-error {
  margin-top: 0.5rem;
  margin-bottom: 0;
  color: #e53e3e;
  font-size: 0.85rem;
  font-weight: 500;
}

/* Spinner */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 2rem;
  background: #f7fafc;
  padding: 0.5rem;
  border-radius: 10px;
  line-height: 1;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.8rem;
  color: #718096;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin-top: 0.2rem;
}

.stat-card.planned .stat-value {
  color: #d97706;
}

.stat-card.bought .stat-value {
  color: #059669;
}

/* Controls */
.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid #edf2f7;
}

.filter-group {
  display: flex;
  gap: 0.5rem;
}

.filter-tab {
  background: transparent;
  border: none;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.85rem;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab.active {
  background: white;
  color: #302b63;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-and-view {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-search-input {
  padding: 0.4rem 0.8rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.85rem;
  min-width: 240px;
}

.view-toggle {
  display: flex;
  background: #edf2f7;
  border-radius: 6px;
  padding: 2px;
}

.view-btn {
  background: transparent;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  color: #718096;
}

.view-btn.active {
  background: white;
  color: #2d3748;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  border: 1px dashed #cbd5e0;
  margin-top: 1.5rem;
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #718096;
  max-width: 480px;
  margin: 0 auto;
}

/* Product Cards Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.product-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.product-card.is-bought {
  border-color: #a7f3d0;
  background: #fcfdfc;
}

.card-image-wrap {
  position: relative;
  width: 100%;
  height: 200px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  border-bottom: 1px solid #edf2f7;
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.card-image-wrap:hover .product-img {
  transform: scale(1.05);
}

.placeholder-img {
  font-size: 3rem;
  opacity: 0.4;
}

.category-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(15, 12, 41, 0.75);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
}

.card-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-title-row {
  margin-bottom: 0.75rem;
}

.product-title,
.product-title-link {
  font-size: 1rem;
  font-weight: 600;
  color: #1a202c;
  text-decoration: none;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.product-title-link:hover {
  color: #6a11cb;
}

.external-icon {
  font-size: 0.8rem;
  color: #718096;
  margin-left: 2px;
}

.price-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #edf2f7;
}

.price-main {
  display: flex;
  flex-direction: column;
}

.price-tag {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2b6cb0;
}

.price-unit {
  font-size: 0.75rem;
  color: #718096;
}

.quantity-controls {
  display: flex;
  align-items: center;
  background: #edf2f7;
  border-radius: 6px;
  padding: 2px;
}

.qty-btn {
  background: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a5568;
  transition: background 0.15s;
}

.qty-btn:hover {
  background: #e2e8f0;
}

.qty-display {
  padding: 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2d3748;
}

.product-desc {
  font-size: 0.82rem;
  color: #718096;
  line-height: 1.4;
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bought-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.85rem;
  font-weight: 500;
  color: #4a5568;
}

.bought-checkbox-label input {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #059669;
}

.card-actions {
  display: flex;
  gap: 0.4rem;
}

.edit-btn,
.delete-btn {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
  color: #4a5568;
}

.edit-btn:hover {
  background: #edf2f7;
  color: #2b6cb0;
}

.delete-btn:hover {
  background: #fed7d7;
  color: #c53030;
  border-color: #feb2b2;
}

/* Table View */
.table-container {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow-x: auto;
  margin-top: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
}

.budget-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.budget-table th {
  background: #f8fafc;
  padding: 0.85rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4a5568;
  text-transform: uppercase;
  border-bottom: 2px solid #edf2f7;
}

.budget-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #edf2f7;
  font-size: 0.9rem;
  color: #2d3748;
  vertical-align: middle;
}

.budget-table tr:hover {
  background: #fcfdfd;
}

.is-bought-row {
  background: #f0fdf4 !important;
}

.center-cell {
  text-align: center;
}

.row-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #059669;
}

.table-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #e2e8f0;
}

.table-thumb-placeholder {
  width: 48px;
  height: 48px;
  background: #edf2f7;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.table-link {
  color: #1a202c;
  font-weight: 600;
  text-decoration: none;
}

.table-link:hover {
  color: #6a11cb;
}

.category-pill {
  display: inline-block;
  background: #edf2f7;
  color: #4a5568;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.table-total-price {
  font-weight: 700;
  color: #2b6cb0;
}

.actions-column {
  text-align: right;
  width: 90px;
}

.actions-cell {
  text-align: right;
  white-space: nowrap;
}

.edit-button,
.remove-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 1rem;
  color: #718096;
  transition: all 0.2s;
}

.edit-button:hover {
  background-color: #edf2f7;
  color: #3182ce;
}

.remove-button:hover {
  background-color: #fed7d7;
  color: #e53e3e;
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.preview-modal {
  max-width: 680px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid #edf2f7;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #1a202c;
}

.close-modal {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #a0aec0;
  line-height: 1;
}

.close-modal:hover {
  color: #4a5568;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #edf2f7;
  background: #f8fafc;
}

.cancel-button {
  background: #edf2f7;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  color: #4a5568;
}

.confirm-button {
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.confirm-button.delete {
  background: #e53e3e;
}

/* Form Styles */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.4rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #6a11cb;
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.flex-1 {
  flex: 1;
}

.w-80 {
  width: 90px;
}

/* Preview Modal Specifics */
.preview-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.preview-image-box {
  width: 180px;
  height: 180px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  color: #a0aec0;
  font-size: 0.8rem;
  text-align: center;
  padding: 0.5rem;
}

.preview-fields {
  flex: 1;
}

/* Image Zoom */
.image-modal-content {
  position: relative;
  max-width: 80vw;
  max-height: 80vh;
}

.full-img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.close-modal-img {
  position: absolute;
  top: -15px;
  right: -15px;
  background: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .budget-view {
    padding: 1rem 0.5rem;
  }

  .title-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .budget-title {
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

  .scraper-input-group {
    flex-direction: column;
    gap: 0.5rem;
  }

  .scrape-button {
    width: 100%;
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .stat-card {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .stat-icon {
    font-size: 1.4rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .stat-label {
    font-size: 0.7rem;
  }

  .controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .filter-group {
    overflow-x: auto;
    width: 100%;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }

  .filter-tab {
    white-space: nowrap;
    font-size: 0.82rem;
    padding: 0.4rem 0.75rem;
  }

  .search-and-view {
    width: 100%;
  }

  .filter-search-input {
    flex: 1;
    font-size: 0.85rem;
  }

  .items-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .budget-table {
    min-width: 600px;
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

  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .w-80 {
    width: 100%;
  }
  
  .preview-layout {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .preview-image-box {
    width: 140px;
    height: 140px;
  }

  .preview-fields {
    width: 100%;
  }
}
</style>
