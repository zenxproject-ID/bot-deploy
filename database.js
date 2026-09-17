const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

const defaultDatabase = {
    users: {},
    websites: {},
    stats: { totalUsers: 0, totalWebsites: 0, lastBackup: null }
};

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading database:', error);
    }
    return JSON.parse(JSON.stringify(defaultDatabase));
}

function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

const db = {
    saveUser(userId, userData) {
        const d = loadDatabase();
        if (!d.users[userId]) d.stats.totalUsers++;
        d.users[userId] = { ...userData, id: userId, joined_at: new Date().toISOString(), last_active: new Date().toISOString() };
        saveDatabase(d);
    },
    getUser(userId) { return loadDatabase().users[userId] || null; },
    getAllUsers() { return loadDatabase().users; },
    saveWebsite(websiteData) {
        const d = loadDatabase();
        const webName = websiteData.name;
        if (!d.websites[webName]) d.stats.totalWebsites++;
        d.websites[webName] = { ...websiteData, created_at: new Date().toISOString() };
        if (!d.users[websiteData.ownerId]) {
            d.users[websiteData.ownerId] = {
                id: websiteData.ownerId,
                first_name: websiteData.ownerName,
                username: '',
                joined_at: new Date().toISOString(),
                last_active: new Date().toISOString()
            };
        }
        saveDatabase(d);
        return true;
    },
    getWebsite(webName) { return loadDatabase().websites[webName] || null; },
    getAllWebsites() { return loadDatabase().websites; },
    getUserWebsites(userId) {
        const d = loadDatabase();
        const out = [];
        for (const [webName, website] of Object.entries(d.websites)) {
            if (website.ownerId === userId) out.push(webName);
        }
        return out;
    },
    deleteWebsite(webName) {
        const d = loadDatabase();
        if (d.websites[webName]) {
            delete d.websites[webName];
            d.stats.totalWebsites = Math.max(0, d.stats.totalWebsites - 1);
            saveDatabase(d);
            return true;
        }
        return false;
    },
    getStats() { return loadDatabase().stats; },
    updateStats(newStats) {
        const d = loadDatabase();
        d.stats = { ...d.stats, ...newStats };
        saveDatabase(d);
    }
};

if (!fs.existsSync(DB_PATH)) {
    saveDatabase(defaultDatabase);
    console.log('✅ Database initialized');
} else {
    console.log('✅ Database loaded');
}

module.exports = db;