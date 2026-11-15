'use strict';
/* Visitas de Obra – PWA offline. Dados no IndexedDB do aparelho. */

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const hojeStr = () => nowLocal().slice(0, 10);
const fmtData = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDT = iso => iso ? `${fmtData(iso)} às ${fmtHora(iso)}` : '';
const fmtLonga = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';
const fmtPrazo = d => d ? d.split('-').reverse().join('/') : '';
const STATUS = { ok: 'Conforme', nc: 'Não conforme', na: 'Não se aplica' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ---------- banco de dados (IndexedDB) ---------- */
let db;
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('visitas-obra', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('obras', { keyPath: 'id' });
      d.createObjectStore('visitas', { keyPath: 'id' }).createIndex('obraId', 'obraId');
      d.createObjectStore('fotos', { keyPath: 'id' }).createIndex('visitaId', 'visitaId');
      d.createObjectStore('modelos', { keyPath: 'id' });
    };
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const st = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
const dbAll = s => rq(st(s).getAll());
const dbGet = (s, k) => rq(st(s).get(k));
const dbPut = (s, o) => rq(st(s, 'readwrite').put(o));
const dbDel = (s, k) => rq(st(s, 'readwrite').delete(k));
const dbIdx = (s, i, k) => rq(st(s).index(i).getAll(k));
const dbClear = s => rq(st(s, 'readwrite').clear());

/* ---------- modelos padrão ---------- */
const PADRAO = {
  'Fundação': ['Locação da obra conferida com o projeto', 'Escavação nas cotas e dimensões do projeto', 'Armadura conforme projeto estrutural (bitolas e espaçamentos)', 'Cobrimento e espaçadores da armadura', 'Concretagem sem falhas (nichos/segregação)', 'Impermeabilização de baldrames'],
  'Estrutura': ['Prumo e nível de pilares', 'Formas e escoramento conferidos', 'Armaduras de vigas e lajes conforme projeto', 'Passagem de tubulações antes da concretagem', 'Qualidade do concreto (acabamento, fissuras)', 'Cura do concreto'],
  'Alvenaria': ['Marcação e esquadro das paredes', 'Prumo, nível e alinhamento', 'Amarração entre paredes e estrutura', 'Vergas e contravergas', 'Vãos de portas e janelas conforme projeto', 'Encunhamento'],
  'Instalações elétricas': ['Pontos de tomadas e interruptores conforme projeto', 'Eletrodutos e caixas embutidos corretamente', 'Quadro de distribuição e circuitos identificados', 'Aterramento', 'Fiação e bitolas conforme projeto', 'Teste de continuidade/funcionamento'],
  'Instalações hidráulicas': ['Pontos de água fria e quente conforme projeto', 'Teste de estanqueidade das tubulações', 'Caimento de esgoto', 'Caixas sifonadas e ralos', 'Registros e acessos para manutenção', 'Reservatório e barrilete'],
  'Impermeabilização': ['Preparo da base (limpeza, regularização)', 'Aplicação conforme especificação do fabricante', 'Rodapé/subida nas paredes (altura mínima)', 'Reforço em ralos, cantos e tubulações', 'Teste de estanqueidade (lâmina d\'água)', 'Proteção mecânica'],
  'Revestimentos': ['Emboço/reboco: prumo e planicidade', 'Contrapiso: nível e caimentos', 'Assentamento de pisos e azulejos (nível, juntas)', 'Alinhamento e paginação conforme projeto', 'Rejuntes', 'Peças sem trincas ou manchas'],
  'Pintura': ['Preparo da superfície (lixa, massa, selador)', 'Número de demãos conforme especificação', 'Cor e acabamento conforme projeto', 'Uniformidade (sem manchas/escorridos)', 'Proteção de pisos e esquadrias', 'Retoques finais'],
  'Esquadrias': ['Dimensões e posição conforme projeto', 'Prumo, nível e esquadro', 'Abertura e fechamento sem esforço', 'Vedação e acabamento', 'Ferragens e fechaduras', 'Vidros sem riscos ou trincas'],
  'Limpeza': ['Remoção de entulho e sobras', 'Limpeza fina de pisos e revestimentos', 'Limpeza de vidros e esquadrias', 'Retirada de proteções', 'Áreas externas e calçadas', 'Conferência final com o cliente']
};
async function semearModelos(forcar) {
  const ex = await dbAll('modelos'); const nomes = ex.map(m => m.nome);
  if (!forcar && (localStorage.getItem('semeado') || ex.length)) return 0;
  let n = 0;
  for (const [nome, itens] of Object.entries(PADRAO)) {
    if (nomes.includes(nome)) continue;
    await dbPut('modelos', { id: uid(), nome, itens: [...itens] }); n++;
  }
  localStorage.setItem('semeado', '1');
  return n;
}

/* ---------- tema ---------- */
function aplicarTema() {
  const t = localStorage.getItem('tema') || 'auto';
  const escuro = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').content = escuro ? '#0d1a1d' : '#0f5c6e';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);

/* ---------- modais ---------- */
function modal(html) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.addEventListener('mousedown', e => { if (e.target === m) fecharModal(); });
  $('#modals').append(m);
  return m.firstElementChild;
}
function fecharModal() { const m = $('#modals').lastElementChild; if (m) m.remove(); }

// fields: {name,label,type(text|textarea|date|datetime-local|select|checks),value,options,required,placeholder}
function formulario({ titulo, campos, ok = 'Salvar', perigo, aoSalvar, aoPerigo, extra = '' }) {
  const html = campos.map(f => {
    const v = esc(f.value ?? ''), req = f.required ? 'required' : '', ph = esc(f.placeholder || '');
    if (f.type === 'textarea') return `<label class="f">${esc(f.label)}<textarea name="${f.name}" placeholder="${ph}" ${req}>${v}</textarea></label>`;
    if (f.type === 'select') return `<label class="f">${esc(f.label)}<select name="${f.name}">${f.options.map(o => `<option value="${esc(o[0])}" ${o[0] === f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
    if (f.type === 'checks') return `<div class="f">${esc(f.label)}</div>${f.options.map(o => `<label class="chk"><input type="checkbox" name="${f.name}" value="${esc(o[0])}" ${o[2] ? 'checked' : ''}>${esc(o[1])}</label>`).join('')}`;
    return `<label class="f">${esc(f.label)}<input type="${f.type || 'text'}" name="${f.name}" value="${v}" placeholder="${ph}" ${req} autocomplete="off"></label>`;
  }).join('');
  const s = modal(`<h2>${esc(titulo)}</h2>${extra}<form>${html}<div class="row"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn">${esc(ok)}</button></div>${perigo ? `<button type="button" class="btn danger" data-p>${esc(perigo)}</button>` : ''}</form>`);
  const form = s.querySelector('form');
  s.querySelector('[data-x]').onclick = fecharModal;
  if (perigo) s.querySelector('[data-p]').onclick = async () => { if (await aoPerigo()) fecharModal(); };
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form), vals = {};
    for (const f of campos) vals[f.name] = f.type === 'checks' ? fd.getAll(f.name) : (fd.get(f.name) || '').toString().trim();
    if (await aoSalvar(vals) !== false) fecharModal();
  };
  const first = form.querySelector('input[type=text],textarea'); if (first && !first.value) setTimeout(() => first.focus(), 80);
}

