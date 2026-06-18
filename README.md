<div align="center">
  <img src="frontend/public/icons/nova.svg" width="80" alt="NOVA logo" />
  <h1>NOVA</h1>
  <p>No-trace Oblivious Vault Access — share secrets that vanish the moment they're read.</p>

  ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Hono](https://img.shields.io/badge/Hono-4.x-E36002?style=flat-square&logo=hono&logoColor=white)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=flat-square&logo=postgresql&logoColor=white)
  ![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=flat-square&logo=redis&logoColor=white)
  ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
  ![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)
  ![Part of AEGIS](https://img.shields.io/badge/Part%20of-AEGIS-22d3ee?style=flat-square)
</div>

---

Ever needed to send a password, an API key, or a sensitive note — and had no idea if the other person would keep it safe? NOVA solves that for good. Create a secret, get a one-time link, share it. The moment someone opens it, it's gone. No accounts needed for recipients, no traces left behind, no drama. Just clean, ephemeral, zero-knowledge secret sharing. ✨

NOVA is part of the [AEGIS](https://github.com/ZulfaNurhuda/AEGIS.project) secure credential infrastructure suite alongside [VOID](https://github.com/ZulfaNurhuda/VOID.project).

---

### **📋・Table of Contents**

- **✨・<a href="#what-is-nova" style="text-decoration: none;">What is NOVA?</a>**
- **🌟・<a href="#features" style="text-decoration: none;">Features</a>**
- **🛠️・<a href="#tech-stack" style="text-decoration: none;">Tech Stack</a>**
- **🔄・<a href="#how-it-works" style="text-decoration: none;">How It Works</a>**
- **🚀・<a href="#getting-started" style="text-decoration: none;">Getting Started</a>**
- **⚙️・<a href="#environment-variables" style="text-decoration: none;">Environment Variables</a>**
- **🔐・<a href="#security" style="text-decoration: none;">Security</a>**
- **📜・<a href="#license" style="text-decoration: none;">License</a>**

---

### <div id="what-is-nova">**✨・What is NOVA? (The Magic Behind the Link 🔗)**</div>

NOVA (No-trace Oblivious Vault Access) is a self-hosted ephemeral secret sharing platform. You create a secret — a password, a token, a one-time code — and NOVA hands you a link. That link works exactly once. The moment a recipient opens it, the secret is burned from existence. No second reads, no recovery, no lingering traces on any server. If the link expires before anyone opens it, same deal — gone forever.

Recipients don't need an account, don't need to install anything, and don't need to trust NOVA's infrastructure beyond "did the page load?" Because the encryption happens client-side, not even the server ever sees your plaintext. That's zero-knowledge done right. 🛡️

---

### <div id="features">**🌟・Features (Everything You Didn't Know You Needed! 🎉)**</div>

- **🔥 One-time links** — secret self-destructs on first read, guaranteed
- **⏱️ Configurable TTL** — set expiry from minutes to days, your call
- **🔒 Password protection** — add an optional passphrase for extra peace of mind
- **📁 File support** — share files alongside text secrets, no hassle
- **👤 No recipient account** — anyone with the link reads it, once, done
- **🌍 Multi-language UI** — i18next with automatic browser language detection
- **🔑 OAuth login** — GitHub, Google, Discord, GitLab, Apple, Microsoft, Twitter (all optional)
- **📧 SMTP support** — optional email delivery for password reset flows
- **📊 Prometheus metrics** — built-in `/metrics` endpoint for the observability nerds
- **🚦 Rate limiting** — Redis-backed per-IP limits so no one abuses your instance
- **📖 API docs** — OpenAPI spec with Scalar UI built right in
- **🐳 Self-hostable** — full Docker Compose stack, yours to own forever

---

### <div id="tech-stack">**🛠️・Tech Stack (The Nerdy Good Stuff ⚙️)**</div>

| Layer | Technology |
|---|---|
| Backend | [Hono](https://hono.dev) 4.x on Node.js |
| Frontend | [React](https://react.dev) 19 + [React Router](https://reactrouter.com) v7 |
| Database | [PostgreSQL](https://www.postgresql.org) 16+ via [Drizzle ORM](https://orm.drizzle.team) |
| Cache / Sessions | [Redis](https://redis.io) 7+ via ioredis |
| Auth | [Better Auth](https://www.better-auth.com) + Argon2id password hashing |
| Client Encryption | [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) — pure TypeScript, no WASM |
| Rate Limiting | hono-rate-limiter (Redis-backed) |
| Styling | Tailwind CSS + Lucide React + Tabler Icons |
| State | Zustand |
| Reverse Proxy | Nginx (Docker) |

---

### <div id="how-it-works">**🔄・How It Works (The Secret Life of a Secret 🕵️)**</div>

It's surprisingly simple under the hood! Here's the full journey of a secret from creation to oblivion:

1. **You create a secret** — type your message (or upload a file), set a TTL, optionally add a password. Encryption happens right in your browser before anything touches the network. 🔐
2. **NOVA stores the ciphertext** — the server receives an encrypted blob it cannot read. It hands back a one-time link tied to that blob.
3. **You share the link** — out-of-band, however you like. Slack, email, carrier pigeon. 🐦
4. **Recipient opens the link** — if a password was set, they enter it. Decryption happens in their browser.
5. **NOVA burns the secret** — the moment the secret is successfully retrieved, it's hard-deleted. Any subsequent request to the same link returns a 404. Forever. 🔥

If the TTL expires before anyone opens it? Same outcome — the scheduled cleanup job sweeps it away.

---

### <div id="getting-started">**🚀・Getting Started (Let's Get This Party Started! 🎉)**</div>

Ready to spin up your own instance? Let's go!

#### **Option 1: Docker Compose (The Easy Way 🐳)**

This is the recommended path for production and anyone who just wants things to work.

**Prerequisites:** Docker with the Compose plugin installed.

**1. Clone the repo:**
```bash
git clone https://github.com/ZulfaNurhuda/NOVA.project.git
cd NOVA.project
```

**2. Set up your environment:**
```bash
cp .env.example .env
# Open .env and fill in: DATABASE_URL, REDIS_HOST, BETTER_AUTH_SECRET, NOVA_BASE_URL
```

**3a. Base stack** (bring your own PostgreSQL and Redis):
```bash
docker compose up -d
```

**3b. Full stack** (includes PostgreSQL + Redis containers — perfect for fresh installs!):
```bash
cp compose.override.yml.disabled compose.override.yml
docker compose up -d
```

To update later:
```bash
docker compose pull && docker compose up -d --build
```

#### **Option 2: Local Development (For the Tinkerers 🔧)**

**Prerequisites:** Node.js 20+, PostgreSQL 16+, Redis 7+

```bash
# Backend
cd backend
npm install
cp ../.env.example .env   # fill in your local values
npm run db:push           # runs migrations
npm run dev               # starts API on :3000

# Frontend — open a second terminal
cd frontend
npm install
npm run dev               # Vite dev server on :5173
```

---

### <div id="environment-variables">**⚙️・Environment Variables (Make It Yours! 🎛️)**</div>

Copy `.env.example` to `.env` and fill in the values. Variables marked **Required** must be set before the app will start — it'll refuse to boot otherwise, which is actually a feature. 😄

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `REDIS_HOST` | **Yes** | — | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `BETTER_AUTH_SECRET` | **Yes** | — | Auth signing secret (min 32 chars). Generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **Yes** | — | Public base URL of the backend |
| `NOVA_BASE_URL` | **Yes** | — | Public base URL shown in generated links |
| `NOVA_TRUSTED_ORIGIN` | **Yes** | — | Allowed CORS origin (your frontend URL) |
| `NOVA_INSTANCE_NAME` | No | `NOVA` | Name shown in the UI header |
| `NOVA_SMTP_HOST` | No | — | SMTP host for password reset emails |
| `NOVA_SMTP_PORT` | No | `587` | SMTP port |
| `NOVA_SMTP_USER` | No | — | SMTP username |
| `NOVA_SMTP_PASSWORD` | No | — | SMTP password |
| `NOVA_SMTP_FROM_EMAIL` | No | — | From address for outgoing emails |
| `NOVA_AUTH_GITHUB_ID` | No | — | GitHub OAuth app client ID |
| `NOVA_AUTH_GITHUB_SECRET` | No | — | GitHub OAuth app client secret |
| `NOVA_AUTH_GOOGLE_ID` | No | — | Google OAuth client ID |
| `NOVA_AUTH_GOOGLE_SECRET` | No | — | Google OAuth client secret |
| `NOVA_AUTH_DISCORD_ID` | No | — | Discord OAuth client ID |
| `NOVA_AUTH_DISCORD_SECRET` | No | — | Discord OAuth client secret |
| `COMPOSE_PROJECT_NAME` | No | `nova` | Docker Compose project name |

> OAuth providers are completely optional — NOVA works perfectly with just email and password auth. Add providers whenever you feel like it!

---

### <div id="security">**🔐・Security (Fort Knox, But Make It Software 🛡️)**</div>

Zero-knowledge is not a buzzword here — it's an architectural guarantee. Here's what that means in practice:

| Feature | Implementation |
|---|---|
| Client-side encryption | @noble/ciphers encrypts before any network call — server receives only ciphertext |
| At-rest storage | Encrypted blobs only — the server has no decryption key |
| Password hashing | Argon2id (memory-hard, salted) — no MD5 crimes here |
| Burn-on-read | Hard delete immediately after first successful retrieval |
| TTL enforcement | Croner job sweeps expired secrets on schedule |
| Rate limiting | Per-IP via hono-rate-limiter backed by Redis |
| Auth tokens | Better Auth session cookies (httpOnly, SameSite) |
| CORS | Locked to `NOVA_TRUSTED_ORIGIN` — no wildcards in production |

---

### <div id="license">**📜・License (The Legal Bits, but Still Friendly! 🤝)**</div>

This project is open-source and proudly distributed under the **MIT License**. That means you're completely free to explore, use, modify, and share NOVA however you see fit — personal projects, team deployments, or building something entirely new on top of it! You can find all the nitty-gritty legal details in the [LICENSE](LICENSE) file. Happy hacking! 🚀

---

<div align="center">
  <sub>Part of the <a href="https://github.com/ZulfaNurhuda/AEGIS.project">AEGIS</a> secure credential infrastructure suite</sub>
</div>
