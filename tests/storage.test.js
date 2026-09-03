import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage, KEYS, migrateV1 } from '../src/core/storage.js';
import { ModuleRegistry } from '../src/core/registry.js';

export const fixture = () => ({ start:'2026-08-24T12:00:00.000Z',target:3,rower:true,scores:{push:{a:7,s:2},squat:{a:14,s:-2},plank:{a:25,s:1},burpee:{a:3,s:0},row:{a:4,s:-1}},sessions:[{date:'2026-09-01T12:00:00.000Z',mode:'minimum',feedback:-1,ex:[{k:'push',n:'Pompes',u:'rép.',d:2,hard:true}],extra:{keep:['a',null,4]}}],future:{untouched:true} });
export class MemoryStorage {
  constructor(raw = JSON.stringify(fixture())) { this.values = new Map(raw === null ? [] : [[KEYS.legacy,raw]]); this.writes=[]; this.failKey=null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key,value) { if(key===this.failKey) throw new Error('QuotaExceededError'); this.writes.push(key); this.values.set(key,String(value)); }
}
test('migration copies every field and preserves the exact original bytes', () => {
  const raw=JSON.stringify(fixture(),null,3), memory=new MemoryStorage(raw), store=new Storage(memory);
  assert.deepEqual(store.load(fixture),fixture());
  assert.equal(memory.getItem(KEYS.legacy),raw); assert.equal(memory.getItem(KEYS.backup),raw);
  assert.deepEqual(store.state.modules.training.data,fixture());
  assert.deepEqual(memory.writes,[KEYS.backup,KEYS.current]);
  const writes=memory.writes.length;
  assert.deepEqual(new Storage(memory).load(fixture),fixture());
  assert.equal(memory.writes.length,writes);
});
test('new user initializes once without inventing V1 data',()=>{
  const memory=new MemoryStorage(null), store=new Storage(memory); store.load(fixture);
  assert.equal(memory.getItem(KEYS.legacy),null); assert.equal(memory.getItem(KEYS.backup),null);
  assert.deepEqual(new Storage(memory).load(()=>{throw Error('unexpected reset');}),fixture());
});
test('quota failures never overwrite the V1 or write unbacked V2',()=>{
  for (const key of [KEYS.backup,KEYS.current]) {
    const memory=new MemoryStorage(), raw=memory.getItem(KEYS.legacy); memory.failKey=key;
    assert.throws(()=>new Storage(memory).load(fixture));
    assert.equal(memory.getItem(KEYS.legacy),raw); assert.equal(memory.getItem(KEYS.current),null);
    memory.failKey=null; assert.deepEqual(new Storage(memory).load(fixture),fixture());
  }
});
test('malformed, null and unknown schemas stop without reset or writes',()=>{
  for(const raw of ['broken','null','{}','[]','false']) {
    const memory=new MemoryStorage(raw); assert.throws(()=>new Storage(memory).load(fixture));
    assert.deepEqual(memory.writes,[]); assert.equal(memory.getItem(KEYS.legacy),raw);
  }
  for(const raw of ['broken','null',JSON.stringify({...migrateV1(fixture()),schemaVersion:3})]) {
    const memory=new MemoryStorage();memory.values.set(KEYS.current,raw);
    assert.throws(()=>new Storage(memory).load(fixture));assert.equal(memory.getItem(KEYS.current),raw);
    assert.deepEqual(memory.writes,[]);
  }
});
test('pause, reload and reactivation retain all module data',()=>{
  const memory=new MemoryStorage(), store=new Storage(memory);store.load(fixture);
  const next=structuredClone(store.state);next.modules.other={enabled:false,version:8,data:{history:[1,2,3]}};next.future='keep';store.commit(next);
  store.setEnabled('training',false);const reopened=new Storage(memory);reopened.load(fixture);
  assert.equal(reopened.state.modules.training.enabled,false);assert.deepEqual(reopened.state.modules.training.data,fixture());
  reopened.setEnabled('training',true);const updated=fixture();updated.scores.push.a=8;reopened.saveTraining(updated);
  assert.deepEqual(reopened.state.modules.other,next.modules.other);assert.equal(reopened.state.future,'keep');
  assert.deepEqual(reopened.state.modules.training.data,updated);assert.deepEqual(JSON.parse(memory.getItem(KEYS.legacy)),fixture());
});
test('concurrent V2 and legacy writers are rejected',()=>{
  for(const key of [KEYS.current,KEYS.legacy]) {
    const memory=new MemoryStorage(), store=new Storage(memory);store.load(fixture);
    memory.values.set(key,'external change');assert.throws(()=>store.saveTraining(fixture()),/autre onglet/);
    assert.equal(memory.getItem(key),'external change');
  }
});
test('legacy changes after migration and conflicting backups stop on reload',()=>{
  const memory=new MemoryStorage();new Storage(memory).load(fixture);
  memory.values.set(KEYS.legacy,JSON.stringify({...fixture(),target:5}));
  assert.throws(()=>new Storage(memory).load(fixture),/V1 ont changé/);
  const second=new MemoryStorage();second.values.set(KEYS.backup,'different');
  assert.throws(()=>new Storage(second).load(fixture));assert.equal(second.getItem(KEYS.current),null);
  const orphan=new MemoryStorage(null);orphan.values.set(KEYS.backup,JSON.stringify(fixture()));
  assert.throws(()=>new Storage(orphan).load(fixture),/sans données actives/);assert.equal(orphan.getItem(KEYS.current),null);
});
test('failed save retains previous V2 and exported backup contains every raw source',()=>{
  const memory=new MemoryStorage(), store=new Storage(memory);store.load(fixture);const before=store.raw;
  memory.failKey=KEYS.current;assert.throws(()=>store.saveTraining({...fixture(),target:5}));
  assert.equal(memory.getItem(KEYS.current),before);assert.equal(store.raw,before);
  const backup=JSON.parse(store.exportRaw());for(const key of Object.values(KEYS))assert.equal(backup.storage[key],memory.getItem(key));
});
test('registry removal only removes definition, never stored state',()=>{
  const registry=new ModuleRegistry(), state=migrateV1(fixture());const before=structuredClone(state);
  const module={id:'training',mount:()=>{},version:1};registry.register(module);
  assert.equal(registry.active(state).length,1);assert.throws(()=>registry.register(module));
  registry.unregister('training');assert.equal(registry.list().length,0);assert.deepEqual(state,before);
  registry.register(module);assert.equal(registry.active(state).length,1);
  state.modules.training.enabled=false;assert.equal(registry.active(state).length,0);
});
