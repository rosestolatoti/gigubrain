# 2 CEREBRO - Extrator de Texto de Imagens

**Desenvolvido por Fábio Rosestolato**

Aplicação web para extração de texto de imagens (OCR) com gerenciamento de fotos e nuvem de palavras.

## 📋 Requisitos

- Python 3.8+
- Flask
- Tesseract OCR (instalado no sistema)
- Pillow (PIL)
- pytesseract

## 🚀 Instalação

### 1. Instale o Tesseract OCR

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-por
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
- Baixe o instalador em: https://github.com/UB-Mannheim/tesseract/wiki
- Adicione ao PATH do sistema

### 2. Configure o ambiente Python

```bash
# Crie o ambiente virtual
python3 -m venv venv

# Ative o ambiente virtual
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows

# Instale as dependências
pip install flask pillow pytesseract
```

### 3. Execute a aplicação

```bash
python app.py
```

A aplicação estará disponível em: **http://localhost:5000**

---

## 📖 Como Usar

### Interface Principal

A interface possui 3 áreas principais:

1. **Área de Extração (Superior)** - 2 colunas
2. **Barra Lateral (Esquerda)** - Importar/Categorias/Palavras
3. **Galeria/Brain Map (Inferior)** - Fotos e nuvem de palavras

---

### Passo a Passo: Extrair Texto de uma Foto

#### Método 1: Arrastar da Galeria

1. **Arraste** uma foto da galeria (embaixo) para a caixa de extração (esquerda superior)
2. A foto aparecerá na caixa de extração
3. Clique no botão **"⚡ Extrair Texto"**
4. Aguarde o processamento (OCR)
5. O texto extraído aparecerá na caixa da direita
6. Use **"🧹 Limpar"** para remover ruídos
7. Use **"💾 Salvar"** para salvar no banco

#### Método 2: Upload de Nova Foto

1. Clique na caixa de extração (esquerda) para selecionar uma foto do computador
2. Ou arraste um arquivo de imagem do seu computador para a caixa
3. Clique em **"⚡ Extrair Texto"**
4. Siga os passos 5-7 acima

#### Método 3: Importar Fotos

1. Na barra lateral, clique em **"+ Adicionar Fotos"**
2. Selecione uma ou mais imagens
3. As fotos aparecerão na galeria

---

### Funções dos Botões

| Botão | Função |
|-------|--------|
| ⚡ Extrair Texto | Executa OCR na foto selecionada |
| 🗑️ Trocar Foto | Limpa a foto atual para selecionar outra |
| 🧹 Limpar | Remove ruídos e texto indesejado do resultado |
| 💾 Salvar | Salva o texto no banco de dados |

---

### Filtrar Fotos

Na galeria, use os filtros:
- **Todas** - Mostra todas as fotos
- **Pendentes** - Fotos que ainda não tiveram OCR
- **Processadas** - Fotos com OCR concluído

---

### Nuvem de Palavras (Brain Map)

Clique na aba **"🧠 Brain Map"** para ver:
- Nuvem de palavras mais frequentes
- Lista de palavras com contagem

---

## 🛠️ Estrutura do Projeto

```
leitorcontextofoto/
├── app.py              # Servidor Flask principal
├── config.py           # Configurações do projeto
├── database.py         # Banco de dados SQLite
├── file_manager.py     # Gerenciamento de arquivos
├── ocr_engine.py       # Motor de OCR
├── templates/
│   └── index.html      # Interface HTML
├── static/
│   ├── style.css       # Estilos CSS
│   └── app.js          # JavaScript do frontend
├── fotos/              # Pasta de fotos (não versionada)
├── ocr_bruto/          # OCRs brutos (não versionado)
└── gigu_brain.db       # Banco de dados (não versionado)
```

---

## 📝 Recursos

- ✅ Extração de texto por OCR
- ✅ Detecção de duplicatas por hash MD5
- ✅ Limpeza automática de texto
- ✅ Banco de palavras extraídas
- ✅ Nuvem de palavras (Brain Map)
- ✅ Categorização de fotos
- ✅ Tema claro/escuro
- ✅ Arrastar e soltar
- ✅ Upload de novas fotos
- ✅ Interface responsiva

---

## ⚠️ Observações

- Fotos de tela de celular (formato 9:16) são recomendadas
- O banco de dados e fotos não são versionados (gitignore)
- Requer conexão com internet para carregar fontes Google

---

## 📄 Licença

Desenvolvido por **Fábio Rosestolato**
