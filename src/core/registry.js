export class ModuleRegistry {
  #modules = new Map();
  register(module) {
    if (!/^[a-z][a-z0-9-]*$/.test(module.id) || this.#modules.has(module.id) || typeof module.mount !== 'function') throw new Error('Déclaration de module invalide ou déjà enregistrée.');
    this.#modules.set(module.id, Object.freeze({ ...module }));
    return this;
  }
  get(id) { return this.#modules.get(id); }
  list() { return [...this.#modules.values()]; }
  active(state) { return this.list().filter(module => state.modules[module.id]?.enabled === true); }
  // Removing a definition never deletes its stored state.
  unregister(id) { this.#modules.delete(id); }
}
