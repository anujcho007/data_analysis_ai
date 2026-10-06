from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.dataset import DatasetMetadata
from app.models.alert import AlertRule, AlertHistory
from app.models.workspace import Workspace, WorkspaceMember
from app.models.connector import DatabaseConnection
from app.routers import users, upload, tables, auth, predictive, reports, alerts, workspaces, connectors, copilot

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Seed default users if table is empty or admin is missing
def seed_initial_users():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            default_admin = User(
                username="admin",
                email="admin@dataforge.ai",
                full_name="System Administrator",
                hashed_password=hash_password("admin123"),
                role="admin",
                is_active=True
            )
            db.add(default_admin)
        
        analyst_user = db.query(User).filter(User.username == "analyst_jane").first()
        if not analyst_user:
            default_analyst = User(
                username="analyst_jane",
                email="jane@dataforge.ai",
                full_name="Jane Doe",
                hashed_password=hash_password("analyst123"),
                role="analyst",
                is_active=True
            )
            db.add(default_analyst)
        db.commit()
    finally:
        db.close()

seed_initial_users()

app = FastAPI(
    title="DataForge AI - Smart Warehouse & Data Analysis API",
    description="Automated multi-CSV cleaning, Star Schema warehouse generator, and User Management API",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(upload.router)
app.include_router(tables.router)
app.include_router(predictive.router)
app.include_router(reports.router)
app.include_router(alerts.router)
app.include_router(workspaces.router)
app.include_router(connectors.router)
app.include_router(copilot.router)

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "DataForge AI Engine",
        "database": "SQLite Warehouse"
    }

@app.get("/", tags=["System"])
def root():
    return {
        "message": "Welcome to DataForge AI Analytics Engine",
        "docs": "/docs",
        "version": "1.0.0"
    }
