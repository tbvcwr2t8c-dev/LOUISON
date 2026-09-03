import {clone} from '../../core/ui.js';
export const initialReading = () => ({minutes:5,signal:0,target:4,books:[],bookId:null,sessions:[],draft:null});
export function validateReading(data) {
  if(data?.adaptive!==undefined && typeof data.adaptive!=='boolean')throw Error('Réglage Lecture illisible.');
  if (!data || !Number.isFinite(data.minutes) || data.minutes<1 || data.minutes>30 || !Number.isFinite(data.signal) || !Number.isInteger(data.target) || data.target<1 || data.target>7 || !Array.isArray(data.books) || !Array.isArray(data.sessions)) throw Error('Données Lecture illisibles.');
  for(const book of data.books) if(typeof book.id!=='string' || typeof book.title!=='string') throw Error('Livre illisible.');
  for(const session of data.sessions) if(typeof session.id!=='string' || !Number.isFinite(Date.parse(session.date)) || !Number.isFinite(session.seconds) || session.seconds<0 || !Number.isInteger(session.pages) || session.pages<0) throw Error('Séance Lecture illisible.');
  if(data.draft && (typeof data.draft.id!=='string' || !Number.isFinite(data.draft.elapsed) || !['minimum','normal'].includes(data.draft.mode) || data.draft.elapsed<0 || !(data.draft.runningSince===null || Number.isFinite(data.draft.runningSince)) || !Number.isFinite(data.draft.goalMinutes) || data.draft.goalMinutes<1 || data.draft.goalMinutes>30 || typeof data.draft.bookTitle!=='string')) throw Error('Séance Lecture en cours illisible.');
  return data;
}
export function finishReading(data, result) {
  validateReading(data);
  if(!data.draft) throw Error('Aucune séance Lecture en cours.');
  if(!Number.isInteger(result.pages) || result.pages<0 || result.pages>10000 || !Number.isFinite(result.seconds) || result.seconds<0 || result.seconds>86400 || ![-1,0,1].includes(result.feedback)) throw Error('Vérifie les pages et la durée.');
  if(data.draft.mode==='minimum' && result.pages<1) throw Error('Valide au moins une page lue.');
  if(data.draft.mode==='normal' && result.seconds<1 && result.pages<1) throw Error('Lis un peu avant de valider la séance.');
  const next=clone(data),draft=next.draft;
  if(next.sessions.some(s=>s.id===draft.id)) throw Error('Cette séance a déjà été enregistrée.');
  next.sessions.push({id:draft.id,date:result.date,mode:draft.mode,bookId:draft.bookId,bookTitle:draft.bookTitle,pages:result.pages,seconds:result.seconds,feedback:result.feedback,goalMinutes:draft.goalMinutes});
  // Minimum counts for regularity, without increasing the next target.
  if(draft.mode==='normal' && next.adaptive!==false) {
    next.signal += result.feedback>0 && result.seconds<draft.goalMinutes*60 ? 0 : result.feedback;
    if(next.signal>=3){next.minutes=Math.min(30,next.minutes+1);next.signal=0;}
    if(next.signal<=-2){next.minutes=Math.max(1,next.minutes-1);next.signal=0;}
  }
  next.draft=null;return validateReading(next);
}
export function elapsedSeconds(draft, now=Date.now()) {
  return Math.max(0,Math.floor((draft.elapsed+(draft.runningSince ? Math.max(0,now-draft.runningSince) : 0))/1000));
}
