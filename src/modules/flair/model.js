import {clone,dayKey} from '../../core/ui.js';
import {SKILLS,skillById} from './catalog.js';
export const initialFlair = () => ({skills:{},sessions:[],draft:null});
export function validateFlair(data) {
  if(!data || !data.skills || typeof data.skills!=='object' || Array.isArray(data.skills) || !Array.isArray(data.sessions))throw Error('Données Flair illisibles.');
  for(const skill of Object.values(data.skills)) if(!skill || !['learning','acquired','review'].includes(skill.status) || !Array.isArray(skill.passDays))throw Error('Progression Flair illisible.');
  for(const session of data.sessions)if(typeof session.id!=='string' || !Number.isFinite(Date.parse(session.date)) || !Number.isInteger(session.successes) || session.successes<0 || session.successes>10)throw Error('Séance Flair illisible.');
  if(data.draft && (!skillById(data.draft.skillId) || !Number.isInteger(data.draft.step) || data.draft.step<0 || data.draft.step>5 || typeof data.draft.id!=='string' || !Array.isArray(data.draft.steps) || data.draft.steps.length!==6 || data.draft.steps.some(s=>!s || typeof s.title!=='string' || typeof s.text!=='string' || !Number.isFinite(s.minutes))))throw Error('Séance Flair en cours illisible.');
  return data;
}
export function status(data,skill,now=Date.now()) {
  const own=data.skills[skill.id];
  if(own?.status==='acquired' && now-Date.parse(own.lastTest)>=14*86400000)return 'review';
  if(own)return own.status;
  return skill.requires.every(id=>data.skills[id]?.status==='acquired')?'new':'locked';
}
export function recommendation(data,now=Date.now()) {
  return SKILLS.find(s=>status(data,s,now)==='review') || SKILLS.find(s=>status(data,s,now)==='learning') || SKILLS.find(s=>status(data,s,now)==='new') || [...SKILLS].sort((a,b)=>Date.parse(data.skills[a.id].lastTest)-Date.parse(data.skills[b.id].lastTest))[0];
}
export function planSession(data,skillId,id,date) {
  const skill=skillById(skillId);
  if(!skill || status(data,skill,Date.parse(date))==='locked')throw Error('Valide les prérequis avant cette séance.');
  const review=SKILLS.find(s=>s.id!==skillId && data.skills[s.id]?.status==='acquired');
  const combo=SKILLS.find(s=>s.category==='Combos' && status(data,s,Date.parse(date))!=='locked');
  return {id,skillId,date,step:0,steps:[
    {title:'Préparer et échauffer',minutes:2,text:'Espace dégagé, bouteille incassable et tin vide. Mobilise doucement les mains puis fais des prises et poses lentes.'},
    {title:'Réviser',minutes:3,text:review?`${review.name} : 10 répétitions faciles, en privilégiant le contrôle.`:'Prises et contrôle : 10 passages de main sans lancer.'},
    {title:'Comprendre le mouvement',minutes:6,text:`${skill.name} : regarde la ressource vidéo et travaille les étapes une par une.`},
    {title:'Répéter',minutes:5,text:`Fais 2 séries de ${skill.reps} essais de ${skill.name}, avec une pause. Reviens à l’étape précédente si le geste se dégrade.`},
    {title:combo?'Mini-combo':'Relier au service',minutes:2,text:combo?`${combo.name} : ${combo.steps.join(' ')}`:'Réalise ton geste, puis repose calmement les objets à leur place. La pose stable fait partie de la répétition.'},
    {title:'Tester',minutes:2,text:`10 essais de ${skill.name}. Compte uniquement les essais respectant : ${skill.criterion}`} ]};
}
export function recordTest(data,{successes,clean,date}) {
  if(!data.draft || data.draft.step!==5 || !Number.isInteger(successes) || successes<0 || successes>10 || typeof clean!=='boolean')throw Error('Termine la séance et indique un résultat entre 0 et 10.');
  const next=clone(data),draft=next.draft;
  if(next.sessions.some(s=>s.id===draft.id))throw Error('Séance déjà enregistrée.');
  const previous=next.skills[draft.skillId]||{status:'learning',passDays:[]};
  const pass=successes>=8 && clean;
  const days=pass?[...new Set([...previous.passDays,dayKey(date)])]:[];
  const acquired=pass && (previous.status==='acquired'||previous.status==='review'||days.length>=2);
  next.skills[draft.skillId]={...previous,status:acquired?'acquired':previous.status==='acquired'||previous.status==='review'?'review':'learning',passDays:days,lastTest:date,lastScore:successes};
  next.sessions.push({id:draft.id,date,skillId:draft.skillId,successes,attempts:10,clean,steps:clone(draft.steps)});
  next.draft=null;return validateFlair(next);
}
