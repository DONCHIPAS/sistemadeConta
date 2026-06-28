
import os
import sys

# =====================================================================
# ESCUDO PROTECTOR INTELIGENTE (100% SEGURO PARA TU LAPTOP)
# =====================================================================
if sys.platform == "win32":
    import builtins
    
    # Guardamos la función original de Python para abrir archivos
    _original_open = builtins.open
    
    # Creamos una versión mejorada que detecta si es texto o binario
    def _patched_open(*args, **kwargs):
        # Conseguimos el modo en que se abre el archivo ('r', 'w', 'rb', etc.)
        mode = kwargs.get('mode', args[1] if len(args) > 1 else 'r')
        
        # SI ES MODO TEXTO (no tiene una 'b'), le aplicamos el escudo UTF-8
        if 'b' not in mode:
            if 'encoding' not in kwargs:
                kwargs['encoding'] = 'utf-8'
            if 'errors' not in kwargs:
                kwargs['errors'] = 'ignore'
                
        return _original_open(*args, **kwargs)
    
    # Reemplazamos la función normal de Python por nuestro escudo
    builtins.open = _patched_open

    # Forzar la consola a no romperse con textos en pantalla
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='ignore')
        sys.stderr.reconfigure(encoding='utf-8', errors='ignore')
    except Exception:
        pass
# =====================================================================

import uvicorn
from dotenv import load_dotenv

# Tus configuraciones de la base de datos
os.environ["PYTHONUTF8"] = "1"
os.environ["POSTGRES_DB"] = "sistemaContable"

# Cargar variables del archivo .env si existe
load_dotenv()

if __name__ == "__main__":
    # Levantar el servidor Uvicorn para desarrollo local
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )