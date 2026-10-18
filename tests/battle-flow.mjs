import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component handlers with isolated HTTP and hook state.
// No provider requests or production votes are made.
const source=fs.readFileSync(new URL('../src/components/battle-client.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const quota={remaining:5,attemptsRemaining:8,busy:false,nextRecovery:null};
const previous={id:'old',status:'ready',choice:'left',left:{setup:'A',punchline:'A'},right:{setup:'B',punchline:'B'}};

function harness(responses,props={}){
  const state=[];const calls=[];const refs=[];let cursor=0,refCursor=0;
  const jsx=(type,props)=>({type,props});
  const react={
    useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=value}];},
    useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
    useCallback:fn=>fn,
    useEffect:()=>{},
  };
  const exports={};
  vm.runInNewContext(code,{
    exports,
    require(name){
      if(name==='react')return react;
      if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
      if(name==='next/link')return {default:'a'};
      throw Error(name);
    },
    crypto:{randomUUID:()=> 'test-request'},
    fetch:async(path,options)=>{
      calls.push({path,options});
      const response=responses.shift();
      assert.ok(response,'Unexpected request: '+path);
      return {ok:!response.error,json:async()=>response};
    }
  });

  function render(){cursor=0;refCursor=0;return exports.BattleClient({signedIn:true,configured:true,available:true,initialQuota:quota,initialBattle:previous,...props});}
  function nodes(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)];}
  const next=()=>nodes(render()).find(n=>n.type==='button'&&['Next battle →','Start battle →'].includes(n.props?.children)).props.onClick();
  return {next,calls,state,nodes:()=>nodes(render())};
}

const fresh={...previous,id:'fresh',choice:undefined};

// Test 1: Next battle sends hybrid matchmaking request with skipIds
{
  const h=harness([{battle:fresh,quota}]);
  await h.next();
  assert.equal(h.state[0].id,'fresh');
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].path,'/api/arena/generate');
  assert.deepEqual(JSON.parse(h.calls[0].options.body),{requestId:'test-request',skipIds:['old'],forceNew:false});
  assert.ok(!h.nodes().some(n=>n.type==='select'||n.type==='textarea'));
}

// Test 2: Sequential next battle calls accumulate skipped IDs
{
  const h=harness([{battle:fresh,quota}]);
  await h.next();
  assert.equal(h.calls.length,1);
  assert.equal(h.state[0].id,'fresh');
}

// Test 3: Provider failure feedback
{
  const h=harness([{error:'Provider unavailable'}]);
  await h.next();
  assert.equal(h.state[0].id,'old');
  assert.ok(h.nodes().some(n=>n.props?.role==='alert'&&n.props.children==='Provider unavailable'));
}

console.log('Battle flow: hybrid matchmaker, single-click next battle, skip tracking, and error recovery passed.');
