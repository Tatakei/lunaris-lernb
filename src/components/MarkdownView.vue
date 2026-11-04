<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { marked } from 'marked'
import { API_BASE } from '@/config'

interface Props {
  markdown: string
  title?: string
}

interface LexikonEntry {
  id: number
  word: string
  definition: string
  number?: string
}

const props = defineProps<Props>()
const entries = ref<LexikonEntry[]>([])
const selectedEntry = ref<LexikonEntry | null>(null)
const overlayPosition = ref({ top: 0, left: 0 })

const fetchEntries = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/lexikon`)
    if (response.ok) {
      const text = await response.text()
      if (text) {
        const data = JSON.parse(text)
        if (Array.isArray(data)) {
          entries.value = data
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch lexikon entries:', err)
  }
}

onMounted(() => {
  fetchEntries()
})

const html = computed(() => {
  let renderedHtml = marked.parse(props.markdown, { async: false }) as string
  
  if (entries.value.length === 0) return renderedHtml

  const sortedEntries = [...entries.value].sort((a, b) => b.word.length - a.word.length)

  // Use a temporary DOM to safely replace text nodes
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${renderedHtml}</div>`, 'text/html')
  const container = doc.body.firstChild as HTMLElement

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || ''
      let hasChange = false
      let newHtml = text
      
      // For each entry, try to find it in the text
      sortedEntries.forEach(entry => {
        const escapedWord = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi')
        
        if (regex.test(newHtml)) {
          newHtml = newHtml.replace(regex, `##LEXIKON_${entry.word}##`)
          hasChange = true
        }
      })

      if (hasChange) {
        sortedEntries.forEach(entry => {
          const marker = `##LEXIKON_${entry.word}##`
          newHtml = newHtml.split(marker).join(`<span class="lexikon-highlight" data-word="${entry.word}">${entry.word}</span>`)
        })
        
        const temp = document.createElement('span')
        temp.innerHTML = newHtml
        
        while (temp.firstChild) {
          node.parentElement?.insertBefore(temp.firstChild, node)
        }
        node.parentElement?.removeChild(node)
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      if (['CODE', 'PRE', 'A', 'BUTTON'].includes(element.tagName)) {
        return
      }
      const children = Array.from(element.childNodes)
      children.forEach(walk)
    }
  }

  walk(container)
  return container.innerHTML
})

const handleContentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target && target.classList.contains('lexikon-highlight')) {
    const word = target.getAttribute('data-word')
    if (word) {
      const entry = entries.value.find(e => e.word.toLowerCase() === word.toLowerCase())
      if (entry) {
        selectedEntry.value = entry
        const rect = target.getBoundingClientRect()
        overlayPosition.value = {
          top: rect.bottom + window.scrollY + 6,
          left: Math.min(Math.max(rect.left + window.scrollX, 10), window.innerWidth - 320)
        }
      }
    }
  }
}

const closeOverlay = () => {
  selectedEntry.value = null
}
</script>

