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
    try:
        init_db()
        print("¡Tablas de base de datos inicializadas en PostgreSQL con éxito!")
    except Exception as e:
        print(f"Advertencia de conexión: {str(e).encode('utf-8', errors='replace').decode('utf-8')}")
        print("Asegúrate de que PostgreSQL esté corriendo y configurado según tu archivo .env.")

    # Siembra automática si la base está vacía
    try:
        from sqlmodel import Session, select
        from app.models.cuenta import Cuenta
        import json, os
        with Session(engine) as session:
            count = len(session.exec(select(Cuenta)).all())
            if count == 0:
                json_path = os.path.join(os.path.dirname(__file__), "data", "pcge_cuentas.json")
                with open(json_path, "r", encoding="utf-8-sig") as f:
                    cuentas = json.load(f)
                for c in cuentas:
                    session.add(Cuenta(**c))
                session.commit()
                print(f"Siembra automática: {len(cuentas)} cuentas cargadas.")
            else:
                print(f"Base de datos ya tiene {count} cuentas.")
    except Exception as e:
        print(f"Error en siembra: {e}")

    print("Nota: Sistema listo.")
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