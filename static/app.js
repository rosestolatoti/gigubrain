let todasFotos = [];
let fotosNaFila = [];
let filtroStatus = "todos";

document.addEventListener("DOMContentLoaded", () => {
  const temaSalvo = localStorage.getItem("gigu-tema") || "light";
  document.documentElement.setAttribute("data-theme", temaSalvo);
  document.getElementById("theme-icon").textContent = temaSalvo === "dark" ? "🌙" : "☀️";
  
  carregarFotos();
  carregarPalavras();
  carregarGrupos();
  setupUpload();
});

function toggleTheme() {
  const atual = document.documentElement.getAttribute("data-theme");
  const novo = atual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("gigu-tema", novo);
  document.getElementById("theme-icon").textContent = novo === "dark" ? "🌙" : "☀️";
}

function atualizarStats(fotos, palavras) {
  document.getElementById("stat-fotos").textContent = `${fotos} fotos`;
  document.getElementById("stat-palavras").textContent = `${palavras} palavras`;
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
  let fotos = filtroStatus === "todos" ? todasFotos : todasFotos.filter(f => f.status === filtroStatus);

  if (!fotos.length) {
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>Nenhuma foto encontrada</p></div>`;
    return;
  }

  grid.innerHTML = fotos.map(f => `
    <div class="foto-card" draggable="true" ondragstart="handleDragStart(event, '${f.numero}')">
      <img src="/api/foto/imagem/${f.numero}" alt="Foto ${f.numero}" loading="lazy" onerror="this.style.display='none'">
      <div class="foto-card-info">
        <span class="foto-numero">#${f.numero}</span>
        <span class="foto-status-badge ${f.status === 'ocr_feito' ? 'status-ocr_feito' : 'status-pendente'}">${f.status === 'ocr_feito' ? '✓' : '...'}</span>
      </div>
    </div>
  `).join("");
}

let dragNumero = null;

function handleDragStart(e, numero) {
  dragNumero = numero;
  e.dataTransfer.setData("text/plain", numero);
}

function handleGaleriaDrop(e) {
  e.preventDefault();
  const numero = e.dataTransfer.getData("text/plain") || dragNumero;
  if (numero) adicionarFilaOCR(numero);
  dragNumero = null;
}

function adicionarFilaOCR(numero) {
  if (fotosNaFila.find(f => f.numero === numero)) return;
  
  const foto = todasFotos.find(f => f.numero === numero);
  if (!foto) return;
  
  fotosNaFila.push({ numero: numero, status: "pendente", texto: "" });
  renderFilaOCR();
}

function renderFilaOCR() {
  const queue = document.getElementById("ocr-queue");
  
  if (!fotosNaFila.length) {
    queue.innerHTML = `<div class="ocr-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>Arraste fotos da galeria para esta área</p><span>ou clique para selecionar</span></div>`;
    return;
  }
  
  queue.innerHTML = fotosNaFila.map((f, idx) => `
    <div class="ocr-item" data-numero="${f.numero}">
      <div class="ocr-item-col1">
        <img class="ocr-item-img" src="/api/foto/imagem/${f.numero}" alt="Foto ${f.numero}">
        <div class="ocr-item-btns">
          <button class="btn-ocr" onclick="processarOCR('${f.numero}')" ${f.status === 'processando' ? 'disabled' : ''}>
            ${f.status === 'processando' ? '⏳ Processando...' : '⚡ Extrair Texto'}
          </button>
          <button class="btn-limpar" onclick="limparTexto('${f.numero}')" ${!f.texto ? 'disabled' : ''}>🧹 Limpar</button>
          <button class="btn-salvar" onclick="salvarOCR('${f.numero}')" ${!f.texto ? 'disabled' : ''}>💾 Salvar</button>
        </div>
      </div>
      <div class="ocr-item-col2">
        <textarea id="ocr-textarea-${f.numero}" placeholder="O texto extraído aparecerá aqui...">${f.texto}</textarea>
        <div class="ocr-status" id="ocr-status-${f.numero}"></div>
      </div>
    </div>
  `).join("");
}

