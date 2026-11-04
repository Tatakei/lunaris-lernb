let pdfModulesPromise: Promise<[typeof import('jspdf'), typeof import('jspdf-autotable')]> | null = null

export function preloadPdfModules(): Promise<[typeof import('jspdf'), typeof import('jspdf-autotable')]> {
  if (!pdfModulesPromise) {
    pdfModulesPromise = Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])
  }
  return pdfModulesPromise
}

export async function getPdfModules() {
  return preloadPdfModules()
}

export function idlePreloadPdf() {
  if (typeof window === 'undefined') return
  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(() => {
      preloadPdfModules()
    })
  } else {
    setTimeout(() => {
      preloadPdfModules()
    }, 2000)
  }
}
