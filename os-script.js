* =============================================================
   MARLIFT SERVICE — OS SCRIPT v3.0
   ============================================================= */
let clientes = [], fotos = [], horFoto = null;
let assinatura = null, assinaturaBase64 = null;
let timerInt = null, timerSeg = 0, timerStatus = 'parado', tLog = [];
let sigCtx = null, sigDrawing = false;
let cfg = {}, isLocked = false;

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('logado') === '1') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.add('visible');
  } else {
    setTimeout(() => document.getElementById('pinInput').focus(), 400);
  }
  carregarCfg(); carregarClientes(); carregarRascunho();
  atualizarSelectCli(); renderClientList(); renderHist();
  atualizarDataHora(); atualizarNumOS(); prog();
  document.querySelectorAll('.modal').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) fecharModal(); })
  );
});

/* ── CONFIGURAÇÕES ── */
function carregarCfg() {
  const raw = localStorage.getItem('os_cfg');
  cfg = raw ? JSON.parse(raw) : { empresa: 'MARLIFT SERVICE', cnpj: '', tel: '', end: '', proxOS: 1, sheetsUrl: '' };
  f('cfEmpresa', cfg.empresa); f('cfCnpj', cfg.cnpj);
  f('cfTel', cfg.tel); f('cfEnd', cfg.end);
  f('cfProxOS', cfg.proxOS || 1); f('cfSheets', cfg.sheetsUrl || '');
  atualizarSyncBadge();
}
function salvarCfg() {
  cfg.empresa   = g('cfEmpresa'); cfg.cnpj = g('cfCnpj');
  cfg.tel       = g('cfTel');     cfg.end  = g('cfEnd');
  cfg.proxOS    = parseInt(g('cfProxOS')) || 1;
  cfg.sheetsUrl = g('cfSheets').trim();
  localStorage.setItem('os_cfg', JSON.stringify(cfg));
  atualizarNumOS(); atualizarSyncBadge();
}
function atualizarSyncBadge() {
  const el = document.getElementById('syncBadge'); if (!el) return;
  if (cfg.sheetsUrl) {
    el.className = 'sync-badge ok';
    el.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Google Sheets configurado';
  } else {
    el.className = 'sync-badge idle';
    el.innerHTML = '<i class="fa-solid fa-circle-dot"></i> Não configurado — offline';
  }
}

