/* ─── GigU Brain — Frontend Logic ─── */

let fotoAtual = null;
let todasFotos = [];
let arquivosParaUpload = [];

// ─── INIT ────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  carregarFotos();
  carregarPalavras();
  carregarGrupos();
  setupUpload();
  setupFiltros();
});

// ─── STATS ──────────────────────────────────────────────

function atualizarStats(fotos, palavras) {
  document.getElementById("stat-fotos").textContent = `${fotos} fotos`;
  document.getElementById("stat-palavras").textContent = `${palavras} palavras`;
}

// ─── GALERIA ────────────────────────────────────────────

async function carregarFotos() {
  const res = await fetch("/api/fotos");
  todasFotos = await res.json();
  renderGaleria(todasFotos);

  const palavras = await fetch("/api/palavras?limit=1").then(r => r.json());
  const totalPalavras = palavras.length > 0
    ? await fetch("/api/palavras?limit=9999").then(r => r.json()).then(p => p.length)
    : 0;
  atualizarStats(todasFotos.length, totalPalavras);
}

function renderGaleria(fotos) {
  const grid = document.getElementById("galeria-grid");

  if (!fotos.length) {
    grid.innerHTML = '<div class="loading">Nenhuma foto encontrada</div>';
    return;
  }

  grid.innerHTML = fotos.map(f => `
    <div class="foto-card" onclick="abrirFoto('${f.numero}')">
      <img src="/api/foto/imagem/${f.numero}" 
           alt="Foto ${f.numero}"
           loading="lazy"
           onerror="this.style.display='none'">
      <div class="foto-card-info">
        <span class="foto-numero">#${f.numero}</span>
        <span class="foto-status status-${f.status}">${f.status === 'ocr_feito' ? '✓' : '…'}</span>
      </div>
    </div>
  `).join("");
}

// ─── FILTROS ────────────────────────────────────────────

function setupFiltros() {
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      const status = btn.dataset.status;
      const filtradas = status === "todos"
        ? todasFotos
        : todasFotos.filter(f => f.status === status);
      renderGaleria(filtradas);
    });
  });
}

// ─── PAINEL OCR ─────────────────────────────────────────

async function abrirFoto(numero) {
  fotoAtual = numero;
  const foto = await fetch(`/api/foto/${numero}`).then(r => r.json());

  document.getElementById("section-ocr").style.display = "block";
  document.getElementById("section-ocr").scrollIntoView({ behavior: "smooth" });

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
}

function fecharOCR() {
  document.getElementById("section-ocr").style.display = "none";
  fotoAtual = null;
}

async function extrairOCR(numero) {
  const btn = document.getElementById("btn-extrair");
  const status = document.getElementById("ocr-status");

  btn.disabled = true;
  btn.textContent = "⏳ Extraindo...";
  status.textContent = "Processando OCR...";

  try {
    const res = await fetch(`/api/ocr/${numero}`, { method: "POST" });
    const data = await res.json();

    if (data.sucesso) {
      document.getElementById("ocr-area").value = data.texto_limpo;
      status.textContent = `✓ ${data.caracteres} caracteres extraídos`;
      document.getElementById("btn-limpar-texto").style.display = "inline-block";
      document.getElementById("btn-salvar-texto").style.display = "inline-block";
      carregarFotos();
      carregarPalavras();
    } else {
      status.textContent = `✕ Erro: ${data.erro}`;
    }
  } catch (e) {
    status.textContent = "✕ Erro de conexão";
  }

  btn.disabled = false;
  btn.textContent = "⚡ Extrair Texto";
}

function limparTextoManual() {
  const area = document.getElementById("ocr-area");
  const linhas = area.value.split("\n");
  const limpas = linhas
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .filter(l => !/^\d{1,2}:\d{2}/.test(l))
    .filter(l => !/^[<>|]{2,}$/.test(l))
    .filter(l => !/(Publicar|Seguir|Curtir|Salvo)/i.test(l));
  area.value = limpas.join("\n");
  document.getElementById("ocr-status").textContent = "✓ Texto limpo";
}

