<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE } from '@/config'

const stats = ref({
  lexikon: 0,
  documents: 0
})
const isLoading = ref(true)

const fetchStats = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/stats`)
    if (response.ok) {
      stats.value = await response.json()
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchStats)
</script>

<template>
  <div class="home-view">
    <div class="home-header">
      <h1>Übersicht</h1>
      <p class="welcome-text">Willkommen bei Lunaris! Hier ist dein aktueller Lernfortschritt.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon lexikon-icon">📖</div>
        <div class="stat-info">
          <span class="stat-label">Fachbegriffe im Lexikon</span>
          <span v-if="isLoading" class="stat-value loading">...</span>
          <span v-else class="stat-value">{{ stats.lexikon }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon docs-icon">📄</div>
        <div class="stat-info">
          <span class="stat-label">Verfügbare Dokumente</span>
          <span v-if="isLoading" class="stat-value loading">...</span>
          <span v-else class="stat-value">{{ stats.documents }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  padding: 2.5rem;
  max-width: 1000px;
  margin: 0 auto;
}

.home-header {
  margin-bottom: 3rem;
}

.home-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.5rem;
  letter-spacing: -0.025em;
}

.welcome-text {
  color: #64748b;
  font-size: 1.1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 1.75rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
}

.lexikon-icon {
  background-color: rgba(99, 102, 241, 0.1);
}

.docs-icon {
  background-color: rgba(16, 185, 129, 0.1);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #0f172a;
}

.stat-value.loading {
  color: #cbd5e1;
}

@media (max-width: 640px) {
  .home-view {
    padding: 1.5rem;
  }
  
  .home-header {
    margin-bottom: 2rem;
  }
  
  .home-header h1 {
    font-size: 1.75rem;
  }
}
</style>
