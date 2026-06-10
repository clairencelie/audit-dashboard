# Audit Dashboard

Sistem manajemen audit internal berbasis web untuk divisi Internal Audit perusahaan asuransi.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Golang + Gin + GORM
- **Database**: PostgreSQL
- **Dev Environment**: Docker Compose

## Cara Menjalankan

### 1. Copy environment file

```bash
cp .env.example .env
```

### 2. Jalankan dengan Docker Compose

```bash
docker-compose up --build
```

Aplikasi tersedia di:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080/api/v1
- Health check: http://localhost:8080/api/v1/health

### 3. Akun Demo (password: `password123`)

| Role | Email |
|------|-------|
| Admin | admin@audit.local |
| Auditor | auditor@audit.local |
| SPV | spv@audit.local |
| Dept Head | depthead@audit.local |
| Div Head | divhead@audit.local |

## Struktur Project

```
audit-dashboard/
├── backend/           # Golang REST API (Gin + GORM)
│   ├── cmd/api/       # Entry point (main.go)
│   ├── internal/      # Business logic per modul
│   │   ├── auth/
│   │   ├── users/
│   │   ├── auditprojects/
│   │   ├── auditprograms/
│   │   ├── checklists/
│   │   ├── approvals/
│   │   └── dashboard/
│   └── Dockerfile
├── frontend/          # React SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── stores/
│   │   └── types/
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## MVP Phase 1 — Fitur Tersedia

- ✅ Authentication JWT + Refresh Token
- ✅ Role-based access (Admin, Auditor, SPV, Dept Head, Div Head)
- ✅ Master Data: Users, Roles, Departments, Auditees
- ✅ Audit Projects (buat, list, detail)
- ✅ Audit Program Builder (scope, tujuan, kriteria, risiko)
- ✅ Checklist Management (tambah, edit, hapus)
- ✅ Approval Workflow berjenjang (Auditor → SPV → Dept Head → Div Head)
- ✅ Lock mandatory checklist setelah program diapprove
- ✅ Dashboard per role (Auditor, SPV, Dept Head, Div Head)

## Development Lokal (tanpa Docker)

```bash
# Backend
cd backend
go run ./cmd/api

# Frontend
cd frontend
npm install
npm run dev
```
