import { ref } from 'vue'

const isCollapsed = ref<boolean>(false)
const mobileOpen = ref<boolean>(false)
let savedStateBeforeEdit: boolean | null = null

// Restore saved preference from localStorage
try {
  const saved = localStorage.getItem('lunaris_sidebar_collapsed')
  if (saved !== null) {
    isCollapsed.value = saved === 'true'
  }
} catch {
  // Ignore localStorage errors
}

export function useSidebar() {
  const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
    try {
      localStorage.setItem('lunaris_sidebar_collapsed', String(isCollapsed.value))
    } catch {}
  }

  const collapse = () => {
    isCollapsed.value = true
    try {
      localStorage.setItem('lunaris_sidebar_collapsed', 'true')
    } catch {}
  }

  const expand = () => {
    isCollapsed.value = false
    try {
      localStorage.setItem('lunaris_sidebar_collapsed', 'false')
    } catch {}
  }

  const toggleMobile = () => {
    mobileOpen.value = !mobileOpen.value
  }

  const closeMobile = () => {
    mobileOpen.value = false
  }

  const openMobile = () => {
    mobileOpen.value = true
  }

  /**
   * Called when entering Markdown edit mode:
   * Saves current collapse state and auto-collapses sidebar.
   */
  const onStartEditing = () => {
    if (savedStateBeforeEdit === null) {
      savedStateBeforeEdit = isCollapsed.value
    }
    collapse()
    closeMobile()
  }

  /**
   * Called when exiting Markdown edit mode:
   * Restores the sidebar state from before editing began.
   */
  const onStopEditing = () => {
    if (savedStateBeforeEdit !== null) {
      if (!savedStateBeforeEdit) {
        expand()
      }
      savedStateBeforeEdit = null
    }
  }

  return {
    isCollapsed,
    mobileOpen,
    toggleCollapse,
    collapse,
    expand,
    toggleMobile,
    closeMobile,
    openMobile,
    onStartEditing,
    onStopEditing
  }
}
