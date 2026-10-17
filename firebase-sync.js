import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=20261014-2";

const japanese=new URLSearchParams(location.search).get("lang")==="ja";
const languageName=japanese?"日文":"英文";
const storageKey=japanese?"japanese-forge-v1":"english-forge-v1";
const localUpdatedKey=storageKey+"-updated-at";
const syncedAtKey=storageKey+"-synced-at";
// shortcut: old clients can replace this shared document; refresh legacy tabs before backing up either language.
const itemsField=japanese?"japaneseItems":"items";
const timestampField=japanese?"japaneseUpdatedAt":"updatedAt";

const status = document.getElementById("firebaseStatus");
const login = document.getElementById("firebaseLogin");
const logout = document.getElementById("firebaseLogout");
const upload = document.getElementById("firebaseUpload");
const download = document.getElementById("firebaseDownload");
const quickButton=document.getElementById("cloudSyncButton");
const quickLabel=document.getElementById("cloudSyncLabel");
const menuButton=document.getElementById("cloudMenuButton");
const panel=document.getElementById("cloudSyncPanel");
const account=document.getElementById("cloudAccount");
const localTime=document.getElementById("cloudLocalTime");
const remoteTime=document.getElementById("cloudRemoteTime");
const panelUpload=document.getElementById("cloudPanelUpload");
const panelDownload=document.getElementById("cloudPanelDownload");
const panelLogout=document.getElementById("cloudPanelLogout");
let auth,db,currentUser=null,remoteUpdatedAt=0,remoteMatchesLocal=false,quickAction="login";
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
function localUpdatedAt(){return Number(localStorage.getItem(localUpdatedKey))||0}
function syncedAt(){return Number(localStorage.getItem(syncedAtKey))||0}
function setQuick(action,label,state){
  quickAction=action;quickLabel.textContent=label;quickButton.dataset.state=state;
  quickButton.setAttribute("aria-label",label);
}
function updatePanel(){
  account.textContent=currentUser?currentUser.email:"尚未登入 Google";
  localTime.textContent=savedTime(localUpdatedAt());
  remoteTime.textContent=remoteUpdatedAt?savedTime(remoteUpdatedAt):currentUser?"雲端尚無備份":"登入後檢查";
  panelUpload.textContent=currentUser?"備份現在的進度":"使用 Google 登入";
  panelUpload.disabled=false;panelDownload.disabled=!currentUser||!remoteUpdatedAt;panelLogout.hidden=!currentUser;
}
function updateSuggestedAction(){
  updatePanel();
  if(!currentUser){setQuick("login","登入同步","signed-out");return}
  const local=localUpdatedAt();
  if(!remoteMatchesLocal&&remoteUpdatedAt>local){setQuick("download","接續上次進度","remote");return}
  if(!syncedAt()||local>syncedAt()){setQuick("upload","備份進度","dirty");return}
  setQuick("panel","已備份","synced");
}
function togglePanel(force){
  const open=force??panel.hidden;panel.hidden=!open;menuButton.setAttribute("aria-expanded",String(open));
}
globalThis.markForgeDataDirty=updatedAt=>{
  if(updatedAt&&!localStorage.getItem(localUpdatedKey))localStorage.setItem(localUpdatedKey,String(updatedAt));
  remoteMatchesLocal=false;
  updateSuggestedAction();
};

