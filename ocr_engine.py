"""
GigU Brain — OCR Engine
Extração e limpeza de texto de imagens via Tesseract
"""

import re
import pytesseract
from PIL import Image, ImageEnhance
from pathlib import Path
from config import TESSERACT_LANG, TESSERACT_CONFIG, STOPWORDS, OCR_DIR
from datetime import datetime


# Padrões de lixo para remover
LIXO = [
    r'^\d{1,2}:\d{2}.*$',           # barra de status: 21:50 ...
    r'^.*\d+%.*$',                   # bateria: 95%
    r'^[<>|©®°•·\-_=]{2,}$',        # linhas de símbolos
    r'^\s*[<O|]\s*[IO|<>]\s*$',      # botões navegação < O IO
    r'^\s*\(\s*\d*\s*\)\s*$',        # (0)
    r'^Publicar sua resposta.*$',     # rodapé twitter
    r'^Traduzido do inglês.*$',       # label google translate
    r'^Ver tradução.*$',
    r'^Acessar o perfil.*$',
    r'^Abrir aplicativo.*$',
    r'^\s*€\s*Postar\s*$',
    r'^\s*←\s*Postar\s*$',
    r'^Seguir.*$',
    r'^Seguindo.*$',
    r'^\s*Posts\s*$',
    r'^\s*Postar\s*$',
    r'^.*Republicações.*Comentários.*$',
    r'^.*Curtidas.*Salvos.*$',
    r'^.*Visualizações.*$',
]


def preprocessar(image_path: str) -> Image.Image:
    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    # Corta barra de status do celular (8% do topo)
    topo = int(h * 0.08)
    img = img.crop((0, topo, w, h))

    # Upscale se necessário
    w, h = img.size
    if w < 1000:
        img = img.resize((w * 2, h * 2), Image.LANCZOS)

    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = ImageEnhance.Sharpness(img).enhance(2.0)
    return img


def limpar_texto(texto: str) -> str:
    linhas = texto.split('\n')
    limpas = []

    for linha in linhas:
        linha = linha.strip()
        if not linha or len(linha) < 3:
            continue
        ignorar = any(re.match(p, linha, re.IGNORECASE) for p in LIXO)
        if not ignorar:
            limpas.append(linha)

    return '\n'.join(limpas)


def extrair_palavras(texto: str) -> list:
    palavras = re.findall(r'\b[a-zA-ZÀ-ÿ]{2,}\b', texto.lower())
    return [p for p in palavras if p not in STOPWORDS]


def salvar_ocr_bruto(numero: str, filename: str, texto: str) -> Path:
    arquivo = OCR_DIR / f"{numero}_{Path(filename).stem}.md"
    conteudo = f"""---
foto: "{numero}"
arquivo: "{filename}"
data: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
caracteres: {len(texto)}
---

# OCR Bruto — Foto {numero}
```
{texto}
```
"""
    with open(arquivo, "w", encoding="utf-8") as f:
        f.write(conteudo)
    return arquivo


def processar_imagem(image_path: str, numero: str, filename: str) -> dict:
    try:
        img = preprocessar(image_path)
        texto_bruto = pytesseract.image_to_string(
            img,
            lang=TESSERACT_LANG,
            config=TESSERACT_CONFIG
        ).strip()

        texto_limpo = limpar_texto(texto_bruto)
        palavras = extrair_palavras(texto_limpo)
        salvar_ocr_bruto(numero, filename, texto_bruto)

        return {
            "sucesso": True,
            "texto_bruto": texto_bruto,
            "texto_limpo": texto_limpo,
            "palavras": palavras,
            "caracteres": len(texto_limpo)
        }

    except Exception as e:
        return {
            "sucesso": False,
            "erro": str(e),
            "texto_bruto": "",
            "texto_limpo": "",
            "palavras": [],
            "caracteres": 0
        }
