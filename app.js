/* CAPITALE TT — app.js corrigé
   Compatible avec index.html + auth_guard.js + Supabase
*/
'use strict';

const SUPABASE_URL = 'https://fgbnonnhkgwdsgatjloa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYm5vbm5oa2d3ZHNnYXRqbG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjk5OTMsImV4cCI6MjEwNTc0NTk5M30.GjhCHXjOO0BIpOxUWSGKX2m1VJKHRSyJWijg25Ix8Dk';

const supabaseClient =
  window.capitaleSupabase ||
  window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let clients = [], interimaires = [], demandes = [], prospects = [], baremes = [], planning = [];
let currentClientId = null, currentInterimaireId = null, currentDemandeId = null;
let currentPlanningId = null, currentProspectId = null, currentBaremeId = null;
let initialized = false;

const names = {
  dashboard:'Accueil', planning:'Planning', alertes:'Alertes & priorités',
  interimaires:'Intérimaires', clients:'Clients & chantiers',
  matching:'Demandes & matching', commercial:'Prospection & pipeline',
  marches:'Marchés publics', marge:'Tarifs & marges',
  conformite:'Conformité & risques', logistique:'Logistique & EPI',
  communication:'Communication', portails:'Portails externes'
};

window.addEventListener('capitale:ready', initApplication, {once:true});
if (window.capitaleUser && window.capitaleSupabase) initApplication();

async function initApplication() {
  if (initialized) return;
  initialized = true;
  bindNavigation();
  bindForms();
  bindControls();
  bindClientTabs();
  await loadAllData();
  updateCurrentDate();
  updateMargin();
  updateDistanceZone();
  populateClientSelect('demandeClient');
  renderProspectClientSelect();
  renderProspectAssigneeSelect();
  show('dashboard');
}

function bindNavigation() {
  document.querySelectorAll('.nav button').forEach(button => {
    button.addEventListener('click', () => show(button.dataset.view));
  });
}

function bindForms() {
  $('clientForm')?.addEventListener('submit', handleClientSubmit);
  $('interimaireForm')?.addEventListener('submit', handleInterimaireSubmit);
  $('demandeForm')?.addEventListener('submit', handleDemandeSubmit);
  $('prospectForm')?.addEventListener('submit', handleProspectSubmit);
  $('baremeForm')?.addEventListener('submit', handleBaremeSubmit);
  $('planningForm')?.addEventListener('submit', handlePlanningSubmit);
}

function bindControls() {
  $('sell')?.addEventListener('input', updateMargin);
  $('cost')?.addEventListener('input', updateMargin);
  $('distance')?.addEventListener('input', updateDistanceZone);
  $('rayon')?.addEventListener('input', updateDistanceZone);
  $('search')?.addEventListener('keydown', handleSearch);
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });
}

function bindClientTabs() {
  document.querySelectorAll('.client-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.client-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.client-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === target);
      });
    });
  });
}

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = $(id);
  if (!target) return;
  target.classList.remove('hidden');
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  if ($('crumb')) $('crumb').textContent = names[id] || 'Accueil';
  window.scrollTo({top:0, behavior:'smooth'});
  if (id === 'dashboard') renderDashboard();
  if (id === 'clients') renderClients();
  if (id === 'interimaires') renderInterimaires();
  if (id === 'matching') renderDemandes();
  if (id === 'planning') renderPlanning();
  if (id === 'commercial') renderProspects();
  if (id === 'marge') renderBaremes();
  if (id === 'conformite') renderConformite();
  if (id === 'logistique') renderLogistique();
  if (id === 'communication') renderCommunication();
  if (id === 'alertes') renderAlerts();
}

async function checkDatabaseConnection() {
  const badge = $('dbStatus');
  const { error } = await supabaseClient.from('clients').select('id', {count:'exact', head:true});
  if (error) {
    if (badge) { badge.textContent = 'Erreur base'; badge.className = 'badge red'; }
    console.error(error);
    return false;
  }
  if (badge) { badge.textContent = 'Base connectée'; badge.className = 'badge green'; }
  return true;
}