async function processarOCR(numero) {
  const item = fotosNaFila.find(f => f.numero === numero);
  if (!item) return;
  
  item.status = "processando";
  renderFilaOCR();
  
  const statusEl = document.getElementById(`ocr-status-${numero}`);
  statusEl.textContent = "Processando OCR...";
  statusEl.className = "ocr-status";
  
  try {
    const res = await fetch(`/api/ocr/${numero}`, { method: "POST" });
    const data = await res.json();
    
    if (data.sucesso) {
      item.texto = data.texto_limpo;
      item.status = "pronto";
      document.getElementById(`ocr-textarea-${numero}`).value = data.texto_limpo;
      statusEl.textContent = `✓ ${data.caracteres} caracteres extraídos`;
      statusEl.className = "ocr-status sucesso";
      
      carregarFotos();
      carregarPalavras();
    } else {
      statusEl.textContent = `Erro: ${data.erro}`;
      statusEl.className = "ocr-status erro";
      item.status = "erro";
    }
  } catch (e) {
    statusEl.textContent = "Erro de conexão";
    statusEl.className = "ocr-status erro";
    item.status = "erro";
  }
  
  renderFilaOCR();
}

function limparTexto(numero) {
  const item = fotosNaFila.find(f => f.numero === numero);
  if (!item) return;
  
  const textarea = document.getElementById(`ocr-textarea-${numero}`);
  const linhas = textarea.value.split("\n");
  const limpas = linhas
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .filter(l => !/^\d{1,2}:\d{2}/.test(l))
    .filter(l => !/^[<>|]{2,}$/.test(l))
    .filter(l => !/(Publicar|Seguir|Curtir|Salvo|YouTube|Instagram)/i.test(l));
  
  item.texto = limpas.join("\n");
  textarea.value = item.texto;
  
  const statusEl = document.getElementById(`ocr-status-${numero}`);
  statusEl.textContent = "✓ Texto limpo";
  statusEl.className = "ocr-status sucesso";
}

