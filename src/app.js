import { Storage, KEYS } from './core/storage.js';
import { ModuleRegistry } from './core/registry.js';
import { TrainingModule } from './modules/training/index.js';
import { ReadingModule } from './modules/reading/index.js';
import { FlairModule } from './modules/flair/index.js';
import { CloudBackup } from './core/cloud.js';
import { CLOUD_CONFIG } from './cloud-config.js';
import { mountAccount } from './core/account.js';

const registry = new ModuleRegistry().register(TrainingModule).register(ReadingModule).register(FlairModule);
let storage, training, cloud, account, selected='training', failed = false;
const mounted={};
const root = document.querySelector('#training-root');
const paused = document.querySelector('#paused');

function download() {
  try {
    const blob = new Blob([(storage || new Storage(localStorage)).exportRaw()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `constante-sauvegarde-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch { alert('La sauvegarde n’a pas pu être créée. Les données enregistrées restent en place.'); }
}

function fail(error) {
  failed = true;
  document.querySelector('#dlg').close();
  root.hidden = true; paused.hidden = true;
  for(const id of ['reading-root','flair-root','account-root','universes'])document.getElementById(id).hidden=true;
  if(cloud){cloud.enabled=false;clearTimeout(cloud.timer);}
  const message = document.querySelector('#core-message');
  message.hidden = false; message.className = 'app'; message.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = 'Données protégées';
  const explanation = document.createElement('p'); explanation.textContent = error.message + ' L’application est arrêtée pour éviter un écrasement. Aucun nouveau départ automatique.';
  const button = document.createElement('button'); button.className = 'primary'; button.textContent = 'Exporter les données enregistrées'; button.onclick = download;
  const reload = document.createElement('button'); reload.className = 'secondary'; reload.textContent = 'Recharger'; reload.onclick = () => location.reload();
  message.append(heading, explanation, button, reload);
}

function guarded(action) {
  if (failed) throw new Error('Application arrêtée : rechargez la page.');
  try { return action(); } catch (error) { fail(error); throw error; }
}

function setEnabled(id, enabled = !storage.state.modules[id].enabled) {
  if (!enabled && (mounted[id]?.hasSession() || storage.state.modules[id].data.draft)) {
    alert('Termine ou annule la séance en cours avant de mettre cet univers en pause.'); return;
  }
  guarded(() => storage.setEnabled(id, enabled));
  cloud?.schedule();visibility();
}

function settings() {
  const card = document.createElement('div'); card.className = 'card';
  const title = document.createElement('h2'); title.textContent = 'Sauvegarde et univers';
  const explanation = document.createElement('p'); explanation.className = 'muted';
  explanation.textContent = 'Télécharge une copie de tes données et conserve-la dans Fichiers ou iCloud Drive. Mettre Training en pause conserve toute ta progression.';
  const exportButton = document.createElement('button'); exportButton.className = 'secondary'; exportButton.textContent = 'Exporter mes données'; exportButton.onclick = download;
  const toggle = document.createElement('button'); toggle.className = 'secondary'; toggle.style.marginTop = '8px'; toggle.textContent = 'Mettre Training en pause'; toggle.onclick = () => setEnabled('training',false);
  const manage=document.createElement('button');manage.className='secondary';manage.textContent='Mon compte et mes univers';manage.onclick=()=>{selected='account';visibility();};
  card.append(title, explanation, exportButton, toggle,manage);
  document.querySelector('#settings').prepend(card);
}

function visibility() {
  if(failed)return;
  const nav=document.querySelector('#universes');nav.replaceChildren();
  for(const module of [...registry.active(storage.state),{id:'account',name:'Mon compte'}]) {
    const button=document.createElement('button');button.className='chip';button.textContent=module.name;button.setAttribute('aria-pressed',String(selected===module.id));button.onclick=()=>{selected=module.id;visibility();};nav.append(button);
  }
  for(const id of ['training','reading','flair','account'])document.querySelector('#'+id+'-root').hidden=true;
  paused.hidden=true;
  if(selected==='account'){document.querySelector('#account-root').hidden=false;account.refresh();return;}
  if(!storage.state.modules[selected].enabled) {
    paused.hidden=false;paused.replaceChildren();
    const title=document.createElement('h1');title.textContent=registry.get(selected).name+' en pause';
    const p=document.createElement('p');p.textContent='Ton historique et ta progression sont conservés.';
    const button=document.createElement('button');button.className='primary';button.textContent='Réactiver';button.onclick=()=>setEnabled(selected,true);paused.append(title,p,button);return;
  }
  const moduleRoot=document.querySelector('#'+selected+'-root');moduleRoot.hidden=false;
  if(!mounted[selected]) {
    const id=selected,definition=registry.get(id);
    mounted[id]=definition.mount({root:moduleRoot,read:()=>structuredClone(storage.state.modules[id].data),save:data=>{guarded(()=>{definition.validate(data);storage.saveModule(id,data);});cloud.schedule();}});
  }
}

function boot() {
  try {
    storage = new Storage(localStorage);
    training = registry.get('training').mount({ load: factory => storage.load(factory), save: data => {guarded(() => storage.saveTraining(data));cloud?.schedule();}, settings });
    mounted.training=training;
    storage.installModules([ReadingModule,FlairModule]);
    cloud=new CloudBackup({config:CLOUD_CONFIG,storage:localStorage,readState:()=>storage.state,notify:()=>account?.status()});
    account=mountAccount({root:document.querySelector('#account-root'),storage,cloud,download,toggle:setEnabled,registry,hasSession:()=>Object.values(mounted).some(m=>m.hasSession()) || !!storage.state.modules.reading.data.draft || !!storage.state.modules.flair.data.draft});
    visibility();cloud.schedule();
    window.addEventListener('online',()=>cloud.schedule());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloud.schedule();});
    window.addEventListener('storage', event => {
      if (event.key === null || Object.values(KEYS).includes(event.key) || event.key==='constante_cloud_auth') fail(new Error('Une autre fenêtre a modifié les données ou le compte. Recharge cette page.'));
    });
  } catch (error) { fail(error); }
}

// One V1.5 writer per browser origin; never hold another tab waiting silently.
if (navigator.locks) {
  navigator.locks.request('constante-writer', { ifAvailable: true }, async lock => {
    if (!lock) { fail(new Error('Constante est déjà ouverte dans un autre onglet. Ferme cet onglet puis recharge ici.')); return; }
    boot();
    await new Promise(resolve => window.addEventListener('pagehide', resolve, { once: true }));
  }).catch(fail);
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
} else boot();
