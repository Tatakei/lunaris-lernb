<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { API_BASE } from '@/config'

export interface DTRNote {
  id?: number
  title: string
  points: number | null
  max_points: number | null
  grade: number
  weight: number
  date: string
  comment?: string
  created_at?: string
}

const notes = ref<DTRNote[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const searchQuery = ref('')
const sortBy = ref<'date-desc' | 'date-asc' | 'grade-desc' | 'grade-asc' | 'title-asc'>('date-desc')

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)

// Delete Modal state
const showDeleteModal = ref(false)
const noteToDelete = ref<DTRNote | null>(null)

const getTodayString = () => new Date().toISOString().split('T')[0] || ''

// Form state
const formTitle = ref('')
const formPoints = ref<string | number>('')
const formMaxPoints = ref<string | number>('')
const formWeight = ref<number>(1.0)
const formDate = ref<string>(getTodayString())
const formComment = ref('')
const formManualGrade = ref<string | number>('')

// Helper for Swiss grade calculation: Note = (Punkte / MaxPunkte) * 5 + 1
const calculateSwissGrade = (pts: number | null, max: number | null): number | null => {
  if (pts === null || max === null || isNaN(pts) || isNaN(max) || max <= 0) {
    return null
  }
  const calc = (pts / max) * 5 + 1
  const clamped = Math.max(1, Math.min(6, calc))
  return Math.round(clamped * 100) / 100
}

// Live calculated grade for the form
const liveCalculatedGrade = computed<number | null>(() => {
  const p = formPoints.value !== '' ? Number(formPoints.value) : null
  const m = formMaxPoints.value !== '' ? Number(formMaxPoints.value) : null
  if (p !== null && m !== null && m > 0) {
    return calculateSwissGrade(p, m)
  }
  if (formManualGrade.value !== '') {
    const mg = Number(formManualGrade.value)
    if (!isNaN(mg) && mg >= 1 && mg <= 6) {
      return Math.round(mg * 100) / 100
    }
  }
  return null
})

// Grade classification
const getGradeCategory = (grade: number) => {
  if (grade >= 5.5) return { label: 'Sehr gut', class: 'grade-excel' }
  if (grade >= 5.0) return { label: 'Gut', class: 'grade-good' }
  if (grade >= 4.0) return { label: 'Genügend', class: 'grade-pass' }
  if (grade >= 3.0) return { label: 'Ungenügend', class: 'grade-fail' }
  return { label: 'Schwach', class: 'grade-poor' }
}

// Fetch Notes
const fetchNotes = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    const res = await fetch(`${API_BASE}/api/dtr/notes`)
    if (!res.ok) {
      throw new Error(`Fehler beim Laden (${res.status})`)
    }
    const data = await res.json()
    if (Array.isArray(data)) {
      notes.value = data
    }
  } catch (err: any) {
    console.error('Error fetching DTR notes:', err)
    errorMessage.value = err.message || 'Verbindung zum Server fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
}

// Notification flash
const notifySuccess = (msg: string) => {
  successMessage.value = msg
  setTimeout(() => {
    if (successMessage.value === msg) {
      successMessage.value = ''
    }
  }, 4000)
}

// Statistics
const totalNotesCount = computed(() => notes.value.length)

const averageGrade = computed<number | null>(() => {
  if (notes.value.length === 0) return null
  let sumWeightGrade = 0
  let sumWeight = 0
  for (const n of notes.value) {
    const w = Number(n.weight) > 0 ? Number(n.weight) : 1
    sumWeightGrade += Number(n.grade) * w
    sumWeight += w
  }
  if (sumWeight === 0) return null
  return Math.round((sumWeightGrade / sumWeight) * 100) / 100
})

const roundedAverageHalf = computed<number | null>(() => {
  if (averageGrade.value === null) return null
  return Math.round(averageGrade.value * 2) / 2
})

const bestGrade = computed<number | null>(() => {
  if (notes.value.length === 0) return null
  return Math.max(...notes.value.map(n => Number(n.grade)))
})

const passingStatus = computed(() => {
  if (averageGrade.value === null) return null
  return averageGrade.value >= 4.0
})

const pointsStats = computed(() => {
  let earned = 0
  let max = 0
  let countWithPoints = 0
  for (const n of notes.value) {
    if (n.points !== null && n.max_points !== null && n.max_points > 0) {
      earned += Number(n.points)
      max += Number(n.max_points)
      countWithPoints++
    }
  }
  const percentage = max > 0 ? Math.round((earned / max) * 1000) / 10 : 0
  return { earned, max, percentage, countWithPoints }
})

