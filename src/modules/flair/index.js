import {esc,uid,clone,historyList,bind} from '../../core/ui.js';
import {SKILLS,skillById} from './catalog.js';
import {initialFlair,validateFlair,status,recommendation,planSession,recordTest} from './model.js';
const labels={locked:'Prérequis à valider',new:'À découvrir',learning:'En apprentissage',acquired:'Acquis',review:'À revoir'};
const links=skill=>skill.resources.map(v=>`<a class="resource-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)} ↗<small>${esc(v.author)} · vidéo en anglais</small></a>`).join('');
const brief=skill=>`<p>${esc(skill.description)}</p><ol>${skill.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p><b>Conseil :</b> ${esc(skill.tips)}</p><p><b>À éviter :</b> ${esc(skill.errors)}</p><p><b>Réussite :</b> ${esc(skill.criterion)}</p>${links(skill)}`;
export const FlairModule={id:'flair',name:'Flair',version:1,initial:initialFlair,validate:validateFlair,mount:mountFlair};
function mountFlair({root,read,save}) {
  const update=data=>{save(validateFlair(data));render();};
  function render() {
    const data=read();if(data.draft){session(data);return;}
    const next=recommendation(data),acquired=SKILLS.filter(s=>status(data,s)==='acquired').length;
    root.innerHTML=`<div class="ey">LE GESTE AVANT LA VITESSE</div><h1>Flair</h1><div class="card"><div class="row"><span class="pill">${acquired}/${SKILLS.length} acquis</span><span class="pill">${data.sessions.length} séances</span></div><h2>${esc(next.name)}</h2><p class="muted">${labels[status(data,next)]} · séance guidée de 20 minutes environ</p><button class="primary" data-practice="${next.id}">Commencer ma séance</button><p class="muted">Bouteille incassable, tin vide, espace dégagé. Travaille hors service ; commence sans liquide.</p></div><div class="card"><h2>Mon parcours</h2><p class="muted">Fondamentaux → Working flair → Combos. Les techniques d’exhibition viendront dans une extension du parcours.</p><p>Un mouvement est acquis après <b>8 réussites propres sur 10, sur deux jours différents</b>. Une révision est proposée après 14 jours.</p>${SKILLS.map(s=>`<details class="lesson"><summary><span>${esc(s.name)}<small>Niveau ${s.level} · ${esc(s.category)}</small></span><span class="skill-status">${labels[status(data,s)]}</span></summary>${brief(s)}${s.requires.length?`<p class="muted">Prérequis : ${s.requires.map(id=>esc(skillById(id).name)).join(', ')}.</p>`:''}<button class="secondary" data-practice="${s.id}" ${status(data,s)==='locked'?'disabled':''}>${status(data,s)==='acquired'?'Réviser':'Pratiquer'}</button></details>`).join('')}</div><details class="card"><summary>Historique Flair</summary>${historyList(data.sessions,s=>`${skillById(s.skillId)?.name||s.skillId} · ${s.successes}/10${s.clean?' propres':' · contrôle à retravailler'}`)}</details>`;
    bind(root,'[data-practice]',el=>{const next=clone(read());next.draft=planSession(next,el.dataset.practice,uid(),new Date().toISOString());update(next);});
  }
  function session(data) {
    const d=data.draft,s=skillById(d.skillId),step=d.steps[d.step];
    root.innerHTML=`<div class="ey">FLAIR · ÉTAPE ${d.step+1}/6</div><h1>${esc(step.title)}</h1><div class="bar"><i style="width:${(d.step+1)/6*100}%"></i></div><div class="card"><span class="pill">${step.minutes} min environ</span><h2>${esc(s.name)}</h2><p>${esc(step.text)}</p>${d.step>=2?`<details ${d.step===2?'open':''}><summary>Voir la fiche et les vidéos</summary>${brief(s)}</details>`:''}</div>${d.step===5?`<form id="flair-result" class="card"><label>Réussites sur 10<input name="score" type="number" min="0" max="10" step="1" value="0" required></label><label class="check-label"><input name="clean" type="checkbox"> J’ai compté uniquement les essais respectant le critère de réussite.</label><button class="primary">Enregistrer la séance</button></form>`:'<button class="primary" id="flair-next">Étape terminée — continuer</button>'}<div class="two-buttons">${d.step?'<button class="secondary" id="flair-back">Étape précédente</button>':''}<button class="secondary" id="flair-cancel">Annuler la séance</button></div>`;
    if(d.step<5)root.querySelector('#flair-next').onclick=()=>{const next=clone(read());next.draft.step++;update(next);};
    if(d.step)root.querySelector('#flair-back').onclick=()=>{const next=clone(read());next.draft.step--;update(next);};
    root.querySelector('#flair-cancel').onclick=()=>{if(confirm('Annuler cette séance sans enregistrer de résultat ?')){const next=clone(read());next.draft=null;update(next);}};
    const form=root.querySelector('#flair-result');if(form)form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form);try{update(recordTest(read(),{successes:Number(fd.get('score')),clean:fd.get('clean')==='on',date:new Date().toISOString()}));}catch(error){alert(error.message);}};
  }
  render();return {refresh:render,hasSession:()=>!!read().draft};
}