/* ---------- cabeçalho / navegação ---------- */
function cab(titulo, voltar, acoes = '') {
  $('#title').textContent = titulo;
  const b = $('#back'); b.style.visibility = voltar ? 'visible' : 'hidden'; if (voltar) b.href = voltar;
  $('#hact').innerHTML = acoes;
}
const vazio = (ic, txt) => `<div class="empty"><big>${ic}</big>${txt}</div>`;

let cur = null;           // visita aberta
let urls = new Map();     // fotoId -> objectURL
const urlFoto = f => { if (!urls.has(f.id)) urls.set(f.id, URL.createObjectURL(f.blob)); return urls.get(f.id); };
const soltarUrls = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); };

let saveT;
function salvarVisita() { clearTimeout(saveT); saveT = setTimeout(flush, 350); }
async function flush() { clearTimeout(saveT); saveT = null; if (cur && cur.v) await dbPut('visitas', cur.v); }

async function rota() {
  await flush(); soltarUrls(); cur = null; $('#modals').innerHTML = '';
  const [p, id, sub] = (location.hash.slice(2) || '').split('/');
  document.body.classList.toggle('notabs', !['', 'modelos', 'config'].includes(p));
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === p));
  try {
    if (p === '') await vObras();
    else if (p === 'obra') await vObra(id, sub);
    else if (p === 'visita') await vVisita(id);
    else if (p === 'relatorio') await vRelatorio(id);
    else if (p === 'modelos') await vModelos();
    else if (p === 'modelo') await vModelo(id);
    else if (p === 'config') await vConfig();
    else location.hash = '#/';
  } catch (e) {
    console.error(e);
    app.innerHTML = vazio('⚠️', 'Algo deu errado ao abrir esta tela.<br><a href="#/" class="chip">Voltar ao início</a>');
  }
}
async function atualizar() { const y = scrollY; await rota(); scrollTo(0, y); }
addEventListener('hashchange', () => { rota(); scrollTo(0, 0); });
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

/* ---------- pendências (cálculo) ---------- */
const pendAberta = it => it.status === 'nc' && (it.pend?.status || 'aberta') !== 'resolvida';
async function pendenciasObra(obraId) {
  const vs = await dbIdx('visitas', 'obraId', obraId);
  vs.sort((a, b) => b.data.localeCompare(a.data));
  return vs.flatMap(v => v.itens.filter(i => i.status === 'nc').map(it => ({ v, it })));
}
function itemPend(p, mostrarAcao = true) {
  const { v, it } = p, res = (it.pend?.status) === 'resolvida', prazo = it.pend?.prazo;
  const venc = !res && prazo && prazo < hojeStr();
  return `<div class="card"><b>${esc(it.texto)}</b>
    <div class="mut">${esc(it.etapa)} · visita de ${fmtData(v.data)}</div>
    ${it.comentario ? `<div style="margin-top:6px">${esc(it.comentario)}</div>` : ''}
    <div class="chips"><span class="chip ${res ? 'ok' : 'nc'}">${res ? 'Resolvida' : 'Aberta'}</span>
    ${prazo ? `<span class="chip ${venc ? 'nc' : ''}">Prazo: ${fmtPrazo(prazo)}${venc ? ' (vencido)' : ''}</span>` : ''}</div>
    ${mostrarAcao ? `<div class="row"><button class="btn sm ${res ? 'ghost' : ''}" data-act="pend-lista" data-v="${v.id}" data-id="${it.id}">${res ? '↩ Reabrir' : '✔ Marcar resolvida'}</button>
    <button class="btn sm ghost" data-act="prazo-lista" data-v="${v.id}" data-id="${it.id}">📅 Prazo</button>
    <a class="btn sm ghost" href="#/visita/${v.id}">Abrir</a></div>` : ''}</div>`;
}

