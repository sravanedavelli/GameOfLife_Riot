# Game of Life

A full-stack implementation of Conway's Game of Life with an ASP.NET Core backend and a React/TypeScript frontend. Supports an infinite 64-bit coordinate grid, client-side prediction for instant grid feedback, Life 1.06 file import/export, structured end-to-end logging with correlation ID tracing, and API versioning.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Logging](#logging)

---
## Final Output
<img width="1911" height="934" alt="image" src="https://github.com/user-attachments/assets/03a5a398-4b58-4161-8bab-98f5527afcf4" />


## Architecture Overview

```
GameOfLife/
├── src/
│   ├── GameOfLife.Engine/      # Core game logic — no dependencies
│   └── GameOfLife.Api/         # ASP.NET Core Web API
├── tests/
│   ├── GameOfLife.Engine.Tests/
│   └── GameOfLife.Api.Tests/
└── frontend/                   # React + TypeScript (Vite)
```

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | React 19, TypeScript, Vite | http://localhost:5173 |
| Backend API | ASP.NET Core 8, C# | http://localhost:5290 |
| Swagger UI | Swashbuckle | http://localhost:5290/swagger |

---

## Prerequisites

Install **all** of the following before running the project.

### 1. .NET 8 SDK
Required to build and run the backend.

- Download: https://dotnet.microsoft.com/download/dotnet/8.0
- Verify installation:
  ```bash
  dotnet --version
  # Expected: 8.x.x
  ```

### 2. Node.js (v18 or later)
Required to run the frontend Vite dev server and install npm packages.

- Download: https://nodejs.org/en/download
- Verify installation:
  ```bash
  node --version   # Expected: v18.x.x or higher
  npm --version    # Expected: 9.x.x or higher
  ```

### 3. Git (optional but recommended)
For cloning the repository.

- Download: https://git-scm.com/downloads

