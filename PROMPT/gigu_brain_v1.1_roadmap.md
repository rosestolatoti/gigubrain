# GigU Brain — Roadmap v1.1
**Repositório:** https://github.com/rosestolatoti/gigubrain  
**Data:** 22/02/2026  
**Lead Dev:** Claude + Fabio

---

## 10 Tarefas Prioritárias

---

### #01 — Bug: Fotos duplicadas no banco
**Arquivo:** `file_manager.py` + `database.py`  
**Problema:** `registrar_fotos_existentes()` roda toda vez que o Flask inicia e re-registra as mesmas fotos.  
**Correção:** Antes de inserir, checar se `filepath` já existe no banco.

```python
# database.py — adicionar função
def foto_existe(filepath: str) -> bool:
    conn = get_conn()
    row = conn.execute("SELECT id FROM fotos WHERE filepath=?", (filepath,)).fetchone()
    conn.close()
    return row is not None

# file_manager.py — registrar_fotos_existentes()
# Adicionar verificação antes de registrar:
if not foto_existe(str(arquivo)):
    registrar_foto(numero, arquivo.name, str(arquivo))
```

---

### #02 — Bug: Detecção de foto duplicada no upload
**Arquivo:** `file_manager.py` + `database.py`  
**Problema:** Mesma imagem pode ser enviada com nome diferente — sem checagem de conteúdo.  
**Correção:** Gerar hash MD5 do arquivo e checar no banco antes de salvar.

```python
# database.py — adicionar coluna hash na tabela fotos
# ALTER TABLE fotos ADD COLUMN hash_md5 TEXT;

# file_manager.py
import hashlib

def gerar_hash(file_bytes: bytes) -> str:
    return hashlib.md5(file_bytes).hexdigest()

def hash_existe(hash_md5: str) -> bool:
    conn = get_conn()
    row = conn.execute("SELECT id FROM fotos WHERE hash_md5=?", (hash_md5,)).fetchone()
    conn.close()
    return row is not None

# Em salvar_upload():
hash_md5 = gerar_hash(file_bytes)
if hash_existe(hash_md5):
    return {"sucesso": False, "erro": "Foto já existe no sistema", "duplicada": True}
```

---

### #03 — Bug: Galeria some ao abrir OCR
**Arquivo:** `static/app.js` + `templates/index.html`  
**Problema:** Ao abrir painel OCR, seção galeria some da tela.  
**Correção:** Mudar para layout modal — OCR abre por cima da galeria sem esconder nada.

```javascript
// app.js — trocar lógica de show/hide por modal
// Adicionar overlay escuro + painel centralizado
// Galeria continua visível atrás do modal
// Botão X fecha o modal e retorna à galeria
```

**HTML — adicionar estrutura modal:**
```html
<div id="modal-ocr" class="modal-overlay" style="display:none">
  <div class="modal-content">
    <!-- conteúdo do OCR aqui -->
    <button class="modal-fechar" onclick="fecharOCR()">✕</button>
  </div>
</div>
```

---

### #04 — Feature: Botão deletar foto
**Arquivo:** `app.py` + `database.py` + `static/app.js`  
**Problema:** Sem como remover foto do sistema.  
**Correção:** Endpoint DELETE + botão no card da galeria e no painel OCR.

```python
# app.py
@app.route("/api/foto/<numero>", methods=["DELETE"])
def api_deletar_foto(numero):
    foto = buscar_foto(numero)
    if not foto:
        return jsonify({"erro": "Não encontrada"}), 404
    Path(foto["filepath"]).unlink(missing_ok=True)
    deletar_foto_db(numero)  # remover do banco + palavras associadas
    return jsonify({"sucesso": True})
```

---

### #05 — Feature: Tema claro/escuro com toggle
**Arquivo:** `static/style.css` + `static/app.js` + `templates/index.html`  
**Problema:** Só existe modo dark. Modo claro é prioridade.  
**Correção:** CSS variables para ambos os temas + toggle no header + salvar preferência em localStorage.

```css
/* style.css — adicionar tema claro */
[data-theme="light"] {
  --bg:     #f8fafc;
  --bg2:    #ffffff;
  --bg3:    #f1f5f9;
  --border: #e2e8f0;
  --text:   #0f172a;
  --text2:  #475569;
  --text3:  #94a3b8;
}
```

