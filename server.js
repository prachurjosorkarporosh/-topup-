import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Support JSON payloads up to 15MB for gallery uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Dedicated upload directory
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve /uploads statically
app.use('/uploads', express.static(uploadsDir));

// Direct gallery upload API: receives base64 dataURL and saves image file
app.post('/api/upload', (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid base64 image data' });
    }

    const mimeType = matches[1];
    let ext = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';

    const safeName = (filename ? filename.replace(/[^a-zA-Z0-9_-]/g, '') : 'img') + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.' + ext;
    const filePath = path.join(uploadsDir, safeName);

    const buffer = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${safeName}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Routes for individual pages
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/topup', (req, res) => res.sendFile(path.join(__dirname, 'topup.html')));
app.get('/addmoney', (req, res) => res.sendFile(path.join(__dirname, 'addmoney.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, 'history.html')));
app.get('/account', (req, res) => res.sendFile(path.join(__dirname, 'account.html')));
app.get('/tutorial', (req, res) => res.sendFile(path.join(__dirname, 'tutorial.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));

// Serve static files from current directory
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
