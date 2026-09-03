import { Storage, KEYS } from './core/storage.js';
import { ModuleRegistry } from './core/registry.js';
import { TrainingModule } from './modules/training/index.js';

const registry = new ModuleRegistry().register(TrainingModule);
let storage, training, failed = false;
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

function setEnabled(enabled) {
  if (!enabled && training?.hasSession()) {
    alert('Termine la séance en cours avant de mettre Training en pause.'); return;
  }
  guarded(() => storage.setEnabled('training', enabled));
  visibility();
}

function settings() {
  const card = document.createElement('div'); card.className = 'card';
  const title = document.createElement('h2'); title.textContent = 'Sauvegarde et univers';
  const explanation = document.createElement('p'); explanation.className = 'muted';
  explanation.textContent = 'Télécharge une copie de tes données et conserve-la dans Fichiers ou iCloud Drive. Mettre Training en pause conserve toute ta progression.';
  const exportButton = document.createElement('button'); exportButton.className = 'secondary'; exportButton.textContent = 'Exporter mes données'; exportButton.onclick = download;
  const toggle = document.createElement('button'); toggle.className = 'secondary'; toggle.style.marginTop = '8px'; toggle.textContent = 'Mettre Training en pause'; toggle.onclick = () => setEnabled(false);
  card.append(title, explanation, exportButton, toggle);
  document.querySelector('#settings').prepend(card);
}

function visibility() {
  const enabled = registry.active(storage.state).some(module => module.id === 'training');
  root.hidden = !enabled; paused.hidden = enabled;
  if (!enabled) {
    paused.innerHTML = '<div class="ey">CONSTANTE</div><h1>Training en pause</h1><p>Ton historique et ta progression sont conservés.</p><button class="primary" id="resume">Réactiver Training</button><button class="secondary" id="paused-export" style="margin-top:8px">Exporter mes données</button>';
    document.querySelector('#resume').onclick = () => setEnabled(true);
    document.querySelector('#paused-export').onclick = download;
  }
}

function boot() {
  try {
    storage = new Storage(localStorage);
    training = registry.get('training').mount({ load: factory => storage.load(factory), save: data => guarded(() => storage.saveTraining(data)), settings });
    visibility();
    window.addEventListener('storage', event => {
      if (event.key === null || Object.values(KEYS).includes(event.key)) fail(new Error('Une autre fenêtre a modifié les données. Recharge cette page.'));
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