async function salvarTexto(numero) {
  const texto = document.getElementById("ocr-area").value;
  await fetch(`/api/ocr/${numero}/salvar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto })
  });
  document.getElementById("ocr-status").textContent = "💾 Salvo!";
}

// ─── UPLOAD ─────────────────────────────────────────────

function setupUpload() {
  const area = document.getElementById("upload-area");
  const input = document.getElementById("input-fotos");

  area.addEventListener("dragover", e => {
    e.preventDefault();
    area.classList.add("drag-over");
  });
  area.addEventListener("dragleave", () => area.classList.remove("drag-over"));
  area.addEventListener("drop", e => {
    e.preventDefault();
    area.classList.remove("drag-over");
    adicionarArquivos([...e.dataTransfer.files]);
  });

  input.addEventListener("change", () => adicionarArquivos([...input.files]));

  document.getElementById("btn-upload").addEventListener("click", enviarFotos);
}

function adicionarArquivos(files) {
  const validos = files.filter(f => f.type.startsWith("image/"));
  const total = arquivosParaUpload.length + validos.length;

  if (total > 5) {
    alert("Máximo 5 fotos por vez");
    return;
  }

  arquivosParaUpload.push(...validos);
  renderPreview();
}

function renderPreview() {
  const preview = document.getElementById("upload-preview");
  const placeholder = document.getElementById("upload-placeholder");
  const btnUpload = document.getElementById("btn-upload");

  if (!arquivosParaUpload.length) {
    preview.innerHTML = "";
    placeholder.style.display = "block";
    btnUpload.style.display = "none";
    return;
  }

  placeholder.style.display = "none";
  btnUpload.style.display = "inline-block";

  preview.innerHTML = arquivosParaUpload.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="preview-item">
        <img src="${url}" alt="${f.name}">
        <button class="remove" onclick="removerArquivo(${i})">✕</button>
      </div>`;
  }).join("");
}

function removerArquivo(idx) {
  arquivosParaUpload.splice(idx, 1);
  renderPreview();
}

async function enviarFotos() {
  if (!arquivosParaUpload.length) return;

  const btn = document.getElementById("btn-upload");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const form = new FormData();
  arquivosParaUpload.forEach(f => form.append("fotos", f));

  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    arquivosParaUpload = [];
    renderPreview();
    carregarFotos();
    btn.textContent = `✓ ${data.resultados.length} foto(s) enviada(s)`;
    setTimeout(() => {
      btn.textContent = "Enviar Fotos";
      btn.disabled = false;
    }, 2000);
  } catch (e) {
    btn.textContent = "Erro no envio";
    btn.disabled = false;
  }
}

// ─── BRAIN MAP ──────────────────────────────────────────

const CORES = [
  "#6366f1","#818cf8","#22c55e","#f59e0b",
  "#ef4444","#06b6d4","#ec4899","#a855f7","#14b8a6"
];

async function carregarPalavras() {
  const palavras = await fetch("/api/palavras?limit=80").then(r => r.json());
  if (!palavras.length) return;

  const max = palavras[0].contagem;
  const cloud = document.getElementById("word-cloud");

  cloud.innerHTML = palavras.map((p, i) => {
    const tamanho = 11 + Math.round((p.contagem / max) * 22);
    const cor = CORES[i % CORES.length];
    const fotos = JSON.parse(p.fotos_ids || "[]").join(", ");
    return `<span class="word-tag" 
      style="font-size:${tamanho}px; background:${cor}22; color:${cor}; border:1px solid ${cor}44"
      title="Aparece ${p.contagem}x — Fotos: ${fotos}"
      onclick="filtrarPorPalavra('${p.palavra}')">
      ${p.palavra}
    </span>`;
  }).join("");

  const top = document.getElementById("top-palavras");
  top.innerHTML = palavras.slice(0, 30).map(p => {
    const fotos = JSON.parse(p.fotos_ids || "[]");
    return `<div class="palavra-row" title="Fotos: ${fotos.join(', ')}">
      <span class="palavra">${p.palavra}</span>
      <span class="contagem">${p.contagem}×</span>
    </div>`;
  }).join("");

  atualizarStats(todasFotos.length, palavras.length);
}

async function carregarGrupos() {
  const grupos = await fetch("/api/grupos").then(r => r.json());
  const container = document.getElementById("grupos-filtro");
  container.innerHTML = `<button class="grupo-tag ativo" style="background:#ffffff22;color:#fff" onclick="filtrarGrupo(null, this)">Todos</button>` +
    grupos.map(g => `
      <button class="grupo-tag" 
        style="background:${g.cor}22; color:${g.cor}"
        onclick="filtrarGrupo('${g.nome}', this)">
        ${g.nome}
      </button>`).join("");
}

function filtrarGrupo(nome, el) {
  document.querySelectorAll(".grupo-tag").forEach(b => b.classList.remove("ativo"));
  el.classList.add("ativo");
}

function filtrarPorPalavra(palavra) {
  const filtradas = todasFotos.filter(f => {
    const texto = (f.ocr_limpo || f.ocr_texto || "").toLowerCase();
    return texto.includes(palavra);
  });
  renderGaleria(filtradas);
  document.getElementById("section-galeria").scrollIntoView({ behavior: "smooth" });
}
