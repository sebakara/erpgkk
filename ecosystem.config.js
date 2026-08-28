module.exports = {
  apps: [
    {
      name: 'gkkerp-api',
      script: 'dist/main.js',
      cwd: '/var/www/erpgkk/apps/api',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'gkkerp-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      cwd: '/var/www/erpgkk/apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
    },
  ],
};
