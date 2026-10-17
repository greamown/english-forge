import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, runTransaction, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=20261014-2";

const japanese=new URLSearchParams(location.search).get("lang")==="ja";
const languageName=japanese?"日文":"英文";
// ponytail: every app shares users/{uid}/backups/latest (1 MiB cap); give each app its own doc + rules if libraries grow large.
const field=japanese?"japaneseRecords":"englishRecords";
const timeField=field+"UpdatedAt";
// Older versions uploaded a whole snapshot here; it is merged in, dated by its upload time, then removed.
const legacyField=japanese?"japaneseItems":"items";
const legacyTimeField=japanese?"japaneseUpdatedAt":"updatedAt";

const status = document.getElementById("firebaseStatus");
const login = document.getElementById("firebaseLogin");
const logout = document.getElementById("firebaseLogout");
const syncButton = document.getElementById("firebaseSync");
const quickButton=document.getElementById("cloudSyncButton");
const quickLabel=document.getElementById("cloudSyncLabel");
const menuButton=document.getElementById("cloudMenuButton");
const panel=document.getElementById("cloudSyncPanel");
const account=document.getElementById("cloudAccount");
const localTime=document.getElementById("cloudLocalTime");
const syncedTime=document.getElementById("cloudRemoteTime");
const panelSync=document.getElementById("cloudPanelSync");
const panelLogout=document.getElementById("cloudPanelLogout");
let auth,db,currentUser=null,syncing=false,again=false,timer,lastSynced=0;
function report(t){status.textContent=t;}

function timestampValue(value){
  if(typeof value==="number")return value;
  if(value?.toMillis)return value.toMillis();
  if(value?.toDate)return value.toDate().getTime();
  if(value?.seconds)return value.seconds*1000;
  const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:0;
}
function savedTime(value){
  if(!value)return "尚未產生紀錄";
  return new Date(value).toLocaleString("zh-TW",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function setQuick(label,state){
  quickLabel.textContent=label;quickButton.dataset.state=state;
  quickButton.setAttribute("aria-label",label);
}
function updatePanel(){
  account.textContent=currentUser?currentUser.email:"尚未登入 Google";
  try{localTime.textContent=savedTime(ProgressRecords.latest(forgeProgress.records()))}catch{localTime.textContent=savedTime(0)}
  syncedTime.textContent=lastSynced?savedTime(lastSynced):currentUser?"尚未同步":"登入後同步";
  panelSync.textContent=currentUser?"立即同步":"使用 Google 登入";
  panelLogout.hidden=!currentUser;
  login.hidden=!!currentUser;logout.hidden=!currentUser;syncButton.hidden=!currentUser;
}
function togglePanel(force){
  const open=force??panel.hidden;panel.hidden=!open;menuButton.setAttribute("aria-expanded",String(open));
}
// Stored as one JSON string: as a map, a large library would hit Firestore's 20,000-fields-per-document limit.
const readField=value=>ProgressRecords.clean(typeof value==="string"?JSON.parse(value):value);
function cloudRecords(cloud){
  const records=readField(cloud[field]),legacy=cloud[legacyField];
  if(!Array.isArray(legacy))return records;
  return ProgressRecords.merge(records,forgeProgress.fromLegacy(legacy,timestampValue(cloud[legacyTimeField])));
}
// Pull, merge per item (newer change wins), push. Safe to run any time on any device.
async function sync(){
  if(!currentUser)return;
  if(syncing){again=true;return}
  syncing=true;setQuick("同步中…","busy");
  try{
    const ref=doc(db,"users",currentUser.uid,"backups","latest");
    const merged=await runTransaction(db,async tx=>{
      const snap=await tx.get(ref),cloud=snap.exists()?snap.data():{};
      const merged=ProgressRecords.merge(forgeProgress.records(),cloudRecords(cloud));
      if(!ProgressRecords.equal(merged,readField(cloud[field]))||legacyField in cloud)
        tx.set(ref,{[field]:JSON.stringify(merged),[timeField]:serverTimestamp(),[legacyField]:deleteField(),[legacyTimeField]:deleteField()},{mergeFields:[field,timeField,legacyField,legacyTimeField]});
      return merged;
    });
    const local=forgeProgress.records(),next=ProgressRecords.merge(local,merged);// keeps grades made while the request was in flight
    if(!ProgressRecords.equal(next,local))forgeProgress.apply(next);
    lastSynced=Date.now();
    report("已同步 "+Object.keys(ProgressRecords.live(next)).length+" 筆"+languageName+"題庫與進度。");setQuick("已同步","synced");
  }catch(e){report("同步失敗："+e.message+"。進度仍保存在這台裝置，下次變更或回到此頁時會再試。");setQuick("同步失敗，重試","dirty")}
  finally{syncing=false;updatePanel();if(again){again=false;sync()}}
}
async function signIn(){try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){report("登入失敗："+e.message)}}

globalThis.markForgeDataDirty=()=>{
  updatePanel();if(!currentUser)return;
  setQuick("待同步","dirty");clearTimeout(timer);timer=setTimeout(sync,1500);
};
// Leaving the tab pushes pending changes; returning pulls what other devices did.
document.addEventListener("visibilitychange",()=>{clearTimeout(timer);sync()});
menuButton.onclick=()=>togglePanel();
quickButton.onclick=()=>currentUser?sync():signIn();
panelSync.onclick=()=>currentUser?sync():signIn();
syncButton.onclick=sync;
document.addEventListener("click",event=>{if(!panel.hidden&&!event.target?.closest?.(".cloud-control"))togglePanel(false)});
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "REPLACE_ME") {
  login.hidden = false; login.disabled = true;
  quickButton.disabled=true;setQuick("同步暫不可用","error");menuButton.disabled=true;
  report("Firebase 設定尚未載入。請強制重新整理；若持續發生，檢查 firebase-config.js。");
} else {
  try {
    const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
    onAuthStateChanged(auth, user=>{
      currentUser=user;lastSynced=0;updatePanel();
      if(user){report("已登入："+user.email+"。進度會自動在各裝置間同步。");sync()}
      else{report("尚未登入 Google；進度只存在這台裝置。");setQuick("登入同步","signed-out")}
    });
    login.onclick=signIn;
    const signOutNow=async()=>{try{await signOut(auth);togglePanel(false)}catch(e){report(e.message)}};
    logout.onclick=signOutNow;panelLogout.onclick=signOutNow;
  }catch(e){login.hidden=false;login.disabled=true;report("Firebase 初始化失敗："+e.message)}
}
