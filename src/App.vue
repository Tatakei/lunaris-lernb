<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, ref, watch, onMounted } from 'vue'
import { API_BASE } from './config'
import { useSidebar } from './composables/useSidebar'

interface LexikonEntry {
  id?: number
  word: string
  definition: string
  number?: string
}

const route = useRoute()
const { isCollapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebar()

const moduleDropdownOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

const lexikonEntries = ref<LexikonEntry[]>([])
const searchQuery = ref('')
const selectedEntry = ref<LexikonEntry | null>(null)
const showSearchModal = ref(false)

const isActive = computed(() => (path: string) => route.path === path)

const fetchLexikon = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/lexikon`)
    if (response.ok) {
      const text = await response.text()
      if (text) {
        const data = JSON.parse(text)
        if (Array.isArray(data)) {
          lexikonEntries.value = data
          try {
            localStorage.setItem('cached_lexikon', JSON.stringify(data))
          } catch {}
        }
      }
    }
  } catch (error) {
    console.error('Error fetching lexikon for search:', error)
    try {
      const cached = localStorage.getItem('cached_lexikon')
      if (cached) {
        lexikonEntries.value = JSON.parse(cached)
      }
    } catch {}
  }
}

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  const query = searchQuery.value.toLowerCase()
  return lexikonEntries.value.filter(entry => 
    entry.word.toLowerCase().includes(query) ||
    (entry.number && entry.number.toLowerCase().includes(query))
  ).slice(0, 10)
})

const showDefinition = (entry: LexikonEntry) => {
  selectedEntry.value = entry
  showSearchModal.value = true
  searchQuery.value = ''
}

const closeSearchModal = () => {
  showSearchModal.value = false
  selectedEntry.value = null
}

onMounted(fetchLexikon)

// Close dropdown and mobile sidebar when navigating away
watch(() => route.path, (newPath) => {
  if (newPath.startsWith('/module/')) {
    moduleDropdownOpen.value = false
  }
  closeMobile()
})

const modules = [
  { id: 'r100', label: 'Module 10x' },
  { id: 'r200', label: 'Module 20x' },
  { id: 'r300', label: 'Module 30x' },
  { id: 'r400', label: 'Module 40x' },
]

const showDropdown = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  moduleDropdownOpen.value = true
}

const hideDropdown = () => {
  closeTimer = setTimeout(() => {
    moduleDropdownOpen.value = false
    closeTimer = null
  }, 150)
}

const toggleModuleDropdown = () => {
  moduleDropdownOpen.value = !moduleDropdownOpen.value
}
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <!-- Mobile Drawer Hamburger -->
        <button 
          class="mobile-menu-btn" 
          @click="toggleMobile" 
          :aria-label="mobileOpen ? 'Menü schließen' : 'Menü öffnen'"
          :class="{ open: mobileOpen }"
          type="button"
        >
          <span class="hamburger-bar"></span>
          <span class="hamburger-bar"></span>
          <span class="hamburger-bar"></span>
        </button>

        <!-- Desktop Sidebar Toggle Button -->
        <button
          class="sidebar-toggle-btn"
          @click="toggleCollapse"
          :title="isCollapsed ? 'Sidebar einblenden' : 'Sidebar ausblenden'"
          type="button"
        >
          <svg
            class="toggle-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <!-- Arrow indicating collapse/expand -->
            <path v-if="!isCollapsed" d="M14 9l-3 3 3 3"></path>
            <path v-else d="M13 15l3-3-3-3"></path>
          </svg>
        </button>

        <!-- Logo -->
        <RouterLink to="/" class="header-logo">
          <img src="@/assets/lunaris.jpg" alt="Lunaris Logo" class="logo-img" />
          <h1 class="title">Lunaris</h1>
        </RouterLink>
      </div>
      
      <!-- Search Input -->
      <div class="header-search">
        <div class="search-container">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Lexikon durchsuchen..." 
            class="search-input"
            @focus="fetchLexikon"
          />
          <span v-if="searchQuery" class="clear-search" @click="searchQuery = ''">✕</span>

          <Transition name="fade">
            <div v-if="searchResults.length > 0" class="search-results">
              <div 
                v-for="entry in searchResults" 
                :key="entry.id" 
                class="search-result-item"
                @click="showDefinition(entry)"
              >
                <div class="result-word-wrap">
                  <span class="result-word">{{ entry.word }}</span>
                  <span v-if="entry.number" class="result-number-badge">{{ entry.number }}</span>
                </div>
                <span class="result-hint">Lexikon</span>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <div class="app-body">
      <!-- Mobile Backdrop -->
      <Transition name="fade">
        <div 
          v-if="mobileOpen" 
          class="sidebar-backdrop" 
          @click="closeMobile"
        ></div>
      </Transition>

      <!-- Sidebar -->
      <aside class="sidebar" :class="{ 'collapsed': isCollapsed, 'mobile-open': mobileOpen }">
        <div class="sidebar-top-bar">
          <span class="sidebar-heading">Navigation</span>
          <button
            class="sidebar-collapse-action"
            @click="toggleCollapse"
            title="Sidebar einklappen"
            type="button"
          >
            ◀
          </button>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section">
            <h3 class="nav-section-title">Lernbereich</h3>

            <RouterLink to="/" class="nav-item" :class="{ active: isActive('/') }" @click="closeMobile">
              <span class="nav-icon">🏠</span>
              <span class="nav-label">Übersicht</span>
            </RouterLink>

            <RouterLink to="/lexikon" class="nav-item" :class="{ active: isActive('/lexikon') }" @click="closeMobile">
              <span class="nav-icon">📖</span>
              <span class="nav-label">Lexikon</span>
              <span v-if="lexikonEntries.length" class="nav-count">{{ lexikonEntries.length }}</span>
            </RouterLink>

            <RouterLink to="/dtr" class="nav-item" :class="{ active: isActive('/dtr') }" @click="closeMobile">
              <span class="nav-icon">📊</span>
              <span class="nav-label">DTR</span>
            </RouterLink>

            <RouterLink to="/docs" class="nav-item" :class="{ active: isActive('/docs') || route.path.startsWith('/docs/') }" @click="closeMobile">
              <span class="nav-icon">📄</span>
              <span class="nav-label">Dokumente</span>
            </RouterLink>

            <div class="dropdown-wrapper" @mouseenter="showDropdown" @mouseleave="hideDropdown">
              <button class="nav-item dropdown-toggle" :class="{ active: moduleDropdownOpen || route.path.startsWith('/module/') }" type="button" @click="toggleModuleDropdown">
                <span class="nav-icon">📦</span>
                <span class="nav-label">Module</span>
                <span class="dropdown-arrow" :class="{ open: moduleDropdownOpen }">▼</span>
              </button>
              <Transition name="dropdown">
                <div v-show="moduleDropdownOpen" class="dropdown-menu">
                  <RouterLink
                    v-for="mod in modules"
                    :key="mod.id"
                    :to="`/module/${mod.id}`"
                    class="dropdown-item"
                    :class="{ active: isActive(`/module/${mod.id}`) || route.path.startsWith(`/module/${mod.id}/`) }"
                    @click="closeMobile"
                  >
                    <span class="dropdown-bullet">•</span>
                    <span class="dropdown-item-label">{{ mod.label }}</span>
                  </RouterLink>
                </div>
              </Transition>
            </div>
          </div>

          <div class="nav-divider"></div>

          <div class="nav-section">
            <h3 class="nav-section-title">Werkzeuge</h3>
            <RouterLink to="/budget" class="nav-item" :class="{ active: isActive('/budget') }" @click="closeMobile">
              <span class="nav-icon">💵</span>
              <span class="nav-label">Shop Tracker</span>
            </RouterLink>
            <RouterLink to="/dtr-ebook" class="nav-item" :class="{ active: isActive('/dtr-ebook') }" @click="closeMobile">
              <span class="nav-icon">📚</span>
              <span class="nav-label">DTR eBook</span>
            </RouterLink>

            <RouterLink to="/oe" class="nav-item" :class="{ active: isActive('/oe') }" @click="closeMobile">
              <span class="nav-icon">🛠️</span>
              <span class="nav-label">OE</span>
            </RouterLink>
          </div>
        </nav>
      </aside>

      <!-- Floating Unhide Tab when Sidebar is Collapsed on Desktop -->
      <button
        v-if="isCollapsed"
        class="sidebar-expand-tab"
        @click="toggleCollapse"
        title="Sidebar einblenden"
        type="button"
      >
        <span class="expand-tab-icon">▶</span>
        <span class="expand-tab-label">Menü</span>
      </button>

      <!-- Main Content Area -->
      <main class="content" :class="{ 'expanded': isCollapsed }">
        <RouterView />
      </main>
    </div>

    <!-- Lexikon Search Modal -->
    <Transition name="fade">
      <div v-if="showSearchModal" class="modal-overlay" @click.self="closeSearchModal">
        <div class="modal-container">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <span class="modal-badge">Lexikon</span>
              <span v-if="selectedEntry?.number" class="modal-number-badge">{{ selectedEntry.number }}</span>
              <h3>{{ selectedEntry?.word }}</h3>
            </div>
            <button class="close-modal" @click="closeSearchModal">×</button>
          </div>
          <div class="modal-body">
            <p>{{ selectedEntry?.definition }}</p>
          </div>
          <div class="modal-footer">
            <button class="confirm-button" @click="closeSearchModal">Schließen</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #f8fafc;
  color: #1e293b;
  overflow: hidden;
  font-family: inherit;
}

/* Header */
.app-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 58px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 100;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Sidebar Toggle Buttons */
.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.sidebar-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  transform: translateY(-1px);
}

.toggle-icon {
  width: 18px;
  height: 18px;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  transition: opacity 0.2s;
}

.header-logo:hover {
  opacity: 0.9;
}

.logo-img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
}

.title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  background: linear-gradient(135deg, #a5b4fc 0%, #ffffff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}


/* Header Search */
.header-search {
  flex: 1;
  max-width: 420px;
  margin-left: 2rem;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 0.85rem;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 0.5rem 2rem 0.5rem 2.2rem;
  color: #ffffff;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.12);
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.2);
}

.search-input::placeholder {
  color: #94a3b8;
}

.clear-search {
  position: absolute;
  right: 10px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 0.75rem;
  padding: 2px 4px;
  border-radius: 4px;
}

.clear-search:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.search-results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  z-index: 200;
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  color: #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #334155;
  color: #ffffff;
}

.result-word-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.result-word {
  font-weight: 500;
  font-size: 0.9rem;
}

.result-number-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 1px 5px;
  border-radius: 4px;
}

.result-hint {
  font-size: 0.7rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}

/* App Body & Sidebar */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  background: #0f172a;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              min-width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease,
              transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 10;
}

.sidebar.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  opacity: 0;
  pointer-events: none;
  border-right: none !important;
}

.sidebar-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.15rem 0.5rem 1.15rem;
}

.sidebar-heading {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #64748b;
}

.sidebar-collapse-action {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.sidebar-collapse-action:hover {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.06);
}

.sidebar-nav {
  flex: 1;
  padding: 0.25rem 0.6rem;
}

.nav-section {
  padding: 0.4rem 0;
}

.nav-section-title {
  margin: 0.25rem 0 0.4rem 0.6rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  font-weight: 600;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  margin: 0.15rem 0;
  color: #94a3b8;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.18s ease;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: #f1f5f9;
}

.nav-item.active {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #6366f1;
}

.nav-icon {
  font-size: 1.05rem;
  width: 1.4rem;
  text-align: center;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  color: inherit;
  font-weight: inherit;
}

.nav-count {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  font-weight: 600;
}

.nav-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0.6rem 0.5rem;
}

/* Dropdown */
.dropdown-wrapper {
  position: relative;
}

.dropdown-toggle {
  width: 100%;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
}

.dropdown-arrow {
  margin-left: auto;
  font-size: 0.55rem;
  transition: transform 0.2s ease;
  color: #64748b;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  margin: 0.2rem 0 0.35rem 1.75rem;
  padding-left: 0.5rem;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  margin: 0.1rem 0;
  color: #94a3b8;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.15s ease;
  font-size: 0.82rem;
}

.dropdown-bullet {
  color: #475569;
  font-size: 0.8rem;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
}

.dropdown-item.active {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
  font-weight: 600;
}

.dropdown-item.active .dropdown-bullet {
  color: #818cf8;
}

.dropdown-item-label {
  color: inherit;
}

.sidebar-footer {
  padding: 0.85rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.15);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.footer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.footer-text {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 500;
}

/* Floating Expand Tab */
.sidebar-expand-tab {
  position: absolute;
  top: 12px;
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem 0.45rem 0.55rem;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-left: none;
  border-radius: 0 8px 8px 0;
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.sidebar-expand-tab:hover {
  background: #1e293b;
  color: #818cf8;
  padding-left: 0.75rem;
}

.expand-tab-icon {
  font-size: 0.65rem;
}

/* Content Area */
.content {
  flex: 1;
  overflow-y: auto;
  background-color: #f8fafc;
  color: #1e293b;
  transition: padding 0.2s ease;
  position: relative;
}

/* Mobile Hamburger Button */
.mobile-menu-btn {
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 22px;
  height: 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  flex-shrink: 0;
}

.hamburger-bar {
  width: 100%;
  height: 2px;
  background-color: #ffffff;
  border-radius: 2px;
  transition: all 0.25s ease;
}

.mobile-menu-btn.open .hamburger-bar:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.mobile-menu-btn.open .hamburger-bar:nth-child(2) {
  opacity: 0;
}

.mobile-menu-btn.open .hamburger-bar:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.sidebar-backdrop {
  display: none;
}

/* Search Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: #ffffff;
  border-radius: 14px;
  width: 90%;
  max-width: 520px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  animation: modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid #e2e8f0;
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.modal-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
}

.modal-number-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.15);
  color: #4338ca;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
}

.close-modal {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s;
}

.close-modal:hover {
  color: #0f172a;
  background: #e2e8f0;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0;
  color: #334155;
  line-height: 1.65;
  font-size: 1rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.confirm-button {
  background: #4f46e5;
  border: none;
  color: #ffffff;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-button:hover {
  background: #4338ca;
  transform: translateY(-1px);
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

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Responsive */
@media (max-width: 768px) {
  .mobile-menu-btn {
    display: flex;
  }

  .sidebar-toggle-btn {
    display: none;
  }

  .sidebar-expand-tab {
    display: none;
  }

  .app-header {
    padding: 0 1rem;
    gap: 0.5rem;
  }

  .header-search {
    margin-left: 0;
    max-width: none;
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    top: 58px;
    left: 0;
    width: 100%;
    height: calc(100% - 58px);
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(2px);
    z-index: 998;
  }

  .sidebar {
    position: fixed;
    top: 58px;
    left: 0;
    width: 270px;
    height: calc(100vh - 58px);
    z-index: 999;
    transform: translateX(-100%);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar.collapsed {
    /* on mobile, collapsed doesn't hide slide-over when open */
    width: 270px !important;
    min-width: 270px !important;
  }
}
</style>
