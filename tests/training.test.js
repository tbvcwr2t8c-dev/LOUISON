import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { Storage } from '../src/core/storage.js';
const baseline = readFileSync(new URL('../reference/v1-training/index.html',import.meta.url),'utf8');
const original = baseline.split('<script>')[1].split('</script>')[0];
const moduleSource=readFileSync(new URL('../src/modules/training/training.js',import.meta.url),'utf8');
const fixture=()=>({start:'2026-08-24T12:00:00.000Z',target:3,rower:true,scores:{push:{a:7,s:2},squat:{a:14,s:-2},plank:{a:25,s:1},burpee:{a:3,s:0},row:{a:4,s:-1}},sessions:[]});
const legacyShape=data=>{const copy=structuredClone(data);delete copy.walker;delete copy.rope;delete copy.walkerMaxSpeed;delete copy.walkerMaxIncline;delete copy.scores.walk;delete copy.scores.rope;return copy};

function run(modular,data){
  const elements=new Map();
  const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},showModal(){this.open=true},close(){this.open=false}});return elements.get(key)};
  const groups={ '[data-f]':[-2,-1,0,1,2].map(f=>({dataset:{f:String(f)}})), '[data-m]':['minimum','short','normal','plus'].map(m=>({dataset:{m}})), '[data-c]':['push','squat','plank','burpee'].map(c=>({dataset:{c}})), '.tab':['today','progress','history','settings'].map(v=>({dataset:{v},classList:{toggle(){}}})), '.view':['today','work','progress','history','settings'].map(id=>({id,classList:{toggle(){}}})) };
  const raw=JSON.stringify(data),memory={constante:raw,getItem(k){return this[k]??null},setItem(k,v){this[k]=String(v)}};
  const store=new Storage(memory);
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:['2026-09-03T12:00:00.000Z']))}static now(){return new Date('2026-09-03T12:00:00.000Z').getTime()}}
  const context=vm.createContext({Date:FixedDate,Intl,localStorage:memory,confirm:()=>true,document:{querySelector:element,querySelectorAll:key=>groups[key]||[]},services:{load:factory=>store.load(factory),save:data=>store.saveTraining(data),settings(){}}});
  vm.runInContext(modular?moduleSource.replace('export function','function')+';mountTrainingModule(services);':original,context);
  return {elements,groups,element,memory,state:()=>JSON.parse(modular?JSON.stringify(store.state.modules.training.data):vm.runInContext('JSON.stringify(S)',context))};
}

test('V1 reference is byte-identical to recovered deployment',()=>assert.equal(createHash('sha256').update(baseline).digest('hex'),'e5bc676d7c09e5cf7465e80e60dfa514ee3c3f8cac537aff8e329b9fe0e6b3a9'));
test('the immutable V1 reference remains available for compatibility comparisons',()=>assert.ok(original.includes("Pompes")&&original.includes("Rameur")));
test('Training sessions, feedback, individual difficulty and rendered statistics match V1',()=>{
  for(const mode of ['minimum','short','normal','plus'])for(const feedback of [-2,-1,0,1,2])for(const hard of [false,true])for(const count of [0,7,8])for(const rower of [false,true]){
    const data=fixture();data.rower=rower;
    data.sessions=Array.from({length:count},()=>({date:'2026-09-01T12:00:00.000Z',mode:'normal',ex:[{k:'push',n:'Pompes',u:'rép.',d:7}]}));
    const old=run(false,data),current=run(true,data);
    for(const app of [old,current]){
      app.groups['[data-m]'].find(b=>b.dataset.m===mode).onclick();app.element('#start').onclick();
      const exerciseCount=rower&&(mode==='plus'||count>=8)?5:4;
      for(let i=0;i<exerciseCount;i++)app.element(hard&&i===0?'#hard':'#next').onclick();
      app.groups['[data-f]'].find(b=>+b.dataset.f===feedback).onclick();
    }
    assert.deepEqual(current.state(),old.state(),`${mode}/${feedback}/${hard}/${count}/${rower}`);
    for(const selector of ['#today','#progress','#history','#work'])assert.equal(current.element(selector).innerHTML,old.element(selector).innerHTML);
    assert.equal(current.memory.constante,JSON.stringify(data));
  }
});
test('settings, reset, empty history and minimum bounds retain V1 behavior',()=>{
  const old=run(false,fixture()),current=run(true,fixture());
  old.element('#target').value='5';old.element('#rower').value='0';old.element('#save').onclick();
  current.element('#target').value='5';current.element('#rower').checked=false;current.element('#walker').checked=false;current.element('#rope').checked=false;current.element('#save').onclick();
  const currentLegacy=legacyShape(current.state());
  assert.deepEqual(currentLegacy,old.state());
  for(const app of [old,current])app.element('#reset').onclick();
  const resetLegacy=legacyShape(current.state());
  assert.deepEqual(resetLegacy,old.state());
  for(let session=0;session<4;session++){
    for(const app of [old,current]){app.element('#start').onclick();for(let i=0;i<4;i++)app.element('#next').onclick();app.groups['[data-f]'][0].onclick();}
    assert.deepEqual(legacyShape(current.state()),old.state());
  }
});
test('walking pad and jump rope are optional, progressive and respect device limits',()=>{
  const data=fixture();data.rower=false;data.walker=true;data.rope=true;data.walkerMaxSpeed=15;data.walkerMaxIncline=15;data.scores.walk={a:5,s:0};data.scores.rope={a:20,s:0};
  const app=run(true,data);
  app.groups['[data-m]'].find(b=>b.dataset.m==='minimum').onclick();
  assert.doesNotMatch(app.element('#today').innerHTML,/Tapis de marche|Corde à sauter/);
  app.groups['[data-m]'].find(b=>b.dataset.m==='short').onclick();
  assert.doesNotMatch(app.element('#today').innerHTML,/Tapis de marche/);assert.match(app.element('#today').innerHTML,/Corde à sauter/);
  for(let session=0;session<3;session++){
    app.groups['[data-m]'].find(b=>b.dataset.m==='normal').onclick();app.element('#start').onclick();
    assert.match(app.element('#work').innerHTML,/Tapis de marche/);assert.match(app.element('#work').innerHTML,/3 km\/h · inclinaison 0%/);
    for(let i=0;i<6;i++)app.element('#next').onclick();
    app.groups['[data-f]'].find(b=>+b.dataset.f===1).onclick();
  }
  const state=app.state();assert.equal(state.scores.walk.a,6);assert.equal(state.scores.rope.a,30);assert.equal(state.sessions.length,3);
  assert.ok(state.walkerMaxSpeed<=15);assert.ok(state.walkerMaxIncline<=15);
});
