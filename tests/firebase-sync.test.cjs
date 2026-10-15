const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Replace network SDK imports at the boundary; exercise the actual backup handlers.
const source = readFileSync(join(__dirname, '../firebase-sync.js'), 'utf8').replace(/^import .*;\s*$/gm, '');
function cloud(language) {
  const elements = new Map(['firebaseStatus','firebaseLogin','firebaseLogout','firebaseUpload','firebaseDownload'].map(id=>[id,{}]));
  const stored = new Map([
    ['english-forge-v1', JSON.stringify([{english:'hello'}])],
    ['japanese-forge-v1', JSON.stringify([{english:'こんにちは'}])],
  ]);
  const backup = {items:[{english:'old English'}],japaneseItems:[{english:'古い日文'}]};
  const writes = [];
  const auth = {currentUser:{uid:'test-user',email:'test@example.com'}};
  const context = vm.createContext({
    document:{getElementById:id=>elements.get(id)},location:{search:'?lang='+language},URLSearchParams,
    firebaseConfig:{apiKey:'test',projectId:'test'},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    onAuthStateChanged:(_,callback)=>callback(auth.currentUser),GoogleAuthProvider:class {},
    signInWithPopup:async()=>{},signOut:async()=>{},confirm:()=>true,
    localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
    doc:(_,...path)=>path,serverTimestamp:()=>123,
    setDoc:async(path,value,options)=>{writes.push({path,value,options});if(!options?.merge)for(const key of Object.keys(backup))delete backup[key];Object.assign(backup,value)},
    getDoc:async()=>({exists:()=>true,data:()=>backup}),
  });
  vm.runInContext(source,context);
  return {el:id=>elements.get(id),stored,backup,writes};
}

test('English uploads keep the legacy items field and preserve Japanese cloud data', async()=>{
  const a=cloud('en');await a.el('firebaseUpload').onclick();
  assert.equal(a.backup.items[0].english,'hello');
  assert.equal(a.backup.japaneseItems[0].english,'古い日文');
  assert.equal(a.writes[0].options?.merge,true);
});

test('Japanese backup and restore touch only Japanese data', async()=>{
  const a=cloud('ja');await a.el('firebaseUpload').onclick();
  assert.equal(a.backup.japaneseItems[0].english,'こんにちは');
  assert.equal(a.backup.items[0].english,'old English');
  assert.equal(a.writes[0].options?.merge,true);
  a.backup.japaneseItems=[{english:'新しい日文'}];
  await a.el('firebaseDownload').onclick();
  assert.equal(JSON.parse(a.stored.get('japanese-forge-v1'))[0].english,'新しい日文');
  assert.equal(JSON.parse(a.stored.get('english-forge-v1'))[0].english,'hello');
});

test('Japanese restore does not fall back to an English-only backup', async()=>{
  const a=cloud('ja');delete a.backup.japaneseItems;
  await a.el('firebaseDownload').onclick();
  assert.equal(JSON.parse(a.stored.get('japanese-forge-v1'))[0].english,'こんにちは');
  assert.match(a.el('firebaseStatus').textContent,/還原失敗/);
});
