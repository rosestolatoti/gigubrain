let fotoAtual = null;
let todasFotos = [];
let arquivosParaUpload = [];
let filtroStatus = "todos";

document.addEventListener("DOMContentLoaded", () => {
  const temaSalvo = localStorage.getItem("gigu-tema") || "light";
  document.documentElement.setAttribute("data-theme", temaSalvo);
  document.getElementById("theme-icon").textContent = temaSalvo === "dark" ? "☀️" : "🌙";
  
  carregarFotos();
  carregarPalavras();
  carregarGrupos();
  setupUpload();
});

function atualizarStats(fotos, palavras) {
  document.getElementById("stat-fotos").textContent = `${fotos} fotos`;
  document.getElementById("stat-palavras").textContent = `${palavras} palavras`;
}

function toggleTheme() {
  const atual = document.documentElement.getAttribute("data-theme");
  const novo = atual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("gigu-tema", novo);
  document.getElementById("theme-icon").textContent = novo === "dark" ? "☀️" : "🌙";
}

function trocarAba(aba, el) {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
  if (el) el.classList.add("active");
  document.getElementById(`tab-${aba}`).style.display = "block";

  if (aba === "brain") carregarPalavras();
}

function filtrarStatus(status, el) {
  filtroStatus = status;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  if (el) el.classList.add("active");
  renderGaleria();
}

async function carregarFotos() {
  try {
    const res = await fetch("/api/fotos");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    todasFotos = await res.json();
    renderGaleria();
    atualizarStats(todasFotos.length, 0);
  } catch (e) {
    console.error("Erro ao carregar fotos:", e);
  }
}

function renderGaleria() {
  const grid = document.getElementById("galeria-grid");
  
  let fotos = todasFotos;
  if (filtroStatus !== "todos") {
    fotos = todasFotos.filter(f => f.status === filtroStatus);
  }

  if (!fotos.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>Nenhuma foto encontrada</p>
      </div>`;
    return;
  }

  grid.innerHTML = fotos.map(f => `
    <div class="foto-card" onclick="abrirFoto('${f.numero}')">
      <img src="/api/foto/imagem/${f.numero}" alt="Foto ${f.numero}" loading="lazy" onerror="this.style.display='none'">
      <div class="foto-card-info">
        <span class="foto-numero">#${f.numero}</span>
        <span class="foto-status-badge ${f.status === 'ocr_feito' ? 'done' : 'pending'}">
          ${f.status === 'ocr_feito' ? 'Processado' : 'Pendente'}
        </span>
      </div>
    </div>
  `).join("");
}

async function abrirFoto(numero) {
  fotoAtual = numero;
  try {
    const foto = await fetch(`/api/foto/${numero}`).then(r => r.json());

    document.getElementById("modal-ocr").style.display = "flex";
    document.body.style.overflow = "hidden";

    document.getElementById("ocr-numero").textContent = `#${numero}`;
    document.getElementById("ocr-status-badge").textContent = foto.status === 'ocr_feito' ? 'Processado' : 'Pendente';
    document.getElementById("ocr-status-badge").className = `foto-status-badge ${foto.status === 'ocr_feito' ? 'done' : 'pending'}`;
    document.getElementById("ocr-img").src = `/api/foto/imagem/${numero}`;
    document.getElementById("ocr-area").value = foto.ocr_limpo || foto.ocr_texto || "";
    document.getElementById("ocr-status").textContent = "";

    const temTexto = !!(foto.ocr_limpo || foto.ocr_texto);
    document.getElementById("btn-limpar").style.display = temTexto ? "flex" : "none";
    document.getElementById("btn-salvar").style.display = temTexto ? "flex" : "none";
  } catch (e) {
    console.error("Erro ao abrir foto:", e);
  }
}

function fecharOCR() {
  document.getElementById("modal-ocr").style.display = "none";
  document.body.style.overflow = "";
  fotoAtual = null;
}

