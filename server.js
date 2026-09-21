import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

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