/* ---------- tela: obras ---------- */
async function vObras() {
  cab('Visitas de Obra', null);
  const [obras, vis] = await Promise.all([dbAll('obras'), dbAll('visitas')]);
  obras.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  app.innerHTML = (obras.length ? obras.map(o => {
    const vs = vis.filter(v => v.obraId === o.id);
    const pend = vs.flatMap(v => v.itens).filter(pendAberta).length;
    const ult = vs.map(v => v.data).sort().pop();
    return `<a class="card link" href="#/obra/${o.id}"><b style="font-size:1.1rem">${esc(o.nome)}</b>
      ${o.cliente ? `<span class="mut">👤 ${esc(o.cliente)}</span>` : ''}${o.endereco ? `<span class="mut">📍 ${esc(o.endereco)}</span>` : ''}
      <div class="chips"><span class="chip">${vs.length} visita(s)</span>${ult ? `<span class="chip">Última: ${fmtData(ult)}</span>` : ''}${pend ? `<span class="chip nc">${pend} pendência(s)</span>` : ''}</div></a>`;
  }).join('') : vazio('🏗️', 'Nenhuma obra ainda.<br>Toque em <b>Nova obra</b> para começar.'))
    + `<button class="fab" data-act="nova-obra">＋ Nova obra</button>`;
}
function formObra(o) {
  const novo = !o;
  formulario({
    titulo: novo ? 'Nova obra' : 'Editar obra',
    campos: [
      { name: 'nome', label: 'Nome da obra / projeto', value: o?.nome, required: true, placeholder: 'Ex.: Residência Silva' },
      { name: 'cliente', label: 'Cliente', value: o?.cliente },
      { name: 'endereco', label: 'Endereço', value: o?.endereco }
    ],
    perigo: novo ? null : 'Excluir obra (apaga visitas e fotos)',
    aoPerigo: async () => {
      if (!confirm('Excluir esta obra com TODAS as visitas e fotos? Isso não pode ser desfeito.')) return false;
      for (const v of await dbIdx('visitas', 'obraId', o.id)) await apagarVisita(v.id);
      await dbDel('obras', o.id); location.hash = '#/'; toast('Obra excluída'); return true;
    },
    aoSalvar: async v => {
      const obra = { id: o?.id || uid(), criada: o?.criada || new Date().toISOString(), ...v };
      await dbPut('obras', obra);
      if (novo) location.hash = '#/obra/' + obra.id; else atualizar();
    }
  });
}
async function apagarVisita(id) {
  for (const f of await dbIdx('fotos', 'visitaId', id)) await dbDel('fotos', f.id);
  await dbDel('visitas', id);
}

