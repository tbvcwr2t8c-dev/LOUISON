import test from 'node:test';
import assert from 'node:assert/strict';
test('application boots, installs modules and opens each universe without touching existing Training',async()=>{
 const elements=new Map();
 function element(key){if(!elements.has(key))elements.set(key,{hidden:false,style:{},children:[],innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},setAttribute(){},append(...children){this.children.push(...children);},prepend(){},replaceChildren(...children){this.children=children;},querySelector:s=>element(key+' '+s),querySelectorAll:()=>[],close(){}});return elements.get(key);}
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 globalThis.document={querySelector:element,querySelectorAll:()=>[],getElementById:id=>element('#'+id),createElement:()=>element(crypto.randomUUID()),addEventListener(){}};
 globalThis.window={addEventListener(){}};globalThis.alert=message=>{throw Error(message);};
 await import('../src/app.js');
 assert.equal(element('#core-message').children.length,0,element('#core-message').children.map(c=>c.textContent).join(' '));const state=JSON.parse(values.get('constante_v2'));assert.deepEqual(Object.keys(state.modules),['training','reading','flair']);const before=JSON.stringify(state.modules.training);
 for(const name of ['Lecture','Flair','Mon compte','Training']){const button=element('#universes').children.find(b=>b.textContent===name);assert.ok(button);button.onclick();}
 assert.equal(JSON.stringify(JSON.parse(values.get('constante_v2')).modules.training),before);
});
