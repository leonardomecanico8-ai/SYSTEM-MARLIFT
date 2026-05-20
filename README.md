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

---

## 💾 Armazenamento de dados

Todos os dados são salvos no **localStorage** do navegador:

| Chave | Conteúdo |
|---|---|
| `os_cfg` | Configurações da empresa |
| `os_clientes` | Banco de clientes cadastrados |
| `os_historico` | Histórico de OS salvas |
| `os_rascunho` | Rascunho da OS em andamento |
| `os_fotos` | Fotos de evidência (base64) |
| `os_sig` | Assinatura do cliente (base64) |
| `os_hor_foto` | Foto do horímetro (base64) |
| `os_tempo_final` | Tempo total do último atendimento |

> **Atenção**: fotos em base64 ocupam espaço no localStorage. Limite prático: ~15 fotos comprimidas.

---

## 🛠️ Tecnologias usadas

- **HTML5 + CSS3 + JavaScript puro** — sem frameworks
- **[jsPDF 2.5.1](https://github.com/parallax/jsPDF)** — geração de PDF client-side
- **[Font Awesome 6.5](https://fontawesome.com)** — ícones
- **Google Apps Script** — backend para Google Sheets (opcional)
- **localStorage** — persistência offline

---

## 📋 Estrutura do projeto

```
/
└── sistema-os.html     ← arquivo único (self-contained)
└── README.md
```

---

## 🔧 Personalização

Edite diretamente o `sistema-os.html`:

| O que mudar | Onde encontrar |
|---|---|
| Cor principal | variável `--primary: #ff6600` no CSS |
| Tipos de chamado | select `id="tipo"` |
| Combustíveis | select `id="eComb"` e `id="cadComb"` |
| Status da OS | select `id="status"` |
| Máx. de fotos | constante `15` nas funções `addFotos` e `renderFotos` |

---

## ⚠️ Limitações conhecidas

- **iOS Safari**: o PDF abre em nova aba em vez de baixar automaticamente — o usuário deve tocar em "Compartilhar → Salvar em Arquivos"
- **localStorage**: ~5MB de limite — use poucas fotos ou de baixa resolução
- **Google Sheets com `no-cors`**: não é possível verificar se o POST foi recebido com sucesso — apenas que não houve erro de rede

---

## 📄 Licença

MIT — use livremente.
