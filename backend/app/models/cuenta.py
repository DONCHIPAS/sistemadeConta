from typing import Optional
from sqlmodel import Field, SQLModel

class CuentaBase(SQLModel):
    codigo: str = Field(index=True, unique=True, nullable=False)
    nombre: str = Field(nullable=False)
    tipo_saldo: str = Field(nullable=False)  # 'deudor' o 'acreedor'
    elemento: int = Field(index=True, nullable=False)  # Elementos del 1 al 7 (y otros en el futuro)
    categoria: str = Field(nullable=False)  # 'cuenta', 'subcuenta', 'divisionaria', 'subdivisionaria'
    activo: bool = Field(default=True)

class Cuenta(CuentaBase, table=True):
    """
    Modelo de Base de Datos para las Cuentas del Plan Contable (PCGE).
    """
    id: Optional[int] = Field(default=None, primary_key=True)

class CuentaCreate(CuentaBase):
    """
    Esquema para la creación de una cuenta contable.
    """
    pass

class CuentaRead(CuentaBase):
    """
    Esquema para la lectura de una cuenta contable (incluye ID).
    """
    id: int

class CuentaUpdate(SQLModel):
    """
    Esquema para la actualización parcial de una cuenta contable.
    """
    nombre: Optional[str] = None
    tipo_saldo: Optional[str] = None
    elemento: Optional[int] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = None
