# GigU Brain v1.1 — Implementação Completa
**Repositório:** https://github.com/rosestolatoti/gigubrain  
**Executar na pasta:** `~/Área de trabalho/leitorcontextofoto/`  
**Ordem:** Execute as tarefas em sequência. Não pule etapas.

---

## TAREFA 01 — Corrigir fotos duplicadas no banco

**Arquivo:** `database.py`

Adicionar função `foto_existe()` logo após a função `registrar_foto()`:

```python
def foto_existe(filepath: str) -> bool:
    conn = get_conn()
    row = conn.execute("SELECT id FROM fotos WHERE filepath=?", (filepath,)).fetchone()
    conn.close()
    return row is not None
```

**Arquivo:** `file_manager.py`

Substituir a função `registrar_fotos_existentes()` completa por:

```python
def registrar_fotos_existentes():
    """Escaneia pasta fotos/ e registra no banco apenas as que ainda não estão"""
    from database import foto_existe
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
```

---

## TAREFA 02 — Detectar upload de foto duplicada via MD5

**Arquivo:** `database.py`

Executar no terminal para adicionar coluna ao banco existente:

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('gigu_brain.db')
try:
    conn.execute('ALTER TABLE fotos ADD COLUMN hash_md5 TEXT')
    conn.commit()
    print('Coluna hash_md5 adicionada')
except Exception as e:
    print('Já existe ou erro:', e)
