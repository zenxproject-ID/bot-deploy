module.exports = {
    apps: [
        {
            name: 'deploy-bot',
            script: './bot.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: { NODE_ENV: 'production' }
        },
        {
            name: 'deploy-web',
            script: './server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: { NODE_ENV: 'production', PORT: 3000 }
        }
    ]
};