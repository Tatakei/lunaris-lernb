# Willkommen bei Lunaris

Dies ist eine **Beispieldatei**, um zu zeigen, wie Markdown-Dateien in Lunaris gerendert werden.

## Textformatierung

Du kannst *kursiv*, **fett**, und ~~durchgestrichen~~ schreiben. Kombiniere auch **_fett und kursiv_**.

## Listen

### Ungeordnete Liste

- Erster Punkt
- Zweiter Punkt
  - Unterpunkt A
  - Unterpunkt B
- Dritter Punkt

### Nummerierte Liste

1. Schritt eins
2. Schritt zwei
3. Schritt drei

## Code

Inline-Code sieht so aus: `const x = 42;`

```typescript
interface User {
  name: string
  age: number
  role: 'admin' | 'user'
}

const user: User = {
  name: 'Lunaris',
  age: 1,
  role: 'admin',
}
```

## Zitate

> Das Wort "Ladungsträger" kommt aus dem Deutschen.
> Es kann mehrere Zeilen umfassen und sieht mit dem Gradienten-Border gut aus.

## Tabellen

| Feature | Status | Priorität |
|---------|--------|-----------|
| Markdown-Rendering | ✓ Fertig | Hoch |
| Custom Styling | ✓ Fertig | Hoch |
| Dark Theme | ✓ Fertig | Mittel |
| Code-Highlighting | 🚧 In Arbeit | Niedrig |

## Links

Besuche [Vue.js](https://vuejs.org) für mehr Informationen über Vue.

---

## Fazit

Füge einfach neue `.md`-Dateien im `src/assets` Ordner hinzu und importiere sie in einer View!
