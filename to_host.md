All done. Here's a summary of what was created/modified:

  Modified:
  - client/src/hooks/useSocket.ts — fallback URL changed from http://${hostname}:3000 to window.location.origin

  Created:
  - server/Dockerfile — multi-stage build using npm (avoids yarn/CodeArtifact issues)
  - server/.dockerignore
  - client/Dockerfile — multi-stage: Vite build → nginx
  - client/.dockerignore
  - nginx.conf — SPA routing + Socket.IO WebSocket proxy to server:3000
  - docker-compose.yml — 3 services: redis, server (internal), client (port 8080)
  - .env.example — CLIENT_URL and REDIS_PASSWORD

  To deploy on your server:
  git pull
  cp .env.example .env   # set CLIENT_URL=https://your-domain.com
  docker compose up -d --build

  Then set up host nginx (one-time) with the reference config from the plan, run certbot, and you're live.

❯ I will do the host with the help of another claude agent, so give me some documentation to give it to him about the             
  deployment so we can heaadstart and integrate in what i have on the server                                                      
                                                                                                                                  
⏺ Let me check a couple of things to make the doc accurate.                                                                       
                                                                                                                                  
⏺ Searched for 1 pattern, read 2 files (ctrl+o to expand)                                                                         
                                                                                                                                  
⏺ Now I have everything I need. Here's the deployment brief for the other agent:
                                                                                                                                  
  ---                                                                                                                             
  Deployment Brief: table-rummikub                                                                                                
                                                                                                                                  
  What the repo contains (already done)                                                                                           
                                                                                                                                  
  The repo is deploy-ready. Everything Docker-related is committed:

  docker-compose.yml          # orchestrates 3 services
  nginx.conf                  # SPA routing + Socket.IO proxy
  server/Dockerfile           # multi-stage Node build
  client/Dockerfile           # multi-stage Vite build → nginx
  .env.example                # template

  Architecture

  Internet → DNS → static IP
    → host nginx :443 (SSL) → localhost:8080
      → Docker nginx :8080
          /              → client static files (React SPA)
          /socket.io/    → proxy → server:3000 (Docker-internal)
      → Docker server :3000 (internal only)
      → Docker redis  :6379 (internal only)

  Only port 8080 is exposed from Docker to the host. SSL is handled entirely by the host-level nginx.

  Environment variables

  The server reads these at runtime:

  ┌────────────────┬───────────────────────────────────┬───────────────────────────┐
  │    Variable    │              Purpose              │          Default          │
  ├────────────────┼───────────────────────────────────┼───────────────────────────┤
  │ CLIENT_URL     │ CORS allowed origin for Socket.IO │ REQUIRED — no default     │
  ├────────────────┼───────────────────────────────────┼───────────────────────────┤
  │ REDIS_HOST     │ Redis hostname                    │ localhost (Docker: redis) │
  ├────────────────┼───────────────────────────────────┼───────────────────────────┤
  │ REDIS_PORT     │ Redis port                        │ 6379                      │
  ├────────────────┼───────────────────────────────────┼───────────────────────────┤
  │ REDIS_PASSWORD │ Redis auth password               │ (empty)                   │
  ├────────────────┼───────────────────────────────────┼───────────────────────────┤
  │ PORT           │ Server listen port                │ 3000                      │
  └────────────────┴───────────────────────────────────┴───────────────────────────┘

  In Docker Compose, REDIS_HOST=redis and REDIS_PORT=6379 are set automatically. CLIENT_URL is REQUIRED — docker compose
  will refuse to start if it is missing from .env. REDIS_PASSWORD is optional.

  Step 1 — Deploy the app

  # Clone the repo on the server
  git clone <repo-url> /opt/table-rummikub
  cd /opt/table-rummikub

  # Configure environment
  cp .env.example .env
  # Edit .env — set CLIENT_URL=https://your-domain.com
  # Optionally set REDIS_PASSWORD=somepassword

  # Build and start
  docker compose up -d --build

  # Verify
  docker compose ps              # all 3 containers should be Up
  curl http://localhost:8080     # should return HTML
  curl http://localhost:8080/socket.io/  # should return Socket.IO response

  Step 2 — Host nginx config

  Create /etc/nginx/sites-available/rummikub:

  server {
      listen 443 ssl;
      server_name your-domain.com;

      ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

      location / {
          proxy_pass http://localhost:8080;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;
      }
  }

  server {
      listen 80;
      server_name your-domain.com;
      return 301 https://$host$request_uri;
  }

  Then enable it:

  sudo ln -s /etc/nginx/sites-available/rummikub /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo nginx -s reload

  Step 3 — SSL (Certbot, one-time)

  sudo certbot --nginx -d your-domain.com

  Key notes for the agent

  - WebSocket upgrade must pass through both nginx layers. The host nginx config above already has Upgrade and Connection headers
  — this is critical for Socket.IO to work. The inner Docker nginx (nginx.conf) also handles the upgrade for the /socket.io/ path.
  - The client connects to window.location.origin — no hardcoded port. So HTTPS on 443 will work transparently after the proxy
  chain.
  - Health check endpoint: GET /health on the server returns { status: "ok" } — useful for a basic liveness check.
  - Redis data is persisted in a Docker named volume (redis_data) — survives container restarts.
  - No .env file is committed — only .env.example. The agent must create .env from the example.