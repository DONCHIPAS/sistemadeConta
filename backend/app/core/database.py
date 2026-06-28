from sqlmodel import create_engine, SQLModel
from app.core.config import settings

# Crear el motor de conexión SQLModel para PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True
)

def init_db() -> None:
    """
    Crea todas las tablas definidas en los modelos si no existen.
    """
    SQLModel.metadata.create_all(engine)
