/**
 * PM2 ecosystem — APEX Workspace on Hostinger KVM 2
 *
 * Usage (on VPS, as app user, from repo root /var/www/apex):
 *   pm2 start apps/api/deploy/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # follow the printed sudo command once
 *
 * Apps listen on localhost; Nginx terminates TLS and reverse-proxies.
 * Do not open ports 3000/4000 in the firewall.
 */
module.exports = {
  apps: [
    {
      name: "apex-api",
      cwd: "/var/www/apex/apps/api",
      script: "src/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        API_PORT: "4000",
      },
      // Secrets live in apps/api/.env (loaded by src/config/env.js).
      error_file: "/var/log/apex/api-error.log",
      out_file: "/var/log/apex/api-out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "apex-web",
      cwd: "/var/www/apex/apps/web",
      // Use npm so workspace-hoisted `next` resolves correctly.
      script: "npm",
      args: "run start -- --hostname 127.0.0.1 --port 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/apex/web-error.log",
      out_file: "/var/log/apex/web-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
