# DataForge AI — Automated Data Cleaning, BI Analytics & Local Warehouse Engine

DataForge AI is an end-to-end data engineering and business intelligence platform built with **FastAPI**, **Pandas**, **SQLite**, and **React**. It empowers users to upload massive CSV datasets, automatically cleans duplicates and imputes missing values, standardizes schemas, generates a local relational **Star Schema** database, provides interactive **BI Analytics** with charts, and features an **AI Natural Language Query Assistant** guarded by multi-layer SQL security.

---

## 🚀 Quick Start Guide

Run the following commands in separate terminals to start the complete application:

### Terminal 1: Backend API (FastAPI)
```bash
cd d:\Data_analysis_ai\backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```
> **Alternative (using standard Python virtual environment):**
> ```bash
> cd d:\Data_analysis_ai\backend
> python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
> ```

* **Backend Live URL:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
* **Interactive API Docs (Swagger):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **System Health / Stats Endpoint:** [http://127.0.0.1:8000/api/tables/stats](http://127.0.0.1:8000/api/tables/stats)

---

### Terminal 2: Frontend (React + Vite)
```bash
cd d:\Data_analysis_ai\frontend
npm run dev
```

* **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)

---

## 🌟 Key Features

### 1. High-Performance Multi-CSV & REST API Live Ingestion Pipeline
* **Chunked Streaming Engine:** Ingests up to **10,000,000 rows (1.33 GB)** in under 15 seconds with a constant ~60 MB RAM footprint.
* **REST API Live Ingestion:** Connects directly to any external HTTP REST API endpoint (supports Bearer Tokens, `X-API-Key`, custom headers, or public APIs), normalizes arbitrary nested JSON or CSV responses into relational tables, cleans missing fields, and indexes tables in the warehouse.
* **1-Click Test Presets:** Instant sample presets for E-Commerce Products, User Demographics, Crypto Markets, and Social Posts.
* **Automated Deduplication:** Instantly drops duplicate and redundant rows.
* **Statistical Imputation:** Configurable null repair strategies:
  * Numeric columns: Median (outlier-robust), Mean, or Zero (`0`).
  * Categorical columns: Mode (most frequent) or `'Unknown'` placeholder.
* **Schema Normalization:** Sanitizes headers to clean `snake_case`, converts dirty tokens (`'N/A'`, `'-'`), and standardizes date formats.

### 2. Local Database & Star Schema Ingestion
* **Direct SQLite Storage:** Automatically creates clean relational tables inside `backend/storage/warehouse.db`.
* **Fact vs Dimension Classification:** Detects transactional Fact tables vs descriptive Dimension tables.
* **Star Schema Relationship Detection:** Analyzes foreign keys across tables (e.g. `orders.customer_id` ➔ `customers.customer_id`).

### 3. Interactive BI Analytics & Autonomous AI Dashboard
* **Autonomous AI Executive Dashboard:** Evaluates all ingested tables across the local warehouse, extracts primary KPIs, discovers temporal velocity, identifies category concentrations, and synthesizes a full executive briefing with narrative findings and strategic business recommendations.
* **Prompt-Driven Customization:** Guide the AI with custom focus prompts (e.g. *"Focus on revenue trends and top customers"*) or let it autonomously profile the entire warehouse.
* **One-Click Offline Interactive HTML Export:** Download a self-contained, standalone `.html` dashboard complete with native SVG charts and interactive tooltips for offline viewing or executive distribution.
* **Print-to-PDF Ready:** Clean `@media print` formatting for immediate executive briefing PDF printing.
* **Dynamic Time-Series Visualization:** SVG trendlines and filled area graphs supporting both summed metrics and record counts.
* **Category Breakdown & Ranked Leaderboards:** Relative distribution progress bars, percentage shares, and ranked contributor leaderboards.
* **Dual Studio Modes:** Seamlessly switch between the **✨ AI Smart Dashboard** and the granular **📊 Custom Chart Studio**.

