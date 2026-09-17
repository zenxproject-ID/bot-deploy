const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const config = require('./config');
const db = require('./database');

const app = express();
const PORT = config.WEB_PORT;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_FILE_SIZE } });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function obfuscateJS(content) {
    return '\n' + content
        .replace(/var\s+(\w+)/g, 'var a$1')
        .replace(/let\s+(\w+)/g, 'let b$1')
        .replace(/const\s+(\w+)/g, 'const c$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function obfuscateHTML(content) {
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Obfuscated</title></head><body>
<script>
(function(){
  try{var s=atob("${b64}");document.open();document.write(s);document.close();}
  catch(e){document.body.innerHTML="<pre>Failed: "+(e.message||e)+"</pre>";}
})();
</script></body></html>`;
}

function checkSecret(req, res, next) {
    const key = req.headers['x-secret-key'] || req.query.key;
    if (key !== config.WEB_SECRET_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
    next();
}

app.get('/api/status', (req, res) => {
    const stats = db.getStats() || {};
    res.json({
        success: true,
        status: 'online',
        total_users: stats.totalUsers || 0,
        total_websites: stats.totalWebsites || 0,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.post('/api/create-website', checkSecret, upload.single('file'), async (req, res) => {
    try {
        const { webName, ownerId, ownerName } = req.body;
        const file = req.file;
        if (!webName || !file) return res.status(400).json({ success: false, error: 'Nama web & file wajib diisi!' });
        if (!file.originalname.endsWith('.html')) return res.status(400).json({ success: false, error: 'File harus .html' });
        const cleanName = webName.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleanName.length < 3) return res.status(400).json({ success: false, error: 'Nama web min 3 karakter' });

        const htmlContent = file.buffer.toString('utf-8');
        const headers = { Authorization: `Bearer ${config.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };

        const check = await fetch(`https://api.vercel.com/v9/projects/${cleanName}`, { headers });
        if (check.status === 200) return res.status(400).json({ success: false, error: `Nama "${cleanName}" sudah dipakai!` });

        const projRes = await fetch('https://api.vercel.com/v9/projects', {
            method: 'POST', headers, body: JSON.stringify({ name: cleanName })
        });
        if (!projRes.ok && projRes.status !== 409) {
            return res.status(400).json({ success: false, error: `Gagal buat project: ${projRes.status}` });
        }

        const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST', headers,
            body: JSON.stringify({
                name: cleanName,
                files: [{ file: 'index.html', data: Buffer.from(htmlContent).toString('base64'), encoding: 'base64' }],
                project: cleanName,
                target: 'production'
            })
        });

        if (!deployRes.ok) {
            const errText = await deployRes.text();
            return res.status(400).json({ success: false, error: `Deploy gagal: ${errText.substring(0, 150)}` });
        }

        const websiteUrl = `https://${cleanName}.vercel.app`;
        db.saveWebsite({
            name: cleanName, url: websiteUrl,
            ownerId: parseInt(ownerId) || 0,
            ownerName: ownerName || 'Web User',
            file_name: file.originalname,
            created_at: new Date().toISOString()
        });

        res.json({ success: true, message: 'Website berhasil dibuat!', url: websiteUrl, name: cleanName });
    } catch (error) {
        console.error('Create website error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/websites', checkSecret, (req, res) => {
    try {
        const list = Object.values(db.getAllWebsites() || {}).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ success: true, websites: list, total: list.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/website/:name', checkSecret, async (req, res) => {
    try {
        const { name } = req.params;
        if (!db.getWebsite(name)) return res.status(404).json({ success: false, error: 'Website tidak ditemukan' });
        const headers = { Authorization: `Bearer ${config.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
        const del = await fetch(`https://api.vercel.com/v9/projects/${name}`, { method: 'DELETE', headers });
        db.deleteWebsite(name);
        res.json({ success: true, message: `Website "${name}" berhasil dihapus`, vercel_status: del.status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/obfuscate/js', checkSecret, upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'File wajib diupload' });
        const out = obfuscateJS(req.file.buffer.toString('utf-8'));
        res.json({ success: true, result: out, filename: req.file.originalname.replace(/\.js$/i, '.obf.js') });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/obfuscate/html', checkSecret, upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'File wajib diupload' });
        const out = obfuscateHTML(req.file.buffer.toString('utf-8'));
        res.json({ success: true, result: out, filename: req.file.originalname.replace(/\.html?$/i, '.obf.html') });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/scrape', checkSecret, async (req, res) => {
    try {
        let { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'URL wajib diisi' });
        if (!url.startsWith('http')) url = 'https://' + url;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/110.0.0.0 Safari/537.36' }
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const html = await response.text();
        res.json({ success: true, html, size: (html.length / 1024).toFixed(2) + ' KB' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[32m🌐 Web Panel running at http://0.0.0.0:${PORT}\x1b[0m`);
});