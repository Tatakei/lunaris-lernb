import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, basename, extname } from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_DIR = resolve(__dirname, '..', 'src', 'assets', 'docs');
const MODULES_DIR = resolve(__dirname, '..', 'src', 'assets', 'modules');
const DIST_DIR = resolve(__dirname, '..', 'dist');
const UPLOADS_DIR = resolve(__dirname, '..', 'public', 'uploads');

// Ensure directories exist
fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.mkdirSync(MODULES_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function getCategoryDir(category) {
  if (category === 'docs') return DOCS_DIR;
  if (category === 'modules') return MODULES_DIR;
  return null;
}

function sanitizeSafeFilename(rawFilename) {
  if (!rawFilename || typeof rawFilename !== 'string') return null;
  const base = basename(rawFilename).replace(/\.md$/i, '').trim();
  const clean = base.replace(/[^\p{L}\p{N}_\-\.]/gu, '_').replace(/_+/g, '_').trim();
  if (!clean || clean === '.' || clean === '..') return null;
  return clean + '.md';
}

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + extname(file.originalname));
  }
});
const upload = multer({ storage });

const app = express();
const port = process.env.PORT || 3001;

app.get('/api/stats', async (req, res) => {
  try {
    const lexikonCount = db.prepare('SELECT COUNT(*) as count FROM lexikon').get().count;
    let dtrNotesCount = 0;
    try {
      dtrNotesCount = db.prepare('SELECT COUNT(*) as count FROM dtr_notes').get().count;
    } catch {}
    
    const countMdFiles = async (dir) => {
      if (!fs.existsSync(dir)) return 0;
      const files = await fsp.readdir(dir);
      return files.filter(file => file.toLowerCase().endsWith('.md')).length;
    };

    const docsCount = await countMdFiles(DOCS_DIR);
    const modulesCount = await countMdFiles(MODULES_DIR);
    
    res.json({
      lexikon: lexikonCount,
      documents: docsCount + modulesCount,
      dtrNotes: dtrNotesCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(cors());
app.use(express.json());

// Helper to format number as M{number}
function formatLexikonNumber(rawNumber) {
  if (rawNumber === undefined || rawNumber === null) return '';
  const str = String(rawNumber).trim();
  if (!str) return '';
  const cleaned = str.replace(/^m/i, '').trim();
  return cleaned ? `M${cleaned}` : '';
}

// Initialize table
const db = new Database(join(__dirname, 'lexikon.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS lexikon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE NOT NULL,
    definition TEXT NOT NULL,
    number TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'CHF',
    image TEXT,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    category TEXT DEFAULT 'Allgemein',
    bought INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dtr_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    points REAL,
    max_points REAL,
    grade REAL NOT NULL,
    weight REAL DEFAULT 1.0,
    date TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration to ensure 'number' column exists in existing tables
try {
  const tableInfo = db.prepare('PRAGMA table_info(lexikon)').all();
  const hasNumber = tableInfo.some(col => col.name === 'number');
  if (!hasNumber) {
    db.exec("ALTER TABLE lexikon ADD COLUMN number TEXT DEFAULT ''");
  }
  const hasTags = tableInfo.some(col => col.name === 'tags');
  if (!hasTags) {
    db.exec("ALTER TABLE lexikon ADD COLUMN tags TEXT DEFAULT ''");
  }
  const hasImage = tableInfo.some(col => col.name === 'image');
  if (!hasImage) {
    db.exec("ALTER TABLE lexikon ADD COLUMN image TEXT");
  }
} catch (err) {
  console.error('Error migrating lexikon table schema:', err);
}

// Seed some initial data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM lexikon').get().count;
if (count === 0) {
  const insert = db.prepare('INSERT INTO lexikon (word, definition, number) VALUES (?, ?, ?)');
  insert.run('Astro-Navigation', 'Die Kunst der Orientierung anhand von Sternkonstellationen im interstellaren Raum.', 'M101');
  insert.run('Baryonische Materie', 'Die sichtbare Materie im Universum, bestehend aus Protonen und Neutronen.', 'M101');
  insert.run('Cryo-Schlaf', 'Ein Zustand künstlich herbeigeführten Winterschlafs für Langzeit-Raumflüge.', 'M102');
  insert.run('Dunkle Energie', 'Eine hypothetische Form von Energie, die für die beschleunigte Expansion des Universums verantwortlich gemacht wird.', 'M103');
  insert.run('Event-Horizont', 'Die Grenze um ein Schwarzes Loch, hinter der kein Licht entkommen kann.', 'M103');
}

// Routes
app.get('/api/lexikon', (req, res) => {
  try {
    const entries = db.prepare('SELECT * FROM lexikon ORDER BY word ASC').all();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lexikon', (req, res) => {
  const { word, definition, number, tags, image, overwrite } = req.body;
  
  if (!word || !definition) {
    return res.status(400).json({ error: 'Word and definition are required' });
  }

  const formattedNumber = formatLexikonNumber(number);
  const tagsString = tags || '';
  const imagePath = image || null;

  try {
    const existing = db.prepare('SELECT * FROM lexikon WHERE word = ?').get(word);

    if (existing && !overwrite) {
      return res.status(409).json({ error: 'Word already exists', existing: true });
    }

    if (existing && overwrite) {
      db.prepare('UPDATE lexikon SET definition = ?, number = ?, tags = ?, image = ? WHERE word = ?').run(definition, formattedNumber, tagsString, imagePath, word);
      return res.json({ message: 'Word updated', word, number: formattedNumber, tags: tagsString, image: imagePath });
    }

    db.prepare('INSERT INTO lexikon (word, definition, number, tags, image) VALUES (?, ?, ?, ?, ?)').run(word, definition, formattedNumber, tagsString, imagePath);
    res.status(201).json({ message: 'Word added', word, number: formattedNumber, tags: tagsString, image: imagePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filePath = `/uploads/${req.file.filename}`;
  res.json({ url: filePath });
});

app.delete('/api/lexikon/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM lexikon WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ message: 'Entry deleted', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lexikon/:id', (req, res) => {
  const { id } = req.params;
  const { word, definition, number, tags, image } = req.body;

  if (!word || !definition) {
    return res.status(400).json({ error: 'Word and definition are required' });
  }

  const formattedNumber = formatLexikonNumber(number);
  const tagsString = tags || '';
  const imagePath = image || null;

  try {
    const existingWord = db.prepare('SELECT * FROM lexikon WHERE word = ? AND id != ?').get(word, id);
    if (existingWord) {
      return res.status(409).json({ error: 'Word already exists', existing: true });
    }

    const result = db.prepare('UPDATE lexikon SET word = ?, definition = ?, number = ?, tags = ?, image = ? WHERE id = ?').run(word, definition, formattedNumber, tagsString, imagePath, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ message: 'Entry updated', id, number: formattedNumber, tags: tagsString, image: imagePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for scraping product metadata
function parseProductHtml(html, targetUrl) {
  let name = '';
  let price = 0;
  let currency = 'CHF';
  let image = '';
  let description = '';

  // 1. JSON-LD parsing
  const jsonLdMatches = [...html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of jsonLdMatches) {
    try {
      const rawText = match[1].trim();
      if (!rawText) continue;
      const parsed = JSON.parse(rawText);
      const findProduct = (obj) => {
        if (!obj) return null;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const p = findProduct(item);
            if (p) return p;
          }
          return null;
        }
        if (obj['@type'] === 'Product' || (typeof obj['@type'] === 'string' && obj['@type'].includes('Product'))) {
          return obj;
        }
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          return findProduct(obj['@graph']);
        }
        return null;
      };

      const product = findProduct(parsed);
      if (product) {
        if (product.name && !name) name = String(product.name).trim();
        if (product.image && !image) {
          if (typeof product.image === 'string') {
            image = product.image;
          } else if (Array.isArray(product.image) && product.image.length > 0) {
            image = typeof product.image[0] === 'string' ? product.image[0] : (product.image[0]?.url || '');
          } else if (typeof product.image === 'object' && product.image.url) {
            image = product.image.url;
          }
        }
        if (product.description && !description) description = String(product.description).trim();
        if (product.offers) {
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          if (offer) {
            if (offer.price !== undefined) {
              const num = parseFloat(String(offer.price).replace(/[^0-9.]/g, ''));
              if (!isNaN(num)) price = num;
            } else if (offer.lowPrice !== undefined) {
              const num = parseFloat(String(offer.lowPrice).replace(/[^0-9.]/g, ''));
              if (!isNaN(num)) price = num;
            }
            if (offer.priceCurrency) currency = String(offer.priceCurrency).trim();
          }
        }
      }
    } catch (e) {
      // Ignore JSON-LD parse errors for malformed script tags
    }
  }

  // 2. OpenGraph / Twitter / Meta Fallbacks
  if (!name) {
    const ogTitle = html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:title|twitter:title)["']/i)
      || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (ogTitle) name = ogTitle[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
  }

  if (!image) {
    const ogImage = html.match(/<meta\s+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["']/i);
    if (ogImage) image = ogImage[1].trim();
  }

  if (!price) {
    const ogPrice = html.match(/<meta\s+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/i)
      || html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/itemprop=["']price["'][^>]*>([\s\S]*?)<\//i);
    if (ogPrice) {
      const matchText = ogPrice[1].replace(/<[^>]+>/g, '');
      const parsed = parseFloat(matchText.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) price = parsed;
    }
  }

  if (!description) {
    const ogDesc = html.match(/<meta\s+(?:property|name)=["'](?:og:description|description|twitter:description)["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:description|description|twitter:description)["']/i);
    if (ogDesc) description = ogDesc[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
  }

  // Ensure absolute image URL if relative
  if (image && targetUrl) {
    try {
      image = new URL(image, targetUrl).href;
    } catch (e) {}
  }

  return {
    name: name || 'Unbenanntes Produkt',
    price: price || 0,
    currency: currency || 'CHF',
    image: image || '',
    description: description || '',
    url: targetUrl
  };
}

// Budget routes
app.post('/api/budget/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL ist erforderlich' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Konnte die Webseite nicht abrufen (${response.statusText})` });
    }

    const html = await response.text();
    const productData = parseProductHtml(html, url);
    res.json(productData);
  } catch (err) {
    res.status(500).json({ error: `Fehler beim Abrufen der URL: ${err.message}` });
  }
});

app.get('/api/budget', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM budget_items ORDER BY id DESC').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budget', (req, res) => {
  const { url, name, price, currency, image, description, quantity, category, bought } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO budget_items (url, name, price, currency, image, description, quantity, category, bought)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      url || '',
      name,
      Number(price) || 0,
      currency || 'CHF',
      image || '',
      description || '',
      Number(quantity) || 1,
      category || 'Allgemein',
      bought ? 1 : 0
    );
    const created = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/budget/:id', (req, res) => {
  const { id } = req.params;
  const { url, name, price, currency, image, description, quantity, category, bought } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    db.prepare(`
      UPDATE budget_items
      SET url = ?, name = ?, price = ?, currency = ?, image = ?, description = ?, quantity = ?, category = ?, bought = ?
      WHERE id = ?
    `).run(
      url !== undefined ? url : existing.url,
      name !== undefined ? name : existing.name,
      price !== undefined ? Number(price) : existing.price,
      currency !== undefined ? currency : existing.currency,
      image !== undefined ? image : existing.image,
      description !== undefined ? description : existing.description,
      quantity !== undefined ? Number(quantity) : existing.quantity,
      category !== undefined ? category : existing.category,
      bought !== undefined ? (bought ? 1 : 0) : existing.bought,
      id
    );

    const updated = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/budget/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM budget_items WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }
    res.json({ message: 'Eintrag gelöscht', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for Swiss grade calculation: Note = (Punkte / MaxPunkte) * 5 + 1
function calculateSwissGrade(points, maxPoints) {
  if (points === undefined || points === null || maxPoints === undefined || maxPoints === null) {
    return null;
  }
  const pts = Number(points);
  const max = Number(maxPoints);
  if (isNaN(pts) || isNaN(max) || max <= 0) {
    return null;
  }
  const calculated = (pts / max) * 5 + 1;
  const clamped = Math.max(1, Math.min(6, calculated));
  return Math.round(clamped * 100) / 100;
}

// DTR Notes API routes
app.get('/api/dtr/notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM dtr_notes ORDER BY date DESC, id DESC').all();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dtr/notes', (req, res) => {
  const { title, points, max_points, grade, weight, date, comment } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Titel ist erforderlich' });
  }

  let finalGrade = grade !== undefined && grade !== null && grade !== '' ? Number(grade) : null;
  const numPoints = points !== undefined && points !== null && points !== '' ? Number(points) : null;
  const numMaxPoints = max_points !== undefined && max_points !== null && max_points !== '' ? Number(max_points) : null;

  if (numPoints !== null && numMaxPoints !== null && numMaxPoints > 0) {
    finalGrade = calculateSwissGrade(numPoints, numMaxPoints);
  }

  if (finalGrade === null || isNaN(finalGrade)) {
    return res.status(400).json({ error: 'Gültige Note oder Punkte/Maximalpunkte erforderlich' });
  }

  const numWeight = weight !== undefined && weight !== null && weight !== '' ? Number(weight) : 1.0;
  const dateStr = date || new Date().toISOString().split('T')[0];
  const commentStr = comment || '';

  try {
    const insert = db.prepare(`
      INSERT INTO dtr_notes (title, points, max_points, grade, weight, date, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(String(title).trim(), numPoints, numMaxPoints, finalGrade, numWeight, dateStr, commentStr);
    const newNote = db.prepare('SELECT * FROM dtr_notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dtr/notes/:id', (req, res) => {
  const { id } = req.params;
  const { title, points, max_points, grade, weight, date, comment } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Titel ist erforderlich' });
  }

  let finalGrade = grade !== undefined && grade !== null && grade !== '' ? Number(grade) : null;
  const numPoints = points !== undefined && points !== null && points !== '' ? Number(points) : null;
  const numMaxPoints = max_points !== undefined && max_points !== null && max_points !== '' ? Number(max_points) : null;

  if (numPoints !== null && numMaxPoints !== null && numMaxPoints > 0) {
    finalGrade = calculateSwissGrade(numPoints, numMaxPoints);
  }

  if (finalGrade === null || isNaN(finalGrade)) {
    return res.status(400).json({ error: 'Gültige Note oder Punkte/Maximalpunkte erforderlich' });
  }

  const numWeight = weight !== undefined && weight !== null && weight !== '' ? Number(weight) : 1.0;
  const dateStr = date || new Date().toISOString().split('T')[0];
  const commentStr = comment || '';

  try {
    const update = db.prepare(`
      UPDATE dtr_notes
      SET title = ?, points = ?, max_points = ?, grade = ?, weight = ?, date = ?, comment = ?
      WHERE id = ?
    `);
    const result = update.run(String(title).trim(), numPoints, numMaxPoints, finalGrade, numWeight, dateStr, commentStr, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note nicht gefunden' });
    }
    const updatedNote = db.prepare('SELECT * FROM dtr_notes WHERE id = ?').get(id);
    res.json(updatedNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dtr/notes/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM dtr_notes WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note nicht gefunden' });
    }
    res.json({ message: 'Note gelöscht', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Markdown API routes
app.get('/api/markdown', async (req, res) => {
  try {
    const listFiles = async (dir, category) => {
      if (!fs.existsSync(dir)) return [];
      const files = await fsp.readdir(dir);
      const results = [];
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = join(dir, file);
        const stat = await fsp.stat(filePath);
        const name = file.replace(/\.md$/, '');
        results.push({
          category,
          name,
          filename: file,
          path: `${category}/${name}`,
          title: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
          updatedAt: stat.mtime,
          size: stat.size
        });
      }
      return results;
    };

    const docs = await listFiles(DOCS_DIR, 'docs');
    const modules = await listFiles(MODULES_DIR, 'modules');
    res.json({ docs, modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/markdown/:category', async (req, res) => {
  const { category } = req.params;
  const dir = getCategoryDir(category);
  if (!dir) {
    return res.status(400).json({ error: 'Ungültige Kategorie. Erlaubt: docs, modules' });
  }

  try {
    if (!fs.existsSync(dir)) {
      return res.json([]);
    }
    const files = await fsp.readdir(dir);
    const results = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = join(dir, file);
      const stat = await fsp.stat(filePath);
      const name = file.replace(/\.md$/, '');
      results.push({
        category,
        name,
        filename: file,
        path: name,
        title: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
        updatedAt: stat.mtime,
        size: stat.size
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/markdown/:category/:filename', async (req, res) => {
  const { category, filename } = req.params;
  const dir = getCategoryDir(category);
  if (!dir) {
    return res.status(400).json({ error: 'Ungültige Kategorie' });
  }

  const safeFile = sanitizeSafeFilename(filename);
  if (!safeFile) {
    return res.status(400).json({ error: 'Ungültiger Dateiname' });
  }

  const filePath = join(dir, safeFile);
  if (!filePath.startsWith(dir)) {
    return res.status(400).json({ error: 'Ungültiger Dateipfad' });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    const content = await fsp.readFile(filePath, 'utf-8');
    const stat = await fsp.stat(filePath);
    const name = safeFile.replace(/\.md$/, '');

    res.json({
      success: true,
      category,
      filename: safeFile,
      name,
      title: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
      content,
      updatedAt: stat.mtime,
      size: stat.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/markdown/:category/:filename', async (req, res) => {
  const { category, filename } = req.params;
  const { content } = req.body;

  if (content === undefined || content === null) {
    return res.status(400).json({ error: 'Inhalt ist erforderlich' });
  }

  const dir = getCategoryDir(category);
  if (!dir) {
    return res.status(400).json({ error: 'Ungültige Kategorie' });
  }

  const safeFile = sanitizeSafeFilename(filename);
  if (!safeFile) {
    return res.status(400).json({ error: 'Ungültiger Dateiname' });
  }

  const filePath = join(dir, safeFile);
  if (!filePath.startsWith(dir)) {
    return res.status(400).json({ error: 'Ungültiger Dateipfad' });
  }

  try {
    await fsp.writeFile(filePath, String(content), 'utf-8');
    const stat = await fsp.stat(filePath);
    const name = safeFile.replace(/\.md$/, '');

    res.json({
      success: true,
      message: 'Datei erfolgreich gespeichert',
      category,
      filename: safeFile,
      name,
      title: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
      content: String(content),
      updatedAt: stat.mtime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/markdown/:category', async (req, res) => {
  const { category } = req.params;
  const { filename, content = '', overwrite = false } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'Dateiname ist erforderlich' });
  }

  const dir = getCategoryDir(category);
  if (!dir) {
    return res.status(400).json({ error: 'Ungültige Kategorie' });
  }

  const safeFile = sanitizeSafeFilename(filename);
  if (!safeFile) {
    return res.status(400).json({ error: 'Ungültiger Dateiname' });
  }

  const filePath = join(dir, safeFile);
  if (!filePath.startsWith(dir)) {
    return res.status(400).json({ error: 'Ungültiger Dateipfad' });
  }

  try {
    const exists = fs.existsSync(filePath);
    if (exists && !overwrite) {
      return res.status(409).json({ error: 'Datei existiert bereits', existing: true, filename: safeFile });
    }

    await fsp.writeFile(filePath, String(content), 'utf-8');
    const stat = await fsp.stat(filePath);
    const name = safeFile.replace(/\.md$/, '');

    res.status(201).json({
      success: true,
      message: 'Datei erfolgreich erstellt',
      category,
      filename: safeFile,
      name,
      title: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
      content: String(content),
      updatedAt: stat.mtime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/markdown/:category/:filename', async (req, res) => {
  const { category, filename } = req.params;
  const dir = getCategoryDir(category);
  if (!dir) {
    return res.status(400).json({ error: 'Ungültige Kategorie' });
  }

  const safeFile = sanitizeSafeFilename(filename);
  if (!safeFile) {
    return res.status(400).json({ error: 'Ungültiger Dateiname' });
  }

  const filePath = join(dir, safeFile);
  if (!filePath.startsWith(dir)) {
    return res.status(400).json({ error: 'Ungültiger Dateipfad' });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    await fsp.unlink(filePath);
    res.json({ success: true, message: 'Datei erfolgreich gelöscht', filename: safeFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve production static assets from dist/ if it exists
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    }
  }));

  // SPA fallback for all non-API GET requests
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.sendFile(indexPath);
    }
    next();
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://127.0.0.1:${port}`);
});