/* ── GOOGLE SHEETS ── */
async function syncClientes() {
  if (!cfg.sheetsUrl) { toast('Configure a URL do Google Sheets primeiro.', 'error'); return; }
  const badge = document.getElementById('syncBadge');
  badge.className = 'sync-badge loading';
  badge.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Sincronizando...';
  try {
    const url = cfg.sheetsUrl + (cfg.sheetsUrl.includes('?') ? '&' : '?') + 'action=list&t=' + Date.now();
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error();
    const remoto = await resp.json();
    if (Array.isArray(remoto) && remoto.length > 0) {
      let novos = 0;
      remoto.forEach(cr => { if (!clientes.find(cl => cl.id === cr.id)) { clientes.push(cr); novos++; } });
      salvarClientes(); atualizarSelectCli(); renderClientList();
      badge.className = 'sync-badge ok';
      badge.innerHTML = `<i class="fa-solid fa-check"></i> Sincronizado! ${novos} novo(s)`;
      toast(`${novos} cliente(s) importado(s)!`, 'success');
    } else {
      await fetch(cfg.sheetsUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'sync_all', clients: clientes }) });
      badge.className = 'sync-badge ok';
      badge.innerHTML = '<i class="fa-solid fa-check"></i> Clientes enviados!';
      toast('Clientes enviados ao Google Sheets!', 'success');
    }
  } catch {
    badge.className = 'sync-badge error';
    badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Erro — verifique a URL';
    toast('Erro ao sincronizar.', 'error');
  }
}
async function testarConn() {
  if (!cfg.sheetsUrl) { toast('Configure a URL primeiro.', 'error'); return; }
  const badge = document.getElementById('syncBadge');
  badge.className = 'sync-badge loading';
  badge.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Testando...';
  try {
    const url = cfg.sheetsUrl + (cfg.sheetsUrl.includes('?') ? '&' : '?') + 'action=ping&t=' + Date.now();
    const resp = await fetch(url, { mode: 'cors' });
    if (resp.ok || resp.type === 'opaque') {
      badge.className = 'sync-badge ok'; badge.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i> Conexão OK!';
      toast('Conexão com Google Sheets OK!', 'success');
    } else throw new Error();
  } catch {
    badge.className = 'sync-badge error'; badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sem resposta';
    toast('Não foi possível conectar.', 'error');
  }
}
function copiarScript() {
  const code = `// ================================================================
// MARLIFT SERVICE — GOOGLE APPS SCRIPT
// 1. Acesse https://script.google.com → Novo projeto
// 2. Cole este código, salve (Ctrl+S)
// 3. Implantar → Nova implantação → App da Web
// 4. Executar como: Eu | Acesso: Qualquer pessoa, mesmo anônimas
// 5. Copie a URL e cole nas Configurações do sistema
// ================================================================
const SHEET_NAME = 'Clientes';

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return out([]);
    const rows = sheet.getDataRange().getValues();
    const clients = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0]) clients.push({
        id: String(rows[i][0]), nome: rows[i][1], cnpj: rows[i][2],
        end: rows[i][3], contato: rows[i][4], email: rows[i][5],
        tel: rows[i][6], marca: rows[i][7], modelo: rows[i][8],
        comb: rows[i][9], serie: rows[i][10]
      });
    }
    return out(clients);
  } catch(e) { return out({ error: e.message }); }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
      sheet.appendRow(['id','nome','cnpj','end','contato','email','tel','marca','modelo','comb','serie']);
      sheet.getRange(1,1,1,11).setFontWeight('bold');
    }
    if (data.action === 'save') {
      const rows = sheet.getDataRange().getValues(); let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.client.id)) {
          sheet.getRange(i+1,1,1,11).setValues([[data.client.id,data.client.nome,data.client.cnpj,data.client.end,data.client.contato,data.client.email,data.client.tel,data.client.marca,data.client.modelo,data.client.comb,data.client.serie]]);
          found = true; break;
        }
      }
      if (!found) sheet.appendRow([data.client.id,data.client.nome,data.client.cnpj,data.client.end,data.client.contato,data.client.email,data.client.tel,data.client.marca,data.client.modelo,data.client.comb,data.client.serie]);
    }
    if (data.action === 'delete') {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) { if (String(rows[i][0]) === String(data.id)) { sheet.deleteRow(i+1); break; } }
    }
    if (data.action === 'sync_all' && Array.isArray(data.clients)) {
      if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
      data.clients.forEach(c => sheet.appendRow([c.id,c.nome,c.cnpj,c.end,c.contato,c.email,c.tel,c.marca,c.modelo,c.comb,c.serie]));
    }
    return out({ success: true });
  } catch(e) { return out({ error: e.message }); }
}

function out(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;
  navigator.clipboard.writeText(code)
    .then(() => toast('Código copiado! Cole no Apps Script.', 'success'))
    .catch(() => toast('Erro ao copiar. Veja o console.', 'error'));
}

/* ── TABS ── */
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-tab, .bnav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  if (id === 'tab-hist') renderHist();
  if (id === 'tab-cfg')  { carregarCfg(); renderClientList(); }
  if (id === 'tab-dash') renderDash();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── DASHBOARD ── */
const tipoBadge   = {'Emergencial':'badge-red','Corretivo':'badge-blue','Preventivo':'badge-green','Garantia':'badge-purple','Orçamento':'badge-orange','Instalação':'badge-gray'};
const statusBadge = {'Concluído':'badge-green','Pendente':'badge-gray','Aguardando Peça':'badge-orange','Orçamento Enviado':'badge-blue'};

function renderDash() {
  const hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  document.getElementById('dTotalOS').textContent    = hist.length;
  document.getElementById('dTotalCli').textContent   = clientes.length;
  document.getElementById('dConcluidas').textContent = hist.filter(x => x.status === 'Concluído').length;
  document.getElementById('dPendentes').textContent  = hist.filter(x => x.status !== 'Concluído').length;

  const tipos = ['Corretivo','Preventivo','Emergencial','Garantia','Orçamento','Instalação'];
  const max = Math.max(1, ...tipos.map(t => hist.filter(x => x.tipoChamado === t).length));
  const chart = document.getElementById('dashChart');
  if (chart) {
    chart.innerHTML = tipos.map(t => {
      const cnt = hist.filter(x => x.tipoChamado === t).length;
      const pct = Math.round((cnt / max) * 100);
      const cls = t === 'Preventivo' ? 'success' : t === 'Emergencial' ? 'accent' : '';
      return `<div class="chart-bar-wrap">
        <div class="chart-bar-label"><span>${t}</span><span>${cnt}</span></div>
        <div class="chart-bar-track"><div class="chart-bar-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  const ul = document.getElementById('dashUltimasOS');
  if (ul) {
    ul.innerHTML = hist.length === 0 ? '<div class="dash-empty">Nenhuma OS registrada ainda.</div>' :
      hist.slice(0, 5).map(os => {
        const dt = new Date(os.data);
        return `<div class="dash-row">
          <div class="dash-row-icon"><i class="fa-solid fa-file-lines"></i></div>
          <div class="dash-row-info">
            <div class="dash-row-name">${esc(os.cliNome)}</div>
            <div class="dash-row-sub">${fmtNum(os.numero)} · ${dt.toLocaleDateString('pt-BR')} · ${esc(os.eqMarca||'')} ${esc(os.eqModelo||'')}</div>
          </div>
          <span class="badge ${statusBadge[os.status]||'badge-gray'}" style="font-size:9.5px">${esc(os.status||'—')}</span>
        </div>`;
      }).join('');
  }

  const dc = document.getElementById('dashClientes');
  if (dc) {
    dc.innerHTML = clientes.length === 0 ? '<div class="dash-empty">Nenhum cliente cadastrado.</div>' :
      [...clientes].sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0,6).map(c => `
        <div class="dash-row">
          <div class="dash-row-icon" style="background:#fff7ed;color:var(--accent)"><i class="fa-solid fa-building"></i></div>
          <div class="dash-row-info">
            <div class="dash-row-name">${esc(c.nome)}</div>
            <div class="dash-row-sub">${esc(c.marca)} ${esc(c.modelo)} · S/N: ${esc(c.serie)}</div>
          </div>
        </div>`).join('');
  }
}