async function loadAllData() {
  await checkDatabaseConnection();
  clients = await fetchRows('clients');
  interimaires = await fetchRows('interimaires');
  demandes = await fetchRows('demandes');
  prospects = await fetchRows('prospects');
  baremes = await fetchRows('baremes');
  planning = await fetchRows('planning_actions');
  renderClients(); renderInterimaires(); renderDemandes();
  renderPlanning(); renderProspects(); renderBaremes(); renderDashboard();
}

async function fetchRows(table) {
  const {data, error} = await supabaseClient.from(table).select('*').order('created_at', {ascending:false});
  if (error) {
    console.error(`Lecture ${table}:`, error);
    toast(`Lecture impossible dans ${table}: ${error.message}`, true);
    return [];
  }
  return data || [];
}

async function saveRow(table, payload, id = null) {
  const result = id
    ? await supabaseClient.from(table).update(payload).eq('id', id).select().single()
    : await supabaseClient.from(table).insert(payload).select().single();
  if (result.error) {
    console.error(`Sauvegarde ${table}:`, result.error);
    toast(`Enregistrement impossible: ${result.error.message}`, true);
    return null;
  }
  return result.data;
}

async function deleteRow(table, id) {
  const {error} = await supabaseClient.from(table).delete().eq('id', id);
  if (error) {
    toast(`Suppression impossible: ${error.message}`, true);
    return false;
  }
  return true;
}