async function salvarOCR(numero) {
  const item = fotosNaFila.find(f => f.numero === numero);
  if (!item) return;
  
  const texto = document.getElementById(`ocr-textarea-${numero}`).value;
  
  try {
    await fetch(`/api/ocr/${numero}/salvar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto })
    });
    
    const statusEl = document.getElementById(`ocr-status-${numero}`);
    statusEl.textContent = "💾 Salvo!";
    statusEl.className = "ocr-status sucesso";
    
    carregarFotos();
    carregarPalavras();
  } catch (e) {
    const statusEl = document.getElementById(`ocr-status-${numero}`);
    statusEl.textContent = "Erro ao salvar";
    statusEl.className = "ocr-status erro";
  }
}

function setupUpload() {
  const input = document.getElementById("input-fotos");
  input.addEventListener("change", () => adicionarArquivos([...input.files]));
}

function adicionarArquivos(files) {
  const validos = files.filter(f => f.type.startsWith("image/"));
  if (!validos.length) return;
  
  const form = new FormData();
  validos.forEach(f => form.append("fotos", f));
  
  fetch("/api/upload", { method: "POST", body: form })
    .then(r => r.json())
    .then(data => {
      carregarFotos();
    })
    .catch(e => console.error("Erro no upload:", e));
}

const CORES = ["#007aff", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#00c7be", "#ff2d55", "#5856d6", "#ffcc00"];

async function carregarPalavras() {
  try {
    const palavras = await fetch("/api/palavras?limit=80").then(r => r.json());
    if (!palavras.length) {
      atualizarStats(todasFotos.length, 0);
      return;
    }
    
    const max = palavras[0].contagem;
    const cloud = document.getElementById("word-cloud");
    
    cloud.innerHTML = palavras.map((p, i) => {
      const tamanho = 12 + Math.round((p.contagem / max) * 18);
      const cor = CORES[i % CORES.length];
      return `<span class="word-tag" style="font-size:${tamanho}px; background:${cor}15; color:${cor}; border:1px solid ${cor}30">${p.palavra}</span>`;
    }).join("");
    
    const top = document.getElementById("top-palavras");
    top.innerHTML = palavras.slice(0, 20).map(p => `<div class="palavra-item"><span>${p.palavra}</span><span class="count">${p.contagem}</span></div>`).join("");
    
    const sidebarTop = document.getElementById("top-palavras-sidebar");
    if (sidebarTop) {
      sidebarTop.innerHTML = palavras.slice(0, 10).map(p => `<div class="palavra-item"><span>${p.palavra}</span><span class="count">${p.contagem}</span></div>`).join("");
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
    container.innerHTML = `<div class="grupo-item active">Todos</div>` +
      grupos.map(g => `<div class="grupo-item" style="border-left:3px solid ${g.cor}">${g.nome}</div>`).join("");
  } catch (e) {
    console.error("Erro ao carregar grupos:", e);
  }
}

let currentPhotoNumero = null;

function handlePhotoSelect(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = document.getElementById("preview-img");
    const dropText = document.getElementById("drop-text");
    
    img.src = e.target.result;
    img.style.display = "block";
    dropText.style.display = "none";
    
    document.getElementById("btn-extrair").disabled = false;
  };
  reader.readAsDataURL(file);
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("photo-drop").classList.add("drag-over");
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("photo-drop").classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("photo-drop").classList.remove("drag-over");
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type.startsWith("image/")) {
      const input = document.getElementById("photo-input");
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handlePhotoSelect(input);
    }
  } else {
    const numero = e.dataTransfer.getData("text/plain");
    if (numero) {
      loadPhotoFromGallery(numero);
    }
  }
}

async function runOCRForPhoto(numero) {
  const statusEl = document.getElementById("ocr-status");
  const btnExtrair = document.getElementById("btn-extrair");
  const btnLimpar = document.getElementById("btn-limpar");
  const btnSalvar = document.getElementById("btn-salvar");
  const textarea = document.getElementById("ocr-text");
  
  btnExtrair.disabled = true;
  btnExtrair.textContent = "⏳ Processando...";
  statusEl.textContent = "Executando OCR...";
  statusEl.className = "ocr-status";
  
  try {
    const ocrRes = await fetch(`/api/ocr/${numero}`, { method: "POST" });
    const ocrData = await ocrRes.json();
    
    if (ocrData.sucesso) {
      textarea.value = ocrData.texto_limpo;
      statusEl.textContent = `✓ ${ocrData.caracteres} caracteres extraídos`;
      statusEl.className = "ocr-status sucesso";
      btnLimpar.disabled = false;
      btnSalvar.disabled = false;
      carregarFotos();
      carregarPalavras();
    } else {
      statusEl.textContent = `Erro: ${ocrData.erro}`;
      statusEl.className = "ocr-status erro";
    }
  } catch (e) {
    statusEl.textContent = "Erro de conexão";
    statusEl.className = "ocr-status erro";
  }
  
  btnExtrair.disabled = false;
  btnExtrair.textContent = "⚡ Extrair Texto";
}

async function executarOCR() {
  const input = document.getElementById("photo-input");
  const file = input.files[0];
  
  if (!file && !currentPhotoNumero) return;
  
  if (currentPhotoNumero && !file) {
    // Photo from gallery - run OCR directly
    await runOCRForPhoto(currentPhotoNumero);
    return;
  }
  
  const statusEl = document.getElementById("ocr-status");
  const btnExtrair = document.getElementById("btn-extrair");
  const btnLimpar = document.getElementById("btn-limpar");
  const btnSalvar = document.getElementById("btn-salvar");
  const textarea = document.getElementById("ocr-text");
  
  btnExtrair.disabled = true;
  btnExtrair.textContent = "⏳ Processando...";
  statusEl.textContent = "Enviando foto...";
  statusEl.className = "ocr-status";
  
  try {
    const formData = new FormData();
    formData.append("fotos", file);
    
    const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    
    if (!uploadData.resultados || !uploadData.resultados[0].sucesso) {
      const erro = uploadData.resultados?.[0]?.erro || "Erro no upload";
      statusEl.textContent = erro;
      statusEl.className = "ocr-status erro";
      btnExtrair.disabled = false;
      btnExtrair.textContent = "⚡ Extrair Texto";
      return;
    }
    
    currentPhotoNumero = uploadData.resultados[0].numero;
    statusEl.textContent = "Executando OCR...";
    
    const ocrRes = await fetch(`/api/ocr/${currentPhotoNumero}`, { method: "POST" });
    const ocrData = await ocrRes.json();
    
    if (ocrData.sucesso) {
      textarea.value = ocrData.texto_limpo;
      statusEl.textContent = `✓ ${ocrData.caracteres} caracteres extraídos`;
      statusEl.className = "ocr-status sucesso";
      btnLimpar.disabled = false;
      btnSalvar.disabled = false;
      carregarFotos();
      carregarPalavras();
    } else {
      statusEl.textContent = `Erro: ${ocrData.erro}`;
      statusEl.className = "ocr-status erro";
    }
  } catch (e) {
    statusEl.textContent = "Erro de conexão";
    statusEl.className = "ocr-status erro";
  }
  
  btnExtrair.disabled = false;
  btnExtrair.textContent = "⚡ Extrair Texto";
}

function limparTexto() {
  const textarea = document.getElementById("ocr-text");
  const linhas = textarea.value.split("\n");
  const limpas = linhas
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .filter(l => !/^\d{1,2}:\d{2}/.test(l))
    .filter(l => !/^[<>|]{2,}$/.test(l))
    .filter(l => !/(Publicar|Seguir|Curtir|Salvo|YouTube|Instagram|Facebook)/i.test(l));
  
  textarea.value = limpas.join("\n");
  
  const statusEl = document.getElementById("ocr-status");
  statusEl.textContent = "✓ Texto limpo";
  statusEl.className = "ocr-status sucesso";
}

async function salvarTexto() {
  if (!currentPhotoNumero) return;
  
  const textarea = document.getElementById("ocr-text");
  const texto = textarea.value;
  const statusEl = document.getElementById("ocr-status");
  
  try {
    await fetch(`/api/ocr/${currentPhotoNumero}/salvar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto })
    });
    
    statusEl.textContent = "💾 Salvo!";
    statusEl.className = "ocr-status sucesso";
    carregarFotos();
    carregarPalavras();
  } catch (e) {
    statusEl.textContent = "Erro ao salvar";
    statusEl.className = "ocr-status erro";
  }
}

function loadPhotoFromGallery(numero) {
  const img = document.getElementById("preview-img");
  const dropText = document.getElementById("drop-text");
  
  img.src = `/api/foto/imagem/${numero}`;
  img.style.display = "block";
  dropText.style.display = "none";
  
  currentPhotoNumero = numero;
  document.getElementById("btn-extrair").disabled = false;
  document.getElementById("ocr-status").textContent = `Foto #${numero} carregada`;
}

function clearPhoto() {
  const img = document.getElementById("preview-img");
  const dropText = document.getElementById("drop-text");
  const input = document.getElementById("photo-input");
  
  img.src = "";
  img.style.display = "none";
  dropText.style.display = "flex";
  input.value = "";
  
  currentPhotoNumero = null;
  document.getElementById("btn-extrair").disabled = true;
  document.getElementById("ocr-text").value = "";
  document.getElementById("btn-limpar").disabled = true;
  document.getElementById("btn-salvar").disabled = true;
  document.getElementById("ocr-status").textContent = "";
}
