<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE } from '@/config'

export interface QuestionItem {
  id: number
  question: string
  answer: string
  category: string
  difficulty: string
  created_at?: string
}

export interface QuizQuestion extends QuestionItem {
  userAnswer: string
  isAnswerRevealed: boolean
  isCorrect: boolean | null // null = unjudged, true = correct, false = incorrect
}

// Tabs: 'quiz' | 'manage'
const activeTab = ref<'quiz' | 'manage'>('quiz')

// State for Questions Database
const questions = ref<QuestionItem[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Form State for Adding / Editing Questions
const editingId = ref<number | null>(null)
const formQuestion = ref('')
const formAnswer = ref('')
const formCategory = ref('Allgemein')
const formDifficulty = ref('Mittel')
const showFormModal = ref(false)

// Search & Filter in Question Manager
const searchQuery = ref('')
const selectedCategoryFilter = ref('Alle')

// Quiz State
const quizStage = ref<'setup' | 'active' | 'finished'>('setup')
const selectedCount = ref<number>(5)
const customCount = ref<number>(5)
const quizQuestions = ref<QuizQuestion[]>([])
const currentQuestionIndex = ref<number>(0)
const quizTimeElapsed = ref<number>(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

// Fetch all questions from API
const fetchQuestions = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/wissenstest`)
    if (res.ok) {
      questions.value = await res.json()
      // Adjust default selected count if necessary
      if (questions.value.length > 0) {
        if (selectedCount.value > questions.value.length) {
          selectedCount.value = Math.min(5, questions.value.length)
        }
      }
    } else {
      errorMessage.value = 'Fehler beim Laden der Fragen aus der Datenbank.'
    }
  } catch (err: any) {
    console.error('Fetch error:', err)
    errorMessage.value = 'Verbindung zum Server fehlgeschlagen.'
  } finally {
    isLoading.value = false
  }
}

// Filtered Questions in Manager
const availableCategories = computed(() => {
  const cats = new Set<string>()
  questions.value.forEach(q => {
    if (q.category) cats.add(q.category)
  })
  return ['Alle', ...Array.from(cats)]
})

const filteredQuestions = computed(() => {
  return questions.value.filter(q => {
    const matchesSearch = 
      q.question.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCat = selectedCategoryFilter.value === 'Alle' || q.category === selectedCategoryFilter.value
    return matchesSearch && matchesCat
  })
})

// Question Form Methods
const openAddModal = () => {
  editingId.value = null
  formQuestion.value = ''
  formAnswer.value = ''
  formCategory.value = 'Allgemein'
  formDifficulty.value = 'Mittel'
  showFormModal.value = true
}

const openEditModal = (q: QuestionItem) => {
  editingId.value = q.id
  formQuestion.value = q.question
  formAnswer.value = q.answer
  formCategory.value = q.category || 'Allgemein'
  formDifficulty.value = q.difficulty || 'Mittel'
  showFormModal.value = true
}

const closeFormModal = () => {
  showFormModal.value = false
  editingId.value = null
}

const saveQuestion = async () => {
  if (!formQuestion.value.trim() || !formAnswer.value.trim()) {
    alert('Bitte Frage und Antwort ausfüllen.')
    return
  }

  isSaving.value = true
  try {
    const payload = {
      question: formQuestion.value.trim(),
      answer: formAnswer.value.trim(),
      category: formCategory.value.trim() || 'Allgemein',
      difficulty: formDifficulty.value || 'Mittel'
    }

    let res: Response
    if (editingId.value) {
      res = await fetch(`${API_BASE}/api/wissenstest/${editingId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } else {
      res = await fetch(`${API_BASE}/api/wissenstest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    }

    if (res.ok) {
      successMessage.value = editingId.value ? 'Frage erfolgreich aktualisiert!' : 'Frage erfolgreich hinzugefügt!'
      setTimeout(() => { successMessage.value = '' }, 3000)
      closeFormModal()
      await fetchQuestions()
    } else {
      const err = await res.json()
      alert('Fehler: ' + (err.error || 'Speichern fehlgeschlagen'))
    }
  } catch (err) {
    console.error('Save error:', err)
    alert('Verbindungsfehler beim Speichern der Frage.')
  } finally {
    isSaving.value = false
  }
}

const deleteQuestion = async (id: number) => {
  if (!confirm('Möchtest du diese Frage wirklich löschen?')) return

  try {
    const res = await fetch(`${API_BASE}/api/wissenstest/${id}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      questions.value = questions.value.filter(q => q.id !== id)
      successMessage.value = 'Frage gelöscht.'
      setTimeout(() => { successMessage.value = '' }, 3000)
    } else {
      alert('Fehler beim Löschen der Frage.')
    }
  } catch (err) {
    console.error('Delete error:', err)
    alert('Verbindungsfehler beim Löschen.')
  }
}

// Quiz Flow Methods
const startQuiz = async (count: number) => {
  if (questions.value.length === 0) {
    alert('Es sind noch keine Fragen in der Datenbank vorhanden.')
    return
  }

  const requestedCount = Math.max(1, Math.min(count, questions.value.length))

  try {
    const res = await fetch(`${API_BASE}/api/wissenstest/random?count=${requestedCount}`)
    if (res.ok) {
      const data = await res.json()
      quizQuestions.value = (data.questions || []).map((q: QuestionItem) => ({
        ...q,
        userAnswer: '',
        isAnswerRevealed: false,
        isCorrect: null
      }))

      if (quizQuestions.value.length === 0) {
        alert('Keine Fragen erhalten.')
        return
      }

      currentQuestionIndex.value = 0
      quizTimeElapsed.value = 0
      quizStage.value = 'active'

      if (timerInterval) clearInterval(timerInterval)
      timerInterval = setInterval(() => {
        quizTimeElapsed.value++
      }, 1000)
    } else {
      alert('Fehler beim Abrufen der Zufallsfragen.')
    }
  } catch (err) {
    console.error('Quiz start error:', err)
    alert('Verbindungsfehler beim Starten des Tests.')
  }
}

const currentQuizQuestion = computed(() => {
  return quizQuestions.value[currentQuestionIndex.value] || null
})

const nextQuestion = () => {
  if (currentQuestionIndex.value < quizQuestions.value.length - 1) {
    currentQuestionIndex.value++
  } else {
    finishQuiz()
  }
}

const prevQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

const revealAnswer = () => {
  if (currentQuizQuestion.value) {
    currentQuizQuestion.value.isAnswerRevealed = true
  }
}

const rateCurrentQuestion = (correct: boolean) => {
  if (currentQuizQuestion.value) {
    currentQuizQuestion.value.isCorrect = correct
    currentQuizQuestion.value.isAnswerRevealed = true
    // Automatically advance after brief feedback if desired or user can click next
  }
}

const finishQuiz = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  quizStage.value = 'finished'
}