// Filtered and sorted notes
const filteredNotes = computed(() => {
  let list = [...notes.value]
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(n =>
      n.title.toLowerCase().includes(q) ||
      (n.comment && n.comment.toLowerCase().includes(q)) ||
      String(n.grade).includes(q)
    )
  }

  list.sort((a, b) => {
    switch (sortBy.value) {
      case 'date-desc':
        return (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0)
      case 'date-asc':
        return (a.date || '').localeCompare(b.date || '') || (a.id || 0) - (b.id || 0)
      case 'grade-desc':
        return Number(b.grade) - Number(a.grade)
      case 'grade-asc':
        return Number(a.grade) - Number(b.grade)
      case 'title-asc':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  return list
})

// Form Actions
const openAddModal = () => {
  isEditing.value = false
  editingId.value = null
  formTitle.value = ''
  formPoints.value = ''
  formMaxPoints.value = ''
  formWeight.value = 1.0
  formDate.value = getTodayString()
  formComment.value = ''
  formManualGrade.value = ''
  errorMessage.value = ''
  showModal.value = true
}

const openEditModal = (note: DTRNote) => {
  isEditing.value = true
  editingId.value = note.id || null
  formTitle.value = note.title
  formPoints.value = note.points !== null ? note.points : ''
  formMaxPoints.value = note.max_points !== null ? note.max_points : ''
  formWeight.value = Number(note.weight) || 1.0
  formDate.value = note.date || getTodayString()
  formComment.value = note.comment || ''
  formManualGrade.value = note.grade
  errorMessage.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingId.value = null
}

const saveNote = async () => {
  if (!formTitle.value.trim()) {
    alert('Bitte gib einen Titel oder eine Prüfungsbezeichnung ein.')
    return
  }

  const finalGrade = liveCalculatedGrade.value
  if (finalGrade === null || isNaN(finalGrade)) {
    alert('Bitte gib gültige Punkte und Maximalpunkte (oder eine Note) ein.')
    return
  }

  const payload = {
    title: formTitle.value.trim(),
    points: formPoints.value !== '' ? Number(formPoints.value) : null,
    max_points: formMaxPoints.value !== '' ? Number(formMaxPoints.value) : null,
    grade: finalGrade,
    weight: Number(formWeight.value) > 0 ? Number(formWeight.value) : 1.0,
    date: formDate.value || getTodayString(),
    comment: formComment.value.trim()
  }

  try {
    isLoading.value = true
    const url = isEditing.value && editingId.value
      ? `${API_BASE}/api/dtr/notes/${editingId.value}`
      : `${API_BASE}/api/dtr/notes`
    const method = isEditing.value ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Fehler beim Speichern (${res.status})`)
    }

    closeModal()
    await fetchNotes()
    notifySuccess(isEditing.value ? 'Note erfolgreich aktualisiert' : 'Note erfolgreich erfasst')
  } catch (err: any) {
    console.error('Error saving note:', err)
    alert(err.message || 'Fehler beim Speichern der Note')
  } finally {
    isLoading.value = false
  }
}

// Delete actions
const confirmDelete = (note: DTRNote) => {
  noteToDelete.value = note
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  noteToDelete.value = null
  showDeleteModal.value = false
}

const deleteNote = async () => {
  if (!noteToDelete.value?.id) return
  try {
    isLoading.value = true
    const res = await fetch(`${API_BASE}/api/dtr/notes/${noteToDelete.value.id}`, {
      method: 'DELETE'
    })
    if (!res.ok) {
      throw new Error(`Fehler beim Löschen (${res.status})`)
    }
    closeDeleteModal()
    await fetchNotes()
    notifySuccess('Note wurde gelöscht')
  } catch (err: any) {
    console.error('Error deleting note:', err)
    alert(err.message || 'Fehler beim Löschen')
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchNotes)
</script>

<template>
  <div class="dtr-view">
    <!-- Header -->
    <div class="dtr-header">
      <div class="header-titles">
        <div class="badge-row">
          <span class="view-badge">Lernbereich</span>
          <span class="calc-badge">Schweizer Notenskala 1.0 – 6.0</span>
        </div>
        <h1>DTR Notenverwaltung</h1>
        <p class="subtitle">
          Noten erfassen und automatisch nach Schweizer Notenberechnung kalkulieren.
        </p>
      </div>
      <div class="header-actions">
        <button class="primary-btn" @click="openAddModal">
          <span class="btn-icon">➕</span>
          <span>Neue Note erfassen</span>
        </button>
      </div>
    </div>

    <!-- Formula Information Card -->
    <div class="formula-banner">
      <div class="formula-icon">📐</div>
      <div class="formula-content">
        <div class="formula-title">Offizielle Schweizer Notenformel:</div>
        <div class="formula-math">
          <strong>Note = (Erreichte Punkte / Maximalpunkte) × 5 + 1</strong>
        </div>
        <div class="formula-desc">
          Ab 60 % der Punkte wird die Note 4.0 (Genügend) erreicht. Maximale Note: 6.0, minimale Note: 1.0.
        </div>
      </div>
    </div>

    <!-- Success Message Banner -->
    <Transition name="fade">
      <div v-if="successMessage" class="alert success-alert">
        <span>✅ {{ successMessage }}</span>
      </div>
    </Transition>

    <!-- Error Message Banner -->
    <div v-if="errorMessage" class="alert error-alert">
      <span>⚠️ {{ errorMessage }}</span>
      <button class="retry-btn" @click="fetchNotes">Erneut versuchen</button>
    </div>

    <!-- Statistics KPI Cards -->
    <div class="stats-grid">
      <div class="stat-card" :class="{ 'pass-border': passingStatus === true, 'fail-border': passingStatus === false }">
        <div class="stat-icon avg-icon">📊</div>
        <div class="stat-info">
          <span class="stat-label">Notenschnitt (Gewichtet)</span>
          <div class="stat-value-group">
            <span class="stat-value" :class="averageGrade !== null ? getGradeCategory(averageGrade).class : ''">
              {{ averageGrade !== null ? averageGrade.toFixed(2) : '–' }}
            </span>
            <span v-if="roundedAverageHalf !== null" class="stat-subvalue">
              (Gerundet: {{ roundedAverageHalf.toFixed(1) }})
            </span>
          </div>
          <span v-if="passingStatus !== null" class="status-pill" :class="passingStatus ? 'pill-pass' : 'pill-fail'">
            {{ passingStatus ? '✓ Bestanden (≥ 4.0)' : '✗ Ungenügend (< 4.0)' }}
          </span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon best-icon">🏆</div>
        <div class="stat-info">
          <span class="stat-label">Beste Note</span>
          <span class="stat-value" :class="bestGrade !== null ? getGradeCategory(bestGrade).class : ''">
            {{ bestGrade !== null ? bestGrade.toFixed(2) : '–' }}
          </span>
          <span class="stat-desc">
            {{ bestGrade !== null ? getGradeCategory(bestGrade).label : 'Noch keine Noten' }}
          </span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon count-icon">📝</div>
        <div class="stat-info">
          <span class="stat-label">Erfasste Noten</span>
          <span class="stat-value">{{ totalNotesCount }}</span>
          <span class="stat-desc">Prüfungen / Leistungsnachweise</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon points-icon">🎯</div>
        <div class="stat-info">
          <span class="stat-label">Punkte Total</span>
          <span class="stat-value">
            {{ pointsStats.countWithPoints > 0 ? `${pointsStats.earned} / ${pointsStats.max}` : '–' }}
          </span>
          <span class="stat-desc">
            {{ pointsStats.countWithPoints > 0 ? `${pointsStats.percentage}% Erfolgsquote` : 'Keine Punkteeinträge' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Controls / Filters -->
    <div class="controls-card">
      <div class="search-box">
        <span class="search-symbol">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Nach Prüfung, Fach oder Bemerkung suchen..."
          class="search-field"
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">✕</button>
      </div>

      <div class="filter-controls">
        <label class="sort-label">Sortierung:</label>
        <select v-model="sortBy" class="sort-select">
          <option value="date-desc">Datum (neueste zuerst)</option>
          <option value="date-asc">Datum (älteste zuerst)</option>
          <option value="grade-desc">Note (beste zuerst)</option>
          <option value="grade-asc">Note (niedrigste zuerst)</option>
          <option value="title-asc">Titel (A-Z)</option>
        </select>
      </div>
    </div>

    <!-- Table of Grades -->
    <div class="table-container">
      <div v-if="isLoading && notes.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Lade DTR Noten...</p>
      </div>

      <div v-else-if="filteredNotes.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>{{ searchQuery ? 'Keine passenden Noten gefunden' : 'Noch keine Noten erfasst' }}</h3>
        <p>
          {{ searchQuery 
            ? 'Versuche einen anderen Suchbegriff.' 
            : 'Füge deine erste Prüfung oder Arbeit hinzu, um deinen Schnitt automatisch zu berechnen.' }}
        </p>
        <button v-if="!searchQuery" class="primary-btn mt-3" @click="openAddModal">
          ➕ Erste Note hinzufügen
        </button>
      </div>

      <table v-else class="grades-table">
        <thead>
          <tr>
            <th class="col-date">Datum</th>
            <th class="col-title">Bezeichnung / Prüfung</th>
            <th class="col-points">Punkte</th>
            <th class="col-percent">Prozent</th>
            <th class="col-weight">Gewichtung</th>
            <th class="col-grade">Note</th>
            <th class="col-status">Status</th>
            <th class="col-comment">Bemerkung</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="note in filteredNotes" :key="note.id">
            <td class="col-date cell-date">
              {{ note.date || '–' }}
            </td>
            <td class="col-title cell-title">
              <span class="note-title-text">{{ note.title }}</span>
            </td>
            <td class="col-points cell-points">
              <span v-if="note.points !== null && note.max_points !== null">
                <strong>{{ note.points }}</strong> / {{ note.max_points }}
              </span>
              <span v-else class="text-muted">–</span>
            </td>
            <td class="col-percent cell-percent">
              <span v-if="note.points !== null && note.max_points !== null && note.max_points > 0" class="percent-badge">
                {{ Math.round((Number(note.points) / Number(note.max_points)) * 1000) / 10 }} %
              </span>
              <span v-else class="text-muted">–</span>
            </td>
            <td class="col-weight cell-weight">
              <span class="weight-badge">{{ note.weight }}x</span>
            </td>
            <td class="col-grade cell-grade">
              <span class="grade-pill" :class="getGradeCategory(Number(note.grade)).class">
                {{ Number(note.grade).toFixed(2) }}
              </span>
            </td>
            <td class="col-status cell-status">
              <span class="status-indicator" :class="Number(note.grade) >= 4.0 ? 'indicator-pass' : 'indicator-fail'">
                {{ Number(note.grade) >= 4.0 ? 'Genügend' : 'Ungenügend' }}
              </span>
            </td>
            <td class="col-comment cell-comment">
              <span class="comment-text" :title="note.comment">{{ note.comment || '–' }}</span>
            </td>
            <td class="col-actions cell-actions">
              <button class="action-btn edit-btn" title="Note bearbeiten" @click="openEditModal(note)">
                ✏️
              </button>
              <button class="action-btn delete-btn" title="Note löschen" @click="confirmDelete(note)">
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add / Edit Modal -->
    <Transition name="fade">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3>{{ isEditing ? 'Note bearbeiten' : 'Neue Note erfassen' }}</h3>
            <button class="close-modal" @click="closeModal">×</button>
          </div>

          <form @submit.prevent="saveNote">
            <div class="modal-body">
              <!-- Title -->
              <div class="form-group">
                <label for="note-title">Bezeichnung / Prüfung *</label>
                <input
                  id="note-title"
                  v-model="formTitle"
                  type="text"
                  placeholder="z.B. DTR Modulprüfung, Test Distribution"
                  required
                  class="form-input"
                  autofocus
                />
              </div>

              <!-- Points & Max Points -->
              <div class="form-row">
                <div class="form-group">
                  <label for="note-points">Erreichte Punkte</label>
                  <input
                    id="note-points"
                    v-model="formPoints"
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="z.B. 24"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label for="note-max-points">Maximalpunkte</label>
                  <input
                    id="note-max-points"
                    v-model="formMaxPoints"
                    type="number"
                    step="0.25"
                    min="0.1"
                    placeholder="z.B. 30"
                    class="form-input"
                  />
                </div>
              </div>

              <!-- Live Grade Calculation Box -->
              <div class="calc-preview-card">
                <div class="calc-preview-header">
                  <span class="calc-preview-title">🇨🇭 Schweizer Notenberechnung</span>
                  <span v-if="liveCalculatedGrade !== null" class="grade-pill large" :class="getGradeCategory(liveCalculatedGrade).class">
                    {{ liveCalculatedGrade.toFixed(2) }}
                  </span>
                </div>

                <div v-if="formPoints !== '' && formMaxPoints !== '' && Number(formMaxPoints) > 0" class="calc-breakdown">
                  <span class="calc-math">
                    ({{ formPoints }} / {{ formMaxPoints }}) × 5 + 1 = <strong>{{ liveCalculatedGrade?.toFixed(2) }}</strong>
                  </span>
                  <span class="calc-status" :class="liveCalculatedGrade && liveCalculatedGrade >= 4.0 ? 'text-pass' : 'text-fail'">
                    {{ liveCalculatedGrade ? getGradeCategory(liveCalculatedGrade).label : '' }}
                    ({{ liveCalculatedGrade && liveCalculatedGrade >= 4.0 ? 'Bestanden' : 'Nicht bestanden' }})
                  </span>
                </div>
                <div v-else-if="formManualGrade !== ''" class="calc-breakdown">
                  <span>Direkt eingegebene Note: <strong>{{ Number(formManualGrade).toFixed(2) }}</strong></span>
                </div>
                <div v-else class="calc-breakdown text-muted">
                  <span>Gib Punkte und Maximalpunkte ein, um die Note automatisch zu berechnen.</span>
                </div>
              </div>

              <!-- Optional Direct Grade Override -->
              <div v-if="formPoints === '' || formMaxPoints === ''" class="form-group">
                <label for="note-manual-grade">Oder Note direkt eingeben (1.0 – 6.0)</label>
                <input
                  id="note-manual-grade"
                  v-model="formManualGrade"
                  type="number"
                  step="0.1"
                  min="1"
                  max="6"
                  placeholder="z.B. 5.5"
                  class="form-input"
                />
              </div>

              <!-- Weight & Date -->
              <div class="form-row">
                <div class="form-group">
                  <label for="note-weight">Gewichtung</label>
                  <input
                    id="note-weight"
                    v-model="formWeight"
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="1.0"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label for="note-date">Datum</label>
                  <input
                    id="note-date"
                    v-model="formDate"
                    type="date"
                    class="form-input"
                  />
                </div>
              </div>

              <!-- Comment -->
              <div class="form-group">
                <label for="note-comment">Bemerkung (optional)</label>
                <textarea
                  id="note-comment"
                  v-model="formComment"
                  rows="2"
                  placeholder="z.B. Kapitel 1 bis 3, Nachprüfung, etc."
                  class="form-textarea"
                ></textarea>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="cancel-button" @click="closeModal">Abbrechen</button>
              <button type="submit" class="confirm-button" :disabled="isLoading || liveCalculatedGrade === null">
                {{ isEditing ? 'Aktualisieren' : 'Speichern' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Delete Modal -->
    <Transition name="fade">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="modal-container delete-modal">
          <div class="modal-header">
            <h3>Note löschen</h3>
            <button class="close-modal" @click="closeDeleteModal">×</button>
          </div>
          <div class="modal-body">
            <p>Möchtest du die Note für <strong>"{{ noteToDelete?.title }}"</strong> wirklich löschen?</p>
            <div v-if="noteToDelete" class="delete-summary">
              <span>Note: <strong>{{ Number(noteToDelete.grade).toFixed(2) }}</strong></span>
              <span v-if="noteToDelete.points !== null">Punkte: {{ noteToDelete.points }} / {{ noteToDelete.max_points }}</span>
              <span>Datum: {{ noteToDelete.date }}</span>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="cancel-button" @click="closeDeleteModal">Abbrechen</button>
            <button type="button" class="delete-confirm-btn" :disabled="isLoading" @click="deleteNote">
              Endgültig löschen
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dtr-view {
  padding: 2.5rem;
  max-width: 1200px;
  margin: 0 auto;
  color: #1e293b;
}

/* Header */
.dtr-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.badge-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.view-badge {
  display: inline-block;
  background: #ede9fe;
  color: #6366f1;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.calc-badge {
  display: inline-block;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.header-titles h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin: 0 0 0.25rem 0;
}

.subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

/* Primary Button */
.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
  transition: all 0.2s;
}

.primary-btn:hover {
  background: linear-gradient(135deg, #4f46e5, #4338ca);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(99, 102, 241, 0.4);
}

.mt-3 {
  margin-top: 1rem;
}

/* Formula Banner */
.formula-banner {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #6366f1;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
}

.formula-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.formula-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #6366f1;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.formula-math {
  font-size: 1.15rem;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.formula-desc {
  font-size: 0.875rem;
  color: #64748b;
}

/* Alerts */
.alert {
  padding: 1rem 1.25rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}

.success-alert {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.error-alert {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.retry-btn {
  background: #991b1b;
  color: white;
  border: none;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 14px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
}

.pass-border {
  border-left: 4px solid #10b981;
}

.fail-border {
  border-left: 4px solid #ef4444;
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.avg-icon {
  background: rgba(99, 102, 241, 0.1);
}

.best-icon {
  background: rgba(245, 158, 11, 0.1);
}

.count-icon {
  background: rgba(16, 185, 129, 0.1);
}

.points-icon {
  background: rgba(14, 165, 233, 0.1);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value-group {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
}

.stat-subvalue {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.stat-desc {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}

.status-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  margin-top: 0.25rem;
  width: fit-content;
}

.pill-pass {
  background: #d1fae5;
  color: #065f46;
}

.pill-fail {
  background: #fee2e2;
  color: #991b1b;
}

/* Controls */
.controls-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  margin-bottom: 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  flex: 1;
  min-width: 240px;
  max-width: 450px;
}

.search-symbol {
  margin-right: 0.5rem;
  font-size: 0.9rem;
}

.search-field {
  border: none;
  background: transparent;
  width: 100%;
  font-size: 0.9rem;
  outline: none;
  color: #1e293b;
}

.clear-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0 0.25rem;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.sort-select {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.85rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
}

/* Table */
.table-container {
  background: white;
  border-radius: 14px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  overflow-x: auto;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.grades-table th {
  background: #f8fafc;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.grades-table td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.9rem;
  vertical-align: middle;
}

.grades-table tbody tr:hover {
  background-color: #fafbfc;
}

.cell-date {
  color: #64748b;
  white-space: nowrap;
  font-size: 0.85rem;
}

.cell-title {
  font-weight: 600;
  color: #0f172a;
}

.note-title-text {
  font-weight: 600;
}

.cell-points {
  white-space: nowrap;
}

.percent-badge {
  display: inline-block;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.weight-badge {
  display: inline-block;
  background: #ede9fe;
  color: #6366f1;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

/* Grade Pills */
.grade-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 800;
  min-width: 48px;
}

.grade-pill.large {
  font-size: 1.4rem;
  padding: 0.4rem 1rem;
  border-radius: 10px;
}

.grade-excel {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.grade-good {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.grade-pass {
  background: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.grade-fail {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #ffedd5;
}

.grade-poor {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.status-indicator {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}

.indicator-pass {
  background: #d1fae5;
  color: #065f46;
}

.indicator-fail {
  background: #fee2e2;
  color: #991b1b;
}

.cell-comment {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
  font-size: 0.85rem;
}

.cell-actions {
  white-space: nowrap;
  text-align: right;
}

.action-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
  margin-left: 0.25rem;
}

.edit-btn:hover {
  background: #edf2f7;
}

.delete-btn:hover {
  background: #fee2e2;
}

.text-muted {
  color: #94a3b8;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  padding: 4rem 2rem;
  text-align: center;
  color: #64748b;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.modal-container {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 540px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.delete-modal {
  max-width: 440px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.close-modal {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #94a3b8;
  line-height: 1;
}

.close-modal:hover {
  color: #475569;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-input,
.form-textarea {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  color: #0f172a;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.form-textarea {
  resize: vertical;
}

/* Calculation Preview Inside Modal */
.calc-preview-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.calc-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calc-preview-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
}

.calc-breakdown {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.calc-math strong {
  color: #0f172a;
  font-size: 1.05rem;
}

.calc-status {
  font-size: 0.85rem;
  font-weight: 700;
}

.text-pass {
  color: #059669;
}

.text-fail {
  color: #dc2626;
}

.delete-summary {
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
  color: #475569;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #f1f5f9;
  background: #fcfcfd;
}

.cancel-button {
  background: #f1f5f9;
  color: #475569;
  border: none;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-button:hover {
  background: #e2e8f0;
}

.confirm-button {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border: none;
  padding: 0.65rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #4f46e5, #4338ca);
}

.delete-confirm-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.delete-confirm-btn:hover {
  background: #dc2626;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .dtr-view {
    padding: 1.5rem 1rem;
  }

  .dtr-header {
    flex-direction: column;
    align-items: stretch;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