function navegarFoto(direcao) {
  const idx = todasFotos.findIndex(f => f.numero === fotoAtual);
  const novoIdx = idx + direcao;
  if (novoIdx >= 0 && novoIdx < todasFotos.length) {
    abrirFoto(todasFotos[novoIdx].numero);
  }
}

async function extrairOCR() {
  if (!fotoAtual) return;
  
  const btn = document.getElementById("btn-extrair");
  const status = document.getElementById("ocr-status");

  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Processando...`;

  status.textContent = "Extraindo texto...";

  try {
    const res = await fetch(`/api/ocr/${fotoAtual}`, { method: "POST" });
    const data = await res.json();

    if (data.sucesso) {
      document.getElementById("ocr-area").value = data.texto_limpo;
      status.textContent = `✓ ${data.caracteres} caracteres extraídos`;
      document.getElementById("btn-limpar").style.display = "flex";
      document.getElementById("btn-salvar").style.display = "flex";
      carregarFotos();
      carregarPalavras();
    } else {
      status.textContent = `Erro: ${data.erro}`;
      status.style.color = "var(--danger)";
    }
  } catch (e) {
    status.textContent = "Erro de conexão";
    status.style.color = "var(--danger)";
  }

  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Extrair Texto`;
}

function limparTexto() {
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

async function salvarTexto() {
  if (!fotoAtual) return;
  
  const texto = document.getElementById("ocr-area").value;
  try {
    await fetch(`/api/ocr/${fotoAtual}/salvar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto })
    });
    document.getElementById("ocr-status").textContent = "💾 Salvo com sucesso!";
  } catch (e) {
    document.getElementById("ocr-status").textContent = "Erro ao salvar";
  }
}

async function deletarFoto() {
  if (!fotoAtual) return;
  if (!confirm(`Deletar foto #${fotoAtual}? Esta ação não pode ser desfeita.`)) return;

  try {
    const res = await fetch(`/api/foto/${fotoAtual}`, { method: "DELETE" });
    const data = await res.json();
    if (data.sucesso) {
      fecharOCR();
      await carregarFotos();
      await carregarPalavras();
    }
  } catch (e) {
    console.error("Erro ao deletar:", e);
  }
}

function setupUpload() {
  const zone = document.getElementById("upload-zone");
  const input = document.getElementById("input-fotos");

  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    adicionarArquivos([...e.dataTransfer.files]);
  });

  input.addEventListener("change", () => adicionarArquivos([...input.files]));
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
  const content = document.getElementById("upload-content");
  const previewArea = document.getElementById("upload-preview-area");
  const previewGrid = document.getElementById("preview-grid");

  if (!arquivosParaUpload.length) {
    content.style.display = "block";
    previewArea.style.display = "none";
    return;
  }

  content.style.display = "none";
  previewArea.style.display = "block";

  previewGrid.innerHTML = arquivosParaUpload.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<img src="${url}" alt="${f.name}" onclick="removerArquivo(${i})">`;
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
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Enviando...`;

  const form = new FormData();
  arquivosParaUpload.forEach(f => form.append("fotos", f));

  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    arquivosParaUpload = [];
    renderPreview();
    carregarFotos();
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Enviado!`;
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Enviar Fotos`;
      btn.disabled = false;
    }, 2000);
  } catch (e) {
    btn.innerHTML = `Erro no envio`;
    btn.disabled = false;
  }
}

