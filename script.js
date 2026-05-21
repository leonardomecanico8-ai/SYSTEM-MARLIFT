/* =============================================================
   MARLIFT SERVICE - Sistema OS v2.0
   ============================================================= */

let clientes = [];
let fotos = [];
let horFoto = null;
let assinatura = null;
let assinaturaBase64 = null;
let timerInt = null;
let timerSeg = 0;
let timerStatus = 'parado';
let tLog = [];
let sigCtx = null;
let sigDrawing = false;
let cfg = {};
let isLocked = false;
let editingOSId = null;
let viewingOS = null;
let ultimaOSSalva = null;
let deferredPrompt = null;
const PASSWORD_CORRETA = "123456";
const MAX_FOTOS = 40;

/* PWA INSTALL */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstall');
  if (btn) btn.style.display = 'flex';
});

function instalarPWA() {
  if (!deferredPrompt) {
    toast('Use o menu do navegador e selecione "Instalar app" ou "Adicionar a tela inicial"', 'info');
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') toast('App instalado com sucesso!', 'success');
    deferredPrompt = null;
    const btn = document.getElementById('btnInstall');
    if (btn) btn.style.display = 'none';
  });
}

/* SERVICE WORKER */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.log('SW registration failed:', err));
  });
}

/* LOGIN */
function fazerLogin() {
  const input = document.getElementById('pinInput');
  const pin = input.value;
  if (pin === PASSWORD_CORRETA) {
    sessionStorage.setItem('logado', 'true');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.add('visible');
    carregarRascunho();
    renderDashboard();
    toast('Bem-vindo ao Marlift Service!', 'success');
  } else {
    toast('Senha incorreta!', 'error');
    input.value = '';
    input.focus();
  }
}

function fazerLogout() {
  if (confirm('Deseja sair do sistema?')) {
    sessionStorage.removeItem('logado');
    location.reload();
  }
}

/* INIT */
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('logado') === 'true') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.add('visible');
    carregarRascunho();
  } else {
    setTimeout(() => document.getElementById('pinInput').focus(), 300);
  }
  carregarCfg();
  carregarClientes();
  atualizarSelectCli();
  renderClientList();
  renderHist();
  renderDashboard();
  prog();
  atualizarDataHora();
  atualizarNumOS();
  document.querySelectorAll('.modal').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) fecharModal(); })
  );
  document.getElementById('pinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') fazerLogin();
  });
});

/* CONFIG */
function carregarCfg() {
  const raw = localStorage.getItem('os_cfg');
  cfg = raw ? JSON.parse(raw) : { empresa: 'MARLIFT SERVICE', cnpj: '', tel: '', end: '', proxOS: 1, googleScript: '' };
  f('cfEmpresa', cfg.empresa);
  f('cfCnpj', cfg.cnpj);
  f('cfTel', cfg.tel);
  f('cfEnd', cfg.end);
  f('cfProxOS', cfg.proxOS || 1);
  f('cfGoogleScript', cfg.googleScript || '');
  const el = document.getElementById('hdrEmpresa');
  if (el) el.textContent = (cfg.empresa || 'MARLIFT SERVICE').toUpperCase();
}

function salvarCfg() {
  cfg.empresa = g('cfEmpresa');
  cfg.cnpj = g('cfCnpj');
  cfg.tel = g('cfTel');
  cfg.end = g('cfEnd');
  cfg.proxOS = parseInt(g('cfProxOS')) || 1;
  cfg.googleScript = g('cfGoogleScript');
  localStorage.setItem('os_cfg', JSON.stringify(cfg));
  const el = document.getElementById('hdrEmpresa');
  if (el) el.textContent = (cfg.empresa || 'MARLIFT SERVICE').toUpperCase();
  atualizarNumOS();
}

/* GOOGLE SHEETS */
function testarGoogleScript() {
  const url = cfg.googleScript;
  if (!url) { toast('Configure a URL do Google Apps Script primeiro.', 'error'); return; }
  fetch(url + '?action=ping', { mode: 'no-cors' })
    .then(() => toast('Conexao enviada! Verifique a planilha.', 'success'))
    .catch(() => toast('Erro na conexao. Verifique a URL.', 'error'));
}

function sincronizarGoogle() {
  const url = cfg.googleScript;
  if (!url) { toast('Configure a URL do Google Apps Script primeiro.', 'error'); return; }
  const hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  if (hist.length === 0) { toast('Nenhuma OS para sincronizar.', 'error'); return; }
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync', data: hist.map(o => ({
      numero: o.numero, data: o.data, cliente: o.cliNome, cnpj: o.cliCnpj,
      endereco: o.cliEnd, tecnico: o.tecNome, marca: o.eqMarca, modelo: o.eqModelo,
      serie: o.eqSerie, horimetro: o.horimetro, tipo: o.tipoChamado,
      defeito: o.defeito, servico: o.servico, pecas: o.pecas, status: o.status, tempo: o.tempo
    }))})
  }).then(() => toast('Dados enviados para a planilha!', 'success'))
    .catch(() => toast('Erro ao sincronizar. Tente novamente.', 'error'));
}

/* TABS */
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const nt = document.querySelector('.nav-tab[data-tab="' + id + '"]');
  if (nt) nt.classList.add('active');
  document.querySelectorAll('.bnav-item').forEach(t => t.classList.remove('active'));
  const bn = document.querySelector('.bnav-item[data-tab="' + id + '"]');
  if (bn) bn.classList.add('active');
  const progWrap = document.getElementById('progBarWrap');
  if (progWrap) progWrap.style.display = id === 'tab-os' ? 'block' : 'none';
  if (id === 'tab-hist') renderHist();
  if (id === 'tab-cfg') { carregarCfg(); renderClientList(); }
  if (id === 'tab-dash') renderDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* DASHBOARD */
