from fastapi import APIRouter
from app.api.v1 import cuentas

api_router = APIRouter()

# Incluir las rutas de cuentas contables del PCGE
api_router.include_router(cuentas.router, prefix="/cuentas", tags=["Cuentas PCGE"])
