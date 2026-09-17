let secretKey = localStorage.getItem('deploy_secret') || '';
let currentFile = null;
let currentObfFile = null;

window.addEventListener('DOMContentLoaded', () => {
    if (secretKey) {
        document.getElementById('secretKey').value = '********';
        refreshStats();
        loadWebsites();
    }
    setInterval(refreshStats, 30000);
    initTabs();
    initFileDrops();
    initRadioPills();
});

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            if (tab.dataset.tab === 'list') loadWebsites();
        });
    });
}

function saveKey() {
    const val = document.getElementById('secretKey').value;
    if (!val || val === '********') return alert('Masukkan secret key!');
    secretKey = val;
    localStorage.setItem('deploy_secret', val);
    document.getElementById('secretKey').value = '********';
    refreshStats();
    loadWebsites();
    alert('✅ Secret key tersimpan!');
}

async function api(url, options = {}) {
    options.headers = { ...(options.headers || {}), 'x-secret-key': secretKey };
    return fetch(url, options);
}

async function refreshStats() {
    try {
        const r = await fetch('/api/status');
        const d = await r.json();
        document.getElementById('statUsers').textContent = d.total_users;
        document.getElementById('statWebsites').textContent = d.total_websites;
        const up = d.uptime || 0;
        const h = Math.floor(up / 3600);
        const m = Math.floor((up % 3600) / 60);
        document.getElementById('statUptime').textContent = `${h}j ${m}m`;
    } catch (e) { console.error(e); }
}

function initFileDrops() {
    setupDrop('fileDrop', 'fileInput', 'fileName', (f) => currentFile = f);
    setupDrop('obfDrop', 'obfInput', 'obfFileName', (f) => currentObfFile = f);
}

function setupDrop(dropId, inputId, labelId, setter) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('dragover');
        const f = e.dataTransfer.files[0];
        if (f) {
            input.files = e.dataTransfer.files;
            setter(f);
            label.textContent = `✅ ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
        }
    });
    input.addEventListener('change', () => {
        const f = input.files[0];
        if (f) {
            setter(f);
            label.textContent = `✅ ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
        }
    });
}

function initRadioPills() {
    document.querySelectorAll('.radio-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.radio-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });
}

async function deployWebsite() {
    if (!secretKey) return alert('Masukkan secret key dulu!');
    const webName = document.getElementById('webName').value.trim();
    const ownerName = document.getElementById('ownerName').value.trim() || 'Web User';
    const resultBox = document.getElementById('deployResult');

    if (!webName) return showResult(resultBox, 'error', '❌ Nama web wajib diisi!');
    if (!currentFile) return showResult(resultBox, 'error', '❌ File HTML wajib diupload!');

    showResult(resultBox, 'success', '⏳ Sedang deploy ke Vercel...');

    try {
        const fd = new FormData();
        fd.append('webName', webName);
        fd.append('ownerName', ownerName);
        fd.append('ownerId', '0');
        fd.append('file', currentFile);

        const r = await api('/api/create-website', { method: 'POST', body: fd });
        const d = await r.json();

        if (d.success) {
            showResult(resultBox, 'success',
                `✅ <strong>Berhasil!</strong><br>🌐 URL: <a href="${d.url}" target="_blank">${d.url}</a><br>📁 Nama: ${d.name}`);
            document.getElementById('webName').value = '';
            currentFile = null;
            document.getElementById('fileName').textContent = 'Klik atau drop file .html di sini';
            loadWebsites();
            refreshStats();
        } else {
            showResult(resultBox, 'error', '❌ ' + d.error);
        }
    } catch (e) {
        showResult(resultBox, 'error', '❌ ' + e.message);
    }
}

function showResult(el, type, html) {
    el.className = 'result-box show ' + type;
    el.innerHTML = html;
}

async function loadWebsites() {
    if (!secretKey) return;
    const list = document.getElementById('websiteList');
    list.innerHTML = '<div class="empty">⏳ Loading...</div>';
    try {
        const r = await api('/api/websites');
        const d = await r.json();
        if (!d.success) throw new Error(d.error);
        if (!d.websites.length) {
            list.innerHTML = '<div class="empty">📭 Belum ada website terdaftar</div>';
            return;
        }
        list.innerHTML = d.websites.map(w => `
            <div class="website-item">
                <div class="website-info">
                    <div class="website-name">📁 ${escapeHtml(w.name)}</div>
                    <a class="website-url" href="${w.url}" target="_blank">${w.url}</a>
                    <div class="website-meta">👤 ${escapeHtml(w.ownerName || 'Unknown')} • 📅 ${new Date(w.created_at).toLocaleDateString('id-ID')}</div>
                </div>
                <div class="website-actions">
                    <a href="${w.url}" target="_blank" class="btn small">🌐 Buka</a>
                    <button class="btn danger" onclick="deleteWeb('${escapeHtml(w.name)}')">🗑️ Hapus</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="empty">❌ ${e.message}</div>`;
    }
}

async function deleteWeb(name) {
    if (!confirm(`Hapus website "${name}"?`)) return;
    try {
        const r = await api('/api/website/' + encodeURIComponent(name), { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { loadWebsites(); refreshStats(); }
        else alert('❌ ' + d.error);
    } catch (e) { alert('❌ ' + e.message); }
}

async function obfuscateFile() {
    if (!secretKey) return alert('Masukkan secret key dulu!');
    const type = document.querySelector('input[name="obfType"]:checked').value;
    const box = document.getElementById('obfResult');
    if (!currentObfFile) return showResult(box, 'error', '❌ Pilih file dulu!');

    showResult(box, 'success', '⏳ Memproses...');

    try {
        const fd = new FormData();
        fd.append('file', currentObfFile);
        const r = await api('/api/obfuscate/' + type, { method: 'POST', body: fd });
        const d = await r.json();
        if (d.success) {
            const blob = new Blob([d.result], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            showResult(box, 'success',
                `✅ <strong>Berhasil!</strong><br>📄 File: <a href="${url}" download="${d.filename}">⬇️ Download ${d.filename}</a>
                 <pre>${escapeHtml(d.result.substring(0, 500))}${d.result.length > 500 ? '...' : ''}</pre>`);
        } else {
            showResult(box, 'error', '❌ ' + d.error);
        }
    } catch (e) {
        showResult(box, 'error', '❌ ' + e.message);
    }
}

async function scrapeUrl() {
    if (!secretKey) return alert('Masukkan secret key dulu!');
    const url = document.getElementById('scrapeUrl').value.trim();
    const box = document.getElementById('scrapeResult');
    if (!url) return showResult(box, 'error', '❌ URL wajib diisi!');

    showResult(box, 'success', '⏳ Mengambil source code...');

    try {
        const r = await api('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const d = await r.json();
        if (d.success) {
            const blob = new Blob([d.html], { type: 'text/html' });
            const linkUrl = URL.createObjectURL(blob);
            showResult(box, 'success',
                `✅ <strong>Berhasil!</strong> (${d.size})<br><a href="${linkUrl}" download="scraped.html">⬇️ Download HTML</a>
                 <pre>${escapeHtml(d.html.substring(0, 500))}${d.html.length > 500 ? '...' : ''}</pre>`);
        } else {
            showResult(box, 'error', '❌ ' + d.error);
        }
    } catch (e) {
        showResult(box, 'error', '❌ ' + e.message);
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.saveKey = saveKey;
window.deployWebsite = deployWebsite;
window.loadWebsites = loadWebsites;
window.deleteWeb = deleteWeb;
window.obfuscateFile = obfuscateFile;
window.scrapeUrl = scrapeUrl;