function renderDashboard() {
  const hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  const now = new Date();
  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const stTotal = document.getElementById('statTotal');
  const stDone = document.getElementById('statDone');
  const stPending = document.getElementById('statPending');
  const stSched = document.getElementById('statSched');
  if (stTotal) stTotal.textContent = hist.length;
  if (stDone) stDone.textContent = hist.filter(o => o.status === 'Concluido' || o.status === 'Concluído').length;
  if (stPending) stPending.textContent = hist.filter(o => o.status !== 'Concluido' && o.status !== 'Concluído').length;
  const agendadas = hist.filter(o => o.agendaData && new Date(o.agendaData) >= new Date(now.toDateString()));
  if (stSched) stSched.textContent = agendadas.length;

  const agEl = document.getElementById('dashAgendamentos');
  if (agEl) {
    const proxAg = agendadas.sort((a, b) => new Date(a.agendaData) - new Date(b.agendaData)).slice(0, 5);
    if (proxAg.length === 0) {
      agEl.innerHTML = '<div class="agenda-empty"><i class="fa-solid fa-calendar-xmark"></i> Nenhum agendamento proximo</div>';
    } else {
      agEl.innerHTML = proxAg.map(o => {
        const dt = new Date(o.agendaData + 'T' + (o.agendaHora || '08:00'));
        return '<div class="agenda-item"><div class="agenda-item-date">' + dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + (o.agendaHora || '') + '</div><div class="agenda-item-info"><div class="agenda-item-name">' + esc(o.cliNome) + '</div><div class="agenda-item-meta">' + esc(o.eqMarca || '') + ' ' + esc(o.eqModelo || '') + ' - ' + esc(o.tipoChamado || '') + '</div></div></div>';
      }).join('');
    }
  }

  const recEl = document.getElementById('dashRecentes');
  if (recEl) {
    const recentes = hist.slice(0, 5);
    if (recentes.length === 0) {
      recEl.innerHTML = '<div class="agenda-empty"><i class="fa-solid fa-folder-open"></i> Nenhuma OS registrada</div>';
    } else {
      recEl.innerHTML = recentes.map(os => {
        const dt = new Date(os.data);
        return '<div class="agenda-item" style="cursor:pointer" onclick="verOS(\'' + os.id + '\')"><div class="agenda-item-date">' + fmtNum(os.numero) + '</div><div class="agenda-item-info"><div class="agenda-item-name">' + esc(os.cliNome) + '</div><div class="agenda-item-meta">' + dt.toLocaleDateString('pt-BR') + ' - ' + esc(os.status || '') + '</div></div></div>';
      }).join('');
    }
  }
}

/* PROGRESS BAR */
function prog() {
  const checks = [!!g('cNome'), !!g('tNome'), !!g('eMarca'), !!g('tipo'), timerStatus !== 'parado', !!g('servico')];
  let first = checks.indexOf(false);
  checks.forEach((ok, i) => {
    const el = document.getElementById('ps' + (i + 1));
    if (!el) return;
    el.className = 'prog-step ' + (ok ? 'done' : i === first ? 'active' : '');
  });
}

/* DATA/HORA */
function atualizarDataHora() {
  const now = new Date();
  const el1 = document.getElementById('osData');
  const el2 = document.getElementById('osHora');
  if (el1) el1.textContent = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  if (el2) el2.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function atualizarNumOS() {
  const el = document.getElementById('osNum');
  if (el) el.textContent = '#' + String(cfg.proxOS || 1).padStart(6, '0');
}
function fmtNum(n) { return '#' + String(n).padStart(6, '0'); }

/* BLOQUEIO */
function bloquearOS() {
  isLocked = true;
  var inputs = document.querySelectorAll('#tab-os input, #tab-os select, #tab-os textarea, #btnIni, #btnPau, #btnSalvar, #btnAbrirSig');
  inputs.forEach(function(el) { el.disabled = true; });
  document.getElementById('btnPdf').disabled = false;
  document.getElementById('btnEditar').style.display = 'inline-flex';
  document.getElementById('btnAbrirSig').style.display = 'none';
}

function desbloquearOS() {
  if (!confirm('Isso desbloqueara a OS para edicao. Continuar?')) return;
  isLocked = false;
  var inputs = document.querySelectorAll('#tab-os input, #tab-os select, #tab-os textarea');
  inputs.forEach(function(el) { el.disabled = false; });
  if (timerStatus === 'parado') document.getElementById('btnIni').disabled = false;
  if (timerStatus === 'rodando') document.getElementById('btnPau').disabled = false;
  document.getElementById('btnSalvar').disabled = false;
  document.getElementById('btnPdf').disabled = true;
  document.getElementById('btnEditar').style.display = 'none';
  document.getElementById('btnAbrirSig').style.display = 'inline-flex';
  toast('OS Desbloqueada para edicao.', 'warning');
}

/* FOTO HORIMETRO */
function processarFotoHor(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.src = e.target.result;
    img.onload = function() {
      var c = document.createElement('canvas');
      var max = 1000, scale = img.width > max ? max / img.width : 1;
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      horFoto = c.toDataURL('image/jpeg', 0.82);
      var prev = document.getElementById('horPrev');
      prev.src = horFoto; prev.classList.add('vis');
      document.getElementById('btnFotHor').style.display = 'none';
      document.getElementById('btnRmHor').style.display = 'flex';
      try { localStorage.setItem('os_hor_foto', horFoto); } catch(ex) {}
      toast('Foto do horimetro salva!', 'success');
    };
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removerFotoHor() {
  horFoto = null;
  var prev = document.getElementById('horPrev');
  prev.src = ''; prev.classList.remove('vis');
  document.getElementById('btnFotHor').style.display = 'flex';
  document.getElementById('btnRmHor').style.display = 'none';
  localStorage.removeItem('os_hor_foto');
}

/* CLIENTES */
function carregarClientes() {
  var raw = localStorage.getItem('os_clientes');
  clientes = raw ? JSON.parse(raw) : [];
}
function salvarClientes() { localStorage.setItem('os_clientes', JSON.stringify(clientes)); }
function atualizarSelectCli() {
  var sel = document.getElementById('selCliente');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Selecione ou preencha abaixo --</option>';
  clientes.slice().sort(function(a, b) { return a.nome.localeCompare(b.nome); }).forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome + ' -- ' + c.marca + ' ' + c.modelo;
    sel.appendChild(opt);
  });
}
function carregarCliente(id) {
  if (!id) return;
  var c = clientes.find(function(x) { return x.id === id; });
  if (!c) return;
  f('cNome', c.nome); f('cCnpj', c.cnpj || ''); f('cEnd', c.end);
  f('cContato', c.contato || ''); f('cTel', c.tel || ''); f('cEmail', c.email || '');
  f('eMarca', c.marca); f('eModelo', c.modelo); f('eComb', c.comb); f('eSerie', c.serie);
  autoSave(); prog();
  toast('"' + c.nome + '" carregado!', 'success');
}