const resetQuiz = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  quizStage.value = 'setup'
  quizQuestions.value = []
  currentQuestionIndex.value = 0
}

const correctAnswersCount = computed(() => {
  return quizQuestions.value.filter(q => q.isCorrect === true).length
})

const answeredQuestionsCount = computed(() => {
  return quizQuestions.value.filter(q => q.isCorrect !== null).length
})

const scorePercentage = computed(() => {
  if (quizQuestions.value.length === 0) return 0
  return Math.round((correctAnswersCount.value / quizQuestions.value.length) * 100)
})

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs} min`
}

onMounted(() => {
  fetchQuestions()
})
</script>

<template>
  <div class="wissenstest-container">
    <!-- Header -->
    <header class="wissenstest-header">
      <div class="header-titles">
        <span class="header-badge">🧠 Werkzeuge</span>
        <h1>Wissenstest</h1>
        <p class="header-subtitle">
          Trainiere dein Fachwissen: Wähle eine beliebige Anzahl von Zufallsfragen aus deiner Datenbank oder verwalte deinen Fragenkatalog.
        </p>
      </div>

      <!-- Tab Buttons -->
      <div class="tab-controls">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'quiz' }"
          @click="activeTab = 'quiz'"
        >
          <span class="tab-icon">🎯</span>
          <span>Test durchführen</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'manage' }"
          @click="activeTab = 'manage'"
        >
          <span class="tab-icon">📚</span>
          <span>Fragen verwalten ({{ questions.length }})</span>
        </button>
      </div>
    </header>

    <!-- Success / Error Notifications -->
    <div v-if="successMessage" class="alert alert-success">
      <span>✓ {{ successMessage }}</span>
    </div>
    <div v-if="errorMessage" class="alert alert-error">
      <span>⚠ {{ errorMessage }}</span>
    </div>

    <!-- ================= TAB 1: QUIZ MODE ================= -->
    <div v-if="activeTab === 'quiz'" class="quiz-view">
      <!-- Stage 1: Setup / Count Selection -->
      <div v-if="quizStage === 'setup'" class="quiz-setup-card">
        <div class="setup-icon-wrap">
          <span class="setup-icon">🎲</span>
        </div>
        <h2>Starte deinen Wissenstest</h2>
        <p class="setup-desc">
          Aktuell befinden sich <strong class="highlight-count">{{ questions.length }}</strong> Fragen in deiner Datenbank.
          Wähle aus, wie viele zufällige Fragen du beantworten möchtest:
        </p>

        <div v-if="questions.length > 0" class="selection-section">
          <!-- Preset Buttons -->
          <div class="preset-buttons">
            <button
              v-for="countOption in [3, 5, 7, 10, 15, questions.length].filter((c, idx, arr) => c <= questions.length && arr.indexOf(c) === idx)"
              :key="countOption"
              class="count-chip"
              :class="{ selected: selectedCount === countOption }"
              @click="selectedCount = countOption"
            >
              {{ countOption === questions.length ? `Alle (${countOption})` : `${countOption} Fragen` }}
            </button>
          </div>

          <!-- Custom Number Input Slider / Field -->
          <div class="custom-selection-wrap">
            <label for="custom-count-input" class="input-label">
              Oder benutzerdefinierte Anzahl wählen (1 bis {{ questions.length }}):
            </label>
            <div class="slider-row">
              <input
                id="custom-count-input"
                type="range"
                min="1"
                :max="questions.length"
                v-model.number="selectedCount"
                class="count-slider"
              />
              <span class="count-display">{{ selectedCount }}</span>
            </div>
          </div>

          <!-- Start Action Button -->
          <div class="start-btn-wrap">
            <button class="primary-start-btn" @click="startQuiz(selectedCount)">
              <span>🚀 Test mit {{ selectedCount }} Zufallsfragen starten</span>
            </button>
          </div>
        </div>

        <div v-else class="empty-questions-notice">
          <p>Es sind noch keine Fragen in der Datenbank hinterlegt.</p>
          <button class="btn-secondary" @click="activeTab = 'manage'; openAddModal()">
            + Jetzt erste Frage erstellen
          </button>
        </div>
      </div>

      <!-- Stage 2: Active Test Session -->
      <div v-else-if="quizStage === 'active' && currentQuizQuestion" class="quiz-active-card">
        <!-- Progress Bar & Stats Header -->
        <div class="quiz-top-bar">
          <div class="progress-info">
            <span class="question-step">Frage {{ currentQuestionIndex + 1 }} von {{ quizQuestions.length }}</span>
            <span class="category-badge">{{ currentQuizQuestion.category || 'Allgemein' }}</span>
            <span
              class="difficulty-badge"
              :class="currentQuizQuestion.difficulty?.toLowerCase()"
            >
              {{ currentQuizQuestion.difficulty || 'Mittel' }}
            </span>
          </div>

          <div class="quiz-timer">
            ⏱ {{ formatTime(quizTimeElapsed) }}
          </div>
        </div>

        <!-- Linear Progress Bar -->
        <div class="progress-bar-track">
          <div
            class="progress-bar-fill"
            :style="{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }"
          ></div>
        </div>

        <!-- Question Card -->
        <div class="question-main-box">
          <h2 class="question-text">{{ currentQuizQuestion.question }}</h2>
        </div>

        <!-- User Answer Input Area -->
        <div class="answer-input-section">
          <label class="input-label">Deine Antwort:</label>
          <textarea
            v-model="currentQuizQuestion.userAnswer"
            placeholder="Schreibe hier deine Antwort oder Lösung..."
            rows="4"
            class="user-answer-textarea"
          ></textarea>
        </div>

        <!-- Show Solution / Self-Correction Area -->
        <div class="solution-section">
          <div v-if="!currentQuizQuestion.isAnswerRevealed" class="reveal-btn-wrap">
            <button class="btn-reveal" @click="revealAnswer">
              💡 Musterlösung anzeigen & prüfen
            </button>
          </div>

          <div v-else class="revealed-box">
            <div class="revealed-header">
              <span class="solution-label">Musterlösung:</span>
            </div>
            <p class="official-answer-text">{{ currentQuizQuestion.answer }}</p>

            <!-- Self Evaluation -->
            <div class="self-evaluation-block">
              <span class="eval-title">Wie bewertest du deine Antwort?</span>
              <div class="eval-buttons">
                <button
                  class="btn-eval btn-correct"
                  :class="{ active: currentQuizQuestion.isCorrect === true }"
                  @click="rateCurrentQuestion(true)"
                >
                  ✓ Richtig gewusst
                </button>
                <button
                  class="btn-eval btn-incorrect"
                  :class="{ active: currentQuizQuestion.isCorrect === false }"
                  @click="rateCurrentQuestion(false)"
                >
                  ✗ Nicht gewusst / Falsch
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="quiz-nav-footer">
          <button
            class="btn-secondary"
            :disabled="currentQuestionIndex === 0"
            @click="prevQuestion"
          >
            ◀ Vorherige Frage
          </button>

          <div class="question-dots">
            <span
              v-for="(q, idx) in quizQuestions"
              :key="q.id"
              class="dot"
              :class="{
                current: idx === currentQuestionIndex,
                correct: q.isCorrect === true,
                incorrect: q.isCorrect === false,
                answered: q.userAnswer.trim().length > 0 && q.isCorrect === null
              }"
              @click="currentQuestionIndex = idx"
              :title="`Frage ${idx + 1}`"
            ></span>
          </div>

          <button
            v-if="currentQuestionIndex < quizQuestions.length - 1"
            class="btn-primary"
            @click="nextQuestion"
          >
            Nächste Frage ▶
          </button>
          <button
            v-else
            class="btn-finish"
            @click="finishQuiz"
          >
            🏁 Test beenden
          </button>
        </div>
      </div>

      <!-- Stage 3: Finished / Results Summary -->
      <div v-else-if="quizStage === 'finished'" class="quiz-results-card">
        <div class="results-header">
          <div class="trophy-icon">🏆</div>
          <h2>Testergebnis</h2>
          <p class="results-subtitle">Du hast den Wissenstest abgeschlossen!</p>
        </div>

        <!-- Score Highlights Grid -->
        <div class="results-score-grid">
          <div class="score-card">
            <span class="score-label">Richtig beantwortet</span>
            <span class="score-number score-green">{{ correctAnswersCount }} / {{ quizQuestions.length }}</span>
          </div>
          <div class="score-card">
            <span class="score-label">Erfolgsquote</span>
            <span class="score-number">{{ scorePercentage }}%</span>
          </div>
          <div class="score-card">
            <span class="score-label">Benötigte Zeit</span>
            <span class="score-number">{{ formatTime(quizTimeElapsed) }}</span>
          </div>
        </div>

        <!-- Question Review Accordion / List -->
        <div class="review-section">
          <h3>Detailübersicht aller Fragen</h3>
          <div class="review-list">
            <div
              v-for="(q, idx) in quizQuestions"
              :key="q.id"
              class="review-item"
              :class="{ 'review-correct': q.isCorrect === true, 'review-incorrect': q.isCorrect === false }"
            >
              <div class="review-item-header">
                <span class="review-num">#{{ idx + 1 }}</span>
                <span class="review-q-title">{{ q.question }}</span>
                <span v-if="q.isCorrect === true" class="status-tag tag-correct">✓ Richtig</span>
                <span v-else-if="q.isCorrect === false" class="status-tag tag-incorrect">✗ Falsch</span>
                <span v-else class="status-tag tag-neutral">Unbewertet</span>
              </div>
              <div class="review-item-body">
                <div class="user-part">
                  <strong>Deine Antwort:</strong>
                  <p>{{ q.userAnswer || '— Keine Antwort eingegeben —' }}</p>
                </div>
                <div class="official-part">
                  <strong>Musterlösung:</strong>
                  <p>{{ q.answer }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="results-actions">
          <button class="btn-primary" @click="startQuiz(selectedCount)">
            🔄 Neuen Test mit {{ selectedCount }} Fragen starten
          </button>
          <button class="btn-secondary" @click="resetQuiz">
            ⚙️ Zurück zur Auswahl
          </button>
        </div>
      </div>
    </div>

    <!-- ================= TAB 2: QUESTIONS MANAGEMENT ================= -->
    <div v-if="activeTab === 'manage'" class="manage-view">
      <!-- Toolbar: Search, Filter, Add Button -->
      <div class="manage-toolbar">
        <div class="search-filter-wrap">
          <div class="search-box">
            <span class="search-ico">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Fragen oder Antworten durchsuchen..."
              class="search-input"
            />
          </div>

          <div class="filter-box">
            <label class="filter-label">Kategorie:</label>
            <select v-model="selectedCategoryFilter" class="filter-select">
              <option v-for="cat in availableCategories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>
        </div>

        <button class="btn-add" @click="openAddModal">
          <span>+ Neue Frage hinzufügen</span>
        </button>
      </div>

      <!-- Question List Table / Cards -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Lade Fragen aus der Datenbank...</p>
      </div>

      <div v-else-if="filteredQuestions.length === 0" class="empty-state">
        <p v-if="questions.length === 0">Noch keine Fragen vorhanden. Erstelle die erste Frage!</p>
        <p v-else>Keine Fragen gefunden, die deinem Suchfilter entsprechen.</p>
      </div>

      <div v-else class="questions-grid">
        <div
          v-for="q in filteredQuestions"
          :key="q.id"
          class="question-card"
        >
          <div class="q-card-header">
            <div class="q-meta-badges">
              <span class="cat-badge">{{ q.category || 'Allgemein' }}</span>
              <span class="diff-badge" :class="q.difficulty?.toLowerCase()">{{ q.difficulty || 'Mittel' }}</span>
            </div>
            <div class="q-actions">
              <button class="action-btn edit-btn" @click="openEditModal(q)" title="Bearbeiten">
                ✏️
              </button>
              <button class="action-btn delete-btn" @click="deleteQuestion(q.id)" title="Löschen">
                🗑️
              </button>
            </div>
          </div>

          <div class="q-card-body">
            <h3 class="q-title">{{ q.question }}</h3>
            <div class="q-answer-box">
              <span class="answer-tag">Antwort:</span>
              <p class="q-answer-text">{{ q.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= ADD / EDIT QUESTION MODAL ================= -->
    <Transition name="fade">
      <div v-if="showFormModal" class="modal-overlay" @click.self="closeFormModal">
        <div class="modal-card">
          <div class="modal-header">
            <h2>{{ editingId ? 'Frage bearbeiten' : 'Neue Frage erstellen' }}</h2>
            <button class="close-x-btn" @click="closeFormModal">✕</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Frage: <span class="required">*</span></label>
              <textarea
                v-model="formQuestion"
                rows="3"
                placeholder="z.B. Wie lautet das Ohmsche Gesetz?"
                class="form-input"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Antwort / Musterlösung: <span class="required">*</span></label>
              <textarea
                v-model="formAnswer"
                rows="4"
                placeholder="z.B. U = R * I (Spannung = Widerstand mal Stromstärke)."
                class="form-input"
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">Kategorie / Fachbereich:</label>
                <input
                  v-model="formCategory"
                  type="text"
                  placeholder="z.B. Physik, Informatik, M101"
                  class="form-input"
                />
              </div>

              <div class="form-group half">
                <label class="form-label">Schwierigkeitsgrad:</label>
                <select v-model="formDifficulty" class="form-select">
                  <option value="Einfach">Einfach</option>
                  <option value="Mittel">Mittel</option>
                  <option value="Schwer">Schwer</option>
                </select>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="closeFormModal">Abbrechen</button>
            <button class="btn-primary" :disabled="isSaving" @click="saveQuestion">
              {{ isSaving ? 'Speichere...' : (editingId ? 'Änderungen speichern' : 'Frage hinzufügen') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.wissenstest-container {
  padding: 2.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

/* Header */
.wissenstest-header {
  margin-bottom: 2rem;
}

.header-badge {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  font-weight: 700;
  font-size: 0.85rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
}

.wissenstest-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.025em;
}

.header-subtitle {
  color: #64748b;
  font-size: 1.05rem;
  line-height: 1.5;
  margin: 0 0 1.5rem 0;
}

.tab-controls {
  display: flex;
  gap: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.tab-btn.active {
  background: #4f46e5;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
}

/* Alerts */
.alert {
  padding: 0.875rem 1.25rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  font-weight: 500;
  font-size: 0.95rem;
}

.alert-success {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.alert-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

/* ================= QUIZ SETUP ================= */
.quiz-setup-card {
  background: white;
  border-radius: 20px;
  padding: 3rem 2.5rem;
  text-align: center;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  border: 1px solid #f1f5f9;
}

.setup-icon-wrap {
  width: 80px;
  height: 80px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem auto;
}

.setup-icon {
  font-size: 2.5rem;
}

.quiz-setup-card h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.75rem;
}

.setup-desc {
  color: #64748b;
  font-size: 1.05rem;
  max-width: 600px;
  margin: 0 auto 2rem auto;
}

.highlight-count {
  color: #4f46e5;
  font-weight: 700;
}

.selection-section {
  max-width: 550px;
  margin: 0 auto;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.count-chip {
  padding: 0.6rem 1.25rem;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 9999px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s ease;
}

.count-chip:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.count-chip.selected {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.25);
}

.custom-selection-wrap {
  background: #f8fafc;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 2rem;
  text-align: left;
}

.input-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.75rem;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.count-slider {
  flex: 1;
  height: 8px;
  accent-color: #4f46e5;
  cursor: pointer;
}

.count-display {
  font-size: 1.35rem;
  font-weight: 800;
  color: #4f46e5;
  min-width: 40px;
  text-align: center;
}

.primary-start-btn {
  width: 100%;
  padding: 1rem 1.75rem;
  background: #4f46e5;
  color: white;
  font-size: 1.1rem;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
  transition: all 0.2s ease;
}

.primary-start-btn:hover {
  background: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 12px 20px -3px rgba(79, 70, 229, 0.4);
}

/* ================= QUIZ ACTIVE ================= */
.quiz-active-card {
  background: white;
  border-radius: 20px;
  padding: 2.25rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
}

.quiz-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.question-step {
  font-weight: 700;
  color: #0f172a;
  font-size: 1rem;
}

.category-badge {
  background: #f1f5f9;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.difficulty-badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.difficulty-badge.einfach {
  background: #ecfdf5;
  color: #059669;
}

.difficulty-badge.mittel {
  background: #fffbeb;
  color: #d97706;
}

.difficulty-badge.schwer {
  background: #fef2f2;
  color: #dc2626;
}

.quiz-timer {
  font-weight: 700;
  color: #64748b;
  font-size: 0.95rem;
  background: #f8fafc;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.progress-bar-track {
  width: 100%;
  height: 8px;
  background: #f1f5f9;
  border-radius: 9999px;
  margin-bottom: 2rem;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.question-main-box {
  background: #f8fafc;
  padding: 1.75rem 2rem;
  border-radius: 14px;
  border-left: 5px solid #4f46e5;
  margin-bottom: 1.75rem;
}

.question-text {
  font-size: 1.35rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.4;
  margin: 0;
}

.answer-input-section {
  margin-bottom: 1.75rem;
}

.user-answer-textarea {
  width: 100%;
  padding: 1rem;
  border-radius: 12px;
  border: 1.5px solid #cbd5e1;
  font-family: inherit;
  font-size: 1rem;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.user-answer-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}

.solution-section {
  margin-bottom: 2rem;
}

.reveal-btn-wrap {
  text-align: center;
}

.btn-reveal {
  padding: 0.85rem 1.5rem;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 700;
  font-size: 0.95rem;
  border: 1.5px dashed #a5b4fc;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reveal:hover {
  background: #e0e7ff;
}

.revealed-box {
  background: #f0fdf4;
  border: 1.5px solid #bbf7d0;
  border-radius: 12px;
  padding: 1.5rem;
}

.revealed-header {
  margin-bottom: 0.5rem;
}

.solution-label {
  font-weight: 700;
  color: #166534;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.official-answer-text {
  color: #14532d;
  font-size: 1.05rem;
  line-height: 1.5;
  margin: 0 0 1.25rem 0;
}

.self-evaluation-block {
  border-top: 1px solid #dcfce7;
  padding-top: 1rem;
}

.eval-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  color: #166534;
  margin-bottom: 0.75rem;
}

.eval-buttons {
  display: flex;
  gap: 0.75rem;
}

.btn-eval {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.btn-correct {
  background: #dcfce7;
  color: #15803d;
  border-color: #86efac;
}

.btn-correct:hover,
.btn-correct.active {
  background: #22c55e;
  color: white;
  border-color: #16a34a;
}

.btn-incorrect {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fca5a5;
}

.btn-incorrect:hover,
.btn-incorrect.active {
  background: #ef4444;
  color: white;
  border-color: #dc2626;
}

.quiz-nav-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1.5rem;
  border-top: 1px solid #f1f5f9;
}

.question-dots {
  display: flex;
  gap: 0.4rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}

.dot.current {
  transform: scale(1.3);
  box-shadow: 0 0 0 2px #4f46e5;
}

.dot.correct {
  background: #22c55e;
}

.dot.incorrect {
  background: #ef4444;
}

.dot.answered {
  background: #a5b4fc;
}

/* ================= QUIZ RESULTS ================= */
.quiz-results-card {
  background: white;
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
}

.results-header {
  text-align: center;
  margin-bottom: 2rem;
}

.trophy-icon {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
}

.results-header h2 {
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.results-subtitle {
  color: #64748b;
  font-size: 1.05rem;
  margin: 0;
}

.results-score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.score-card {
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  text-align: center;
}

.score-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.score-number {
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
}

.score-green {
  color: #16a34a;
}

.review-section {
  margin-bottom: 2.5rem;
}

.review-section h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 1rem;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review-item {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #e2e8f0;
}

.review-item.review-correct {
  border-left: 4px solid #22c55e;
}

.review-item.review-incorrect {
  border-left: 4px solid #ef4444;
}

.review-item-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.review-num {
  font-weight: 700;
  color: #64748b;
}

.review-q-title {
  flex: 1;
  font-weight: 700;
  color: #0f172a;
}

.status-tag {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.tag-correct {
  background: #dcfce7;
  color: #15803d;
}

.tag-incorrect {
  background: #fee2e2;
  color: #b91c1c;
}

.tag-neutral {
  background: #f1f5f9;
  color: #64748b;
}

.review-item-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  font-size: 0.95rem;
}

.user-part,
.official-part {
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.user-part strong {
  color: #475569;
  font-size: 0.85rem;
}

.official-part strong {
  color: #166534;
  font-size: 0.85rem;
}

.user-part p,
.official-part p {
  margin: 0.25rem 0 0 0;
  color: #0f172a;
}

.results-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

/* ================= MANAGE VIEW ================= */
.manage-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-filter-wrap {
  display: flex;
  gap: 1rem;
  flex: 1;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 250px;
}

.search-ico {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.filter-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
}

.filter-select {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  background: white;
  font-size: 0.95rem;
  color: #0f172a;
}

.btn-add {
  padding: 0.75rem 1.25rem;
  background: #4f46e5;
  color: white;
  font-weight: 700;
  font-size: 0.95rem;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
  transition: all 0.2s;
}

.btn-add:hover {
  background: #4338ca;
}

.questions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.question-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.q-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.q-meta-badges {
  display: flex;
  gap: 0.5rem;
}

.cat-badge {
  background: #f1f5f9;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.diff-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.diff-badge.einfach {
  background: #ecfdf5;
  color: #059669;
}

.diff-badge.mittel {
  background: #fffbeb;
  color: #d97706;
}

.diff-badge.schwer {
  background: #fef2f2;
  color: #dc2626;
}

.q-actions {
  display: flex;
  gap: 0.4rem;
}

.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #f1f5f9;
}

.q-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 1rem 0;
  line-height: 1.4;
}

.q-answer-box {
  background: #f8fafc;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
}

.answer-tag {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.q-answer-text {
  margin: 0;
  font-size: 0.95rem;
  color: #334155;
  line-height: 1.4;
}

/* ================= MODAL ================= */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.modal-card {
  background: white;
  border-radius: 20px;
  max-width: 580px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.close-x-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: #64748b;
  cursor: pointer;
}

.modal-body {
  padding: 1.75rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group.half {
  flex: 1;
}

.form-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.5rem;
}

.required {
  color: #ef4444;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1.5px solid #cbd5e1;
  font-family: inherit;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}

.modal-footer {
  padding: 1.25rem 1.75rem;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* Common Buttons */
.btn-primary {
  padding: 0.75rem 1.5rem;
  background: #4f46e5;
  color: white;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-secondary {
  padding: 0.75rem 1.25rem;
  background: #e2e8f0;
  color: #334155;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

.btn-finish {
  padding: 0.75rem 1.5rem;
  background: #059669;
  color: white;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.25);
  transition: all 0.2s;
}

.btn-finish:hover {
  background: #047857;
}

/* Utilities */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .wissenstest-container {
    padding: 1.5rem;
  }
  .review-item-body {
    grid-template-columns: 1fr;
  }
}
</style>
