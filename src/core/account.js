import {esc,bind} from './ui.js';
import {decodeBackup} from './backup.js';
export function mountAccount({root,storage,cloud,download,toggle,registry,hasSession}) {
  let email='',codeSent=false,notice='';
  const counts=data=>Object.entries(data.modules).map(([id,m])=>`${registry.get(id)?.name||id} : ${m.data.sessions?.length||0} séances`).join(' · ');
  async function run(action) {try{await action();}catch(error){notice=error.message;}render();}
  function restore(value) {
    const data=decodeBackup(value);
    if(hasSession())throw Error('Termine ou annule les séances en cours avant de restaurer.');
    if(!confirm(`Restaurer cette copie ?\n${counts(data)}\n\nActuellement : ${counts(storage.state)}\nCette copie remplacera les données actives. Une copie locale de l’état actuel sera conservée avant le remplacement.`))return;
    // Restore never silently resumes uploads of a snapshot selected by the user.
    cloud.setEnabled(false);storage.restoreState(data);location.reload();
  }
  function render() {
    root.innerHTML=`<div class="ey">CONSTANTE</div><h1>Mon compte</h1><p role="status">${esc(notice)}</p><div class="card"><h2>Mes univers</h2><p class="muted">Mettre un univers en pause conserve son historique et sa progression.</p>${registry.list().map(m=>`<div class="ex"><span>${esc(m.name)}</span><button class="chip" data-toggle="${m.id}">${storage.state.modules[m.id].enabled?'Mettre en pause':'Réactiver'}</button></div>`).join('')}</div><div class="card"><h2>Sauvegarde automatique</h2><p id="cloud-status" role="status">${esc(cloud.message)}</p>${!cloud.configured?'<p>La sauvegarde en ligne est en préparation. Pour le moment, tes séances sont enregistrées automatiquement sur cet appareil. Garde une copie dans Fichiers pour pouvoir changer de téléphone.</p>':cloud.session?`<p>Connecté : ${esc(cloud.session.user.email||'ton compte')}</p><p class="muted">Sur un nouveau téléphone, restaure d’abord ta dernière sauvegarde. L’envoi automatique fonctionne quand Constante est ouverte et connectée à Internet.</p><button class="primary" id="cloud-toggle">${cloud.enabled?'Suspendre les envois':'Activer la sauvegarde sur cet appareil'}</button><button class="secondary" id="cloud-list">Récupérer une sauvegarde</button><div id="cloud-copies"></div><button class="secondary" id="cloud-out">Déconnexion</button>`:`<form id="cloud-login"><label>Adresse e-mail<input name="email" type="email" autocomplete="email" required value="${esc(email)}"></label><button class="primary">${codeSent?'Renvoyer le code':'Recevoir un code de connexion'}</button></form>${codeSent?'<form id="cloud-code"><label>Code reçu par e-mail<input name="code" inputmode="numeric" autocomplete="one-time-code" required></label><button class="primary">Me connecter</button></form>':''}`}</div><div class="card"><h2>Une copie dans Fichiers</h2><p class="muted">L’export contient tous tes univers. Il ne contient pas tes codes de connexion.</p><button class="secondary" id="account-export">Exporter mes données</button><label>Restaurer un fichier de sauvegarde<input id="account-import" type="file" accept=".json,application/json"></label><p class="muted">Une restauration demande toujours confirmation avant de remplacer les données actives.</p></div>`;
    bind(root,'[data-toggle]',el=>{toggle(el.dataset.toggle);render();});
    root.querySelector('#account-export').onclick=download;
    root.querySelector('#account-import').onchange=e=>run(async()=>{const file=e.target.files[0];if(!file)return;if(file.size>10000000)throw Error('Ce fichier est trop volumineux.');restore(await file.text());});
    const login=root.querySelector('#cloud-login');if(login)login.onsubmit=e=>{e.preventDefault();email=new FormData(e.target).get('email').trim();run(async()=>{await cloud.sendCode(email);codeSent=true;notice='Consulte tes e-mails puis saisis le code ici.';});};
    const code=root.querySelector('#cloud-code');if(code)code.onsubmit=e=>{e.preventDefault();const token=new FormData(e.target).get('code').trim();run(async()=>{await cloud.verifyCode(email,token);notice='Compte connecté. Tu peux restaurer une copie ou activer les envois sur cet appareil.';});};
    const button=root.querySelector('#cloud-toggle');if(button)button.onclick=()=>run(()=>cloud.setEnabled(!cloud.enabled));
    const out=root.querySelector('#cloud-out');if(out)out.onclick=()=>run(()=>cloud.signOut());
    const list=root.querySelector('#cloud-list');if(list)list.onclick=async()=>{list.disabled=true;try{const rows=await cloud.list();const area=root.querySelector('#cloud-copies');if(!area)return;area.innerHTML=rows.length?rows.map(row=>`<button class="secondary" data-copy="${esc(row.id)}">${esc(new Date(row.created_at).toLocaleString('fr-FR'))} — restaurer</button>`).join(''):'<p>Aucune sauvegarde en ligne pour ce compte.</p>';bind(area,'[data-copy]',el=>run(async()=>restore(await cloud.retrieve(el.dataset.copy))));}catch(error){notice=error.message;render();}finally{list.disabled=false;}};
  }
  render();return {refresh:render,status:()=>{const el=root.querySelector('#cloud-status');if(el)el.textContent=cloud.message;}};
}