function salvarCliente() {
  var nome = g('cadNome').trim();
  var end = g('cadEnd').trim();
  var marca = g('cadMarca').trim();
  var modelo = g('cadModelo').trim();
  var serie = g('cadSerie').trim();
  if (!nome || !end || !marca || !modelo || !serie) {
    toast('Preencha os campos obrigatorios (*)', 'error');
    return;
  }
  var novo = {
    id: Date.now().toString(), nome: nome, cnpj: g('cadCnpj'), end: end, contato: g('cadContato'),
    email: g('cadEmail'), tel: g('cadTel'), marca: marca, modelo: modelo, comb: g('cadComb'), serie: serie
  };
  clientes.push(novo);
  salvarClientes();
  atualizarSelectCli();
  renderClientList();
  ['cadNome','cadCnpj','cadEnd','cadContato','cadEmail','cadTel','cadMarca','cadModelo','cadSerie'].forEach(function(id) { f(id, ''); });
  fecharModal();
  toast('"' + nome + '" cadastrado com sucesso!', 'success');
}

function renderClientList() {
  var el = document.getElementById('clientList');
  if (!el) return;
  el.innerHTML = '';
  clientes.slice().sort(function(a, b) { return a.nome.localeCompare(b.nome); }).forEach(function(c) {
    var div = document.createElement('div');
    div.className = 'client-item';
    div.innerHTML = '<div class="client-item-info"><div class="client-name">' + esc(c.nome) + '</div><div class="client-meta">' + esc(c.marca) + ' ' + esc(c.modelo) + ' - S/N: ' + esc(c.serie) + '</div></div><div class="client-btns"><button class="btn btn-ghost btn-icon btn-sm" onclick="carregarCliente(\'' + c.id + '\');switchTab(\'tab-os\')" title="Usar na OS"><i class="fa-solid fa-arrow-up-right-from-square"></i></button><button class="btn btn-danger btn-icon btn-sm" onclick="excluirCliente(\'' + c.id + '\')" title="Excluir"><i class="fa-solid fa-trash"></i></button></div>';
    el.appendChild(div);
  });
}

function excluirCliente(id) {
  var c = clientes.find(function(x) { return x.id === id; });
  if (!c || !confirm('Excluir o cliente "' + c.nome + '"?')) return;
  clientes = clientes.filter(function(x) { return x.id !== id; });
  salvarClientes();
  atualizarSelectCli();
  renderClientList();
  toast('Cliente excluido.', 'success');
}

/* RASCUNHO */
var CAMPOS = ['cNome','cCnpj','cEnd','cContato','cTel','cEmail','tNome','eMarca','eModelo',
  'eComb','eSerie','eHor','tipo','prior','defeito','servico','pecas','obs','status',
  'agendaData','agendaHora','agendaObs'];

function autoSave() {
  if (isLocked) return;
  var d = {};
  CAMPOS.forEach(function(id) { var el = document.getElementById(id); if (el) d[id] = el.value; });
  d._ts = timerSeg; d._st = timerStatus; d._log = tLog;
  d._locked = isLocked;
  localStorage.setItem('os_rascunho', JSON.stringify(d));
}

function carregarRascunho() {
  var raw = localStorage.getItem('os_rascunho');
  if (!raw) return;
  var d = JSON.parse(raw);
  CAMPOS.forEach(function(id) { if (d[id] !== undefined) { var el = document.getElementById(id); if (el) el.value = d[id]; } });
  timerSeg = d._ts || 0;
  timerStatus = d._st || 'parado';
  tLog = d._log || [];
  atualizarTimerDisp();
  renderTimerLog();

  if (d._locked && localStorage.getItem('os_sig')) {
    var assRaw = localStorage.getItem('os_sig');
    if (assRaw) {
      assinatura = JSON.parse(assRaw);
      assinaturaBase64 = assinatura.img;
      exibirAssinatura();
    }
    bloquearOS();
  } else {
    var btnI = document.getElementById('btnIni'), btnP = document.getElementById('btnPau');
    if (timerStatus === 'finalizado') {
      if (btnI) { btnI.disabled = true; btnI.innerHTML = '<i class="fa-solid fa-lock"></i> Encerrado'; }
      if (btnP) btnP.disabled = true;
    } else if (timerStatus === 'pausado') {
      if (btnI) btnI.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Retomar';
      if (btnP) btnP.disabled = true;
    } else if (timerStatus === 'rodando') {
      timerStatus = 'parado';
      iniciarTimer();
    }
  }

  var fotosRaw = localStorage.getItem('os_fotos');
  if (fotosRaw) { fotos = JSON.parse(fotosRaw); renderFotos(); }

  var assRaw2 = localStorage.getItem('os_sig');
  if (assRaw2 && !assinatura) {
    assinatura = JSON.parse(assRaw2);
    assinaturaBase64 = assinatura.img;
    exibirAssinatura();
  }

  var horRaw = localStorage.getItem('os_hor_foto');
  if (horRaw) {
    horFoto = horRaw;
    var prev = document.getElementById('horPrev');
    if (prev) { prev.src = horRaw; prev.classList.add('vis'); }
    var bF = document.getElementById('btnFotHor'), bR = document.getElementById('btnRmHor');
    if (bF) bF.style.display = 'none';
    if (bR) bR.style.display = 'flex';
  }
  prog();
}

/* CRONOMETRO */
function horaAtual() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function fmtTempo(s) { return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(function(n) { return String(n).padStart(2, '0'); }).join(':'); }
function atualizarTimerDisp() { var el = document.getElementById('timerDisp'); if (el) el.textContent = fmtTempo(timerSeg); }

