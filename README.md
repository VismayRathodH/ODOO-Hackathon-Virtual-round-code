# Expense Management Platform

Full-stack expense submission and approval system with role-based workflows.

This repository contains:
- `backend/`: NestJS API (authentication, users, expenses, approvals, currency, OCR)
- `frontend/`: Next.js web application

## Features

- JWT-based authentication and authorization
- Role-based access for `ADMIN`, `MANAGER`, and `EMPLOYEE`
- Expense creation with receipt upload
- Multi-step approval workflow (`approve`, `reject`, `override`)
- Currency rate lookup and conversion
- OCR-assisted receipt parsing (Google Gemini API)

## Tech Stack

- Frontend: Next.js 14, React 18, TypeScript, TanStack Query, Tailwind
- Backend: NestJS 11, TypeScript, JWT, Supabase JS client
- Data layer: Supabase (PostgreSQL)

## Repository Structure

```text
.
|- backend/
|- frontend/
```

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project with the required tables for users, companies, expenses, rules, steps, and logs

## Environment Variables

### Backend (`backend/.env`)

Required:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```

Recommended/optional:

```env
PORT=3001
JWT_EXPIRES_IN=1d

# OCR (any one key works)
GOOGLE_AI_API_KEY=
GOOGLE_AI_STUDIO_API_KEY=
GEMINI_API_KEY=

# OCR model (optional)
GOOGLE_AI_MODEL=gemini-1.5-flash
GOOGLE_AI_STUDIO_MODEL=gemini-1.5-flash
```

### Frontend (`frontend/.env.local`)

Create from `frontend/.env.local.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Local Development

Install dependencies:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Run both apps (recommended ports: frontend `3000`, backend `3001`):

### Windows PowerShell

```powershell
# Terminal 1
cd backend
$env:PORT="3001"
npm run start:dev

# Terminal 2
cd frontend
$env:NEXT_PUBLIC_API_URL="http://localhost:3001"
npm run dev
```

### macOS/Linux

```bash
# Terminal 1
cd backend
PORT=3001 npm run start:dev

# Terminal 2
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

Open the app at `http://localhost:3000`.

## Common Commands

Backend:

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
```

## API Overview

Authentication:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Users:
- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `GET /users/me`

Expenses:
- `GET /expenses`
- `POST /expenses`
- `GET /expenses/:id`
- `POST /expenses/:id/approve`
- `POST /expenses/:id/reject`
- `POST /expenses/:id/override`

Currency:
- `GET /currency/rates?base=USD`
- `GET /currency/countries`

OCR:
- `POST /ocr/receipt` (multipart form-data, field name: `file`)

## Notes

- Backend default port in code is `3000`; using `3001` locally avoids conflict with Next.js.
- Do not commit real secrets (API keys, service role keys, JWT secrets) to GitHub.