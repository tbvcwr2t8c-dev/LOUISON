export const KEYS = Object.freeze({ legacy: 'constante', current: 'constante_v2', backup: 'constante_v1_backup' });
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
function requireValue(ok, message) { if (!ok) throw new Error(message); }

// Validate what Training actually reads; retain every unrecognized field verbatim.
export function validateTraining(data) {
  requireValue(object(data) && typeof data.start === 'string' && Number.isFinite(Date.parse(data.start)), 'Date de départ illisible.');
  requireValue(Number.isFinite(data.target) && data.target > 0 && typeof data.rower === 'boolean', 'Réglages Training illisibles.');
  requireValue(data.walker === undefined || typeof data.walker === 'boolean', 'Réglage tapis de marche illisible.');
  requireValue(data.rope === undefined || typeof data.rope === 'boolean', 'Réglage corde à sauter illisible.');
  requireValue(data.walkerMaxSpeed === undefined || Number.isFinite(data.walkerMaxSpeed) && data.walkerMaxSpeed > 0 && data.walkerMaxSpeed <= 15, 'Vitesse du tapis illisible.');
  requireValue(data.walkerMaxIncline === undefined || Number.isFinite(data.walkerMaxIncline) && data.walkerMaxIncline >= 0 && data.walkerMaxIncline <= 15, 'Inclinaison du tapis illisible.');
  requireValue(object(data.scores) && Array.isArray(data.sessions), 'Progression Training illisible.');
  for (const key of ['push', 'squat', 'plank', 'burpee', 'row']) {
    const score = data.scores[key];
    requireValue(object(score) && Number.isFinite(score.a) && score.a > 0 && (score.s === undefined || Number.isFinite(score.s)), 'Niveau Training illisible.');
  }
  for (const key of ['walk', 'rope']) if (data.scores[key] !== undefined) {
    const score = data.scores[key];
    requireValue(object(score) && Number.isFinite(score.a) && score.a > 0 && (score.s === undefined || Number.isFinite(score.s)), 'Niveau équipement Training illisible.');
  }
  for (const session of data.sessions) {
    requireValue(object(session) && typeof session.date === 'string' && Number.isFinite(Date.parse(session.date)) && Array.isArray(session.ex), 'Séance illisible.');
    for (const ex of session.ex) requireValue(object(ex) && typeof ex.k === 'string' && Number.isFinite(ex.d), 'Exercice historique illisible.');
  }
  return data;
}

export function validateV2(data) {
  requireValue(object(data) && data.schemaVersion === 2, 'Version de sauvegarde non prise en charge.');
  requireValue(object(data.core) && object(data.modules) && object(data.modules.training), 'Structure de sauvegarde illisible.');
  for (const module of Object.values(data.modules)) requireValue(object(module) && typeof module.enabled === 'boolean' && Number.isInteger(module.version) && module.version > 0 && Object.hasOwn(module, 'data'), 'Module illisible.');
  requireValue(data.modules.training.version === 1, 'Version Training non prise en charge.');
  validateTraining(data.modules.training.data);
  return data;
}

export function migrateV1(data, now = new Date().toISOString()) {
  validateTraining(data);
  const migrated = { schemaVersion: 2, core: { createdAt: now, preferences: {} }, modules: { training: { enabled: true, version: 1, data: copy(data) } } };
  requireValue(JSON.stringify(data) === JSON.stringify(migrated.modules.training.data), 'La copie de Training est différente.');
  return validateV2(migrated);
}