function renderTimerLog() {
  var el = document.getElementById('timerLog');
  if (!el) return;
  if (tLog.length === 0) { el.innerHTML = '<div class="timer-log-item" style="color:rgba(255,255,255,0.28)">Aguardando inicio...</div>'; return; }
  el.innerHTML = tLog.map(function(item) {
    var extra = item.parcial ? ' <strong style="color:var(--warning)">(' + item.parcial + ')</strong>' : '';
    if (item.total) extra = ' <strong style="color:var(--success)">[TOTAL: ' + item.total + ']</strong>';
    return '<div class="timer-log-item">&#9201; <strong>' + item.hora + '</strong> -- ' + item.evento + extra + '</div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function iniciarTimer() {
  if (timerStatus === 'rodando') return;
  tLog.push({ evento: timerStatus === 'parado' ? 'Inicio do atendimento' : 'Retorno do atendimento', hora: horaAtual() });
  timerStatus = 'rodando';
  var btnI = document.getElementById('btnIni'), btnP = document.getElementById('btnPau');
  if (btnI) { btnI.disabled = true; btnI.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Em andamento'; }
  if (btnP) btnP.disabled = false;
  timerInt = setInterval(function() { timerSeg++; atualizarTimerDisp(); if (timerSeg % 15 === 0) autoSave(); }, 1000);
  renderTimerLog();
  prog();
  autoSave();
}

function pausarTimer(motivo) {
  if (timerStatus !== 'rodando') return;
  clearInterval(timerInt);
  timerStatus = 'pausado';
  tLog.push({ evento: 'Pausa -- ' + motivo, hora: horaAtual(), parcial: fmtTempo(timerSeg) });
  var btnI = document.getElementById('btnIni'), btnP = document.getElementById('btnPau');
  if (btnI) { btnI.disabled = false; btnI.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Retomar'; }
  if (btnP) btnP.disabled = true;
  renderTimerLog();
  autoSave();
}

function finalizarTimer() {
  if (timerStatus === 'finalizado') return;
  if (timerInt) clearInterval(timerInt);
  timerStatus = 'finalizado';
  var total = fmtTempo(timerSeg);
  tLog.push({ evento: 'Fim do atendimento', hora: horaAtual(), total: total });
  var btnI = document.getElementById('btnIni'), btnP = document.getElementById('btnPau');
  if (btnI) { btnI.disabled = true; btnI.innerHTML = '<i class="fa-solid fa-lock"></i> Encerrado'; }
  if (btnP) btnP.disabled = true;
  renderTimerLog();
  autoSave();
  localStorage.setItem('os_tempo_final', total);
}

function confirmarPausa() {
  var m = document.getElementById('motivoPausa').value;
  if (m === 'Outro') m = document.getElementById('motivoOutro').value || 'Nao especificado';
  pausarTimer(m);
  fecharModal();
}

function toggleMotivoOutro(val) {
  var el = document.getElementById('motivoOutroWrap');
  if (el) el.style.display = val === 'Outro' ? 'block' : 'none';
}

/* FOTOS (ate 40) */
function addFotos(input) {
  Array.from(input.files).forEach(function(file) {
    if (fotos.length >= MAX_FOTOS) { toast('Limite de ' + MAX_FOTOS + ' fotos atingido.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.src = e.target.result;
      img.onload = function() {
        var c = document.createElement('canvas');
        var max = 800, scale = img.width > max ? max / img.width : 1;
        c.width = img.width * scale; c.height = img.height * scale;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        fotos.push(c.toDataURL('image/jpeg', 0.6));
        renderFotos();
        try { localStorage.setItem('os_fotos', JSON.stringify(fotos)); } catch(ex) {}
      };
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderFotos() {
  var grid = document.getElementById('photosGrid');
  if (!grid) return;
  var cnt = document.getElementById('fotoCnt');
  if (cnt) cnt.textContent = fotos.length;
  grid.innerHTML = '';
  fotos.forEach(function(src, i) {
    var div = document.createElement('div');
    div.className = 'photo-item';
    div.innerHTML = '<img src="' + src + '" onclick="abrirLightbox(this.src)"><button class="photo-remove" onclick="removerFoto(' + i + ')">x</button>';
    grid.appendChild(div);
  });
  if (fotos.length < MAX_FOTOS) {
    var btn = document.createElement('div');
    btn.className = 'photo-add-btn';
    btn.innerHTML = '<i class="fa-solid fa-camera-retro"></i><span>Camera / Galeria</span>';
    btn.onclick = function() { document.getElementById('inputFotos').click(); };
    grid.appendChild(btn);
  }
}

function removerFoto(i) {
  fotos.splice(i, 1);
  renderFotos();
  try { localStorage.setItem('os_fotos', JSON.stringify(fotos)); } catch(ex) {}
}

function abrirLightbox(src) { document.getElementById('lbImg').src = src; document.getElementById('lightbox').classList.add('open'); }
function fecharLightbox() { document.getElementById('lightbox').classList.remove('open'); }

/* ASSINATURA */
function initSigCanvas() {
  var canvas = document.getElementById('sigCanvas');
  var wrap = document.getElementById('sigCanvasWrap');
  if (!canvas || !wrap) return;
  sigCtx = canvas.getContext('2d');
  function resize() {
    var rect = wrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    sigCtx.strokeStyle = '#000';
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.fillStyle = '#fff';
    sigCtx.fillRect(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);
  function pos(e) {
    var r = canvas.getBoundingClientRect();
    var src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }
  canvas.addEventListener('mousedown', function(e) { sigDrawing = true; var p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', function(e) { if (!sigDrawing) return; var p = pos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); });
  canvas.addEventListener('mouseup', function() { sigDrawing = false; });
  canvas.addEventListener('mouseleave', function() { sigDrawing = false; });
  canvas.addEventListener('touchstart', function(e) { e.preventDefault(); sigDrawing = true; var p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }, { passive: false });
  canvas.addEventListener('touchmove', function(e) { e.preventDefault(); if (!sigDrawing) return; var p = pos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); }, { passive: false });
  canvas.addEventListener('touchend', function() { sigDrawing = false; });
}

function clearSig() {
  if (sigCtx) {
    var c = document.getElementById('sigCanvas');
    if (c) { sigCtx.fillStyle = '#fff'; sigCtx.fillRect(0, 0, c.width, c.height); }
  }
}

function salvarSig() {
  var nome = g('sigNome').trim();
  var docVal = g('sigDoc').trim();
  if (!nome) { toast('Informe o nome do responsavel.', 'error'); return; }
  if (!docVal) { toast('Informe o RG/CPF.', 'error'); return; }
  finalizarTimer();
  var canvas = document.getElementById('sigCanvas');
  assinaturaBase64 = canvas.toDataURL();
  assinatura = { img: assinaturaBase64, nome: nome, doc: docVal };
  localStorage.setItem('os_sig', JSON.stringify(assinatura));
  exibirAssinatura();
  fecharModal();
  bloquearOS();
  salvarOS(true);
}

function exibirAssinatura() {
  var el = document.getElementById('sigPreview');
  if (!el || !assinatura) return;
  el.innerHTML = '<div style="text-align:center;width:100%"><img src="' + assinatura.img + '" style="max-height:70px;max-width:100%;object-fit:contain;border:1px solid #ddd;border-radius:6px"><div style="font-size:12px;font-weight:bold;margin-top:6px">' + esc(assinatura.nome) + '</div><div style="font-size:11px;color:var(--gray)">RG/CPF: ' + esc(assinatura.doc) + '</div></div>';
}

/* SALVAR OS */
function salvarOS(fromSignature) {
  var nome = g('cNome').trim();
  if (!nome) { toast('Preencha o nome do cliente antes de salvar.', 'error'); return; }
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  var num = cfg.proxOS || 1;
  var osData = {
    id: Date.now().toString(), numero: num,
    data: new Date().toISOString(),
    cliNome: nome, cliCnpj: g('cCnpj'), cliEnd: g('cEnd'),
    cliContato: g('cContato'), cliTel: g('cTel'), cliEmail: g('cEmail'),
    tecNome: g('tNome'),
    eqMarca: g('eMarca'), eqModelo: g('eModelo'), eqComb: g('eComb'),
    eqSerie: g('eSerie'), horimetro: g('eHor'),
    tipoChamado: g('tipo'), prioridade: g('prior'),
    defeito: g('defeito'), servico: g('servico'), pecas: g('pecas'),
    obs: g('obs'), status: g('status'),
    agendaData: g('agendaData'), agendaHora: g('agendaHora'), agendaObs: g('agendaObs'),
    tempo: fmtTempo(timerSeg), timerLog: tLog,
    fotosCount: fotos.length, fotos: fotos,
    horFoto: horFoto,
    assinatura: assinatura,
    assinado: !!assinatura
  };
  hist.unshift(osData);
  localStorage.setItem('os_historico', JSON.stringify(hist));
  cfg.proxOS = num + 1;
  localStorage.setItem('os_cfg', JSON.stringify(cfg));
  f('cfProxOS', cfg.proxOS);
  atualizarNumOS();
  ultimaOSSalva = osData;

  if (fromSignature) {
    limparFormulario();
    document.getElementById('finOSNum').textContent = 'OS ' + fmtNum(num) + ' salva com sucesso!';
    abrirModal('modalFinalizada');
  } else {
    toast('OS ' + fmtNum(num) + ' salva no historico!', 'success');
  }
  renderDashboard();
}

/* LIMPAR FORMULARIO */
function limparFormulario() {
  CAMPOS.forEach(function(id) { f(id, ''); });
  f('status', 'Concluído'); f('prior', 'Normal');
  clearInterval(timerInt);
  timerSeg = 0; timerStatus = 'parado'; tLog = [];
  isLocked = false;
  atualizarTimerDisp(); renderTimerLog();
  var bI = document.getElementById('btnIni'), bP = document.getElementById('btnPau');
  if (bI) { bI.disabled = false; bI.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar'; }
  if (bP) bP.disabled = true;
  fotos = []; renderFotos();
  removerFotoHor();
  assinatura = null; assinaturaBase64 = null;
  var sp = document.getElementById('sigPreview');
  if (sp) sp.innerHTML = '<div class="sig-placeholder"><i class="fa-solid fa-pen-nib" style="font-size:26px;opacity:0.25"></i><span>Toque para assinar</span></div>';
  document.getElementById('btnPdf').disabled = true;
  document.getElementById('btnEditar').style.display = 'none';
  document.getElementById('btnAbrirSig').style.display = 'inline-flex';
  document.getElementById('btnSalvar').disabled = false;
  var inputs = document.querySelectorAll('#tab-os input, #tab-os select, #tab-os textarea');
  inputs.forEach(function(el) { el.disabled = false; });
  ['os_rascunho','os_fotos','os_sig','os_tempo_final','os_hor_foto'].forEach(function(k) { localStorage.removeItem(k); });
  atualizarDataHora(); atualizarNumOS(); prog();
}

/* NOVA OS */
function novaOS() {
  if (isLocked) { toast('Desbloqueie a OS atual primeiro.', 'error'); return; }
  if (g('cNome').trim() && !confirm('Iniciar nova OS? O rascunho atual sera perdido.')) return;
  limparFormulario();
  switchTab('tab-os');
  toast('Nova OS iniciada!', 'success');
}

/* HISTORICO */
var tipoBadge = {'Emergencial':'badge-red','Corretivo':'badge-blue','Preventivo':'badge-green','Garantia':'badge-purple','Orcamento':'badge-orange','Instalacao':'badge-gray','Orçamento':'badge-orange','Instalação':'badge-gray'};
var statusBadge = {'Concluído':'badge-green','Concluido':'badge-green','Pendente':'badge-gray','Aguardando Peça':'badge-orange','Aguardando Peca':'badge-orange','Orçamento Enviado':'badge-blue','Orcamento Enviado':'badge-blue'};

function renderHist() {
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  var busca = (g('busca') || '').toLowerCase().trim();
  var el = document.getElementById('osList');
  var totalEl = document.getElementById('totalOS');
  if (totalEl) totalEl.textContent = hist.length;
  if (!el) return;
  var filtrado = busca ? hist.filter(function(os) {
    return (os.cliNome || '').toLowerCase().indexOf(busca) >= 0 ||
      (os.eqMarca || '').toLowerCase().indexOf(busca) >= 0 ||
      (os.eqModelo || '').toLowerCase().indexOf(busca) >= 0 ||
      (os.tecNome || '').toLowerCase().indexOf(busca) >= 0 ||
      (os.defeito || '').toLowerCase().indexOf(busca) >= 0;
  }) : hist;
  if (filtrado.length === 0) {
    el.innerHTML = '<div class="os-empty"><i class="fa-solid fa-folder-open"></i><p style="font-weight:800;font-size:16px">' + (busca ? 'Nenhum resultado' : 'Nenhuma OS salva') + '</p></div>';
    return;
  }
  el.innerHTML = '';
  filtrado.forEach(function(os) {
    var dt = new Date(os.data);
    var div = document.createElement('div');
    div.className = 'os-card';
    div.innerHTML = '<div class="os-card-top"><div class="os-card-info"><div class="os-num">' + fmtNum(os.numero) + ' - ' + dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</div><div class="os-cliente">' + esc(os.cliNome) + '</div><div class="os-meta">' + esc(os.eqMarca || '') + ' ' + esc(os.eqModelo || '') + (os.horimetro ? ' - ' + os.horimetro + 'h' : '') + ' - Tec: ' + esc(os.tecNome || '--') + '</div><div class="os-tags"><span class="badge ' + (tipoBadge[os.tipoChamado] || 'badge-gray') + '">' + esc(os.tipoChamado || '--') + '</span><span class="badge ' + (statusBadge[os.status] || 'badge-gray') + '">' + esc(os.status || '--') + '</span>' + (os.assinado ? '<span class="badge badge-green"><i class="fa-solid fa-check"></i> Assinado</span>' : '') + '</div></div></div><div class="os-actions"><button class="btn btn-ghost btn-sm" onclick="verOS(\'' + os.id + '\')"><i class="fa-solid fa-eye"></i> Ver</button><button class="btn btn-outline btn-sm" onclick="editarOS(\'' + os.id + '\')"><i class="fa-solid fa-pen"></i> Editar</button><button class="btn btn-secondary btn-sm" onclick="gerarPDFPorId(\'' + os.id + '\')"><i class="fa-solid fa-file-pdf"></i> PDF</button><button class="btn btn-danger btn-sm" onclick="excluirOS(\'' + os.id + '\')"><i class="fa-solid fa-trash"></i></button></div>';
    el.appendChild(div);
  });
}

function excluirOS(id) {
  if (!confirm('Excluir esta OS do historico?')) return;
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  hist = hist.filter(function(x) { return x.id !== id; });
  localStorage.setItem('os_historico', JSON.stringify(hist));
  renderHist();
  renderDashboard();
  toast('OS excluida.', 'success');
}

/* VER OS */
function verOS(id) {
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  var os = hist.find(function(x) { return x.id === id; });
  if (!os) return;
  viewingOS = os;
  var body = document.getElementById('verOSBody');
  var dt = new Date(os.data);
  body.innerHTML = '<div class="ver-section"><div class="ver-label">OS Numero</div><div class="ver-value">' + fmtNum(os.numero) + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Data/Hora</div><div class="ver-value">' + dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Cliente</div><div class="ver-value">' + esc(os.cliNome) + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">CNPJ</div><div class="ver-value">' + esc(os.cliCnpj || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Endereco</div><div class="ver-value">' + esc(os.cliEnd || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Tecnico</div><div class="ver-value">' + esc(os.tecNome || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Equipamento</div><div class="ver-value">' + esc(os.eqMarca || '') + ' ' + esc(os.eqModelo || '') + ' - ' + esc(os.eqComb || '') + ' - S/N: ' + esc(os.eqSerie || '') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Horimetro</div><div class="ver-value">' + esc(os.horimetro || '--') + ' h</div></div>' +
    '<div class="ver-section"><div class="ver-label">Tipo / Prioridade</div><div class="ver-value">' + esc(os.tipoChamado || '--') + ' / ' + esc(os.prioridade || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Defeito</div><div class="ver-value">' + esc(os.defeito || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Servico Executado</div><div class="ver-value">' + esc(os.servico || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Pecas</div><div class="ver-value">' + esc(os.pecas || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Tempo</div><div class="ver-value">' + esc(os.tempo || '--') + '</div></div>' +
    '<div class="ver-section"><div class="ver-label">Status</div><div class="ver-value">' + esc(os.status || '--') + '</div></div>' +
    (os.assinatura ? '<div class="ver-section"><div class="ver-label">Assinatura</div><div style="text-align:center"><img src="' + os.assinatura.img + '" style="max-height:60px;border:1px solid #ddd;border-radius:6px"><div style="font-size:11px;margin-top:4px">' + esc(os.assinatura.nome) + ' - RG/CPF: ' + esc(os.assinatura.doc) + '</div></div></div>' : '');
  abrirModal('modalVerOS');
}

function gerarPDFHistorico() {
  if (!viewingOS) return;
  _buildPDFFromOS(viewingOS);
  fecharModal();
}

function gerarPDFPorId(id) {
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  var os = hist.find(function(x) { return x.id === id; });
  if (!os) { toast('OS nao encontrada.', 'error'); return; }
  _buildPDFFromOS(os);
}

/* EDITAR OS */
function editarOS(id) {
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  var os = hist.find(function(x) { return x.id === id; });
  if (!os) return;
  editingOSId = id;
  var body = document.getElementById('editOSBody');
  body.innerHTML = '<div class="edit-field"><label>Cliente</label><input type="text" id="editCli" value="' + esc(os.cliNome || '') + '"></div>' +
    '<div class="edit-field"><label>Tecnico</label><input type="text" id="editTec" value="' + esc(os.tecNome || '') + '"></div>' +
    '<div class="edit-field"><label>Defeito</label><input type="text" id="editDef" value="' + esc(os.defeito || '') + '"></div>' +
    '<div class="edit-field"><label>Servico Executado</label><textarea id="editServ">' + esc(os.servico || '') + '</textarea></div>' +
    '<div class="edit-field"><label>Pecas</label><textarea id="editPecas">' + esc(os.pecas || '') + '</textarea></div>' +
    '<div class="edit-field"><label>Observacoes</label><textarea id="editObs">' + esc(os.obs || '') + '</textarea></div>' +
    '<div class="edit-field"><label>Status</label><select id="editStatus"><option' + (os.status === 'Concluído' ? ' selected' : '') + '>Concluído</option><option' + (os.status === 'Pendente' ? ' selected' : '') + '>Pendente</option><option' + (os.status === 'Aguardando Peça' ? ' selected' : '') + '>Aguardando Peça</option><option' + (os.status === 'Orçamento Enviado' ? ' selected' : '') + '>Orçamento Enviado</option></select></div>';
  abrirModal('modalEditOS');
}

function salvarEdicaoOS() {
  if (!editingOSId) return;
  var hist = JSON.parse(localStorage.getItem('os_historico') || '[]');
  var idx = hist.findIndex(function(x) { return x.id === editingOSId; });
  if (idx < 0) return;
  hist[idx].cliNome = document.getElementById('editCli').value;
  hist[idx].tecNome = document.getElementById('editTec').value;
  hist[idx].defeito = document.getElementById('editDef').value;
  hist[idx].servico = document.getElementById('editServ').value;
  hist[idx].pecas = document.getElementById('editPecas').value;
  hist[idx].obs = document.getElementById('editObs').value;
  hist[idx].status = document.getElementById('editStatus').value;
  localStorage.setItem('os_historico', JSON.stringify(hist));
  fecharModal();
  renderHist();
  renderDashboard();
  toast('OS atualizada com sucesso!', 'success');
}

/* GERAR PDF DA ULTIMA OS */
function gerarPDFUltimaOS() {
  if (!ultimaOSSalva) { toast('Nenhuma OS disponivel para PDF.', 'error'); return; }
  _buildPDFFromOS(ultimaOSSalva);
  fecharModal();
}

/* GERAR PDF (OS ATUAL) */
function gerarPDF() {
  var osData = {
    numero: cfg.proxOS || 1, data: new Date().toISOString(),
    cliNome: g('cNome'), cliCnpj: g('cCnpj'), cliEnd: g('cEnd'),
    cliContato: g('cContato'), cliTel: g('cTel'), cliEmail: g('cEmail'),
    tecNome: g('tNome'), eqMarca: g('eMarca'), eqModelo: g('eModelo'),
    eqComb: g('eComb'), eqSerie: g('eSerie'), horimetro: g('eHor'),
    tipoChamado: g('tipo'), prioridade: g('prior'), defeito: g('defeito'),
    servico: g('servico'), pecas: g('pecas'), obs: g('obs'), status: g('status'),
    agendaData: g('agendaData'), agendaHora: g('agendaHora'),
    tempo: fmtTempo(timerSeg), timerLog: tLog,
    fotos: fotos, horFoto: horFoto, assinatura: assinatura
  };
  _buildPDFFromOS(osData);
}

/* PDF BUILDER */
function _buildPDFFromOS(os) {
  var btn = document.getElementById('btnPdf');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Gerando PDF...'; }
  setTimeout(function() {
    try { _doPDF(os); }
    catch (err) { console.error('PDF Error:', err); toast('Erro ao gerar PDF: ' + err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Gerar e Baixar PDF'; } }
  }, 200);
}

function _doPDF(os) {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var now = new Date(os.data || new Date());
  var numOS = fmtNum(os.numero || 1);
  var empresa = (cfg.empresa || 'MARLIFT SERVICE').toUpperCase();
  var W = 210, M = 12, C = W - M * 2;
  var y = 0;

  function hex2rgb(h) { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  function check(n) { if (y + n > 280) { doc.addPage(); y = M; } }

  // Header
  doc.setFillColor(30, 30, 46); doc.rect(0, 0, W, 32, 'F');
  doc.setFillColor(255, 102, 0); doc.rect(0, 29, W, 3, 'F');
  doc.setTextColor(255, 102, 0); doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text(empresa, M, 12);
  doc.setTextColor(200, 200, 200); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('ORDEM DE SERVICO', M, 18);
  if (cfg.cnpj) doc.text('CNPJ: ' + cfg.cnpj, M, 23);
  if (cfg.tel) doc.text('Tel: ' + cfg.tel, M, 27.5);
  doc.setFillColor(255, 102, 0); doc.roundedRect(W - M - 42, 5, 42, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text(numOS, W - M - 21, 14.5, { align: 'center' });
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}), W - M - 21, 18.5, { align: 'center' });
  y = 36;

  // Secao helper
  function secao(titulo, corBg, corTxt) {
    check(10);
    var rgb = hex2rgb(corBg);
    doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(M, y, C, 7, 'F');
    var trgb = hex2rgb(corTxt);
    doc.setTextColor(trgb[0],trgb[1],trgb[2]); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
    doc.text(titulo, M + 3, y + 5);
    y += 7;
  }

  // Cliente
  secao('CLIENTE', '#ff6600', '#ffffff');
  check(25);
  doc.setDrawColor(229,231,235); doc.setLineWidth(0.3); doc.rect(M, y, C, 22, 'S');
  doc.setTextColor(30,30,46); doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(os.cliNome || '--', M + 3, y + 6);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(107,114,128);
  if (os.cliCnpj) doc.text('CNPJ: ' + os.cliCnpj, M + 3, y + 11);
  if (os.cliEnd) doc.text('End: ' + os.cliEnd, M + 3, y + 16);
  var contLine = (os.cliContato ? 'Contato: ' + os.cliContato + '  ' : '') + (os.cliTel ? 'Tel: ' + os.cliTel : '');
  if (contLine) doc.text(contLine, M + 3, y + 21);
  y += 25;

  // Tecnico e Equipamento
  secao('TECNICO E EQUIPAMENTO', '#1e1e2e', '#ffffff');
  check(22);
  doc.setDrawColor(229,231,235); doc.rect(M, y, C, 20, 'S');
  doc.setTextColor(30,30,46); doc.setFontSize(9); doc.setFont('helvetica','bold');
  doc.text('Tecnico: ' + (os.tecNome || '--'), M + 3, y + 6);
  doc.setFont('helvetica','normal');
  doc.text('Equipamento: ' + (os.eqMarca || '') + ' ' + (os.eqModelo || ''), M + 3, y + 11);
  doc.text('Combustivel: ' + (os.eqComb || '--') + '  |  S/N: ' + (os.eqSerie || '--') + '  |  Horimetro: ' + (os.horimetro || '--') + 'h', M + 3, y + 16);
  y += 23;

  // Tipo e Defeito
  secao('CHAMADO', '#fee2e2', '#b91c1c');
  check(18);
  doc.setDrawColor(229,231,235); doc.rect(M, y, C, 16, 'S');
  doc.setTextColor(30,30,46); doc.setFontSize(9); doc.setFont('helvetica','bold');
  doc.text('Tipo: ' + (os.tipoChamado || '--') + '  |  Prioridade: ' + (os.prioridade || '--'), M + 3, y + 6);
  doc.setFont('helvetica','normal');
  var defLines = doc.splitTextToSize('Defeito: ' + (os.defeito || '--'), C - 6);
  defLines.forEach(function(l, i) { doc.text(l, M + 3, y + 11 + i * 4); });
  y += 18;

  // Servico
  secao('SERVICO EXECUTADO', '#ff6600', '#ffffff');
  var srvLines = doc.splitTextToSize(os.servico || '--', C - 6);
  var srvH = srvLines.length * 4.5 + 6;
  check(srvH);
  doc.setDrawColor(229,231,235); doc.rect(M, y, C, srvH, 'S');
  doc.setTextColor(30,30,46); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  srvLines.forEach(function(l, i) { doc.text(l, M + 3, y + 5 + i * 4.5); });
  y += srvH + 3;

  // Pecas
  if (os.pecas) {
    secao('PECAS APLICADAS', '#1e1e2e', '#ffffff');
    var pecLines = doc.splitTextToSize(os.pecas, C - 6);
    var pecH = pecLines.length * 4.5 + 6;
    check(pecH);
    doc.setDrawColor(229,231,235); doc.rect(M, y, C, pecH, 'S');
    doc.setTextColor(30,30,46); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    pecLines.forEach(function(l, i) { doc.text(l, M + 3, y + 5 + i * 4.5); });
    y += pecH + 3;
  }

  // Tempo
  secao('REGISTRO DE TEMPO', '#1e1e2e', '#ffffff');
  var logEntries = os.timerLog || [];
  var logH = Math.max(18, logEntries.length * 4.5 + 14);
  check(logH);
  doc.setFillColor(40,40,60); doc.rect(M, y, C, logH, 'F');
  doc.setTextColor(255,102,0); doc.setFontSize(16); doc.setFont('courier','bold');
  doc.text(os.tempo || '00:00:00', M + 4, y + 10);
  doc.setTextColor(180,180,180); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  var ly = y + 16;
  logEntries.forEach(function(item) {
    if (ly + 4 > y + logH - 2) return;
    var txt = item.hora + ' -- ' + item.evento;
    if (item.parcial) txt += ' (' + item.parcial + ')';
    if (item.total) txt += ' [TOTAL: ' + item.total + ']';
    doc.text(txt, M + 4, ly); ly += 4.5;
  });
  y += logH + 3;

  // Fotos
  var osFotos = os.fotos || [];
  if (osFotos.length > 0) {
    secao('FOTOS (' + osFotos.length + ')', '#ff6600', '#ffffff');
    y += 2;
    var fW = (C - 8) / 3, fH = fW * 0.75;
    var fotosToShow = osFotos.slice(0, 9);
    fotosToShow.forEach(function(src, i) {
      var col = i % 3;
      if (col === 0 && i > 0) y += fH + 4;
      check(fH + 4);
      var fx = M + col * (fW + 4);
      try { doc.addImage(src, 'JPEG', fx, y, fW, fH); } catch(ex) {}
    });
    y += fH + 6;
  }

  // Assinatura
  check(42);
  doc.setDrawColor(229,231,235); doc.setLineWidth(0.4);
  doc.rect(M, y, C, 38, 'S');
  doc.setTextColor(107,114,128); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
  doc.text('ASSINATURA DO CLIENTE', M + 3, y + 6);
  if (os.assinatura && os.assinatura.img) {
    try { doc.addImage(os.assinatura.img, 'PNG', M + 3, y + 8, 60, 18); } catch(ex) {}
  } else {
    doc.setDrawColor(200,200,200); doc.line(M + 5, y + 20, M + C / 2, y + 20);
  }
  doc.setTextColor(30,30,46); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  var respNome = (os.assinatura && os.assinatura.nome) ? os.assinatura.nome : '--';
  doc.text(respNome, M + 3, y + 30);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(107,114,128);
  var respDoc = (os.assinatura && os.assinatura.doc) ? 'RG/CPF: ' + os.assinatura.doc : 'RG/CPF: --';
  doc.text(respDoc, M + 3, y + 35);
  y += 40;

  // Rodape
  var totalPages = doc.getNumberOfPages();
  for (var pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(30, 30, 46); doc.rect(0, 286, W, 11, 'F');
    doc.setTextColor(140,140,140); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text(empresa + ' - Emitido em ' + now.toLocaleDateString('pt-BR') + ' - ' + numOS, W / 2, 292, { align: 'center' });
    doc.setTextColor(255,102,0); doc.text(pg + ' / ' + totalPages, W - M, 292);
  }

  var nomeArq = 'OS-' + numOS.replace('#','') + '_' + (os.cliNome || 'cliente').replace(/\s+/g,'-').substring(0,20) + '.pdf';
  doc.save(nomeArq);
  toast('PDF gerado! Verifique seus Downloads.', 'success');
}

/* GPS */
function abrirGps() {
  var end = g('cEnd');
  if (!end) { toast('Preencha o endereco primeiro.', 'error'); return; }
  window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(end), '_blank');
}

/* LIMPAR TUDO */
function limparTudo() {
  if (!confirm('APAGAR TODOS os dados do sistema? Esta acao e IRREVERSIVEL!')) return;
  ['os_cfg','os_clientes','os_historico','os_rascunho','os_fotos','os_sig','os_tempo_final','os_hor_foto']
    .forEach(function(k) { localStorage.removeItem(k); });
  location.reload();
}

/* MODAIS */
function abrirModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  if (id === 'modalSig') setTimeout(initSigCanvas, 150);
}
function fecharModal() { document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('open'); }); }

/* TOAST */
function toast(msg, type) {
  type = type || '';
  var c = document.getElementById('toastWrap');
  if (!c) return;
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  var icon = type === 'success' ? '&#9989;' : type === 'error' ? '&#10060;' : '&#8505;&#65039;';
  t.innerHTML = '<span>' + icon + '</span> ' + msg;
  c.appendChild(t);
  setTimeout(function() { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(function() { t.remove(); }, 320); }, 3500);
}

/* MASCARAS */
function mascaraCnpj(el) {
  var v = el.value.replace(/\D/g,'').substring(0,14);
  v = v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  el.value = v;
}
function mascaraTel(el) {
  var v = el.value.replace(/\D/g,'').substring(0,11);
  v = v.length <= 10 ? v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3') : v.replace(/^(\d{2})(\d{5})(\d{0,4})$/, '($1) $2-$3');
  el.value = v; autoSave();
}

/* HELPERS */
function g(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function f(id, val) { var el = document.getElementById(id); if (!el) return; if (el.tagName === 'DIV' || el.tagName === 'SPAN') el.textContent = val; else el.value = val; }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
