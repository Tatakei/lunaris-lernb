<script setup lang="ts">
import { ref } from 'vue'

// Import the PDF from assets
import pdfUrl from '@/assets/F_Distribution EFZ 2022.pdf'

const isLoading = ref(true)

const onLoaded = () => {
  isLoading.value = false
}
</script>

<template>
  <div class="ebook-container">
    <div class="ebook-header">
      <h1>DTR eBook</h1>
      <p>F_Distribution EFZ 2022</p>
    </div>

    <div class="pdf-viewer-wrapper">
      <div v-if="isLoading" class="loading-overlay">
        <div class="spinner"></div>
        <p>PDF wird geladen...</p>
      </div>
      
      <iframe 
        :src="pdfUrl" 
        class="pdf-viewer" 
        @load="onLoaded"
        frameborder="0"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.ebook-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px); /* Adjust based on header height */
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.ebook-header {
  margin-bottom: 1.5rem;
}

.ebook-header h1 {
  font-size: 1.875rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.ebook-header p {
  color: #64748b;
  font-size: 1rem;
}

.pdf-viewer-wrapper {
  flex-grow: 1;
  position: relative;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .ebook-container {
    padding: 1rem;
    height: calc(100vh - 60px);
  }
}
</style>