<template>
  <div class="markdown-page">
    <h1 v-if="title" class="markdown-title">{{ title }}</h1>
    <div 
      class="markdown-body" 
      v-html="html"
      @click="handleContentClick"
    ></div>

    <!-- Lexikon Overlay / Popover -->
    <Teleport to="body">
      <div v-if="selectedEntry" class="lexikon-overlay-backdrop" @click="closeOverlay">
        <div 
          class="lexikon-overlay" 
          :style="{ top: overlayPosition.top + 'px', left: overlayPosition.left + 'px' }"
          @click.stop
        >
          <div class="overlay-header">
            <div class="overlay-title-group">
              <h3>{{ selectedEntry.word }}</h3>
              <span v-if="selectedEntry.number" class="overlay-number-badge">{{ selectedEntry.number }}</span>
            </div>
            <button @click="closeOverlay" class="close-btn" aria-label="Schließen">&times;</button>
          </div>
          <div class="overlay-body">
            {{ selectedEntry.definition }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.markdown-page {
  padding: 2rem;
  max-width: 860px;
}

.markdown-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 1.5rem 0;
  background: linear-gradient(135deg, #000000 0%, #00f0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Overlay Styles */
.lexikon-overlay-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.lexikon-overlay {
  position: absolute;
  background: #1e2746;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  max-width: 300px;
  color: #e0e0e0;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 0.5rem;
  gap: 0.5rem;
}

.overlay-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.overlay-number-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
}

.overlay-header h3 {
  margin: 0;
  font-size: 1.1rem;
  background: linear-gradient(135deg, #fcb9f8 0%, #433af2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.close-btn {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: #ffffff;
}

.overlay-body {
  font-size: 0.95rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .markdown-page {
    padding: 1rem 0.5rem;
  }

  .markdown-title {
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }

  .lexikon-overlay-backdrop {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
  }

  .lexikon-overlay {
    position: static !important;
    max-width: 90% !important;
    width: 100%;
    margin: auto;
  }
}
</style>

<style>
/* Deep styles for rendered markdown content (not scoped) */
.markdown-body {
  color: #1a1a1a;
  line-height: 1.7;
  font-size: 1rem;
}

.lexikon-highlight {
  color: #fcb9f8;
  font-weight: 600;
  text-decoration: underline dotted #433af2;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0 2px;
  border-radius: 4px;
}

.lexikon-highlight:hover {
  background: rgba(67, 58, 242, 0.2);
  color: #ffffff;
  text-decoration: underline solid #fcb9f8;
}

.markdown-body h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem 0;
  background: linear-gradient(135deg, #fcb9f8 0%, #433af2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.markdown-body h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem 0;
  background: linear-gradient(135deg, #fe5697 0%, #021659 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.markdown-body h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem 0;
  color: #333333;
}

.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
  color: #444444;
}

.markdown-body p {
  margin: 0.75rem 0;
}

.markdown-body a {
  color: #fcb9f8;
  text-decoration: none;
  transition: color 0.2s ease;
}

.markdown-body a:hover {
  color: #433af2;
  text-decoration: underline;
}

.markdown-body strong {
  color: #000000;
  font-weight: 600;
}

.markdown-body em {
  color: #2c3e50;
  font-style: italic;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 1.5rem;
  margin: 0.75rem 0;
}

.markdown-body li {
  margin: 0.35rem 0;
}

.markdown-body li::marker {
  color: #fcb9f8;
}

.markdown-body code {
  background: #1e2746;
  color: #fcb9f8;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.markdown-body pre {
  background: #1e2746;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-body pre code {
  background: none;
  padding: 0;
  color: #c0c0c0;
  font-size: 0.9rem;
  line-height: 1.6;
}

.markdown-body blockquote {
  border-left: 3px solid;
  border-image: linear-gradient(135deg, #433af2, #fcb9f8) 1;
  margin: 1rem 0;
  padding: 0.5rem 0 0.5rem 1rem;
  color: #4b5563;
  font-style: italic;
}

.markdown-body hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
  margin: 2rem 0;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.markdown-body th {
  color: #ffffff;
  font-weight: 600;
  text-align: left;
  padding: 0.75rem 1rem;
}

.markdown-body thead tr {
  background: linear-gradient(135deg, #fcb9f8 0%, #433af2 100%);
}

.markdown-body td {
  padding: 0.6rem 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  color: #374151;
}

.markdown-body tr:hover td {
  background: rgba(0, 0, 0, 0.02);
}

.markdown-body img {
  max-width: 100%;
  border-radius: 8px;
  margin: 1rem 0;
}

@media (max-width: 768px) {
  .markdown-body {
    font-size: 0.95rem;
    word-break: break-word;
  }

  .markdown-body h1 {
    font-size: 1.4rem;
    margin: 1.25rem 0 0.75rem 0;
  }

  .markdown-body h2 {
    font-size: 1.2rem;
    margin: 1.25rem 0 0.5rem 0;
  }

  .markdown-body h3 {
    font-size: 1.05rem;
  }

  .markdown-body pre {
    padding: 0.75rem;
    font-size: 0.85rem;
    border-radius: 6px;
  }

  .markdown-body table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
  }

  .markdown-body th,
  .markdown-body td {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }
}
</style>
