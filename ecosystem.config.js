// Konfiguracja PM2: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "seal-performance",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3210 -H 127.0.0.1",
      interpreter: "node",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
    },
  ],
};
