import test from 'node:test';
import assert from 'node:assert/strict';
import {Storage,KEYS} from '../src/core/storage.js';
import {decodeBackup} from '../src/core/backup.js';
import {ReadingModule} from '../src/modules/reading/index.js';
import {FlairModule} from '../src/modules/flair/index.js';
import {initialReading,finishReading,elapsedSeconds} from '../src/modules/reading/model.js';
import {initialFlair,planSession,recordTest,status} from '../src/modules/flair/model.js';
import {SKILLS} from '../src/modules/flair/catalog.js';
import {CloudBackup} from '../src/core/cloud.js';
const fixture=()=>({start:'2026-08-24T12:00:00Z',target:3,rower:true,scores:Object.fromEntries(['push','squat','plank','burpee','row'].map(k=>[k,{a:2,s:0}])),sessions:[],extra:{preserve:true}});
class Memory {constructor(){this.map=new Map([[KEYS.legacy,JSON.stringify(fixture())]]);}getItem(k){return this.map.get(k)??null;}setItem(k,v){if(k===this.fail)throw Error('quota');this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
function setup(){const memory=new Memory(),storage=new Storage(memory);storage.load(fixture);return {memory,storage};}
test('module installation preserves Training bytes, pause state and original backup; rerun is idempotent',()=>{
 const {memory,storage}=setup();storage.setEnabled('training',false);const training=JSON.stringify(storage.state.modules.training),legacy=memory.getItem(KEYS.legacy);
 storage.installModules([ReadingModule,FlairModule]);assert.equal(JSON.stringify(storage.state.modules.training),training);assert.equal(memory.getItem(KEYS.legacy),legacy);assert.equal(memory.getItem(KEYS.backup),legacy);
 const raw=storage.raw;storage.installModules([ReadingModule,FlairModule]);assert.equal(storage.raw,raw);
 storage.setEnabled('reading',false);storage.installModules([ReadingModule,FlairModule]);assert.equal(storage.state.modules.reading.enabled,false);
});
test('failed pre-addition backup stops before any module write',()=>{const {memory,storage}=setup(),raw=storage.raw;memory.fail='constante_v2_before_modules';assert.throws(()=>storage.installModules([ReadingModule]));assert.equal(memory.getItem(KEYS.current),raw);});
test('restore keeps a non-recursive prior snapshot; failed backup never replaces active state',()=>{
 const {memory,storage}=setup();storage.installModules([ReadingModule,FlairModule]);const original=storage.raw,next=structuredClone(storage.state);next.modules.reading.data.minutes=6;
 memory.fail='constante_before_restore';assert.throws(()=>storage.restoreState(next));assert.equal(storage.raw,original);memory.fail=null;
 storage.restoreState(next);assert.equal(decodeBackup(memory.getItem('constante_before_restore')).modules.reading.data.minutes,5);
 storage.restoreState(next);assert.equal(Object.hasOwn(JSON.parse(memory.getItem('constante_before_restore')).storage,'constante_before_restore'),false);
 assert.throws(()=>decodeBackup({...next,schemaVersion:3}));const malformed=structuredClone(next);malformed.modules.training.data.sessions=[{date:'2026-09-01',mode:'<img onerror=alert(1)>',ex:[]}];assert.throws(()=>decodeBackup(malformed));
});
function readingDraft(data,id,mode='normal'){data.draft={id,mode,goalMinutes:data.minutes,elapsed:0,runningSince:null,bookId:null,bookTitle:''};return data;}
test('reading minimum counts without increasing dose; normal adapts only after completed easy sessions',()=>{
 let data=initialReading();for(let i=0;i<3;i++)data=finishReading(readingDraft(data,'min'+i,'minimum'),{pages:1,seconds:0,feedback:1,date:'2026-09-03'});assert.equal(data.minutes,5);
 for(let i=0;i<3;i++)data=finishReading(readingDraft(data,'easy'+i),{pages:4,seconds:300,feedback:1,date:'2026-09-03'});assert.equal(data.minutes,6);
 for(let i=0;i<2;i++)data=finishReading(readingDraft(data,'hard'+i),{pages:1,seconds:20,feedback:-1,date:'2026-09-03'});assert.equal(data.minutes,5);
 assert.equal(elapsedSeconds({elapsed:2000,runningSince:1000},5000),6);assert.equal(elapsedSeconds({elapsed:2000,runningSince:null},5000),2);
});
test('Flair requires prerequisites, full session, 8 clean trials on two distinct days and later review',()=>{
 let data=initialFlair();const skill=SKILLS[0];assert.throws(()=>planSession(data,'tin-spin','a','2026-09-03'));
 function attempt(date,successes=8,clean=true){data.draft=planSession(data,skill.id,crypto.randomUUID(),date);assert.throws(()=>recordTest(data,{successes,clean,date}));data.draft.step=5;data=recordTest(data,{successes,clean,date});}
 attempt('2026-09-03T12:00:00Z');attempt('2026-09-03T13:00:00Z');assert.equal(data.skills[skill.id].status,'learning');attempt('2026-09-04T12:00:00Z');assert.equal(data.skills[skill.id].status,'acquired');assert.equal(status(data,skill,Date.parse('2026-09-20')),'review');
 attempt('2026-09-20T12:00:00Z',7);assert.equal(data.skills[skill.id].status,'review');attempt('2026-09-21T12:00:00Z');assert.equal(data.skills[skill.id].status,'acquired');
});
function cloudSetup(fetcher){const storage=new Memory(),cloud=new CloudBackup({config:{url:'https://test.invalid',key:'public'},storage,readState:()=>({schemaVersion:2}),fetcher});cloud.keepSession({access_token:'test',refresh_token:'test',user:{id:'user'},expires_in:3600});cloud.enabled=true;cloud.pending=true;return cloud;}
test('cloud only reports saved after acknowledgement and deduplicates identical snapshots',async()=>{
 let calls=0;const cloud=cloudSetup(async()=>({ok:true,text:async()=>++calls===1?'':JSON.stringify([{id:'copy',created_at:'2026-09-03T12:00:00Z'}])}));await cloud.flush();assert.match(cloud.message,/Sauvegardé en ligne/);assert.equal(calls,2);cloud.pending=true;await cloud.flush();assert.equal(calls,2);
});
test('cloud failures and missing verification keep retry pending, never report success',async()=>{
 for(const fetcher of [async()=>{throw Error('offline');},async()=>({ok:true,text:async()=>'[]'})]){const cloud=cloudSetup(fetcher);await cloud.flush();clearTimeout(cloud.timer);assert.equal(cloud.pending,true);assert.doesNotMatch(cloud.message,/Sauvegardé en ligne/);}
});
test('email link verification uses only this project and refuses a different account',async()=>{
 let calls=0;const cloud=cloudSetup(async(url,options)=>{calls++;assert.equal(url,'https://test.invalid/auth/v1/verify');assert.deepEqual(JSON.parse(options.body),{token_hash:'example',type:'magiclink'});return {ok:true,text:async()=>JSON.stringify({access_token:'new',refresh_token:'refresh',expires_in:3600,user:{id:'user',email:'reader@example.invalid'}})};});
 await assert.rejects(()=>cloud.verifyLink('https://elsewhere.invalid/auth/v1/verify?token=example&type=magiclink'));assert.equal(calls,0);
 await assert.rejects(()=>cloud.verifyLink('https://test.invalid/auth/v1/verify?token=example&type=magiclink','different@example.invalid'));
 await cloud.verifyLink('https://test.invalid/auth/v1/verify?token=example&type=magiclink','reader@example.invalid');assert.equal(cloud.enabled,false);assert.equal(cloud.session.access_token,'new');
});
