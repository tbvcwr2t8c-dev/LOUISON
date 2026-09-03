import test from 'node:test';
import assert from 'node:assert/strict';
import {Storage,KEYS,migrateV1} from '../src/core/storage.js';
import {personalize} from '../src/core/profile.js';
import {ReadingModule} from '../src/modules/reading/index.js';
import {FlairModule} from '../src/modules/flair/index.js';
import {finishReading} from '../src/modules/reading/model.js';
const training=()=>({start:'2026-09-01',target:3,rower:true,scores:Object.fromEntries(['push','squat','plank','burpee','row'].map(k=>[k,{a:2,s:1}])),sessions:[],extra:'keep'});
function setup(legacy){const map=new Map(legacy?[[KEYS.legacy,JSON.stringify(training())]]:[]);const memory={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};const storage=new Storage(memory);storage.load(training);storage.installModules([ReadingModule,FlairModule]);return {storage,map,memory};}
const choices={name:'Laurent',modules:['reading'],trainingTarget:3,rower:true,readingMinutes:15,readingTarget:5,adaptive:false};
test('only fresh installations request onboarding; existing V1 is preserved exactly',()=>{
 const fresh=setup(false);assert.equal(fresh.storage.state.core.preferences.onboardingPending,true);new Storage(fresh.memory).load(training);assert.equal(JSON.parse(fresh.map.get(KEYS.current)).core.preferences.onboardingPending,true);
 const old=setup(true);assert.equal(old.storage.state.core.preferences.onboardingPending,undefined);assert.deepEqual(old.storage.state.modules.training.data,training());
});
test('personalizing an independent profile preserves histories and does not mutate another profile',()=>{
 const {storage}=setup(true),before=JSON.stringify(storage.state);storage.state.modules.reading.data.sessions.push({id:'old',date:'2026-09-01',pages:3,seconds:300});const original=structuredClone(storage.state);
 const next=personalize(storage.state,choices);assert.deepEqual(storage.state,original);assert.equal(next.core.preferences.name,'Laurent');assert.equal(next.modules.training.enabled,false);assert.equal(next.modules.reading.enabled,true);assert.equal(next.modules.flair.enabled,false);assert.deepEqual(next.modules.training.data,training());assert.deepEqual(next.modules.reading.data.sessions,original.modules.reading.data.sessions);assert.ok(before);
 assert.throws(()=>personalize(original,{...choices,modules:[]}));assert.throws(()=>personalize(original,{...choices,readingMinutes:0}));
});
test('fixed reading goal stays fixed after easy sessions',()=>{
 let data=personalize(setup(true).storage.state,choices).modules.reading.data;
 for(let n=0;n<4;n++){data.draft={id:String(n),mode:'normal',goalMinutes:15,elapsed:0,runningSince:null,bookTitle:'',bookId:null};data=finishReading(data,{date:'2026-09-03',seconds:900,pages:5,feedback:1});}
 assert.equal(data.minutes,15);assert.equal(data.signal,0);
});