### 4. IDE (optional)
- **Visual Studio 2022** (recommended for C# — free Community edition works)
- **Visual Studio Code** with the following extensions:
  - C# Dev Kit
  - ESLint
  - Prettier

---

## Project Structure

```
GameOfLife/
├── GameOfLife.sln                          # Solution file — open this in Visual Studio
│
├── src/
│   ├── GameOfLife.Engine/                  # Pure C# class library — no framework dependencies
│   │   ├── Models/
│   │   │   └── Cell.cs                     # Coordinate model with 64-bit long X/Y
│   │   └── Services/
│   │       ├── IGameEngine.cs              # Interface for DI
│   │       ├── GameEngine.cs               # Tick and simulate logic (HashSet-based)
│   │       └── Life106Parser.cs            # Import/export Life 1.06 format
│   │
│   └── GameOfLife.Api/                     # ASP.NET Core Web API
│       ├── Program.cs                      # App startup, Serilog, versioning, middleware
│       ├── ConfigureSwaggerOptions.cs      # DI-based Swagger version config
│       ├── appsettings.json                # Base config (CORS origins empty by default)
│       ├── appsettings.Development.json    # Dev config (CORS allows localhost frontends)
│       ├── Controllers/
│       │   ├── GameController.cs           # /api/v1/game — tick, simulate, parse, export
│       │   └── LogController.cs            # /api/v1/log  — receives frontend log events
│       ├── Dtos/                           # Request/response data models
│       ├── Middleware/
│       │   └── CorrelationIdMiddleware.cs  # Injects X-Correlation-Id into every log line
│       └── logs/                           # Rolling log files (created on first request)
│
├── tests/
│   ├── GameOfLife.Engine.Tests/            # xUnit tests for core engine logic
│   └── GameOfLife.Api.Tests/              # xUnit integration tests (WebApplicationFactory)
│
└── frontend/                              # React + TypeScript app
    ├── .env                               # VITE_API_BASE — backend URL
    ├── vite.config.ts                     # Vite + Vitest config
    ├── package.json
    └── src/
        ├── App.tsx                        # Root component — cluster detection
        ├── main.tsx                       # Entry point, global error handlers
        ├── components/
        │   ├── Grid.tsx                   # Canvas renderer, pan/zoom, boundary wall
        │   ├── Controls.tsx               # Play/pause, speed, step, simulate N
        │   └── FileUpload.tsx             # Life 1.06 drag-and-drop upload
        ├── hooks/
        │   └── useGameOfLife.ts           # All game state, API calls, client-side prediction, logging
        ├── services/
        │   ├── api.ts                     # Typed fetch wrappers with correlation IDs
        │   └── logger.ts                  # Structured frontend logger → backend pipeline
        └── __tests__/                     # Vitest unit tests
```

---

## Backend Setup

### Step 1 — Restore NuGet packages

NuGet packages are restored automatically on build. To restore manually:

```bash
cd c:\Future\GameOfLife
dotnet restore
```

### NuGet packages used

| Package | Version | Purpose |
|---------|---------|---------|
| `Asp.Versioning.Mvc` | 8.1.1 | URL-path API versioning (`/api/v1/`, `/api/v2/`) |
| `Asp.Versioning.Mvc.ApiExplorer` | 8.1.1 | Swagger integration for versioned APIs |
| `Serilog.AspNetCore` | 10.0.0 | Structured logging (console + file) |
| `Serilog.Enrichers.Environment` | 3.0.1 | Adds machine name and environment to logs |
| `Serilog.Enrichers.Thread` | 4.0.0 | Adds thread ID to logs |
| `Serilog.Sinks.File` | 7.0.0 | Rolling daily log files |
| `Swashbuckle.AspNetCore` | 6.6.2 | Swagger UI + OpenAPI spec generation |
| `Microsoft.NET.Test.Sdk` | 17.8.0 | Test runner |
| `xunit` | 2.5.3 | Unit test framework |
| `xunit.runner.visualstudio` | 2.5.3 | Visual Studio test explorer integration |
| `coverlet.collector` | 6.0.0 | Code coverage collection |
| `Microsoft.AspNetCore.Mvc.Testing` | 8.0.* | In-process API integration tests |

### Step 2 — Build the backend

```bash
cd c:\Future\GameOfLife
dotnet build
```

Expected output: `Build succeeded. 0 Warning(s). 0 Error(s).`

---

## Frontend Setup

### Step 1 — Install npm packages

```bash
cd c:\Future\GameOfLife\frontend
npm install
```

### npm packages used

| Package | Type | Purpose |
|---------|------|---------|
| `react` ^19.2.0 | runtime | UI framework |
| `react-dom` ^19.2.0 | runtime | DOM rendering |
| `vite` ^7.3.1 | dev | Fast dev server and bundler |
| `vitest` ^4.0.18 | dev | Unit testing framework |
| `typescript` ~5.9.3 | dev | TypeScript compiler |
| `@vitejs/plugin-react` ^5.1.1 | dev | Vite plugin for React/JSX |
| `eslint` ^9.39.1 | dev | Code linting |
| `eslint-plugin-react-hooks` ^7.0.1 | dev | Rules for React hooks |
| `eslint-plugin-react-refresh` ^0.4.24 | dev | Fast refresh safety checks |
| `typescript-eslint` ^8.48.0 | dev | TypeScript ESLint rules |
| `@types/react` ^19.2.7 | dev | TypeScript types for React |
| `@types/react-dom` ^19.2.3 | dev | TypeScript types for ReactDOM |
| `@types/node` ^24.10.1 | dev | TypeScript types for Node.js |
| `globals` ^16.5.0 | dev | Global variable definitions for ESLint |

### Step 2 — Configure the backend URL

The frontend reads the backend URL from `frontend/.env`. The default is already set correctly for local development:

```env
VITE_API_BASE=http://localhost:5290/api/v1/game
```

For a different backend host or port, update this value and restart the Vite dev server.

> **Note:** Vite does not hot-reload `.env` changes. Always restart `npm run dev` after editing `.env`.

---

## Running the Application

Both the backend and frontend must run simultaneously.

### Terminal 1 — Start the backend

```bash
cd c:\Future\GameOfLife\src\GameOfLife.Api
dotnet run
```

Expected output:
```
[HH:mm:ss INF] Now listening on: http://localhost:5290
```

The API is ready when you see `Now listening on`.

### Terminal 2 — Start the frontend

```bash
cd c:\Future\GameOfLife\frontend
npm run dev
```

Expected output:
```
  VITE ready in Xms

  ➜  Local:   http://localhost:5173/
```

### Open the app

- **Game UI:** http://localhost:5173
- **Swagger UI:** http://localhost:5290/swagger

---

## Running Tests

### Backend tests

Run all backend tests from the solution root:

```bash
cd c:\Future\GameOfLife
dotnet test
```

Run only engine tests:

```bash
dotnet test tests/GameOfLife.Engine.Tests
```

Run only API integration tests:

```bash
dotnet test tests/GameOfLife.Api.Tests
```

> **Note:** Stop the running API process before running API integration tests. The test host binds to the same port and will conflict with a running instance.

### Frontend tests

```bash
cd c:\Future\GameOfLife\frontend
npm test
```

Runs Vitest in `run` mode (no watch). Tests cover:
- `validateLife106` — Life 1.06 client-side file validation
- `parseCells` / `serializeCells` — BigInt ↔ string round-trips
- `normalizeAnchor` — viewport anchor normalization
- `detectClusters` — spatial cluster detection for navigation

---

## API Reference

All endpoints are versioned under `/api/v1/`.

### Game Endpoints — `/api/v1/game`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/game/tick` | Advance the grid by 1 generation |
| `POST` | `/api/v1/game/simulate` | Advance by N generations (1–1000) |
| `POST` | `/api/v1/game/parse` | Parse a Life 1.06 file into cells |
| `POST` | `/api/v1/game/export` | Export current cells as Life 1.06 text |

**Cell format:** coordinates are sent and received as `[string, string]` pairs (e.g., `["0","0"]`) to preserve full 64-bit precision across JSON.

**Request size limits:**
- `/tick`, `/simulate`, `/export` — 50 MB
- `/parse` — 12 MB

**Cell count limit:** 1,000,000 cells per request.

### Log Endpoint — `/api/v1/log`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/log` | Receive structured log events from the frontend |

The frontend sends `info`, `warn`, and `error` level events to this endpoint. They are written into the same Serilog pipeline as backend logs, tagged with `Source=Frontend`.

### Swagger

Interactive API documentation is available in Development mode at:
```
http://localhost:5290/swagger
```

---

## Configuration

### Backend — `appsettings.Development.json`

Controls which frontend origins are allowed by CORS:

```json
{
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000"
    ]
  }
}
```

Add your frontend origin here if you run it on a different port.

### Frontend — `frontend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `http://localhost:5290/api/v1/game` | Backend game API base URL |

For production, create `frontend/.env.production` with the production URL:

```env
VITE_API_BASE=https://api.yourdomain.com/api/v1/game
```

---

## Logging

### Backend logs

Serilog writes structured logs to two sinks:

| Sink | Location | Format |
|------|----------|--------|
| Console | Terminal | Human-readable with correlation IDs |
| Rolling file | `src/GameOfLife.Api/logs/gameoflife-YYYYMMDD.log` | Full timestamps, 30-day retention, 100 MB max per file |

Every log line includes:
- `CorrelationId` — unique per HTTP request, traceable end-to-end
- `SessionId` — unique per browser session
- `MachineName`, `ThreadId`, `EnvironmentName`

### Frontend logs

The frontend logger (`src/services/logger.ts`) writes to two sinks simultaneously:

| Sink | When |
|------|------|
| Browser console (DevTools) | Always — all levels including `debug` |
| Backend `/api/v1/log` | `info`, `warn`, `error` only |

Frontend and backend logs for the same transaction share the same `CorrelationId`, so you can search a single ID in any log viewer (Grafana, Loki, Kibana) to see the full request trace.
<<<<<<< HEAD

### Stopping auto-play on backend failure

If the backend goes down while the simulation is auto-playing, the frontend automatically stops the timer after the first failed request and shows an error message. No further requests are sent until the user manually resumes.

---

## Client-Side Prediction

Each step (`stepForward`) applies Conway's rules locally in the browser before the API response arrives, so the grid updates instantly with zero perceived latency.

**How it works:**

1. **Optimistic update** — `computeNextGeneration` runs the full Conway ruleset (birth/survival/death) on the current cell map using BigInt arithmetic and immediately sets the result as the new grid state.
2. **Parallel API call** — the original (pre-step) cell list is sent to the backend concurrently.
3. **Reconciliation** — when the server response arrives it overwrites the optimistic state with the authoritative result. In practice the two will always agree; reconciliation exists as a safety net.
4. **Rollback on error** — if the API call fails, the grid and generation counter are reverted to their pre-step values and auto-play is stopped.

**Why this matters for auto-play:** At high speeds (e.g. 200 ms interval) the round-trip to the backend can exceed the tick interval. The optimistic update ensures the grid always advances visually on schedule, even if the network is slow.

**Scope:** Prediction applies to single-step (`stepForward`) only. Bulk simulation (`simulateN`) cannot be predicted locally because computing N generations of a large pattern in the browser would block the UI thread.
=======
>>>>>>> 8d86f6c31a4d2d367c839f77bd92e2a38eec2eab
