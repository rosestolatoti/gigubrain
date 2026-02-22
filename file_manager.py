"""
GigU Brain — File Manager
Gerencia e renumera fotos automaticamente
"""

import hashlib
from pathlib import Path
from config import FOTOS_DIR, EXTENSOES_VALIDAS
from database import registrar_foto, listar_fotos, foto_existe, hash_existe


def proximo_numero() -> str:
    fotos = listar_fotos()
    if not fotos:
        return "001"
    numeros = [int(f["numero"]) for f in fotos]
    return str(max(numeros) + 1).zfill(3)


def registrar_fotos_existentes():
    """Escaneia pasta fotos/ e registra no banco apenas as que ainda não estão"""
    arquivos = sorted([
        f for f in FOTOS_DIR.iterdir()
        if f.suffix.lower() in EXTENSOES_VALIDAS
    ])

    registradas = 0
    for arquivo in arquivos:
        if not foto_existe(str(arquivo)):
            numero = proximo_numero()
            registrar_foto(numero, arquivo.name, str(arquivo))
            registradas += 1

    return registradas


def salvar_upload(file_bytes: bytes, filename: str) -> dict:
    """Salva arquivo enviado via upload com número sequencial e checagem de duplicata"""
    sufixo = Path(filename).suffix.lower()
    if sufixo not in EXTENSOES_VALIDAS:
        return {"sucesso": False, "erro": "Formato não suportado"}

    # Checar duplicata por hash MD5
    hash_md5 = hashlib.md5(file_bytes).hexdigest()
    existente = hash_existe(hash_md5)
    if existente:
        return {
            "sucesso": False,
            "erro": f"Foto já existe no sistema como #{existente['numero']} ({existente['filename']})",
            "duplicada": True,
            "numero_existente": existente['numero']
        }

    numero = proximo_numero()
    novo_nome = f"{numero}_{Path(filename).stem}{sufixo}"
    destino = FOTOS_DIR / novo_nome

    with open(destino, "wb") as f:
        f.write(file_bytes)

    registrar_foto(numero, novo_nome, str(destino), hash_md5=hash_md5)

    return {
        "sucesso": True,
        "numero": numero,
        "filename": novo_nome,
        "filepath": str(destino)
    }


def listar_fotos_disco() -> list:
    """Lista fotos existentes na pasta com metadados"""
    return sorted([
        {
            "filename": f.name,
            "filepath": str(f),
            "tamanho_kb": round(f.stat().st_size / 1024, 1)
        }
        for f in FOTOS_DIR.iterdir()
        if f.suffix.lower() in EXTENSOES_VALIDAS
    ], key=lambda x: x["filename"])
