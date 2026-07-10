module.exports = {
  apps: [
    {
      name: 'eventhub-api',
      script: 'dist/main.js',
      cwd: './apps/api',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
    },
    {
      name: 'eventhub-worker',
      script: 'dist/main.js',
      cwd: './apps/worker',
      instances: 1, // BullMQ worker running in single instance to keep queue processing predictable
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
    },
  ],
};
