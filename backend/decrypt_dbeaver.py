from Crypto.Cipher import AES
import json
import os
import sys

# Llave fija utilizada por DBeaver para el cifrado AES
KEY = bytes([186, 187, 74, 159, 119, 74, 184, 83, 201, 108, 45, 101, 61, 254, 84, 74])

path = r"C:\Users\Josue\AppData\Roaming\DBeaverData\workspace6\General\.dbeaver\credentials-config.json"

if not os.path.exists(path):
    print("No se encontró el archivo de credenciales de DBeaver.")
    sys.exit(1)

try:
    with open(path, "rb") as f:
        data = f.read()

    # El cifrado en DBeaver usa AES CBC, donde los primeros 16 bytes son el Vector de Inicialización (IV)
    iv = data[:16]
    encrypted = data[16:]
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(encrypted)

    # Limpieza del padding PKCS7
    padding_len = decrypted[-1]
    if padding_len < 16:
        if all(decrypted[-i] == padding_len for i in range(1, padding_len + 1)):
            decrypted = decrypted[:-padding_len]
            
    # Limpieza de bytes nulos/caracteres de control extras
    text = decrypted.rstrip(b'\x00').rstrip(b'\x08').decode('utf-8', 'ignore')
    
    # Parsear JSON decodificado
    config = json.loads(text)
    
    # Buscar credenciales asociadas a PostgreSQL
    postgres_conn = None
    for conn_id, conn_data in config.items():
        if "postgres" in conn_id or "sistemaContable" in conn_id:
            postgres_conn = conn_data
            break
            
    if not postgres_conn and config:
        postgres_conn = list(config.values())[0]

    if postgres_conn:
        # Buscar recursivamente llaves para 'user' y 'password'
        def find_key(d, key_name):
            if isinstance(d, dict):
                for k, v in d.items():
                    if k.lower() == key_name.lower():
                        return v
                    res = find_key(v, key_name)
                    if res is not None:
                        return res
            elif isinstance(d, list):
                for item in d:
                    res = find_key(item, key_name)
                    if res is not None:
                        return res
            return None

        password = find_key(postgres_conn, "password")
        user = find_key(postgres_conn, "user")
        
        print(f"Usuario decodificado: {user}")
        print(f"Contraseña decodificada: {password}")
        
        if password:
            # Actualizar el archivo .env
           # Actualizar el archivo .env
            env_path = ".env"
            if os.path.exists(env_path):
                # LE AGREGAMOS errors="ignore" AQUÍ ABAJO PARA QUE NO EXPLOTE
                with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                with open(env_path, "w", encoding="utf-8", errors="ignore") as f:
                    for line in lines:
                        if line.startswith("POSTGRES_PASSWORD="):
                            f.write(f"POSTGRES_PASSWORD={password}\n")
                        elif line.startswith("POSTGRES_USER=") and user:
                            f.write(f"POSTGRES_USER={user}\n")
                        else:
                            f.write(line)
                print("Archivo .env actualizado exitosamente.")
                sys.exit(0)
            
except Exception as e:
    print(f"Error al decifrar: {e}")
    sys.exit(1)