/* ── PROGRESSO ── */
function prog() {
  const checks = [!!g('cNome'), !!g('tNome'), !!g('eMarca'), !!g('tipo'), timerStatus !== 'parado', !!g('servico')];
  const first = checks.indexOf(false);
  checks.forEach((ok, i) => {
    const el = document.getElementById(`ps${i+1}`); if (!el) return;
    el.className = 'prog-step ' + (ok ? 'done' : i === first ? 'active' : '');
  });
}

/* ── DATA/HORA & NUM OS ── */
function atualizarDataHora() {
  const now = new Date();
  const el1 = document.getElementById('osData'), el2 = document.getElementById('osHora');
  if (el1) el1.textContent = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  if (el2) el2.textContent = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function atualizarNumOS() {
  const el = document.getElementById('osNum'); if (el) el.textContent = fmtNum(cfg.proxOS || 1);
}
function fmtNum(n) { return `#${String(n).padStart(6,'0')}`; }

/* ── BLOQUEIO ── */
function bloquearOS() {
  isLocked = true;
  document.querySelectorAll('#tab-os input, #tab-os select, #tab-os textarea, #btnIni, #btnPau, #btnSalvar, #btnAbrirSig').forEach(el => el.disabled = true);
  document.getElementById('btnPdf').disabled = false;
  document.getElementById('btnEditar').style.display = 'inline-flex';
  document.getElementById('btnAbrirSig').style.display = 'none';
  toast('OS Bloqueada! PDF disponível.', 'success');
}
