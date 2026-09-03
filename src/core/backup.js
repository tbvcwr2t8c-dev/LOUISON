import {migrateV1,validateV2} from './storage.js';
import {validateReading} from '../modules/reading/model.js';
import {validateFlair} from '../modules/flair/model.js';
export function decodeBackup(value) {
  let data=typeof value==='string'?JSON.parse(value):value;
  if(data?.format==='constante-backup') {
    if(data.backupVersion!==1 || !data.storage)throw Error('Format de sauvegarde non reconnu.');
    if(data.storage.constante_v2!==null && data.storage.constante_v2!==undefined)data=JSON.parse(data.storage.constante_v2);
    else if(typeof data.storage.constante==='string')data=migrateV1(JSON.parse(data.storage.constante));
    else throw Error('La sauvegarde ne contient pas de progression.');
  }
  validateV2(data);
  for(const session of data.modules.training.data.sessions)if(!['minimum','short','normal','plus'].includes(session.mode))throw Error('Mode Training non reconnu dans le fichier.');
  if(data.modules.reading){if(data.modules.reading.version!==1)throw Error('Version Lecture non prise en charge.');validateReading(data.modules.reading.data);}
  if(data.modules.flair){if(data.modules.flair.version!==1)throw Error('Version Flair non prise en charge.');validateFlair(data.modules.flair.data);}
  return data;
}
