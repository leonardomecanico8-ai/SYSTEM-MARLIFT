# Sistema de Ordem de Serviço (OS)

Sistema web completo para gerenciamento de Ordens de Serviço — funciona 100% offline no celular do técnico em campo.

## 🚀 Como testar no GitHub Pages

### Passo 1 — Fork / Clone
```bash
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO
```

### Passo 2 — Publicar no GitHub Pages
1. Vá em **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` · Pasta: `/ (root)` ou `/public`
4. Salvar → aguardar ~2 min
5. Acesse: `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/sistema-os.html`

---

## 📱 Funcionalidades

| Funcionalidade | Status |
|---|---|
| Formulário completo de OS | ✅ |
| Seleção de cliente cadastrado | ✅ |
| Cadastro de novo cliente | ✅ |
| Envio automático ao Google Sheets | ✅ |
| Cronômetro com pausa e log | ✅ |
| Foto do horímetro (câmera) | ✅ |
| Evidências fotográficas (15 fotos) | ✅ |
| Assinatura digital do cliente | ✅ |
| **Geração de PDF — download direto** | ✅ |
| Envio de resumo por WhatsApp | ✅ |
| Abertura no Google Maps / GPS | ✅ |
| Histórico de OS com busca | ✅ |
| Rascunho automático | ✅ |
| Funciona 100% offline | ✅ |

---

## ☁️ Configurar Google Sheets (Sincronização de Clientes)

### Passo 1 — Criar o Apps Script
1. Acesse [script.google.com](https://script.google.com)
2. Crie um **novo projeto** (pode nomear como "Sistema OS")
3. Abra o sistema → aba **Config** → clique em **"Copiar código Apps Script"**
4. Cole o código no editor do Apps Script e salve (`Ctrl+S`)

### Passo 2 — Implantar
1. Clique em **Implantar → Nova implantação**
2. Tipo: **App da Web**
3. Executar como: **Eu**
4. Quem tem acesso: **Qualquer pessoa, mesmo anônimas** ⚠️ (obrigatório)
5. Clique em **Implantar**
6. Autorize as permissões solicitadas
7. **Copie a URL** gerada (começa com `https://script.google.com/macros/s/...`)

### Passo 3 — Configurar no sistema
1. Abra o sistema → aba **Config**
2. Cole a URL no campo **"URL do Apps Script (Web App)"**
3. Clique em **"Testar conexão"** para verificar
4. A partir de agora, cada novo cliente cadastrado é enviado **automaticamente** à planilha

### Como funciona
- Ao cadastrar um novo cliente → salva localmente **E** envia direto à planilha
- Botão **"Sincronizar Clientes"** → importa clientes da planilha para o dispositivo
- Exclusão de cliente → remove localmente e na planilha

---

## 📄 Geração de PDF

O PDF é gerado 100% em JavaScript usando **jsPDF**, sem dependência de servidor.

### Conteúdo do PDF gerado
- Cabeçalho com logo da empresa e número da OS
- Dados completos do cliente
- Dados do técnico e equipamento (com horímetro)
- Defeito apresentado e serviço executado
- Peças aplicadas (lista formatada)
- Observações / recomendações
- Registro de tempo (cronômetro com log de pausas)
- Evidências fotográficas (até 6 fotos no PDF)
- Assinatura digital do cliente
- Rodapé com dados da empresa em todas as páginas

### Download no celular
- **Android**: salvo automaticamente na pasta **Downloads**
- **iOS**: abre no Safari → toque em **Compartilhar → Salvar em Arquivos**
- **Desktop**: diálogo de salvar arquivo