```javascript
// app.js
function toggleTheme() {
  const atual = document.documentElement.getAttribute("data-theme");
  const novo = atual === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("gigu-theme", novo);
}

// Na inicialização:
const tema = localStorage.getItem("gigu-theme") || "light";
document.documentElement.setAttribute("data-theme", tema);
```

---

### #06 — UX: Reorganizar layout da página
**Arquivo:** `templates/index.html` + `static/style.css`  
**Problema:** Brain Map está embaixo de tudo — deveria ser acessível sem scroll longo.  
**Correção:** Sidebar fixa à esquerda com navegação + área principal à direita.

```
┌─────────────────────────────────────────────┐
│  HEADER — logo + stats + toggle tema        │
├──────────┬──────────────────────────────────┤
│ SIDEBAR  │  ÁREA PRINCIPAL                  │
│ (240px)  │                                  │
│ Upload   │  [aba ativa: Galeria / Brain Map] │
│ ──────   │                                  │
│ Grupos   │                                  │
│ ──────   │                                  │
│ Top 10   │                                  │
│ palavras │                                  │
└──────────┴──────────────────────────────────┘
```

---

### #07 — UX: Navegação por abas
**Arquivo:** `templates/index.html` + `static/app.js`  
**Problema:** Tudo em seções verticais — confuso para navegar.  
**Correção:** Abas na área principal: Galeria | Brain Map | Upload

```html
<div class="abas">
  <button class="aba ativa" onclick="trocarAba('galeria')">📷 Galeria</button>
  <button class="aba" onclick="trocarAba('brain')">🧠 Brain Map</button>
  <button class="aba" onclick="trocarAba('upload')">⬆ Upload</button>
</div>
```

---

### #08 — Feature: Busca full-text nas fotos
**Arquivo:** `app.py` + `static/app.js` + `templates/index.html`  
**Problema:** Sem como buscar por texto dentro das fotos processadas.  
**Correção:** Input de busca no header + endpoint de search.

```python
# app.py
@app.route("/api/buscar", methods=["GET"])
def api_buscar():
    termo = request.args.get("q", "").strip()
    if not termo:
        return jsonify([])
    conn = get_conn()
    rows = conn.execute("""
        SELECT * FROM fotos 
        WHERE ocr_limpo LIKE ? OR ocr_texto LIKE ?
        ORDER BY numero
    """, (f"%{termo}%", f"%{termo}%")).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
```

---

### #09 — Qualidade: Try/catch no frontend
**Arquivo:** `static/app.js`  
**Problema:** Funções async sem tratamento de erro — qualquer falha da API quebra silenciosamente.  
**Correção:** Envolver todas as chamadas fetch em try/catch com feedback visual.

```javascript
// Padrão a aplicar em todas as funções async:
async function carregarFotos() {
  try {
    const res = await fetch("/api/fotos");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    todasFotos = await res.json();
    renderGaleria(todasFotos);
  } catch (e) {
    mostrarErro("Erro ao carregar fotos: " + e.message);
  }
}
```

---

### #10 — Qualidade: Conexão SQLite com context manager
**Arquivo:** `database.py`  
**Problema:** Cada função abre e fecha conexão manualmente — verboso e propenso a vazamentos.  
**Correção:** Context manager Python para garantir fechamento mesmo em erros.

```python
# database.py — substituir get_conn() por:
from contextlib import contextmanager

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# Uso em todas as funções:
def listar_fotos():
    with get_db() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM fotos ORDER BY numero")]
```

---

## Ordem de Execução Recomendada

| # | Tarefa | Tipo | Impacto |
|---|--------|------|---------|
| 01 | Fotos duplicadas no banco | 🔴 Bug | Alto |
| 02 | Hash MD5 upload duplicado | 🔴 Bug | Alto |
| 03 | Galeria some ao abrir OCR | 🔴 Bug | Alto |
| 05 | Tema claro/escuro | ✨ Feature | Alto |
| 06 | Layout sidebar | ✨ Feature | Alto |
| 07 | Navegação por abas | ✨ Feature | Médio |
| 04 | Botão deletar foto | ✨ Feature | Médio |
| 08 | Busca full-text | ✨ Feature | Médio |
| 09 | Try/catch frontend | 🟡 Qualidade | Médio |
| 10 | Context manager SQLite | 🟡 Qualidade | Baixo |

---

*GigU Brain — desenvolvido com Claude (Anthropic) + Fabio*
