module.exports = {
    apps: [{
        name: 'Analysis_Bot',
        script: './production',
        // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
        // args: 'one two',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env_production: {
            NODE_ENV: 'production'
        }
    }],

    deploy: {
        production: {
            user: 'node',
            ref: 'origin/master',
            repo: 'https://github.com/WoodManGitHub/Analysis_Bot.git',
            path: '/var/www/production',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
        }
    }
};