export class Storage {
  constructor(storage) { this.storage = storage; this.raw = undefined; this.legacyRaw = undefined; this.state = undefined; }
  read() { return this.storage.getItem(KEYS.current); }
  load(makeDefault) {
    this.raw = this.read();
    this.legacyRaw = this.storage.getItem(KEYS.legacy);
    if (this.raw !== null) {
      this.state = validateV2(JSON.parse(this.raw));
      const backup = this.storage.getItem(KEYS.backup);
      requireValue(this.legacyRaw === backup, 'Les données V1 ont changé depuis la migration. Exportez-les avant de continuer.');
      return copy(this.state.modules.training.data);
    }
    requireValue(this.legacyRaw !== null || this.storage.getItem(KEYS.backup) === null, 'Une sauvegarde V1 existe sans données actives. Exportez-la avant toute restauration.');
    const original = this.legacyRaw === null ? makeDefault() : JSON.parse(this.legacyRaw);
    const next = migrateV1(original);
    if(this.legacyRaw===null)next.core.preferences.onboardingPending=true;
    if (this.legacyRaw !== null) {
      const previous = this.storage.getItem(KEYS.backup);
      requireValue(previous === null || previous === this.legacyRaw, 'Une sauvegarde V1 différente existe déjà.');
      if (previous === null) this.storage.setItem(KEYS.backup, this.legacyRaw);
      requireValue(this.storage.getItem(KEYS.backup) === this.legacyRaw, 'Impossible de vérifier la sauvegarde V1.');
    }
    this.commit(next);
    return copy(this.state.modules.training.data);
  }
  assertUnchanged() {
    requireValue(this.raw !== undefined && this.read() === this.raw && this.storage.getItem(KEYS.legacy) === this.legacyRaw, 'Les données ont changé dans un autre onglet. Rechargez avant de continuer.');
  }
  commit(next) {
    validateV2(next);
    this.assertUnchanged();
    const raw = JSON.stringify(next);
    // A single atomic localStorage write. Quota/errors never erase the previous value.
    this.storage.setItem(KEYS.current, raw);
    requireValue(this.read() === raw, 'Impossible de vérifier l’enregistrement.');
    this.raw = raw;
    this.state = copy(next);
  }
  saveTraining(data) {
    validateTraining(data);
    const next = copy(this.state);
    next.modules.training.data = copy(data);
    this.commit(next);
  }
  installModules(definitions) {
    const next=copy(this.state);
    for(const module of definitions) {
      if(Object.hasOwn(next.modules,module.id)) {
        requireValue(next.modules[module.id].version===module.version, 'Version du module non prise en charge : '+module.name);
        module.validate(next.modules[module.id].data);
      } else next.modules[module.id]={enabled:true,version:module.version,data:module.initial()};
    }
    requireValue(JSON.stringify(next.modules.training)===JSON.stringify(this.state.modules.training),'Training a changé pendant l’ajout des modules.');
    if(JSON.stringify(next)!==this.raw) {
      if(this.storage.getItem('constante_v2_before_modules')===null)this.storage.setItem('constante_v2_before_modules',this.raw);
      this.commit(next);
    }
  }
  saveModule(id,data) {
    requireValue(id!=='training' && Object.hasOwn(this.state.modules,id),'Module inconnu.');
    const next=copy(this.state);next.modules[id].data=copy(data);this.commit(next);
  }
  restoreState(data) {
    validateV2(data);this.assertUnchanged();
    const backup=JSON.stringify({format:'constante-backup',backupVersion:1,exportedAt:new Date().toISOString(),storage:Object.fromEntries(Object.values(KEYS).map(key=>[key,this.storage.getItem(key)]))});
    this.storage.setItem('constante_before_restore',backup);
    requireValue(this.storage.getItem('constante_before_restore')===backup,'La sauvegarde avant restauration a échoué.');
    this.commit(copy(data));
  }
  setEnabled(id, enabled) {
    requireValue(typeof enabled === 'boolean' && Object.hasOwn(this.state.modules, id), 'Module inconnu.');
    const next = copy(this.state);
    next.modules[id].enabled = enabled;
    this.commit(next);
  }
  exportRaw() {
    return JSON.stringify({ format: 'constante-backup', backupVersion: 1, exportedAt: new Date().toISOString(), storage: Object.fromEntries([...Object.values(KEYS),'constante_v2_before_modules','constante_before_restore'].map(key => [key, this.storage.getItem(key)])) }, null, 2);
  }
}
