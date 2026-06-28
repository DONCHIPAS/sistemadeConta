import os
import json

def verify_pcge_json():
    print("--- Iniciando verificación de catálogo PCGE JSON ---")
    json_path = os.path.join("backend", "app", "data", "pcge_cuentas.json")
    
    if not os.path.exists(json_path):
        print(f"ERROR: No se encontró el archivo en {json_path}")
        return False
        
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        print(f"ÉXITO: El archivo JSON es válido. Contiene {len(data)} cuentas.")
        
        # Agrupar por elemento
        elementos = {}
        categorias = {}
        for item in data:
            el = item.get("elemento")
            cat = item.get("categoria")
            elementos[el] = elementos.get(el, 0) + 1
            categorias[cat] = categorias.get(cat, 0) + 1
            
        print("\nDistribución por Elemento:")
        for el in sorted(elementos.keys()):
            print(f"  Elemento {el}: {elementos[el]} cuentas")
            
        print("\nDistribución por Categoría:")
        for cat, count in categorias.items():
            print(f"  {cat}: {count}")
            
        return True
    except Exception as e:
        print(f"ERROR al leer y verificar el archivo JSON: {e}")
        return False

if __name__ == "__main__":
    verify_pcge_json()
