<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const moduleId = computed(() => route.params.id as string)

const moduleData: Record<string, { title: string; rows: { label: string; icon: string; path: string }[] }> = {
  r100: {
    title: 'Module 10x',
    rows: [
      { label: '101 — Grundlagen', icon: '📘', path: '/module/r100/101' },
      { label: '102 — Einführung', icon: '📗', path: '/module/r100/102' },
      { label: '103 — Basiswissen', icon: '📙', path: '/module/r100/103' },
    ]
  },
  r200: {
    title: 'Module 20x',
    rows: [
      { label: '201 — Fortgeschritten', icon: '📕', path: '/module/r200/201' },
      { label: '202 — Vertiefung', icon: '📓', path: '/module/r200/202' },
      { label: '203 — Praxis', icon: '📔', path: '/module/r200/203' },
    ]
  },
  r300: {
    title: 'Module 30x',
    rows: [
      { label: '301 — Spezialthemen', icon: '📒', path: '/module/r300/301' },
      { label: '302 — Anwendungen', icon: '📚', path: '/module/r300/302' },
      { label: '303 — Projekte', icon: '📖', path: '/module/r300/303' },
    ]
  },
  r400: {
    title: 'Module 40x',
    rows: [
      { label: '401 — Expertenthemen', icon: '🔬', path: '/module/r400/401' },
      { label: '402 — Forschung', icon: '🔭', path: '/module/r400/402' },
      { label: '403 — Innovation', icon: '💡', path: '/module/r400/403' },
    ]
  },
}

const currentModule = computed(() => moduleData[moduleId.value] || { title: 'Unbekanntes Modul', rows: [] })
</script>

<template>
  <div class="module-view">
    <div class="module-header">
      <div class="header-badge">Modulübersicht</div>
      <h2 class="module-title">{{ currentModule.title }}</h2>
      <p class="module-description">Wählen Sie ein Untermodul aus, um die Lerninhalte zu öffnen oder zu bearbeiten.</p>
    </div>

    <div class="module-rows">
      <RouterLink
        v-for="row in currentModule.rows"
        :key="row.path"
        :to="row.path"
        class="module-row-card"
      >
        <div class="card-left">
          <span class="row-icon">{{ row.icon }}</span>
          <span class="row-label">{{ row.label }}</span>
        </div>
        <span class="row-arrow">→</span>
      </RouterLink>
    </div>

    <div v-if="currentModule.rows.length === 0" class="module-empty">
      <p>Noch keine Einträge vorhanden.</p>
    </div>
  </div>
</template>

<style scoped>
.module-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.module-header {
  margin-bottom: 2rem;
}

.header-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.module-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.5rem 0;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.module-description {
  color: #64748b;
  margin: 0;
  font-size: 0.95rem;
}

.module-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.module-row-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.35rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  text-decoration: none;
  color: #1e293b;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.module-row-card:hover {
  background: #ffffff;
  border-color: #818cf8;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.1);
}

.card-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.row-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
}

.row-label {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
}

.module-row-card:hover .row-label {
  color: #4f46e5;
}

.row-arrow {
  font-size: 1.2rem;
  color: #94a3b8;
  transition: transform 0.2s ease, color 0.2s ease;
}

.module-row-card:hover .row-arrow {
  color: #4f46e5;
  transform: translateX(4px);
}

.module-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .module-view {
    padding: 1rem 0.5rem;
  }

  .module-title {
    font-size: 1.4rem;
  }

  .module-row-card {
    padding: 0.9rem 1.1rem;
  }
}
</style>
