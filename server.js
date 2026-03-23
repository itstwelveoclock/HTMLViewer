const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Config ──────────────────────────────────────────────────────────────────
const PASSWORD = process.env.SITE_PASSWORD || 'changeme123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'prototype-hub-secret-key-change-in-prod';
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || path.join(__dirname);
const DATA_FILE = path.join(PERSISTENT_DIR, 'data', 'prototypes.json');
const UPLOADS_DIR = path.join(PERSISTENT_DIR, 'uploads');

// ── Ensure directories exist ─────────────────────────────────────────────────
[UPLOADS_DIR, path.join(__dirname, 'data')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));

// ── Helpers ──────────────────────────────────────────────────────────────────
function readPrototypes() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writePrototypes(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Multer storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const id = req.prototypeId || generateId();
    req.prototypeId = id;
    cb(null, `${id}.html`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html' || path.extname(file.originalname).toLowerCase() === '.html') {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'));
    }
  }
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Serve uploaded HTML files (only to authenticated users)
app.use('/uploads', (req, res, next) => {
  if (!req.session.authenticated) return res.status(401).send('Unauthorized');
  next();
}, express.static(UPLOADS_DIR));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware for API routes
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// ── Prototype routes ──────────────────────────────────────────────────────────

// GET all prototypes
app.get('/api/prototypes', requireAuth, (req, res) => {
  res.json(readPrototypes());
});

// POST upload new prototype
app.post('/api/prototypes', requireAuth, (req, res, next) => {
  // Generate ID before multer runs so filename matches
  req.prototypeId = generateId();
  next();
}, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { title, description, author, folder } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const prototypes = readPrototypes();
  const entry = {
    id: req.prototypeId,
    title,
    description: description || '',
    author: author || 'Unknown',
    folder: folder || 'Uncategorized',
    filename: req.file.filename,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  prototypes.unshift(entry);
  writePrototypes(prototypes);
  res.json(entry);
});

// PUT update prototype file (new version) or metadata
app.put('/api/prototypes/:id', requireAuth, (req, res, next) => {
  req.prototypeId = req.params.id;
  next();
}, upload.single('file'), (req, res) => {
  const prototypes = readPrototypes();
  const idx = prototypes.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const existing = prototypes[idx];
  const { title, description, author, folder } = req.body;

  // If a new file was uploaded, overwrite the existing one
  if (req.file) {
    const oldPath = path.join(UPLOADS_DIR, existing.filename);
    // multer already wrote to uploads/{id}.html — same filename, so it's replaced
    existing.version = (existing.version || 1) + 1;
  }

  existing.title = title || existing.title;
  existing.description = description !== undefined ? description : existing.description;
  existing.author = author || existing.author;
  existing.folder = folder || existing.folder;
  existing.updatedAt = new Date().toISOString();

  prototypes[idx] = existing;
  writePrototypes(prototypes);
  res.json(existing);
});

// DELETE prototype
app.delete('/api/prototypes/:id', requireAuth, (req, res) => {
  const prototypes = readPrototypes();
  const idx = prototypes.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const [removed] = prototypes.splice(idx, 1);
  const filePath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  writePrototypes(prototypes);
  res.json({ ok: true });
});

// GET list of folders
app.get('/api/folders', requireAuth, (req, res) => {
  const prototypes = readPrototypes();
  const folders = [...new Set(prototypes.map(p => p.folder))].sort();
  res.json(folders);
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Proto running on http://localhost:${PORT}`);
});
