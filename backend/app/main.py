import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import init_db, engine
from app.models.cuenta import Cuenta
from app.api.v1.api import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestor de ciclo de vida de FastAPI blindado.
    """
    # 1. Intentar crear las tablas en PostgreSQL de forma directa
    try:
        init_db()
        print("¡Tablas de base de datos inicializadas en PostgreSQL con éxito!")
    except Exception as e:
        print(f"Advertencia de conexión: {e}")
        print("Asegúrate de que PostgreSQL esté corriendo y configurado según tu archivo .env.")

    # 2. Saltamos la siembra automática por ahora para que no explote con textos raros
    print("Nota: Siembra automática pausada temporalmente para evitar problemas de tildes.")

    yield

# Inicializar FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    description="Backend API en FastAPI con SQLModel para el Sistema Contable de Perú"
)

# Configurar CORS para permitir peticiones del Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rutas del API v1
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["General"])
def root():
    return {
        "message": f"Bienvenido al Backend de {settings.PROJECT_NAME}",
        "documentacion": "/docs",
        "estado": "operativo"
    }