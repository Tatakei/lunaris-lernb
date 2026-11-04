<script setup lang="ts">
import { ref } from 'vue'

interface OEItem {
  id: number
  text: string
  checked: boolean
}

const oeItems = ref<OEItem[]>([
  { id: 1, text: 'Arbeitsplatz vorbereiten', checked: false },
  { id: 2, text: 'Werkzeuge kontrollieren', checked: false },
  { id: 3, text: 'Sicherheitsausrüstung anlegen', checked: false },
  { id: 4, text: 'Materialprüfung durchführen', checked: false },
  { id: 5, text: 'Dokumentation bereitstellen', checked: false }
])
</script>

<template>
  <div class="oe-view">
    <div class="oe-header">
      <h2 class="oe-title">OE Checkliste</h2>
      <p class="oe-subtitle">Diese Checkliste wird beim Neuladen der Seite zurückgesetzt.</p>
    </div>

    <div class="oe-container">
      <div v-for="item in oeItems" :key="item.id" class="check-item">
        <label :for="'oe-' + item.id" class="check-label">
          <input 
            type="checkbox" 
            :id="'oe-' + item.id" 
            v-model="item.checked" 
            class="check-input"
          />
          <span class="check-text" :class="{ 'is-checked': item.checked }">
            {{ item.text }}
          </span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oe-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.oe-header {
  margin-bottom: 2rem;
}

.oe-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.oe-subtitle {
  color: #64748b;
  font-size: 0.95rem;
}

.oe-container {
  background: #ffffff;
  border: 2px solid #6366f1; /* Indigo border as a default */
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.check-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.check-item:last-child {
  border-bottom: none;
}

.check-label {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  user-select: none;
}

.check-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #6366f1;
}

.check-text {
  font-size: 1.1rem;
  color: #334155;
  transition: color 0.2s, text-decoration 0.2s;
}

.check-text.is-checked {
  color: #94a3b8;
  text-decoration: line-through;
}

@media (max-width: 640px) {
  .oe-view {
    padding: 1rem;
  }
}
</style>