const CORES = ["#007aff", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#00c7be", "#ff2d55", "#5856d6", "#ffcc00"];

async function carregarPalavras() {
  try {
    const palavras = await fetch("/api/palavras?limit=80").then(r => r.json());
    if (!palavras.length) return;

    const max = palavras[0].contagem;
    const cloud = document.getElementById("word-cloud");

    cloud.innerHTML = palavras.map((p, i) => {
      const tamanho = 12 + Math.round((p.contagem / max) * 20);
      const cor = CORES[i % CORES.length];
      const fotos = JSON.parse(p.fotos_ids || "[]").join(", ");
      return `<span class="word-tag" 
        style="font-size:${tamanho}px; background:${cor}15; color:${cor}; border:1px solid ${cor}30"
        title="Aparece ${p.contagem}x — Fotos: ${fotos}"
        onclick="filtrarPorPalavra('${p.palavra}')">
        ${p.palavra}
      </span>`;
    }).join("");

    const top = document.getElementById("top-palavras");
    top.innerHTML = palavras.slice(0, 30).map(p => {
      const fotos = JSON.parse(p.fotos_ids || "[]");
      return `<div class="palavra-item" title="Fotos: ${fotos.join(', ')}">
        <span>${p.palavra}</span>
        <span class="count">${p.contagem}×</span>
      </div>`;
    }).join("");

    const sidebarTop = document.getElementById("top-palavras-sidebar");
    if (sidebarTop) {
      sidebarTop.innerHTML = palavras.slice(0, 10).map(p => {
        const fotos = JSON.parse(p.fotos_ids || "[]");
        return `<div class="palavra-item" title="Fotos: ${fotos.join(', ')}">
          <span>${p.palavra}</span>
          <span class="count">${p.contagem}</span>
        </div>`;
      }).join("");
    }

    atualizarStats(todasFotos.length, palavras.length);
  } catch (e) {
    console.error("Erro ao carregar palavras:", e);
  }
}

async function carregarGrupos() {
  try {
    const grupos = await fetch("/api/grupos").then(r => r.json());
    const container = document.getElementById("grupos-filtro");
    container.innerHTML = `<div class="grupo-item active" onclick="filtrarGrupo(null, this)">Todos</div>` +
      grupos.map(g => `
        <div class="grupo-item" style="border-left: 3px solid ${g.cor}" onclick="filtrarGrupo('${g.nome}', this)">
          ${g.nome}
        </div>`).join("");
  } catch (e) {
    console.error("Erro ao carregar grupos:", e);
  }
}

function filtrarGrupo(nome, el) {
  document.querySelectorAll(".grupo-item").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

function filtrarPorPalavra(palavra) {
  const filtradas = todasFotos.filter(f => {
    const texto = (f.ocr_limpo || f.ocr_texto || "").toLowerCase();
    return texto.includes(palavra);
  });
  
  document.getElementById("galeria-grid").innerHTML = filtradas.map(f => `
    <div class="foto-card" onclick="abrirFoto('${f.numero}')">
      <img src="/api/foto/imagem/${f.numero}" alt="Foto ${f.numero}" loading="lazy" onerror="this.style.display='none'">
      <div class="foto-card-info">
        <span class="foto-numero">#${f.numero}</span>
        <span class="foto-status-badge ${f.status === 'ocr_feito' ? 'done' : 'pending'}">
          ${f.status === 'ocr_feito' ? 'Processado' : 'Pendente'}
        </span>
      </div>
    </div>
  `).join("");
  
  document.querySelectorAll(".tab")[0].click();
}

let buscaTimeout = null;

function buscarFotos(termo) {
  clearTimeout(buscaTimeout);
  buscaTimeout = setTimeout(async () => {
    if (termo.length < 2) {
      renderGaleria();
      return;
    }
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(termo)}`);
      const resultados = await res.json();
      
      document.getElementById("galeria-grid").innerHTML = resultados.map(f => `
        <div class="foto-card" onclick="abrirFoto('${f.numero}')">
          <img src="/api/foto/imagem/${f.numero}" alt="Foto ${f.numero}" loading="lazy" onerror="this.style.display='none'">
          <div class="foto-card-info">
            <span class="foto-numero">#${f.numero}</span>
            <span class="foto-status-badge ${f.status === 'ocr_feito' ? 'done' : 'pending'}">
              ${f.status === 'ocr_feito' ? 'Processado' : 'Pendente'}
            </span>
          </div>
        </div>
      `).join("");
    } catch (e) {
      console.error("Erro na busca:", e);
    }
  }, 300);
}
