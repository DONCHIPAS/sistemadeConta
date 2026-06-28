from typing import Generator
from sqlmodel import Session
from app.core.database import engine

def get_db() -> Generator[Session, None, None]:
    """
    Dependencia para obtener una sesión de base de datos SQLModel.
    Garantiza que la sesión se cierre correctamente tras completar la petición.
    """
    with Session(engine) as session:
        yield session