async function refreshRemote(){
  if(!currentUser)return;
  try{
    const snap=await getDoc(doc(db,"users",currentUser.uid,"backups","latest"));
    const cloud=snap.exists()?snap.data():{};
    const cloudItems=cloud[itemsField];
    remoteUpdatedAt=Array.isArray(cloudItems)?timestampValue(cloud[timestampField]):0;
    remoteMatchesLocal=Array.isArray(cloudItems)&&JSON.stringify(cloudItems)===localStorage.getItem(storageKey);
    if(remoteMatchesLocal&&localUpdatedAt())localStorage.setItem(syncedAtKey,String(localUpdatedAt()));
    updateSuggestedAction();
  }catch(e){remoteTime.textContent="目前無法檢查";report("無法檢查雲端備份："+e.message)}
}
async function uploadData(confirmFirst=true){
  if(!currentUser)return signIn();
  if(confirmFirst&&!confirm("將這台裝置的"+languageName+"題庫與學習進度覆寫至雲端？"))return;
  setQuick("busy","備份中…","busy");
  try{
    const raw=localStorage.getItem(storageKey);
    const items=JSON.parse(raw||"[]");if(!Array.isArray(items))throw Error("本機資料格式不正確");
    await setDoc(doc(db,"users",currentUser.uid,"backups","latest"),{[itemsField]:items,[timestampField]:serverTimestamp()},{merge:true});
    const now=Date.now(),version=localUpdatedAt()||now;
    if(!localUpdatedAt())localStorage.setItem(localUpdatedKey,String(version));
    localStorage.setItem(syncedAtKey,String(version));remoteUpdatedAt=now;remoteMatchesLocal=true;
    report("已將 "+items.length+" 筆"+languageName+"資料備份至 Firestore。");
    updateSuggestedAction();
  }catch(e){report("備份失敗："+e.message);setQuick("upload","備份失敗，重試","dirty")}
}
async function downloadData(){
  if(!currentUser)return signIn();
  if(!confirm("從雲端接續"+languageName+"進度會覆蓋這台裝置的對應題庫與進度。確定繼續？"))return;
  setQuick("busy","還原中…","busy");
  try{
    const snap=await getDoc(doc(db,"users",currentUser.uid,"backups","latest"));
    if(!snap.exists())throw Error("雲端還沒有備份");
    const cloud=snap.data(),items=cloud[itemsField];if(!Array.isArray(items))throw Error("雲端沒有可用的"+languageName+"備份");
    const restoredAt=timestampValue(cloud[timestampField])||Date.now();
    localStorage.setItem(storageKey,JSON.stringify(items));localStorage.setItem(localUpdatedKey,String(restoredAt));localStorage.setItem(syncedAtKey,String(restoredAt));remoteUpdatedAt=restoredAt;remoteMatchesLocal=true;
    report("已還原 "+items.length+" 筆"+languageName+"資料。正在載入最新進度…");
    updateSuggestedAction();
    if(typeof location.reload==="function")location.reload();
  }catch(e){report("還原失敗："+e.message);updateSuggestedAction()}
}
async function signIn(){try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){report("登入失敗："+e.message)}}

menuButton.onclick=()=>togglePanel();
quickButton.onclick=()=>quickAction==="login"?signIn():quickAction==="upload"?uploadData(false):quickAction==="download"?downloadData():togglePanel();
panelUpload.onclick=()=>uploadData(true);panelDownload.onclick=downloadData;
document.addEventListener("click",event=>{if(!panel.hidden&&!event.target?.closest?.(".cloud-control"))togglePanel(false)});
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "REPLACE_ME") {
  login.hidden = false; login.disabled = true;
  quickButton.disabled=true;setQuick("unavailable","備份暫不可用","error");menuButton.disabled=true;
  report("Firebase 設定尚未載入。請強制重新整理；若持續發生，檢查 firebase-config.js。");
} else {
  try {
    const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
    onAuthStateChanged(auth, user=>{
      currentUser=user;const signed=!!user;
      login.hidden=signed;logout.hidden=!signed;upload.hidden=!signed;download.hidden=!signed;
      report(signed?"已登入："+user.email+"。資料不會自動覆蓋；請手動選擇備份或還原。":"尚未登入 Firebase。");
      remoteUpdatedAt=0;remoteMatchesLocal=false;updateSuggestedAction();if(signed)refreshRemote();
    });
    login.onclick=signIn;
    const signOutNow=async()=>{try{await signOut(auth);togglePanel(false)}catch(e){report(e.message)}};
    logout.onclick=signOutNow;panelLogout.onclick=signOutNow;
    upload.onclick=()=>uploadData(true);download.onclick=downloadData;
  }catch(e){login.hidden=false;login.disabled=true;report("Firebase 初始化失敗："+e.message)}
}
