require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    CHANNEL_USERNAME: process.env.CHANNEL_USERNAME,
    CHANNEL_USERNAME2: process.env.CHANNEL_USERNAME2,
    GROUP_USERNAME: '@ikiipublic',
    DEVELOPER_USERNAME: process.env.DEVELOPER_USERNAME,
    ADMIN_USERS: (process.env.ADMIN_USERS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean),
    MAX_FILE_SIZE: 20 * 1024 * 1024,
    ALLOWED_EXTENSIONS: ['.html'],
    WEB_PORT: process.env.WEB_PORT || 3000,
    WEB_SECRET_KEY: process.env.WEB_SECRET_KEY || 'default-secret',

    MESSAGES: {
        WELCOME: `Selamat datang di Bot Deploy Website! 🚀`,
        NEED_JOIN: `🔒 Akses Dibatasi`
    }
};