function $(id) { return document.getElementById(id); }
function value(id, fallback='') {
  const el = $(id);
  return el && typeof el.value === 'string' ? el.value.trim() : fallback;
}
function numberValue(id, fallback=0) {
  const n = Number($(id)?.value);
  return Number.isFinite(n) ? n : fallback;
}
function nullableValue(id) {
  const v = value(id);
  return v === '' ? null : v;
}
function setField(id, val) {
  const el = $(id);
  if (el && val !== undefined && val !== null) el.value = val;
}
function escapeHtml(input) {
  return String(input ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}
function jsonForInline(obj) { return encodeURIComponent(JSON.stringify(obj)); }
function parseInline(encoded) {
  try { return JSON.parse(decodeURIComponent(encoded)); } catch { return null; }
}
function toast(message, error=false) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast${error ? ' error' : ''}`;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}
function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (['actif','conforme','terminée','livré','validée','contrat signé'].includes(s)) return 'green';
  if (['bloqué','expiré','urgent','très urgent','refusé','perdu'].includes(s)) return 'red';
  if (['à qualifier','prospect','normal','nouvelle'].includes(s)) return 'blue';
  return 'orange';
}
function updateCurrentDate() {
  const el = $('currentDate');
  if (!el) return;
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  }).format(new Date());
  el.textContent = text.charAt(0).toUpperCase() + text.slice(1);
}

function renderDashboard() {
  const missions = planning.filter(p => p.action_type === 'Mission' && ['Planifié','En cours'].includes(p.status)).length;
  const disponibles = interimaires.filter(i => ['Immédiate','Dans 1 semaine'].includes(i.availability)).length;
  const demandesActives = demandes.filter(d => !['Pourvue','Annulée'].includes(d.status)).length;
  const marge = baremes.length ? baremes.reduce((s,b) => s + Number(b.margin || 0), 0) / baremes.length : 0;
  if ($('kpiMissions')) $('kpiMissions').textContent = missions;
  if ($('kpiInterims')) $('kpiInterims').textContent = disponibles;
  if ($('kpiDemandes')) $('kpiDemandes').textContent = demandesActives;
  if ($('kpiMarge')) $('kpiMarge').innerHTML = `${marge.toFixed(2).replace('.',',')} €<small style="font-size:13px">/h</small>`;
  if ($('dashboardAlerts')) $('dashboardAlerts').innerHTML = `
    <div class="alert red"><span><b>${planning.filter(p => p.status === 'Bloqué').length}</b> mission(s) bloquée(s)</span><b>→</b></div>
    <div class="alert orange"><span><b>Documents</b> à contrôler</span><b>→</b></div>
    <div class="alert blue"><span><b>${prospects.filter(p => p.follow_up_date).length}</b> relance(s) planifiée(s)</span><b>→</b></div>`;
}

/* ---------------- CLIENTS ---------------- */
function openClientModal(client = null) {
  $('clientForm')?.reset();
  currentClientId = client?.id || null;
  if ($('clientModalTitle')) $('clientModalTitle').textContent = client ? 'Modifier le client' : 'Créer un client';
  document.querySelectorAll('.client-tab').forEach((t,i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.client-tab-panel').forEach((p,i) => p.classList.toggle('active', i === 0));
  if (client) {
    const map = {
      clientType:'type', clientStatus:'status', company:'company', activity:'activity',
      phone:'phone', email:'email', address:'address', postal:'postal', city:'city',
      department:'department', siret:'siret', naf:'naf', jobs:'jobs',
      qualifications:'qualifications', currentTT:'current_tt', potentialTT:'potential_tt',
      competitors:'competitors', employees:'employees', billing:'billing',
      paymentDelay:'payment_delay', paymentMethod:'payment_method',
      outstanding:'outstanding', creditLimit:'credit_limit', riskLevel:'risk_level',
      contractEmail:'contract_email', invoiceEmail:'invoice_email'
    };
    Object.entries(map).forEach(([field, key]) => setField(field, client[key]));
  }
  $('clientModal')?.classList.remove('hidden');
}
function closeClientModal() { $('clientModal')?.classList.add('hidden'); currentClientId = null; }

async function handleClientSubmit(e) {
  e.preventDefault();
  const company = value('company');
  if (!company) return toast('La raison sociale est obligatoire.', true);
  const payload = {
    type:value('clientType','Prospect'), status:value('clientStatus','À qualifier'), company,
    activity:nullableValue('activity'), phone:nullableValue('phone'), email:nullableValue('email'),
    address:nullableValue('address'), postal:nullableValue('postal'), city:nullableValue('city'),
    department:nullableValue('department'), siret:nullableValue('siret'), naf:nullableValue('naf'),
    jobs:nullableValue('jobs'), qualifications:nullableValue('qualifications'),
    current_tt:numberValue('currentTT'), potential_tt:numberValue('potentialTT'),
    competitors:nullableValue('competitors'), employees:nullableValue('employees'),
    billing:nullableValue('billing'), payment_delay:nullableValue('paymentDelay'),
    payment_method:nullableValue('paymentMethod'), outstanding:numberValue('outstanding'),
    credit_limit:numberValue('creditLimit'), risk_level:value('riskLevel','normal'),
    contract_email:nullableValue('contractEmail'), invoice_email:nullableValue('invoiceEmail'),
    country:'France'
  };
  const saved = await saveRow('clients', payload, currentClientId);
  if (!saved) return;
  toast(currentClientId ? 'Client mis à jour.' : 'Client créé.');
  closeClientModal(); await loadAllData(); show('clients');
}
function editClient(id) {
  const client = clients.find(c => c.id === id);
  if (client) openClientModal(client); else toast('Client introuvable.', true);
}
async function deleteClient(id) {
  const client = clients.find(c => c.id === id);
  if (!client || !confirm(`Supprimer ${client.company} ?`)) return;
  if (await deleteRow('clients', id)) { toast('Client supprimé.'); await loadAllData(); show('clients'); }
}
function renderClients() {
  const body = $('clientsBody'), counter = $('clientCount');
  if (!body) return;
  if (counter) counter.textContent = `${clients.length} client${clients.length > 1 ? 's' : ''}`;
  if (!clients.length) return void (body.innerHTML = '<tr><td colspan="6">Aucun client enregistré.</td></tr>');
  body.innerHTML = clients.map(c => `
    <tr>
      <td><b>${escapeHtml(c.company || 'Sans nom')}</b><br><span style="color:var(--muted)">${escapeHtml(c.id || '')}</span></td>
      <td>${escapeHtml(c.type || 'Prospect')}</td>
      <td>${escapeHtml(c.phone || '—')}<br><span style="color:var(--muted)">${escapeHtml(c.email || '—')}</span></td>
      <td><b>${Number(c.potential_tt || 0)}</b></td>
      <td><span class="badge ${statusClass(c.status)}">${escapeHtml(c.status || 'À qualifier')}</span></td>
      <td><button class="btn light" type="button" onclick="editClient('${c.id}')">Ouvrir</button>
          <button class="btn" type="button" onclick="deleteClient('${c.id}')">Supprimer</button></td>
    </tr>`).join('');
}

/* ---------------- INTERIMAIRES ---------------- */
function openInterimaireModal(item=null) {
  $('interimaireForm')?.reset(); currentInterimaireId = item?.id || null;
  if (item) {
    setField('intNom', item.last_name); setField('intPrenom', item.first_name);
    setField('intMetier', item.trades); setField('intDispo', item.availability);
    setField('intScore', item.terrain_score); setField('intConformite', item.compliance_status);
  }
  $('interimaireModal')?.classList.remove('hidden');
}
function closeInterimaireModal() { $('interimaireModal')?.classList.add('hidden'); currentInterimaireId=null; }
async function handleInterimaireSubmit(e) {
  e.preventDefault();
  const first_name=value('intPrenom'), last_name=value('intNom'), trades=value('intMetier');
  if (!first_name || !last_name || !trades) return toast('Nom, prénom et métier sont obligatoires.', true);
  const saved = await saveRow('interimaires', {
    first_name,last_name,trades,availability:value('intDispo','Immédiate'),
    terrain_score:numberValue('intScore'),compliance_status:value('intConformite','Dossier incomplet')
  }, currentInterimaireId);
  if (!saved) return;
  toast(currentInterimaireId ? 'Intérimaire mis à jour.' : 'Intérimaire créé.');
  closeInterimaireModal(); await loadAllData(); show('interimaires');
}
function editInterimaire(encoded) { const item=parseInline(encoded); if(item) openInterimaireModal(item); }
async function deleteInterimaire(id) { if(confirm('Supprimer cet intérimaire ?') && await deleteRow('interimaires',id)){toast('Intérimaire supprimé.');await loadAllData();show('interimaires');} }
function renderInterimaires() {
  const body=$('interimairesBody'); if(!body)return;
  if(!interimaires.length)return void(body.innerHTML='<tr><td colspan="6">Aucun intérimaire enregistré.</td></tr>');
  body.innerHTML=interimaires.map(i=>`
    <tr><td><b>${escapeHtml(i.first_name)} ${escapeHtml(i.last_name)}</b><br><span style="color:var(--muted)">${escapeHtml(i.reference||i.id)}</span></td>
    <td>${escapeHtml(i.trades||'—')} - ${escapeHtml(i.qualification||'—')}</td>
    <td><span class="badge ${statusClass(i.availability)}">${escapeHtml(i.availability||'—')}</span></td>
    <td><b>${Number(i.terrain_score||0).toFixed(1)} / 5</b></td>
    <td><span class="badge ${statusClass(i.compliance_status)}">${escapeHtml(i.compliance_status||'—')}</span></td>
    <td><button class="btn light" onclick="editInterimaire('${jsonForInline(i)}')">Ouvrir</button><button class="btn" onclick="deleteInterimaire('${i.id}')">Supprimer</button></td></tr>`).join('');
}

/* ---------------- DEMANDES ---------------- */
function populateClientSelect(id='demandeClient', selected='') {
  const select=$(id); if(!select || select.tagName!=='SELECT')return;
  select.innerHTML='<option value="">Sélectionner un client</option>'+clients.map(c=>`<option value="${c.id}">${escapeHtml(c.company)}</option>`).join('');
  if(selected)select.value=selected;
}
function openDemandeModal(item=null) {
  $('demandeForm')?.reset(); currentDemandeId=item?.id||null; populateClientSelect('demandeClient',item?.client_id||'');
  if(item){setField('demandeMetier',item.trade);setField('demandeStart',item.start_date);setField('demandeUrgence',item.urgency);}
  $('demandeModal')?.classList.remove('hidden');
}
function closeDemandeModal(){ $('demandeModal')?.classList.add('hidden'); currentDemandeId=null; }
async function handleDemandeSubmit(e) {
  e.preventDefault();
  const client_id=value('demandeClient'), trade=value('demandeMetier'), start_date=value('demandeStart');
  if(!client_id||!trade||!start_date)return toast('Client, métier et date de démarrage sont obligatoires.',true);
  const saved=await saveRow('demandes',{client_id,trade,start_date,urgency:value('demandeUrgence','Normal'),positions:1,status:'Nouvelle'},currentDemandeId);
  if(!saved)return; toast(currentDemandeId?'Demande mise à jour.':'Demande créée.');closeDemandeModal();await loadAllData();show('matching');
}
function editDemande(encoded){const item=parseInline(encoded);if(item)openDemandeModal(item);}
async function deleteDemande(id){if(confirm('Supprimer cette demande ?')&&await deleteRow('demandes',id)){toast('Demande supprimée.');await loadAllData();show('matching');}}
function renderDemandes(){
  const list=$('demandesList');if(!list)return;
  if(!demandes.length)return void(list.innerHTML='<div class="alert blue">Aucune demande en cours.</div>');
  list.innerHTML=demandes.map(d=>{const c=clients.find(x=>x.id===d.client_id);return`
  <div class="row"><div><h4>${escapeHtml(d.trade)}</h4><p>${escapeHtml(c?.company||d.client_id)} • ${escapeHtml(d.start_date||'')}</p></div>
  <span class="badge ${statusClass(d.urgency)}">${escapeHtml(d.urgency)}</span>
  <button class="btn light" onclick="editDemande('${jsonForInline(d)}')">Ouvrir</button><button class="btn" onclick="deleteDemande('${d.id}')">Supprimer</button></div>`}).join('');
}

/* ---------------- PLANNING ---------------- */
function openPlanningModal(item=null){$('planningForm')?.reset();currentPlanningId=item?.id||null;if(item){setField('planRes',item.resource||item.description);setField('planType',item.action_type);setField('planDate',item.action_date);setField('planDay',item.action_date);} $('planningModal')?.classList.remove('hidden');}
function closePlanningModal(){$('planningModal')?.classList.add('hidden');currentPlanningId=null;}
function normalizePlanningDate(){return value('planDate')||value('planDay')||new Date().toISOString().slice(0,10);}
async function handlePlanningSubmit(e){
  e.preventDefault();const description=value('planRes');if(!description)return toast('La ressource ou la description est obligatoire.',true);
  const type=value('planType','Autre');
  const allowed=['Mission','Appel commercial','Rendez-vous terrain','Formation','Relance','Terrain','Autre'];
  const action_type=allowed.includes(type)?type:'Autre';
  const saved=await saveRow('planning_actions',{resource:description,action_type,action_date:normalizePlanningDate(),description,status:'Planifié',planning_kind:'operationnel'},currentPlanningId);
  if(!saved)return;toast(currentPlanningId?'Action mise à jour.':'Action ajoutée au planning.');closePlanningModal();await loadAllData();show('planning');
}
function editPlanning(encoded){const item=parseInline(encoded);if(item)openPlanningModal(item);}
async function deletePlanning(id){if(confirm('Supprimer cette action ?')&&await deleteRow('planning_actions',id)){toast('Action supprimée.');await loadAllData();show('planning');}}
function renderPlanning(){
  const body=$('planningBody');if(!body)return;
  if(!planning.length)return void(body.innerHTML='<tr><td colspan="6">Aucune action planifiée.</td></tr>');
  const dates=['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25'],groups={};
  planning.forEach(p=>{const k=p.resource||p.description||'Action';(groups[k]??=[]).push(p);});
  body.innerHTML=Object.entries(groups).map(([resource,actions])=>`<tr><td><b>${escapeHtml(resource)}</b><br><span style="color:var(--muted)">${actions.map(a=>escapeHtml(a.action_date||'')).join(', ')}</span></td>${dates.map(date=>{const p=actions.find(a=>a.action_date===date);return`<td>${p?`<span class="badge ${statusClass(p.status)}">${escapeHtml(p.action_type)}</span> <button class="btn" onclick="deletePlanning('${p.id}')">×</button>`:'—'}</td>`}).join('')}</tr>`).join('');
}

/* ---------------- PROSPECTION ---------------- */
function renderProspectClientSelect(selected=''){const s=$('propClient');if(!s)return;s.innerHTML='<option value="">Aucun client associé</option>'+clients.map(c=>`<option value="${c.id}">${escapeHtml(c.company)}</option>`).join('');if(selected)s.value=selected;}
function renderProspectAssigneeSelect(selected=''){
  const s=$('propAssignedTo');if(!s)return;
  supabaseClient.from('profiles').select('id,first_name,last_name,email').order('last_name',{ascending:true}).then(({data,error})=>{
    if(error){console.warn('Profils non chargés:',error.message);return;}
    s.innerHTML='<option value="">Non assigné</option>'+(data||[]).map(p=>`<option value="${p.id}">${escapeHtml([p.first_name,p.last_name].filter(Boolean).join(' ')||p.email||p.id)}</option>`).join('');
    if(selected)s.value=selected;
  });
}
function openProspectModal(item=null){
  $('prospectForm')?.reset();currentProspectId=item?.id||null;renderProspectClientSelect(item?.client_id||'');renderProspectAssigneeSelect(item?.assigned_to||'');
  if(item){setField('propName',item.name);setField('propSource',item.source);setField('propStage',item.stage);setField('propPotential',item.potential);setField('propProbability',item.probability);setField('propNextAction',item.next_action);setField('propFollowUp',item.follow_up_date);setField('propClient',item.client_id);setField('propAssignedTo',item.assigned_to);setField('propNotes',item.notes);}
  $('prospectModal')?.classList.remove('hidden');
}
function closeProspectModal(){$('prospectModal')?.classList.add('hidden');currentProspectId=null;}
async function handleProspectSubmit(e){
  e.preventDefault();const name=value('propName');if(!name)return toast('Le nom du prospect est obligatoire.',true);
  const stage=value('propStage','Sourcé'), allowed=['Sourcé','Premier contact','RDV conducteur','Devis','Négociation','Contrat signé','Perdu'];
  const payload={name,source:nullableValue('propSource'),stage:allowed.includes(stage)?stage:'Sourcé',potential:Math.max(0,numberValue('propPotential')),probability:Math.min(100,Math.max(0,numberValue('propProbability'))),next_action:nullableValue('propNextAction'),follow_up_date:nullableValue('propFollowUp'),client_id:nullableValue('propClient'),assigned_to:nullableValue('propAssignedTo'),notes:nullableValue('propNotes')};
  const saved=await saveRow('prospects',payload,currentProspectId);if(!saved)return;toast(currentProspectId?'Opportunité mise à jour.':'Opportunité créée.');closeProspectModal();await loadAllData();show('commercial');
}
function editProspect(encoded){const item=parseInline(encoded);if(item)openProspectModal(item);}
async function quickMoveProspect(id,currentStage){const stages=['Sourcé','Premier contact','RDV conducteur','Devis','Négociation','Contrat signé'];const i=stages.indexOf(currentStage);if(i<0||i>=stages.length-1)return toast('Cette opportunité est déjà au dernier stade.',true);const saved=await saveRow('prospects',{stage:stages[i+1]},id);if(saved){toast(`Opportunité déplacée vers ${stages[i+1]}.`);await loadAllData();show('commercial');}}
async function deleteProspect(id){if(confirm('Supprimer cette opportunité ?')&&await deleteRow('prospects',id)){toast('Opportunité supprimée.');await loadAllData();show('commercial');}}
function renderProspects(){
  const pipeline=$('pipelineStages');if(!pipeline)return;
  pipeline.querySelectorAll('.stage-content').forEach(x=>x.innerHTML='');
  prospects.forEach(p=>{
    const column=pipeline.querySelector(`.stage[data-stage="${CSS.escape(p.stage)}"] .stage-content`);if(!column)return;
    const card=document.createElement('div');card.className='deal';card.innerHTML=`<strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.source||'Source non renseignée')}</span><div style="display:flex;justify-content:space-between;margin-top:7px;font-size:10px;"><span>💰 ${Number(p.potential||0).toLocaleString('fr-FR')} €</span><span class="badge ${Number(p.probability||0)>=60?'green':'blue'}">${Number(p.probability||0)} %</span></div><p style="font-size:10px;color:var(--muted);margin:8px 0 0;">📌 ${escapeHtml(p.next_action||'Aucune action prévue')}</p><div style="display:flex;gap:5px;margin-top:8px;"><button class="btn light" style="font-size:9px;padding:4px 8px;" onclick="editProspect('${jsonForInline(p)}')">Détails</button><button class="btn" style="font-size:9px;padding:4px 8px;" onclick="quickMoveProspect('${p.id}','${escapeHtml(p.stage)}')">➡</button><button class="btn" style="font-size:9px;padding:4px 8px;" onclick="deleteProspect('${p.id}')">×</button></div>`;column.appendChild(card);
  });
  if($('prospectsActifsCount'))$('prospectsActifsCount').textContent=`${prospects.filter(p=>p.stage!=='Perdu').length} opportunité(s) active(s)`;
}

/* ---------------- BARÈMES / AUTRES ---------------- */
function updateMargin(){const margin=numberValue('sell')-numberValue('cost');if($('margin'))$('margin').textContent=`${margin.toFixed(2).replace('.',',')} €/h — ${margin>=4.5?'Conforme':margin>=3?'Limite':'Bloquée'}`;if($('marginBox'))$('marginBox').className=`alert ${margin>=4.5?'green':margin>=3?'orange':'red'}`;}
function openBaremeModal(item=null){$('baremeForm')?.reset();currentBaremeId=item?.id||null;if(item){setField('barMetier',item.trade);setField('barNiveau',item.level);setField('barSell',item.sale_rate);setField('barMargin',item.margin);}$('baremeModal')?.classList.remove('hidden');}
function closeBaremeModal(){$('baremeModal')?.classList.add('hidden');currentBaremeId=null;}
async function handleBaremeSubmit(e){e.preventDefault();const trade=value('barMetier'),level=value('barNiveau'),sale_rate=numberValue('barSell'),margin=numberValue('barMargin');if(!trade||!level||sale_rate<=0)return toast('Métier, niveau et prix de vente sont obligatoires.',true);const saved=await saveRow('baremes',{trade,level,sale_rate,loaded_cost:Math.max(0,sale_rate-margin),minimum_margin:4.5,region:'Île-de-France',active:true},currentBaremeId);if(!saved)return;toast(currentBaremeId?'Barème mis à jour.':'Barème créé.');closeBaremeModal();await loadAllData();show('marge');}
function renderBaremes(){const body=$('baremeBody');if(!body)return;if(!baremes.length)return void(body.innerHTML='<tr><td colspan="4">Aucun barème enregistré.</td></tr>');body.innerHTML=baremes.map(b=>`<tr><td>${escapeHtml(b.trade)}</td><td>${escapeHtml(b.level)}</td><td>${Number(b.sale_rate||0).toFixed(2)} €</td><td><span class="badge ${statusClass(Number(b.margin)>=4.5?'Conforme':'Bloqué')}">${Number(b.margin||0).toFixed(2)} €</span></td></tr>`).join('');}
function renderConformite(){} function renderLogistique(){} function renderCommunication(){} function renderAlerts(){}
function updateDistanceZone(){const d=numberValue('distance'),r=numberValue('rayon',40);const z=d<=10?'Zone 1':d<=20?'Zone 2':d<=30?'Zone 3':d<=40?'Zone 4':'Zone 5';if($('zone'))$('zone').textContent=`${z} • ${d<=r?'Dans le rayon':'Hors rayon'}`;if($('distanceValue'))$('distanceValue').textContent=`${d} km`;}
function handleSearch(e){if(e.key!=='Enter')return;const q=e.target.value.trim().toLowerCase();if(!q)return;const c=clients.find(x=>String(x.company||'').toLowerCase().includes(q));if(c){show('clients');toast(`Client trouvé : ${c.company}`);return;}if(q.includes('planning'))show('planning');else if(q.includes('interim'))show('interimaires');else if(q.includes('marge'))show('marge');else if(q.includes('demande'))show('matching');else if(q.includes('prospect')||q.includes('pipeline'))show('commercial');else toast('Aucun résultat trouvé.',true);}

Object.assign(window,{show,toast,openClientModal,closeClientModal,editClient,deleteClient,openInterimaireModal,closeInterimaireModal,editInterimaire,deleteInterimaire,openDemandeModal,closeDemandeModal,editDemande,deleteDemande,openPlanningModal,closePlanningModal,editPlanning,deletePlanning,openProspectModal,closeProspectModal,editProspect,deleteProspect,quickMoveProspect,openBaremeModal,closeBaremeModal});