### 4. AI Natural Language Query Assistant & Secure SQL Runner
* **Natural Language Queries:** Ask plain English questions like `"top 10 cuisine by sales"`, `"sales by city"`, or `"orders by status"`.
* **5-Layer Security Gatekeeper:**
  1. Strict single-statement enforcement.
  2. Blocklist of destructive keywords (`DROP`, `DELETE`, `UPDATE`, `ALTER`, `ATTACH`, `EXEC`).
  3. AST SQL parser verification.
  4. Automatic `LIMIT` bounding (max 500 rows).
  5. Read-only SQLite connection execution.

### 5. Modern Bright & Catchy User-Friendly Interface
* Clean, bright SaaS aesthetic inspired by Linear and Stripe light modes.
* Crisp typography, high-contrast metrics, pastel status badges, and smooth micro-interactions.

### 6. Full Authentication, Role-Based Access Control & Auto Session Cleanup
* **Gated Access:** The application verifies valid user credentials before permitting entry into the studio.
* **Pre-Configured Demo Accounts:**
  * 👑 **Administrator:** `username: admin`, `password: admin123`
    * Full administrative authority: only admins can view the **User Management** tab, add new users, or delete existing users.
  * 📊 **Data Analyst:** `username: analyst_jane`, `password: analyst123`
    * Dedicated analytical workflow: upload datasets, explore Star Schema, and query with AI natural language assistant. User Management is restricted and hidden.
* **Session Cleanup on Logout:** Whenever any user logs out:
  * All ingested warehouse tables in `warehouse.db` are automatically dropped and dataset metadata is wiped.
  * Upon logging back in, the user is greeted with a 100% fresh, clean dashboard ready for new dataset uploads.

---

## 🧪 Testing with Sample E-Commerce Data

Sample datasets are located in `sample_data/`:
* `sample_data/orders.csv`: Fact table (contains duplicates, missing prices/quantities).
* `sample_data/customers.csv`: Dimension table (contains duplicates, unformatted names).
* `sample_data/products.csv`: Dimension table (contains missing prices, category nulls).

To test:
1. Open [http://localhost:5173](http://localhost:5173).
2. Go to the **Upload & Clean** tab and drag & drop the CSV files.
3. Review the cleaned metrics, explore the **Star Schema & Explorer** tab, and run analytical queries.

---

## 📁 Project Structure

```text
Data_analysis_ai/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── database.py         # SQLite connection & sessions
│   │   │   └── security.py         # Password hashing & auth
│   │   ├── models/
│   │   │   ├── user.py             # User SQLAlchemy model
│   │   │   ├── dataset.py          # Warehouse metadata model
│   │   │   └── schema.py           # Pydantic schemas
│   │   ├── services/
│   │   │   ├── cleaner.py          # Deduplication & null imputation engine
│   │   │   ├── schema_builder.py   # Star Schema detection & SQL runner
│   │   │   ├── ai_query.py         # Natural Language AI query generator
│   │   │   └── sql_security.py     # 5-layer SQL security guardrails
│   │   ├── routers/
│   │   │   ├── users.py            # User management endpoints
│   │   │   ├── upload.py           # Multi-CSV ingestion endpoint
│   │   │   └── tables.py           # Analytics & table query endpoints
│   │   ├── config.py
│   │   └── main.py                 # FastAPI application
│   ├── storage/
│   │   └── warehouse.db            # Local SQLite analytical warehouse
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/client.js           # API client
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Bright header & navigation
│   │   │   ├── StatCard.jsx        # KPI metric cards
│   │   │   └── ConfirmModal.jsx    # Confirmation dialogs
│   │   ├── views/
│   │   │   ├── Dashboard.jsx       # Overview & Star Schema summary
│   │   │   ├── AnalyticsDashboard.jsx # Interactive BI charts & graphs
│   │   │   ├── UploadView.jsx      # CSV dropzone & cleaning rules
│   │   │   ├── SchemaExplorer.jsx  # AI query assistant & SQL runner
│   │   │   └── UserManagement.jsx  # User management system
│   │   ├── index.css               # Bright SaaS design system
│   │   └── App.jsx
│   └── vite.config.js
└── sample_data/                    # Sample relational datasets
```
