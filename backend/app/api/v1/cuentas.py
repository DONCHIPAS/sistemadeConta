import json
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.api import deps
from app.crud import cuenta as crud_cuenta
from app.models.cuenta import CuentaRead, CuentaCreate, CuentaUpdate, Cuenta

router = APIRouter()

@router.get("/", response_model=List[CuentaRead])
def read_cuentas(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 500,
    elemento: Optional[int] = None,
    activo: Optional[bool] = None
):
    """
    Obtiene el catálogo de cuentas del Plan Contable General Empresarial (PCGE).
    Permite filtrar por elemento (1-7) y por estado activo.
    """
    return crud_cuenta.get_cuentas(db, skip=skip, limit=limit, elemento=elemento, activo=activo)

@router.get("/{codigo}", response_model=CuentaRead)
def read_cuenta(codigo: str, db: Session = Depends(deps.get_db)):
    """
    Obtiene el detalle de una cuenta específica mediante su código numérico (ej. 10411).
    """
    db_cuenta = crud_cuenta.get_cuenta_by_codigo(db, codigo=codigo)
    if not db_cuenta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"La cuenta contable con código '{codigo}' no fue encontrada."
        )
    return db_cuenta

@router.post("/", response_model=CuentaRead, status_code=status.HTTP_201_CREATED)
def create_cuenta(cuenta_in: CuentaCreate, db: Session = Depends(deps.get_db)):
    """
    Crea una nueva cuenta o subcuenta en el PCGE.
    """
    db_cuenta = crud_cuenta.get_cuenta_by_codigo(db, codigo=cuenta_in.codigo)
    if db_cuenta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"La cuenta contable con código '{cuenta_in.codigo}' ya existe."
        )
    return crud_cuenta.create_cuenta(db, cuenta_in=cuenta_in)

@router.put("/{codigo}", response_model=CuentaRead)
def update_cuenta(codigo: str, cuenta_in: CuentaUpdate, db: Session = Depends(deps.get_db)):
    """
    Actualiza parcialmente una cuenta contable existente.
    """
    db_cuenta = crud_cuenta.get_cuenta_by_codigo(db, codigo=codigo)
    if not db_cuenta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"La cuenta contable con código '{codigo}' no existe."
        )
    return crud_cuenta.update_cuenta(db, db_cuenta=db_cuenta, cuenta_in=cuenta_in)

@router.delete("/{codigo}", response_model=CuentaRead)
def delete_cuenta(codigo: str, db: Session = Depends(deps.get_db)):
    """
    Desactiva (eliminación lógica) una cuenta contable.
    """
    db_cuenta = crud_cuenta.get_cuenta_by_codigo(db, codigo=codigo)
    if not db_cuenta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"La cuenta contable con código '{codigo}' no existe."
        )
    return crud_cuenta.delete_cuenta(db, db_cuenta=db_cuenta)

@router.post("/seed", status_code=status.HTTP_200_OK)
def seed_cuentas(db: Session = Depends(deps.get_db)):
    """
    Carga el catálogo detallado del PCGE desde el archivo JSON de datos base a la base de datos PostgreSQL.
    Solo insertará aquellas cuentas que no existan previamente.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    json_path = os.path.join(base_dir, "data", "pcge_cuentas.json")
    
    if not os.path.exists(json_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo encontrar el archivo de datos base en {json_path}."
        )
        
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            cuentas_data = json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al leer el archivo JSON de cuentas: {str(e)}"
        )
        
    inserted_count = 0
    for item in cuentas_data:
        existing = crud_cuenta.get_cuenta_by_codigo(db, codigo=item["codigo"])
        if not existing:
            cuenta_in = CuentaCreate(
                codigo=item["codigo"],
                nombre=item["nombre"],
                tipo_saldo=item["tipo_saldo"],
                elemento=item["elemento"],
                categoria=item["categoria"]
            )
            crud_cuenta.create_cuenta(db, cuenta_in=cuenta_in)
            inserted_count += 1
            
    return {"message": "Siembra completada con éxito.", "cuentas_agregadas": inserted_count}
