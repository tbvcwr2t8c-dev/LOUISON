import {esc} from './ui.js';
import {validateV2} from './storage.js';

export function personalize(state, choices) {
  if(typeof choices.name!=='string' || choices.name.trim().length>60 || !Array.isArray(choices.modules) || !choices.modules.length || choices.modules.some(id=>!['training','reading','flair'].includes(id)))throw Error('Choisis au moins un univers.');
  if(![2,3,4,5].includes(choices.trainingTarget) || typeof choices.rower!=='boolean' || !Number.isInteger(choices.readingMinutes) || choices.readingMinutes<1 || choices.readingMinutes>30 || !Number.isInteger(choices.readingTarget) || choices.readingTarget<1 || choices.readingTarget>7 || typeof choices.adaptive!=='boolean')throw Error('Vérifie les objectifs renseignés.');
  const next=structuredClone(state);
  for(const id of ['training','reading','flair']) {
    if(!choices.modules.includes(id) && next.modules[id].data.draft)throw Error('Termine la séance en cours avant de mettre cet univers en pause.');
    next.modules[id].enabled=choices.modules.includes(id);
  }
  next.core.preferences={...next.core.preferences,name:choices.name.trim(),onboardingPending:false};
  next.modules.training.data.target=choices.trainingTarget;
  next.modules.training.data.rower=choices.rower;
  const reading=next.modules.reading.data;
  if(reading.minutes!==choices.readingMinutes || (reading.adaptive!==false)!==choices.adaptive)reading.signal=0;
  Object.assign(reading,{minutes:choices.readingMinutes,target:choices.readingTarget,adaptive:choices.adaptive});
  return validateV2(next);
}

export function mountProfile({root,state,save,restore}) {
  const preferences=state.core.preferences||{},training=state.modules.training.data,reading=state.modules.reading.data;
  root.innerHTML=`<div class="card"><h2>${preferences.onboardingPending?'Bienvenue dans Constante':'Mon rythme'}</h2><p>Choisis ce que tu veux pratiquer. Tu pourras changer tes objectifs et mettre un univers en pause à tout moment.</p>${preferences.onboardingPending?'<button type="button" id="profile-restore" class="secondary">J’ai déjà une progression — la récupérer</button>':''}<form id="profile-form"><label>Prénom (facultatif)<input name="name" maxlength="60" autocomplete="given-name" value="${esc(preferences.name||'')}"></label><fieldset><legend>Mes univers</legend>${[['training','Training'],['reading','Lecture'],['flair','Flair']].map(([id,name])=>`<label class="check-label"><input name="modules" type="checkbox" value="${id}" ${state.modules[id].enabled?'checked':''}>${name}</label>`).join('')}</fieldset><details open><summary>Mon objectif Training</summary><label>Séances par semaine<select name="trainingTarget">${[2,3,4,5].map(n=>`<option ${n===training.target?'selected':''}>${n}</option>`).join('')}</select></label><label class="check-label"><input name="rower" type="checkbox" ${training.rower?'checked':''}>J’ai accès à un rameur</label></details><details open><summary>Mon objectif Lecture</summary><label>Minutes par séance<input name="readingMinutes" type="number" min="1" max="30" step="1" value="${reading.minutes}" required></label><label>Jours par semaine<select name="readingTarget">${[1,2,3,4,5,6,7].map(n=>`<option ${n===reading.target?'selected':''}>${n}</option>`).join('')}</select></label><label class="check-label"><input name="adaptive" type="checkbox" ${reading.adaptive!==false?'checked':''}>Adapter doucement la durée à mes retours</label><p class="muted">Décoche pour garder une durée fixe. Une page reste toujours un minimum accepté.</p></details><p class="muted">Flair propose un parcours guidé selon les mouvements acquis.</p><p id="profile-error" role="alert"></p><button class="primary">${preferences.onboardingPending?'Commencer à mon rythme':'Enregistrer mon rythme'}</button></form></div>`;
  if(preferences.onboardingPending)root.querySelector('#profile-restore').onclick=restore;
  root.querySelector('#profile-form').onsubmit=e=>{
    e.preventDefault();const form=new FormData(e.target);
    try{save(personalize(state,{name:form.get('name'),modules:form.getAll('modules'),trainingTarget:Number(form.get('trainingTarget')),rower:form.has('rower'),readingMinutes:Number(form.get('readingMinutes')),readingTarget:Number(form.get('readingTarget')),adaptive:form.has('adaptive')}));}
    catch(error){root.querySelector('#profile-error').textContent=error.message;}
  };
}
