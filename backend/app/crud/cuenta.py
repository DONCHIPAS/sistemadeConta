from typing import List, Optional
from sqlmodel import Session, select
from app.models.cuenta import Cuenta, CuentaCreate, CuentaUpdate

def get_cuentas(
    db: Session, 
    skip: int = 0, 
    limit: int = 500, 
    elemento: Optional[int] = None,
    activo: Optional[bool] = None
) -> List[Cuenta]:
    """
    Obtiene un listado de cuentas contables filtradas opcionalmente por elemento y estado de actividad.
    Ordenado ascendente por código de cuenta.
    """
    statement = select(Cuenta)
    if elemento is not None:
        statement = statement.where(Cuenta.elemento == elemento)
    if activo is not None:
        statement = statement.where(Cuenta.activo == activo)
    
    # Ordenamos por código para mantener la estructura jerárquica visualmente
    statement = statement.offset(skip).limit(limit).order_by(Cuenta.codigo)
    return db.exec(statement).all()

def get_cuenta_by_codigo(db: Session, codigo: str) -> Optional[Cuenta]:
    """
    Busca una cuenta contable específica por su código.
    """
    statement = select(Cuenta).where(Cuenta.codigo == codigo)
    return db.exec(statement).first()

def create_cuenta(db: Session, cuenta_in: CuentaCreate) -> Cuenta:
    """
    Crea una nueva cuenta contable en la base de datos.
    """
    db_cuenta = Cuenta.model_validate(cuenta_in)
    db.add(db_cuenta)
    db.commit()
    db.refresh(db_cuenta)
    return db_cuenta

def update_cuenta(db: Session, db_cuenta: Cuenta, cuenta_in: CuentaUpdate) -> Cuenta:
    """
    Actualiza parcialmente los datos de una cuenta contable existente.
    """
    cuenta_data = cuenta_in.model_dump(exclude_unset=True)
    for key, value in cuenta_data.items():
        setattr(db_cuenta, key, value)
    db.add(db_cuenta)
    db.commit()
    db.refresh(db_cuenta)
    return db_cuenta

def delete_cuenta(db: Session, db_cuenta: Cuenta) -> Cuenta:
    """
    Desactiva una cuenta contable (eliminación lógica).
    """
    db_cuenta.activo = False
    db.add(db_cuenta)
    db.commit()
    db.refresh(db_cuenta)
    return db_cuenta