conn.close()
"
```

Adicionar função `hash_existe()` em `database.py` após `foto_existe()`:

```python
def hash_existe(hash_md5: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT numero, filename FROM fotos WHERE hash_md5=?", (hash_md5,)).fetchone()
    conn.close()
    return dict(row) if row else None
```

**Arquivo:** `file_manager.py`

Adicionar import no topo do arquivo:

```python
import hashlib
```

Substituir a função `salvar_upload()` completa por:

```python
def salvar_upload(file_bytes: bytes, filename: str) -> dict:
    """Salva arquivo enviado via upload com número sequencial e checagem de duplicata"""
    from database import hash_existe

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
```

**Arquivo:** `database.py`

Substituir a função `registrar_foto()` completa por:

```python
def registrar_foto(numero: str, filename: str, filepath: str, hash_md5: str = None) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO fotos (numero, filename, filepath, hash_md5, criado_em)
        VALUES (?, ?, ?, ?, ?)
    """, (numero, filename, filepath, hash_md5, datetime.now().isoformat()))
    conn.commit()
    id_ = cur.lastrowid
    conn.close()
    return id_
```

---

## TAREFA 03 — Corrigir galeria sumindo ao abrir OCR (Modal)

**Arquivo:** `templates/index.html`

Substituir a section inteira `id="section-ocr"` por:

```html
<!-- MODAL OCR -->
<div id="modal-ocr" class="modal-overlay" style="display:none" onclick="fecharOCROverlay(event)">
  <div class="modal-box">
    <div class="modal-header">
      <h2>Foto <span id="ocr-numero"></span></h2>
      <div class="modal-acoes-header">
        <button class="btn-nav" id="btn-foto-anterior" onclick="navegarFoto(-1)">‹ Anterior</button>
        <button class="btn-nav" id="btn-foto-proxima" onclick="navegarFoto(1)">Próxima ›</button>
        <button class="btn-deletar" id="btn-deletar-foto">🗑 Deletar</button>
        <button class="btn-fechar" onclick="fecharOCR()">✕</button>
      </div>
    </div>
    <div class="modal-body">
      <div class="ocr-imagem">
        <img id="ocr-img" src="" alt="Foto selecionada">
      </div>
      <div class="ocr-texto">
        <div class="ocr-acoes">
          <button class="btn-primary" id="btn-extrair">⚡ Extrair Texto</button>
          <button class="btn-secondary" id="btn-limpar-texto" style="display:none">🧹 Limpar</button>
          <button class="btn-success" id="btn-salvar-texto" style="display:none">💾 Salvar</button>
        </div>
        <div class="ocr-status" id="ocr-status"></div>
        <textarea id="ocr-area" placeholder="O texto extraído aparecerá aqui..."></textarea>
      </div>
    </div>
  </div>
</div>
```

**Arquivo:** `static/style.css`

Adicionar no final do arquivo:

```css
/* ─── MODAL OCR ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal-box {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 16px;
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg2);
  z-index: 10;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text);
}

.modal-acoes-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.modal-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 24px;
}

@media (max-width: 768px) {
  .modal-body { grid-template-columns: 1fr; }
}

.btn-nav {
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--text2);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.btn-nav:hover { border-color: var(--accent); color: var(--accent2); }

.btn-deletar {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  color: #ef4444;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.btn-deletar:hover { background: rgba(239,68,68,0.2); }
```

**Arquivo:** `static/app.js`

Substituir a função `abrirFoto()` completa por:

```javascript
async function abrirFoto(numero) {
  fotoAtual = numero;
  const foto = await fetch(`/api/foto/${numero}`).then(r => r.json());

  document.getElementById("modal-ocr").style.display = "flex";
  document.body.style.overflow = "hidden";

  document.getElementById("ocr-numero").textContent = `#${numero}`;
  document.getElementById("ocr-img").src = `/api/foto/imagem/${numero}`;
  document.getElementById("ocr-area").value = foto.ocr_limpo || foto.ocr_texto || "";
  document.getElementById("ocr-status").textContent = "";

  const temTexto = !!(foto.ocr_limpo || foto.ocr_texto);
  document.getElementById("btn-limpar-texto").style.display = temTexto ? "inline-block" : "none";
  document.getElementById("btn-salvar-texto").style.display = temTexto ? "inline-block" : "none";

  document.getElementById("btn-extrair").onclick = () => extrairOCR(numero);
  document.getElementById("btn-limpar-texto").onclick = () => limparTextoManual();
  document.getElementById("btn-salvar-texto").onclick = () => salvarTexto(numero);
  document.getElementById("btn-deletar-foto").onclick = () => deletarFoto(numero);
}

function fecharOCR() {
  document.getElementById("modal-ocr").style.display = "none";
  document.body.style.overflow = "";
  fotoAtual = null;
}

function fecharOCROverlay(event) {
  if (event.target === document.getElementById("modal-ocr")) {
    fecharOCR();
  }
}

function navegarFoto(direcao) {
  const idx = todasFotos.findIndex(f => f.numero === fotoAtual);
  const novoIdx = idx + direcao;
  if (novoIdx >= 0 && novoIdx < todasFotos.length) {
    abrirFoto(todasFotos[novoIdx].numero);
  }
}
```

Remover do `app.js` a função `fecharOCR()` antiga (que usava section-ocr).

---

## TAREFA 04 — Botão deletar foto

**Arquivo:** `database.py`

Adicionar função `deletar_foto_db()` e `remover_foto_das_palavras()`:

```python
def deletar_foto_db(numero: str):
    import json
    conn = get_conn()

    # Remover referência da tabela de palavras
    palavras = conn.execute("SELECT id, fotos_ids, contagem FROM palavras").fetchall()
    for p in palavras:
        fotos = json.loads(p["fotos_ids"] or "[]")
        if numero in fotos:
            fotos.remove(numero)
            nova_contagem = max(0, p["contagem"] - 1)
            if nova_contagem == 0:
                conn.execute("DELETE FROM palavras WHERE id=?", (p["id"],))
            else:
                conn.execute(
                    "UPDATE palavras SET fotos_ids=?, contagem=? WHERE id=?",
                    (json.dumps(fotos), nova_contagem, p["id"])
                )

    conn.execute("DELETE FROM fotos WHERE numero=?", (numero,))
    conn.commit()
    conn.close()
```

**Arquivo:** `app.py`

Adicionar import no topo:

```python
from database import deletar_foto_db
```

Adicionar rota DELETE:

```python
@app.route("/api/foto/<numero>", methods=["DELETE"])
def api_deletar_foto(numero):
    foto = buscar_foto(numero)
    if not foto:
        return jsonify({"erro": "Não encontrada"}), 404
    try:
        Path(foto["filepath"]).unlink(missing_ok=True)
    except Exception:
        pass
    deletar_foto_db(numero)
    return jsonify({"sucesso": True})
```

**Arquivo:** `static/app.js`

Adicionar função `deletarFoto()`:

```javascript
async function deletarFoto(numero) {
  if (!confirm(`Deletar foto #${numero}? Esta ação não pode ser desfeita.`)) return;

  try {
    const res = await fetch(`/api/foto/${numero}`, { method: "DELETE" });
    const data = await res.json();
    if (data.sucesso) {
      fecharOCR();
      await carregarFotos();
      await carregarPalavras();
    }
  } catch (e) {
    alert("Erro ao deletar foto");
  }
}
```

---

## TAREFA 05 — Tema claro/escuro com toggle

**Arquivo:** `static/style.css`

No início do arquivo, substituir o bloco `:root { ... }` existente por:

```css
/* ─── TEMA CLARO (padrão) ─── */
:root, [data-theme="light"] {
  --bg:        #f8fafc;
  --bg2:       #ffffff;
  --bg3:       #f1f5f9;
  --border:    #e2e8f0;
  --accent:    #6366f1;
  --accent2:   #4f46e5;
  --success:   #16a34a;
  --warning:   #d97706;
  --danger:    #dc2626;
  --text:      #0f172a;
  --text2:     #334155;
  --text3:     #94a3b8;
  --shadow:    0 4px 24px rgba(0,0,0,0.08);
  --radius:    12px;
}

/* ─── TEMA ESCURO ─── */
[data-theme="dark"] {
  --bg:        #0f1117;
  --bg2:       #1a1d27;
  --bg3:       #242736;
  --border:    #2e3148;
  --accent:    #6366f1;
  --accent2:   #818cf8;
  --success:   #22c55e;
  --warning:   #f59e0b;
  --danger:    #ef4444;
  --text:      #e2e8f0;
  --text2:     #94a3b8;
  --text3:     #64748b;
  --shadow:    0 4px 24px rgba(0,0,0,0.4);
  --radius:    12px;
}
```

**Arquivo:** `templates/index.html`

No `<header>`, adicionar botão de toggle entre `.header-stats` e o fechamento `</header>`:

```html
<button class="btn-tema" onclick="toggleThema()" id="btn-tema" title="Alternar tema">
  <span id="tema-icon">🌙</span>
</button>
```

Adicionar CSS para o botão em `style.css`:

```css
.btn-tema {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  line-height: 1;
}
.btn-tema:hover { border-color: var(--accent); }
```

**Arquivo:** `static/app.js`

Adicionar no início do `DOMContentLoaded`:

```javascript
// Tema
const temaSalvo = localStorage.getItem("gigu-tema") || "light";
document.documentElement.setAttribute("data-theme", temaSalvo);
document.getElementById("tema-icon").textContent = temaSalvo === "dark" ? "☀️" : "🌙";
```

Adicionar função `toggleThema()`:

```javascript
function toggleThema() {
  const atual = document.documentElement.getAttribute("data-theme");
  const novo = atual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("gigu-tema", novo);
  document.getElementById("tema-icon").textContent = novo === "dark" ? "☀️" : "🌙";
}
```

---

## TAREFA 06 — Reorganizar layout: Sidebar + Área Principal

**Arquivo:** `templates/index.html`

Substituir o conteúdo inteiro de `<main>` por:

```html
<main>
  <!-- SIDEBAR -->
  <aside class="sidebar">

    <div class="sidebar-section">
      <h3>⬆ Upload</h3>
      <div class="upload-area" id="upload-area">
        <input type="file" id="input-fotos" multiple accept="image/*" hidden>
        <div class="upload-placeholder" id="upload-placeholder">
          <span class="upload-icon">📁</span>
          <p><button onclick="document.getElementById('input-fotos').click()">Selecionar fotos</button></p>
          <small>Máx 5 · JPG PNG WEBP</small>
        </div>
        <div class="upload-preview" id="upload-preview"></div>
        <button class="btn-primary full-width" id="btn-upload" style="display:none">Enviar</button>
      </div>
    </div>

    <div class="sidebar-section">
      <h3>🏷 Grupos</h3>
      <div class="grupos-filtro sidebar-grupos" id="grupos-filtro"></div>
    </div>

    <div class="sidebar-section">
      <h3>🔥 Top Palavras</h3>
      <div class="top-palavras-sidebar" id="top-palavras-sidebar"></div>
    </div>

  </aside>

  <!-- ÁREA PRINCIPAL -->
  <div class="area-principal">

    <!-- ABAS -->
    <div class="abas">
      <button class="aba ativa" data-aba="galeria" onclick="trocarAba('galeria', this)">📷 Galeria</button>
      <button class="aba" data-aba="brain" onclick="trocarAba('brain', this)">🧠 Brain Map</button>
    </div>

    <!-- ABA GALERIA -->
    <div class="aba-conteudo" id="aba-galeria">
      <div class="galeria-toolbar">
        <input type="text" id="input-busca" placeholder="🔍 Buscar nas fotos..." oninput="buscarFotos(this.value)">
        <div class="filtros">
          <button class="filtro-btn ativo" data-status="todos">Todas</button>
          <button class="filtro-btn" data-status="pendente">Pendentes</button>
          <button class="filtro-btn" data-status="ocr_feito">Processadas</button>
        </div>
      </div>
      <div class="galeria-grid" id="galeria-grid">
        <div class="loading">Carregando fotos...</div>
      </div>
    </div>

    <!-- ABA BRAIN MAP -->
    <div class="aba-conteudo" id="aba-brain" style="display:none">
      <div class="word-cloud" id="word-cloud">
        <p class="empty">Processe fotos para construir o Brain Map</p>
      </div>
      <div class="top-palavras" id="top-palavras"></div>
    </div>

  </div>
</main>
```

**Arquivo:** `static/style.css`

Substituir o bloco `main { ... }` existente por:

```css
main {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 0;
  max-width: 100%;
  min-height: calc(100vh - 60px);
}

/* ─── SIDEBAR ─── */
.sidebar {
  background: var(--bg2);
  border-right: 1px solid var(--border);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.sidebar-section h3 {
  font-size: 11px;
  font-weight: 700;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
}

.sidebar-grupos {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-grupos .grupo-tag {
  text-align: left;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
}

.top-palavras-sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.top-palavras-sidebar .palavra-row {
  font-size: 12px;
  padding: 5px 10px;
}

/* ─── ÁREA PRINCIPAL ─── */
.area-principal {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

/* ─── ABAS ─── */
.abas {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid var(--border);
  padding-bottom: 0;
}

.aba {
  background: none;
  border: none;
  color: var(--text3);
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.aba.ativa {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.aba:hover:not(.ativa) { color: var(--text2); }

/* ─── GALERIA TOOLBAR ─── */
.galeria-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

#input-busca {
  flex: 1;
  min-width: 200px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 14px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
#input-busca:focus { border-color: var(--accent); }

/* ─── UPLOAD SIDEBAR ─── */
.upload-area {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
  transition: border-color 0.2s;
}
.upload-area.drag-over { border-color: var(--accent); background: rgba(99,102,241,0.05); }
.upload-icon { font-size: 28px; display: block; margin-bottom: 8px; }
.upload-placeholder p { color: var(--text2); font-size: 13px; margin-bottom: 4px; }
.upload-placeholder small { color: var(--text3); font-size: 11px; }
.upload-placeholder button {
  background: none; border: none; color: var(--accent);
  cursor: pointer; font-size: 13px; text-decoration: underline;
}
.full-width { width: 100%; margin-top: 10px; }
```

**Arquivo:** `static/app.js`

Adicionar função `trocarAba()`:

```javascript
function trocarAba(aba, el) {
  document.querySelectorAll(".aba").forEach(b => b.classList.remove("ativa"));
  document.querySelectorAll(".aba-conteudo").forEach(c => c.style.display = "none");
  if (el) el.classList.add("ativa");
  document.getElementById(`aba-${aba}`).style.display = "block";

  if (aba === "brain") carregarPalavras();
}
```

Atualizar `carregarPalavras()` para também atualizar sidebar:

```javascript
// Dentro de carregarPalavras(), após renderizar top-palavras, adicionar:
const sidebarTop = document.getElementById("top-palavras-sidebar");
if (sidebarTop) {
  sidebarTop.innerHTML = palavras.slice(0, 15).map(p => {
    const fotos = JSON.parse(p.fotos_ids || "[]");
    return `<div class="palavra-row" title="Fotos: ${fotos.join(', ')}">
      <span class="palavra">${p.palavra}</span>
      <span class="contagem">${p.contagem}×</span>
    </div>`;
  }).join("");
}
```

---

## TAREFA 07 — Busca full-text nas fotos

**Arquivo:** `app.py`

Adicionar rota de busca:

```python
@app.route("/api/buscar", methods=["GET"])
def api_buscar():
    termo = request.args.get("q", "").strip()
    if not termo or len(termo) < 2:
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

Adicionar import no topo de `app.py` se não existir:

```python
from database import get_conn
```

**Arquivo:** `static/app.js`

Adicionar função `buscarFotos()` com debounce:

```javascript
let buscaTimeout = null;

function buscarFotos(termo) {
  clearTimeout(buscaTimeout);
  buscaTimeout = setTimeout(async () => {
    if (termo.length < 2) {
      renderGaleria(todasFotos);
      return;
    }
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(termo)}`);
      const resultados = await res.json();
      renderGaleria(resultados);
    } catch (e) {
      console.error("Erro na busca:", e);
    }
  }, 300);
}
```

---

## TAREFA 08 — Try/catch em todas as funções async do frontend

**Arquivo:** `static/app.js`

Adicionar função helper de erro no início do arquivo (após declarações de variáveis):

```javascript
function mostrarErro(msg) {
  console.error(msg);
  const status = document.getElementById("ocr-status");
  if (status) {
    status.textContent = "⚠ " + msg;
    status.style.color = "var(--danger)";
  }
}
```

Substituir `carregarFotos()` completa por:

```javascript
async function carregarFotos() {
  try {
    const res = await fetch("/api/fotos");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    todasFotos = await res.json();
    renderGaleria(todasFotos);
    atualizarStats(todasFotos.length, 0);
  } catch (e) {
    mostrarErro("Erro ao carregar fotos: " + e.message);
  }
}
```

Substituir `carregarPalavras()` — adicionar try/catch envolvendo todo o corpo da função.

Substituir `carregarGrupos()` — adicionar try/catch envolvendo todo o corpo da função.

Substituir `extrairOCR()` — já tem try/catch, garantir que o catch exibe mensagem via `mostrarErro()`.

Substituir `enviarFotos()` — no catch, exibir mensagem detalhada.

---

## TAREFA 09 — Context manager SQLite

**Arquivo:** `database.py`

Adicionar import no topo:

```python
from contextlib import contextmanager
```

Adicionar context manager logo após a função `get_conn()`:

```python
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
```

Refatorar `listar_fotos()` como exemplo do padrão a aplicar em todas:

```python
def listar_fotos():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM fotos ORDER BY numero").fetchall()
        return [dict(r) for r in rows]
```

Aplicar o mesmo padrão `with get_db() as conn:` nas funções:
- `buscar_foto()`
- `atualizar_ocr()`
- `atualizar_ocr_limpo()`
- `top_palavras()`
- `listar_grupos()`
- `deletar_foto_db()`

---

## TAREFA 10 — Commit e push para GitHub

Após executar todas as tarefas anteriores e testar no navegador:

```bash
cd ~/Área\ de\ trabalho/leitorcontextofoto

# Verificar o que mudou
git status
git diff --stat

# Commit com mensagem descritiva
git add .
git commit -m "feat: v1.1 — modal OCR, tema claro/escuro, sidebar, dedup MD5, busca, delete foto"

# Push
git push origin master
```

---

## CHECKLIST FINAL — Testar antes do commit

- [ ] Flask inicia sem erros: `python3 app.py`
- [ ] Banco não duplica fotos ao reiniciar o servidor
- [ ] Upload da mesma foto duas vezes mostra mensagem de duplicata
- [ ] Clicar em foto abre modal sem esconder galeria
- [ ] Botão ✕ fecha o modal
- [ ] Clicar fora do modal fecha o modal
- [ ] Botão 🗑 Deletar remove foto da galeria e do banco
- [ ] Toggle ☀️/🌙 troca tema e persiste após recarregar
- [ ] Tema padrão ao abrir é claro (light)
- [ ] Sidebar mostra grupos e top 15 palavras
- [ ] Abas Galeria / Brain Map funcionam
- [ ] Campo de busca filtra fotos em tempo real
- [ ] OCR extrai texto normalmente
- [ ] Limpar e Salvar texto funcionam

---

*GigU Brain v1.1 — Claude (Anthropic) + Fabio*