/* ---------- tela: obra ---------- */
let pendFiltro = 'abertas';
async function vObra(id, sub) {
  const obra = await dbGet('obras', id);
  if (!obra) { location.hash = '#/'; return; }
  cab(obra.nome, '#/', `<button class="ib" data-act="editar-obra" data-id="${id}" aria-label="Editar obra">✎</button>`);
  const vs = (await dbIdx('visitas', 'obraId', id)).sort((a, b) => b.data.localeCompare(a.data));
  const pends = await pendenciasObra(id);
  const nAb = pends.filter(p => pendAberta(p.it)).length;
  let html = `<div class="card">${obra.cliente ? `<div>👤 ${esc(obra.cliente)}</div>` : ''}${obra.endereco ? `<div>📍 ${esc(obra.endereco)}</div>` : ''}${!obra.cliente && !obra.endereco ? '<span class="mut">Sem cliente/endereço. Toque em ✎ para editar.</span>' : ''}</div>
  <div class="tabsw"><a href="#/obra/${id}" class="${sub !== 'pend' ? 'on' : ''}">Visitas (${vs.length})</a><a href="#/obra/${id}/pend" class="${sub === 'pend' ? 'on' : ''}">Pendências (${nAb})</a></div>`;
  if (sub === 'pend') {
    const lista = pends.filter(p => pendFiltro === 'todas' || (pendFiltro === 'abertas') === pendAberta(p.it));
    html += `<div class="tabsw">${[['abertas', 'Abertas'], ['resolvidas', 'Resolvidas'], ['todas', 'Todas']].map(f => `<button class="${pendFiltro === f[0] ? 'on' : ''}" data-act="filtro" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>`
      + (lista.length ? lista.map(p => itemPend(p)).join('') : vazio(pendFiltro === 'resolvidas' ? '📭' : '🎉', pendFiltro === 'resolvidas' ? 'Nenhuma pendência resolvida.' : 'Nenhuma pendência aqui.<br>Itens marcados como <b>Não conforme</b> aparecem nesta lista.'));
  } else {
    html += vs.length ? (await Promise.all(vs.map(async v => {
      const c = { ok: 0, nc: 0, na: 0 }; v.itens.forEach(i => i.status && c[i.status]++);
      const nf = (await dbIdx('fotos', 'visitaId', v.id)).length;
      return `<a class="card link" href="#/visita/${v.id}"><b>${fmtLonga(v.data)}</b><span class="mut">às ${fmtHora(v.data)}</span>
        <div class="chips"><span class="chip ok">✓ ${c.ok}</span><span class="chip nc">✕ ${c.nc}</span><span class="chip na">– ${c.na}</span><span class="chip">📷 ${nf}</span></div>
        ${v.obs ? `<span class="mut" style="margin-top:4px">${esc(v.obs.slice(0, 90))}${v.obs.length > 90 ? '…' : ''}</span>` : ''}</a>`;
    }))).join('') : vazio('📝', 'Nenhuma visita registrada.<br>Toque em <b>Nova visita</b>.');
    html += `<button class="fab" data-act="nova-visita" data-id="${id}">＋ Nova visita</button>`;
  }
  app.innerHTML = html;
}
async function novaVisita(obraId) {
  const modelos = (await dbAll('modelos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ult = JSON.parse(localStorage.getItem('ultimosModelos') || '[]');
  formulario({
    titulo: 'Nova visita',
    extra: `<p class="mut">Data e hora: agora (${fmtDT(nowLocal())}). Escolha as etapas do checklist:</p>`,
    campos: [{ name: 'm', label: 'Etapas / modelos de checklist', type: 'checks', options: modelos.map(m => [m.id, `${m.nome} (${m.itens.length})`, ult.includes(m.id)]) }],
    ok: 'Iniciar visita',
    aoSalvar: async ({ m }) => {
      localStorage.setItem('ultimosModelos', JSON.stringify(m));
      const v = { id: uid(), obraId, data: nowLocal(), obs: '', itens: [] };
      for (const mo of modelos.filter(x => m.includes(x.id))) v.itens.push(...itensDoModelo(mo));
      await dbPut('visitas', v); location.hash = '#/visita/' + v.id;
    }
  });
}
const itensDoModelo = mo => mo.itens.map(t => ({ id: uid(), etapa: mo.nome, texto: t, status: '', comentario: '', pend: { status: 'aberta', prazo: '' } }));

/* ---------- tela: visita ---------- */
function htmlItem(it) {
  const nf = cur.fotos.filter(f => f.itemId === it.id).length;
  const pend = it.pend || {}, res = pend.status === 'resolvida';
  return `<div class="item st-${it.status || 'x'}" id="it-${it.id}">
    <div class="it-t"><span>${esc(it.texto)}</span><button data-act="edit-item" data-id="${it.id}" aria-label="Editar item">✎</button></div>
    <div class="seg">${['ok', 'nc', 'na'].map(s => `<button data-act="set-st" data-id="${it.id}" data-v="${s}" class="${it.status === s ? 'on' : ''}">${s === 'ok' ? '✓ Conforme' : s === 'nc' ? '✕ Não conforme' : 'N/A'}</button>`).join('')}</div>
    <textarea data-f="coment" data-id="${it.id}" placeholder="Comentário…">${esc(it.comentario)}</textarea>
    ${it.status === 'nc' ? `<div class="pend"><label>Prazo da pendência<input type="date" data-f="prazo" data-id="${it.id}" value="${esc(pend.prazo || '')}"></label>
      <button class="chip ${res ? 'ok' : 'nc'}" data-act="pend-st" data-id="${it.id}">${res ? 'Resolvida · reabrir' : 'Aberta · marcar resolvida'}</button></div>` : ''}
    <div class="itfoot"><button class="chip" data-act="foto-item" data-id="${it.id}">📷 Foto deste item</button>${nf ? `<span class="mut">${nf} foto(s)</span>` : ''}</div></div>`;
}
function htmlChecklist() {
  const v = cur.v, etapas = [...new Set(v.itens.map(i => i.etapa))];
  if (!etapas.length) return vazio('☑️', 'Checklist vazio.<br>Use <b>+ Modelo</b> ou <b>+ Item</b>.');
  return etapas.map(e => `<div class="etapa"><span>${esc(e)}</span><button data-act="rem-etapa" data-e="${esc(e)}">remover etapa</button></div>${v.itens.filter(i => i.etapa === e).map(htmlItem).join('')}`).join('');
}
function htmlResumo() {
  const c = { ok: 0, nc: 0, na: 0, x: 0 }; cur.v.itens.forEach(i => c[i.status || 'x']++);
  return `<span class="chip ok">✓ ${c.ok} conformes</span><span class="chip nc">✕ ${c.nc} não conformes</span><span class="chip na">– ${c.na} N/A</span><span class="chip">${c.x} sem resposta</span>`;
}
function htmlFotos() {
  if (!cur.fotos.length) return `<div class="mut" style="margin-top:8px">Nenhuma foto ainda.</div>`;
  return `<div class="photos">${cur.fotos.map(f => {
    const it = cur.v.itens.find(i => i.id === f.itemId);
    return `<div class="ph" data-act="abrir-foto" data-id="${f.id}"><img src="${urlFoto(f)}" alt=""><div>${esc(f.legenda) || '<small>Sem legenda</small>'}${it ? `<small>🔗 ${esc(it.texto.slice(0, 40))}</small>` : ''}</div></div>`;
  }).join('')}</div>`;
}
const refazResumo = () => { const e = $('#resumo'); if (e) e.innerHTML = htmlResumo(); };
const refazFotos = () => { const e = $('#fotos'); if (e) e.innerHTML = htmlFotos(); };

async function vVisita(id) {
  const v = await dbGet('visitas', id);
  if (!v) { location.hash = '#/'; return; }
  const obra = await dbGet('obras', v.obraId);
  const fotos = (await dbIdx('fotos', 'visitaId', id)).sort((a, b) => a.ts - b.ts);
  cur = { v, obra, fotos };
  cab('Visita', '#/obra/' + v.obraId, `<button class="ib" data-act="del-visita" aria-label="Excluir visita">🗑</button>`);
  app.innerHTML = `<div class="card"><b>${esc(obra?.nome)}</b>${obra?.cliente ? `<div class="mut">${esc(obra.cliente)}</div>` : ''}
    <label class="f" style="margin-top:12px">Data e hora da visita<input type="datetime-local" data-f="data" value="${esc(v.data)}"></label>
    <label class="f" style="margin:0">Observações gerais<textarea data-f="obs" placeholder="Anotações gerais da visita, clima, presentes, andamento…">${esc(v.obs)}</textarea></label></div>
    <div class="chips" id="resumo">${htmlResumo()}</div>
    <div class="sec"><h2>Checklist</h2><div style="display:flex;gap:8px"><button class="btn sm ghost" data-act="add-modelo">+ Modelo</button><button class="btn sm ghost" data-act="add-item">+ Item</button></div></div>
    <div id="checklist">${htmlChecklist()}</div>
    <div class="sec"><h2>Fotos</h2></div>
    <div class="row" style="margin-top:0"><button class="btn" data-act="foto-cam">📷 Câmera</button><button class="btn ghost" data-act="foto-gal">🖼️ Galeria</button></div>
    <div id="fotos">${htmlFotos()}</div>
    <div class="bar"><a class="btn" href="#/relatorio/${v.id}">📄 Gerar relatório (PDF)</a></div>`;
}
const itemDe = id => cur.v.itens.find(i => i.id === id);
function repintaItem(id) { const el = document.getElementById('it-' + id), it = itemDe(id); if (el && it) el.outerHTML = htmlItem(it); refazResumo(); }
function repintaChecklist() { $('#checklist').innerHTML = htmlChecklist(); refazResumo(); }

/* ---------- fotos ---------- */
let ligarA = '';
function carregarImg(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); res(i); };
    i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('imagem inválida')); };
    i.src = u;
  });
}
async function comprimir(file, max = 1600, q = 0.72) {
  let img;
  try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { img = await carregarImg(file); }
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  img.close?.();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  if (!blob) throw new Error('falha ao comprimir');
  return blob;
}
async function addFotos(files, itemId) {
  if (!cur || !files.length) return;
  toast(`Processando ${files.length} foto(s)…`);
  let n = 0;
  for (const file of files) {
    try {
      const blob = await comprimir(file);
      const f = { id: uid(), visitaId: cur.v.id, blob, legenda: '', itemId: itemId || '', ts: Date.now() + n };
      await dbPut('fotos', f); cur.fotos.push(f); n++;
    } catch (e) { console.error(e); toast('Não consegui processar uma das fotos.'); await sleep(1200); }
  }
  refazFotos(); if (itemId) repintaItem(itemId);
  if (n) toast(`${n} foto(s) adicionada(s). Toque na foto para legendar.`);
}
function abrirFoto(id) {
  const f = cur.fotos.find(x => x.id === id); if (!f) return;
  const opts = [['', '— Sem vínculo —'], ...cur.v.itens.map(i => [i.id, `${i.etapa}: ${i.texto}`.slice(0, 70)])];
  formulario({
    titulo: 'Foto',
    extra: `<img class="bigimg" src="${urlFoto(f)}" alt=""><p class="mut" style="margin:6px 0 12px">${Math.round(f.blob.size / 1024)} KB</p>`,
    campos: [{ name: 'legenda', label: 'Legenda', type: 'textarea', value: f.legenda, placeholder: 'Descreva a foto' },
    { name: 'itemId', label: 'Vincular a um item do checklist', type: 'select', options: opts, value: f.itemId }],
    perigo: 'Excluir foto',
    aoPerigo: async () => {
      if (!confirm('Excluir esta foto?')) return false;
      await dbDel('fotos', id); cur.fotos = cur.fotos.filter(x => x.id !== id);
      urls.has(id) && (URL.revokeObjectURL(urls.get(id)), urls.delete(id));
      refazFotos(); repintaChecklist(); return true;
    },
    aoSalvar: async v => {
      const antigo = f.itemId; f.legenda = v.legenda; f.itemId = v.itemId; await dbPut('fotos', f);
      refazFotos(); if (antigo) repintaItem(antigo); if (f.itemId) repintaItem(f.itemId);
    }
  });
}

/* ---------- tela: relatório ---------- */
function textoResumo(obra, v, pends) {
  const c = { ok: 0, nc: 0, na: 0 }; v.itens.forEach(i => i.status && c[i.status]++);
  const ab = pends.filter(p => pendAberta(p.it));
  return `*Relatório de visita – ${obra.nome}*\n📅 ${fmtDT(v.data)}\n${obra.endereco ? '📍 ' + obra.endereco + '\n' : ''}\n✓ Conformes: ${c.ok}\n✕ Não conformes: ${c.nc}\n– Não se aplica: ${c.na}\n`
    + (v.obs ? `\n*Observações:* ${v.obs}\n` : '')
    + (ab.length ? `\n*Pendências em aberto (${ab.length}):*\n` + ab.map(p => `• ${p.it.texto}${p.it.comentario ? ' – ' + p.it.comentario : ''}${p.it.pend?.prazo ? ' (prazo ' + fmtPrazo(p.it.pend.prazo) + ')' : ''}`).join('\n') : '\nSem pendências em aberto.')
    + `\n\n${localStorage.getItem('responsavel') || 'Gabriel Franklin'} – Arquiteto`;
}
async function vRelatorio(id) {
  const v = await dbGet('visitas', id); if (!v) { location.hash = '#/'; return; }
  const obra = await dbGet('obras', v.obraId);
  const fotos = (await dbIdx('fotos', 'visitaId', id)).sort((a, b) => a.ts - b.ts);
  const pends = await pendenciasObra(v.obraId);
  cur = { v: null, obra, fotos, rel: v, pends };
  const abertas = pends.filter(p => pendAberta(p.it));
  const resp = localStorage.getItem('responsavel') || 'Gabriel Franklin';
  const c = { ok: 0, nc: 0, na: 0, x: 0 }; v.itens.forEach(i => c[i.status || 'x']++);
  cab('Relatório', '#/visita/' + id);
  const etapas = [...new Set(v.itens.map(i => i.etapa))];
  app.innerHTML = `<div class="toolbar noprint"><button class="btn" data-act="imprimir">🖨️ Salvar PDF / Imprimir</button><button class="btn ghost" data-act="wa">💬 Resumo no WhatsApp</button></div>
  <p class="mut noprint">Dica: em <b>Salvar PDF / Imprimir</b> escolha “Salvar como PDF” (Android) ou toque em compartilhar na pré-visualização (iPhone) para enviar por WhatsApp ou e-mail.</p>
  <div class="report">
    <h1>Relatório de visita de obra</h1><div>${esc(obra.nome)}</div>
    <div class="meta"><div><b>Cliente:</b> ${esc(obra.cliente) || '—'}</div><div><b>Data:</b> ${fmtLonga(v.data)}, ${fmtHora(v.data)}</div>
      <div><b>Endereço:</b> ${esc(obra.endereco) || '—'}</div><div><b>Responsável:</b> ${esc(resp)}</div></div>
    <div><b>Resumo:</b> <span class="s-ok">${c.ok} conformes</span> · <span class="s-nc">${c.nc} não conformes</span> · <span class="s-na">${c.na} não se aplica</span>${c.x ? ` · ${c.x} sem resposta` : ''}</div>
    ${v.obs ? `<h2>Observações gerais</h2><div style="white-space:pre-wrap">${esc(v.obs)}</div>` : ''}
    <h2>Checklist</h2>
    ${etapas.length ? etapas.map(e => `<table style="margin-bottom:10px"><tr><th colspan="3">${esc(e)}</th></tr>${v.itens.filter(i => i.etapa === e).map(i => `<tr><td>${esc(i.texto)}</td><td style="white-space:nowrap" class="s-${i.status || ''}">${STATUS[i.status] || '—'}</td><td>${esc(i.comentario)}</td></tr>`).join('')}</table>`).join('') : '<div>Sem itens de checklist.</div>'}
    <h2>Pendências em aberto da obra (${abertas.length})</h2>
    ${abertas.length ? `<table><tr><th>Item</th><th>Etapa</th><th>Origem</th><th>Prazo</th></tr>${abertas.map(p => `<tr><td>${esc(p.it.texto)}${p.it.comentario ? `<br><i>${esc(p.it.comentario)}</i>` : ''}</td><td>${esc(p.it.etapa)}</td><td>${fmtData(p.v.data)}</td><td>${fmtPrazo(p.it.pend?.prazo) || '—'}</td></tr>`).join('')}</table>` : '<div>Nenhuma pendência em aberto.</div>'}
    ${fotos.length ? `<h2>Registro fotográfico (${fotos.length})</h2><div class="fotos">${fotos.map((f, n) => { const it = v.itens.find(i => i.id === f.itemId); return `<figure><img src="${urlFoto(f)}" alt=""><figcaption><b>Foto ${n + 1}</b>${f.legenda ? ' – ' + esc(f.legenda) : ''}${it ? `<br><i>Item: ${esc(it.texto)}</i>` : ''}</figcaption></figure>`; }).join('')}</div>` : ''}
    <p style="margin-top:22px;font-size:12px;color:#555">${esc(resp)} – Arquiteto · Gerado em ${fmtDT(nowLocal())}</p>
  </div>`;
}
async function imprimir() {
  const v = cur.rel, antes = document.title;
  document.title = `Relatorio - ${cur.obra.nome} - ${v.data.slice(0, 10)}`.replace(/[\\/:*?"<>|]/g, '');
  const imgs = [...document.querySelectorAll('.report img')];
  await Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })));
  addEventListener('afterprint', () => { document.title = antes; }, { once: true });
  window.print();
}

/* ---------- tela: modelos ---------- */
async function vModelos() {
  cab('Modelos de checklist', null);
  const ms = (await dbAll('modelos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  app.innerHTML = `<p class="mut">Modelos são listas de itens por etapa, copiadas para cada nova visita. Editar um modelo não altera visitas já feitas.</p>`
    + (ms.length ? ms.map(m => `<a class="card link" href="#/modelo/${m.id}"><b>${esc(m.nome)}</b><span class="mut">${m.itens.length} item(ns)</span></a>`).join('') : vazio('📋', 'Nenhum modelo. Crie um ou restaure os padrão em Ajustes.'))
    + `<button class="fab" data-act="novo-modelo">＋ Novo modelo</button>`;
}
async function vModelo(id) {
  const m = await dbGet('modelos', id); if (!m) { location.hash = '#/modelos'; return; }
  cab('Modelo', '#/modelos', `<button class="ib" data-act="del-modelo" data-id="${id}" aria-label="Excluir modelo">🗑</button>`);
  app.innerHTML = `<label class="f">Nome da etapa / modelo<input type="text" id="mnome" value="${esc(m.nome)}"></label>
    <div class="sec"><h2>Itens (${m.itens.length})</h2></div>
    ${m.itens.map((t, i) => `<div class="card" style="display:flex;gap:8px;align-items:center;padding:6px 6px 6px 14px"><span style="flex:1">${esc(t)}</span>
      <button class="btn sm ghost" data-act="mi-sobe" data-id="${id}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
      <button class="btn sm ghost" data-act="mi-edit" data-id="${id}" data-i="${i}" aria-label="Editar">✎</button></div>`).join('')}
    <button class="fab" data-act="mi-novo" data-id="${id}">＋ Novo item</button>`;
  $('#mnome').addEventListener('change', async e => { const nome = e.target.value.trim(); if (nome) { m.nome = nome; await dbPut('modelos', m); toast('Nome salvo'); } });
}

/* ---------- tela: ajustes / backup ---------- */
async function vConfig() {
  cab('Ajustes', null);
  const tema = localStorage.getItem('tema') || 'auto';
  let uso = '';
  try { const e = await navigator.storage.estimate(); uso = `Espaço usado pelo app: ${(e.usage / 1048576).toFixed(1)} MB.`; } catch { }
  app.innerHTML = `<div class="card"><h2>Responsável</h2><label class="f">Nome que aparece nos relatórios<input type="text" id="resp" value="${esc(localStorage.getItem('responsavel') || 'Gabriel Franklin')}"></label></div>
  <div class="card"><h2>Tema</h2><div class="tabsw" style="margin:0">${[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(t => `<button class="${tema === t[0] ? 'on' : ''}" data-act="tema" data-t="${t[0]}">${t[1]}</button>`).join('')}</div></div>
  <div class="card"><h2>Backup</h2><p class="mut">Os dados ficam só neste aparelho. Faça backup com frequência (e antes de trocar de celular). O arquivo inclui obras, visitas, modelos e fotos. ${uso}</p>
    <div class="row" style="flex-direction:column"><button class="btn" data-act="exportar">⬇️ Exportar backup (baixar)</button><button class="btn ghost" data-act="exportar-comp">📤 Exportar e compartilhar</button><button class="btn ghost" data-act="importar">⬆️ Importar backup</button></div></div>
  <div class="card"><h2>Modelos</h2><button class="btn ghost wide" data-act="restaurar">Restaurar modelos padrão faltantes</button></div>
  <div class="card"><h2>Instalar no celular</h2><p class="mut"><b>iPhone:</b> Safari → botão Compartilhar → “Adicionar à Tela de Início”.<br><b>Android:</b> Chrome → menu ⋮ → “Instalar app”.</p></div>
  <p class="mut" style="text-align:center">Visitas de Obra · versão 1.0 · funciona offline</p>`;
  $('#resp').addEventListener('change', e => { localStorage.setItem('responsavel', e.target.value.trim() || 'Gabriel Franklin'); toast('Salvo'); });
}
const paraDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function exportar(compartilhar) {
  toast('Gerando backup…');
  const fotos = [];
  for (const f of await dbAll('fotos')) fotos.push({ ...f, blob: await paraDataURL(f.blob) });
  const dados = { app: 'visitas-de-obra', versao: 1, exportadoEm: new Date().toISOString(), obras: await dbAll('obras'), visitas: await dbAll('visitas'), modelos: await dbAll('modelos'), fotos };
  const nome = `visitas-de-obra-backup-${hojeStr()}.json`;
  const file = new File([JSON.stringify(dados)], nome, { type: 'application/json' });
  if (compartilhar && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Visitas de Obra' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast('Backup gerado: ' + nome);
}
async function importar(file) {
  let d;
  try { d = JSON.parse(await file.text()); } catch { return toast('Arquivo inválido.'); }
  if (d.app !== 'visitas-de-obra' || !Array.isArray(d.obras)) return toast('Este não é um backup do Visitas de Obra.');
  if (!confirm(`Importar backup de ${fmtDT(d.exportadoEm)}?\n${d.obras.length} obra(s), ${d.visitas.length} visita(s), ${d.fotos.length} foto(s).\n\nISSO SUBSTITUI todos os dados atuais deste aparelho.`)) return;
  toast('Importando…');
  for (const s of ['obras', 'visitas', 'fotos', 'modelos']) await dbClear(s);
  for (const o of d.obras) await dbPut('obras', o);
  for (const v of d.visitas) await dbPut('visitas', v);
  for (const m of d.modelos || []) await dbPut('modelos', m);
  for (const f of d.fotos) { f.blob = await (await fetch(f.blob)).blob(); await dbPut('fotos', f); }
  localStorage.setItem('semeado', '1');
  toast('Backup importado!'); location.hash = '#/'; rota();
}

/* ---------- ações (cliques) ---------- */
const A = {
  'nova-obra': () => formObra(),
  'editar-obra': async d => formObra(await dbGet('obras', d.id)),
  'nova-visita': d => novaVisita(d.id),
  filtro: d => { pendFiltro = d.f; atualizar(); },
  'pend-lista': async d => { const v = await dbGet('visitas', d.v), it = v.itens.find(i => i.id === d.id); it.pend = it.pend || {}; it.pend.status = it.pend.status === 'resolvida' ? 'aberta' : 'resolvida'; await dbPut('visitas', v); toast(it.pend.status === 'resolvida' ? 'Pendência resolvida ✔' : 'Pendência reaberta'); atualizar(); },
  'prazo-lista': async d => {
    const v = await dbGet('visitas', d.v), it = v.itens.find(i => i.id === d.id);
    formulario({ titulo: 'Prazo da pendência', campos: [{ name: 'prazo', label: 'Prazo (deixe vazio para remover)', type: 'date', value: it.pend?.prazo }], aoSalvar: async x => { it.pend = it.pend || { status: 'aberta' }; it.pend.prazo = x.prazo; await dbPut('visitas', v); atualizar(); } });
  },
  'set-st': d => { const it = itemDe(d.id); it.status = it.status === d.v ? '' : d.v; if (it.status === 'nc' && !it.pend) it.pend = { status: 'aberta', prazo: '' }; repintaItem(d.id); salvarVisita(); },
  'pend-st': d => { const it = itemDe(d.id); it.pend = it.pend || {}; it.pend.status = it.pend.status === 'resolvida' ? 'aberta' : 'resolvida'; repintaItem(d.id); salvarVisita(); },
  'edit-item': d => {
    const it = itemDe(d.id);
    formulario({
      titulo: 'Editar item', campos: [{ name: 'texto', label: 'Item', type: 'textarea', value: it.texto, required: true }, { name: 'etapa', label: 'Etapa', value: it.etapa, required: true }],
      perigo: 'Remover item desta visita',
      aoPerigo: async () => {
        if (!confirm('Remover este item da visita?')) return false;
        cur.v.itens = cur.v.itens.filter(i => i.id !== it.id);
        for (const f of cur.fotos.filter(f => f.itemId === it.id)) { f.itemId = ''; await dbPut('fotos', f); }
        await flush(); repintaChecklist(); refazFotos(); return true;
      },
      aoSalvar: async v => { it.texto = v.texto; it.etapa = v.etapa; await flush(); repintaChecklist(); }
    });
  },
  'add-item': () => {
    const etapas = [...new Set(cur.v.itens.map(i => i.etapa))];
    formulario({
      titulo: 'Novo item nesta visita', extra: etapas.length ? `<p class="mut">Etapas existentes: ${etapas.map(esc).join(', ')}</p>` : '',
      campos: [{ name: 'texto', label: 'Item a verificar', type: 'textarea', required: true }, { name: 'etapa', label: 'Etapa', value: etapas[etapas.length - 1] || 'Geral', required: true }],
      aoSalvar: async v => { cur.v.itens.push({ id: uid(), etapa: v.etapa, texto: v.texto, status: '', comentario: '', pend: { status: 'aberta', prazo: '' } }); await flush(); repintaChecklist(); }
    });
  },
  'add-modelo': async () => {
    const ms = (await dbAll('modelos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!ms.length) return toast('Nenhum modelo cadastrado.');
    formulario({
      titulo: 'Adicionar modelo ao checklist', campos: [{ name: 'm', label: 'Modelos', type: 'checks', options: ms.map(m => [m.id, `${m.nome} (${m.itens.length})`, false]) }], ok: 'Adicionar',
      aoSalvar: async ({ m }) => { ms.filter(x => m.includes(x.id)).forEach(mo => cur.v.itens.push(...itensDoModelo(mo))); await flush(); repintaChecklist(); }
    });
  },
  'rem-etapa': async d => { if (!confirm(`Remover a etapa "${d.e}" e todos os seus itens desta visita?`)) return; const ids = cur.v.itens.filter(i => i.etapa === d.e).map(i => i.id); cur.v.itens = cur.v.itens.filter(i => i.etapa !== d.e); for (const f of cur.fotos.filter(f => ids.includes(f.itemId))) { f.itemId = ''; await dbPut('fotos', f); } await flush(); repintaChecklist(); refazFotos(); },
  'foto-cam': () => { ligarA = ''; $('#fcam').click(); },
  'foto-gal': () => { ligarA = ''; $('#fgal').click(); },
  'foto-item': d => { ligarA = d.id; $('#fcam').click(); },
  'abrir-foto': d => abrirFoto(d.id),
  'del-visita': async () => { if (!confirm('Excluir esta visita e suas fotos?')) return; const o = cur.v.obraId, id = cur.v.id; cur = null; clearTimeout(saveT); await apagarVisita(id); location.hash = '#/obra/' + o; toast('Visita excluída'); },
  imprimir, wa: () => { window.open('https://wa.me/?text=' + encodeURIComponent(textoResumo(cur.obra, cur.rel, cur.pends)), '_blank'); },
  'novo-modelo': () => formulario({ titulo: 'Novo modelo', campos: [{ name: 'nome', label: 'Nome da etapa / modelo', required: true }], aoSalvar: async v => { const m = { id: uid(), nome: v.nome, itens: [] }; await dbPut('modelos', m); location.hash = '#/modelo/' + m.id; } }),
  'del-modelo': async d => { if (!confirm('Excluir este modelo? (Visitas já feitas não mudam.)')) return; await dbDel('modelos', d.id); location.hash = '#/modelos'; },
  'mi-novo': async d => { const m = await dbGet('modelos', d.id); formulario({ titulo: 'Novo item do modelo', campos: [{ name: 'texto', label: 'Item', type: 'textarea', required: true }], aoSalvar: async v => { m.itens.push(v.texto); await dbPut('modelos', m); atualizar(); } }); },
  'mi-edit': async d => {
    const m = await dbGet('modelos', d.id), i = +d.i;
    formulario({
      titulo: 'Editar item do modelo', campos: [{ name: 'texto', label: 'Item', type: 'textarea', value: m.itens[i], required: true }], perigo: 'Remover item',
      aoPerigo: async () => { m.itens.splice(i, 1); await dbPut('modelos', m); atualizar(); return true; },
      aoSalvar: async v => { m.itens[i] = v.texto; await dbPut('modelos', m); atualizar(); }
    });
  },
  'mi-sobe': async d => { const m = await dbGet('modelos', d.id), i = +d.i; if (i > 0) { [m.itens[i - 1], m.itens[i]] = [m.itens[i], m.itens[i - 1]]; await dbPut('modelos', m); atualizar(); } },
  tema: d => { localStorage.setItem('tema', d.t); aplicarTema(); atualizar(); },
  exportar: () => exportar(false), 'exportar-comp': () => exportar(true),
  importar: () => $('#fimp').click(),
  restaurar: async () => { const n = await semearModelos(true); toast(n ? `${n} modelo(s) restaurado(s)` : 'Todos os modelos padrão já existem'); }
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || !A[b.dataset.act]) return;
  e.preventDefault();
  try { await A[b.dataset.act](b.dataset, b); } catch (err) { console.error(err); toast('Erro: ' + err.message); }
});
document.addEventListener('input', e => {
  const t = e.target, f = t.dataset.f; if (!f || !cur?.v) return;
  if (f === 'obs') cur.v.obs = t.value;
  else if (f === 'coment') itemDe(t.dataset.id).comentario = t.value;
  else if (f === 'data') { if (t.value) cur.v.data = t.value; }
  else if (f === 'prazo') { const it = itemDe(t.dataset.id); it.pend = it.pend || { status: 'aberta' }; it.pend.prazo = t.value; }
  salvarVisita();
});
$('#fcam').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; addFotos(fs, ligarA); });
$('#fgal').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; addFotos(fs, ''); });
$('#fimp').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importar(f).catch(err => { console.error(err); toast('Falha ao importar: ' + err.message); }); });

/* ---------- início ---------- */
(async function iniciar() {
  aplicarTema();
  try {
    await abrirDB(); await semearModelos(false);
    navigator.storage?.persist?.();
  } catch (e) {
    app.innerHTML = vazio('⚠️', 'Não foi possível abrir o armazenamento do aparelho. Saia do modo de navegação privada e tente de novo.'); return;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  rota();
})();
