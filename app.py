"""
GigU Brain — Flask Server
API e servidor principal
"""

from flask import Flask, request, jsonify, render_template, send_from_directory
from pathlib import Path
from config import FOTOS_DIR, STATIC_DIR
from database import init_db, listar_fotos, buscar_foto, atualizar_ocr, atualizar_ocr_limpo, atualizar_palavras, top_palavras, listar_grupos
from file_manager import salvar_upload, registrar_fotos_existentes
from ocr_engine import processar_imagem
import base64

app = Flask(__name__)
init_db()
registrar_fotos_existentes()


# ─── PÁGINAS ────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─── FOTOS ──────────────────────────────────────────────

@app.route("/api/fotos", methods=["GET"])
def api_fotos():
    fotos = listar_fotos()
    return jsonify(fotos)


@app.route("/api/foto/<numero>", methods=["GET"])
def api_foto(numero):
    foto = buscar_foto(numero)
    if not foto:
        return jsonify({"erro": "Foto não encontrada"}), 404
    return jsonify(foto)


@app.route("/api/foto/imagem/<numero>")
def api_imagem(numero):
    foto = buscar_foto(numero)
    if not foto:
        return jsonify({"erro": "Não encontrada"}), 404
    path = Path(foto["filepath"])
    return send_from_directory(path.parent, path.name)


# ─── UPLOAD ─────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def api_upload():
    files = request.files.getlist("fotos")
    if not files:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    if len(files) > 5:
        return jsonify({"erro": "Máximo 5 fotos por vez"}), 400

    resultados = []
    for file in files:
        resultado = salvar_upload(file.read(), file.filename)
        resultados.append(resultado)

    return jsonify({"resultados": resultados})


# ─── OCR ────────────────────────────────────────────────

@app.route("/api/ocr/<numero>", methods=["POST"])
def api_ocr(numero):
    foto = buscar_foto(numero)
    if not foto:
        return jsonify({"erro": "Foto não encontrada"}), 404

    resultado = processar_imagem(foto["filepath"], numero, foto["filename"])

    if resultado["sucesso"]:
        atualizar_ocr(numero, resultado["texto_bruto"])
        atualizar_ocr_limpo(numero, resultado["texto_limpo"])
        atualizar_palavras(numero, resultado["palavras"])

    return jsonify(resultado)


@app.route("/api/ocr/<numero>/salvar", methods=["POST"])
def api_salvar_ocr(numero):
    data = request.get_json()
    texto = data.get("texto", "")
    atualizar_ocr_limpo(numero, texto)
    return jsonify({"sucesso": True})


# ─── PALAVRAS ───────────────────────────────────────────

@app.route("/api/palavras", methods=["GET"])
def api_palavras():
    limit = request.args.get("limit", 100, type=int)
    palavras = top_palavras(limit)
    return jsonify(palavras)


@app.route("/api/grupos", methods=["GET"])
def api_grupos():
    grupos = listar_grupos()
    return jsonify(grupos)


# ─── START ──────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
