# GKK ERP — CompanyOS

A full-stack internal ERP system built for GKK Technologies. Covers project management (sprints, issues, kanban), HR (leave, performance reviews, leave packages), real-time notifications, and role-based access for admins, managers, and employees.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | NestJS 10, TypeScript, Knex.js, MySQL 8, Socket.IO |
| Frontend | Next.js 14 (App Router), TanStack Query v5, Tailwind CSS, Zustand |
| Real-time | WebSockets via Socket.IO |
| Auth | JWT (passport-jwt), bcryptjs |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Infrastructure | Docker (MySQL + Redis), Nginx, PM2 |

---

## Project Structure

```
gkkerp/
├── apps/
│   ├── api/                  # NestJS backend
│   │   └── src/
│   │       ├── auth/         # JWT authentication
│   │       ├── companies/    # Company management
│   │       ├── departments/  # Departments + heads
│   │       ├── users/        # User management
│   │       ├── projects/     # Projects + members
│   │       ├── sprints/      # Sprint planning
│   │       ├── issues/       # Issues / tasks
│   │       ├── docs/         # Project documentation
│   │       ├── hr/
│   │       │   ├── leave/           # Leave requests
│   │       │   ├── leave-packages/  # Leave allocation
│   │       │   ├── performance/     # Performance reviews
│   │       │   ├── announcements/   # Company announcements
│   │       │   └── dept-notifier.service.ts
│   │       ├── notifications/  # WebSocket gateway
│   │       └── database/
│   │           ├── migrations/ # Knex migrations
│   │           └── seeds/      # Seed data
│   └── web/                  # Next.js 14 frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/         # Login / register
│           │   └── (dashboard)/    # All authenticated pages
│           │       ├── dashboard/
│           │       ├── projects/[id]/
│           │       │   ├── issues/
│           │       │   ├── board/
│           │       │   ├── backlog/
│           │       │   ├── docs/
│           │       │   └── analytics/
│           │       ├── hr/
│           │       ├── settings/
│           │       └── notifications/
│           ├── components/
│           │   ├── kanban/   # Drag-and-drop board
│           │   ├── issues/   # Create modal, detail drawer
│           │   ├── sprint/   # Sprint create modal
│           │   └── layout/   # Sidebar, header
│           ├── lib/          # axios client, API helpers
│           ├── store/        # Zustand auth store
│           └── types/        # Shared TypeScript types
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .env.example
└── package.json
```

---

## Roles

| Role | Access |
|---|---|
| `admin` | Full access — all data, settings, user management |
| `manager` | HR management, all project issues, leave approval |
| `employee` | Own assigned issues only, own leave & performance, no settings |

---

## Features

### Projects & Issues
- Projects with members, status, icon, and description
- GitHub-style issue tracker — type, priority, label, sprint, story points, due date, assignee, comments
- Bulk issue creation (paste markdown list or table editor)
- Sprint planning backlog — move issues between sprints with one click
- Kanban board with live drag-and-drop across columns (cross-column + within-column reorder)
- Project docs editor (Tiptap rich text)
- Analytics dashboard — velocity, burn-down by status/priority/type

### HR
- Leave requests with per-type balance tracking
- Leave packages — define types/days per period, allocate to employees
- Performance reviews with star ratings
- Company announcements
- Department heads — each department has a designated head who is notified of all employee activity

### Notifications
- Real-time WebSocket notifications
- Triggered on: leave request, performance review created/submitted, leave package allocated, issue assigned, comment added

### Access control
- Employees see only their assigned issues and personal HR data
- Settings page (department heads, company config) hidden from employees
- HR tabs (Employees, Leave Packages) hidden from employees

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` then `corepack prepare pnpm@10 --activate`)
- MySQL 8
- Redis 7
- Docker (optional — for MySQL + Redis)

### 1. Clone and install

```bash
git clone https://github.com/sebakara/gkkerp.git
cd gkkerp
pnpm install
```

### 2. Environment variables

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` with your database credentials and a strong JWT secret:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gkkerp
DB_USER=root
DB_PASSWORD=your_password

JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

REDIS_HOST=localhost
REDIS_PORT=6379
```

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start MySQL and Redis

Using Docker:

```bash
docker compose up -d mysql redis
```

Or use an existing MySQL installation and point the `.env` at it.

### 4. Run database migrations and seed

```bash
pnpm db:migrate
pnpm db:seed
```

This creates all tables and inserts:
- 1 company (GKK Technologies)
- 4 departments with designated heads
- 4 management users + 10 developer employees
- 5 projects with 3 sprints and 10 issues each
- 2026 annual leave package allocated to all users

### 5. Start the apps

```bash
# Both apps
pnpm dev

# Or separately
pnpm --filter @gkkerp/api dev   # API on port 3001
pnpm --filter @gkkerp/web dev   # Frontend on port 3000
```

Open [http://localhost:3000](http://localhost:3000).

---

## Seed Credentials

| Role | Email | Password |
|---|---|---|
| Admin (CTO) | `admin@gkk.com` | `Admin@1234` |
| CEO | `ceo@gkk.com` | `Admin@1234` |
| HR Manager | `hr@gkk.com` | `Admin@1234` |
| Product Manager | `product@gkk.com` | `Admin@1234` |
| Developer | `liam.chen@gkk.com` | `Dev@1234` |
| Developer | `aisha.diallo@gkk.com` | `Dev@1234` |

---

## Deployment

See the full deployment guide for Ubuntu + Nginx + PM2 + Let's Encrypt SSL.

### Quick summary

```bash
# 1. Add swap (prevents OOM on low-RAM servers)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile

# 2. Start infrastructure
docker compose up -d redis   # or native MySQL

# 3. Install and migrate
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm build

# 4. Run with PM2
pm2 startOrReload ecosystem.config.js --update-env
pm2 save && pm2 startup
```

### Nginx config (ops.kwikkoders.com)

```nginx
server {
    listen 80;
    server_name ops.kwikkoders.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo certbot --nginx -d ops.kwikkoders.com
```

### Updating

```bash
cd /var/www/gkkerp
git pull origin main
pm2 restart all
```

---

## API Overview

All routes are prefixed with `/api`.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/login` | Login | Public |
| POST | `/auth/register` | Register first admin | Public |
| GET | `/auth/me` | Current user | JWT |
| GET | `/projects` | List my projects | JWT |
| POST | `/projects` | Create project | JWT |
| GET | `/projects/:id/issues` | List issues (scoped by role) | JWT |
| POST | `/projects/:id/issues/bulk` | Bulk create issues | JWT |
| PATCH | `/projects/:id/issues/:id/move` | Move issue (kanban) | JWT |
| GET | `/projects/:id/sprints` | List sprints | JWT |
| GET | `/hr/leave` | All leave requests | Admin/Manager |
| GET | `/hr/leave/mine` | My leave requests | JWT |
| POST | `/hr/leave` | Request leave | JWT |
| PATCH | `/hr/leave/:id/approve` | Approve leave | Admin/Manager |
| GET | `/hr/leave-packages` | List packages | JWT |
| POST | `/hr/leave-packages/:id/allocate` | Allocate to employees | Admin/Manager |
| GET | `/hr/performance` | Performance reviews (scoped) | JWT |
| GET | `/departments` | List departments | JWT |
| PATCH | `/departments/:id` | Update dept head | Admin/Manager |
| GET | `/notifications` | My notifications | JWT |
| PATCH | `/notifications/read-all` | Mark all read | JWT |

---

## License

Private — GKK Technologies internal use only.
