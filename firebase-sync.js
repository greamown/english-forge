import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=20261014-2";

const japanese=new URLSearchParams(location.search).get("lang")==="ja";
const languageName=japanese?"日文":"英文";
const storageKey=japanese?"japanese-forge-v1":"english-forge-v1";
// shortcut: old clients can replace this shared document; refresh legacy tabs before backing up either language.
const itemsField=japanese?"japaneseItems":"items";
const timestampField=japanese?"japaneseUpdatedAt":"updatedAt";

const status = document.getElementById("firebaseStatus");
const login = document.getElementById("firebaseLogin");
const logout = document.getElementById("firebaseLogout");
const upload = document.getElementById("firebaseUpload");
const download = document.getElementById("firebaseDownload");
function report(t){status.textContent=t;}
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "REPLACE_ME") {
  login.hidden = false; login.disabled = true;
  report("Firebase 設定尚未載入。請強制重新整理；若持續發生，檢查 firebase-config.js。");
} else {
  try {
    const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
    onAuthStateChanged(auth, user=>{
      const signed=!!user;
      login.hidden=signed;logout.hidden=!signed;upload.hidden=!signed;download.hidden=!signed;
      report(signed?"已登入："+user.email+"。資料不會自動覆蓋；請手動選擇備份或還原。":"尚未登入 Firebase。");
    });
    login.onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){report("登入失敗："+e.message)}};
    logout.onclick=async()=>{try{await signOut(auth)}catch(e){report(e.message)}};
    upload.onclick=async()=>{
      if(!auth.currentUser)return;
      if(!confirm("將這台裝置的"+languageName+"題庫與學習進度覆寫至雲端？"))return;
      try {
        const raw=localStorage.getItem(storageKey);
        const items=JSON.parse(raw||"[]");if(!Array.isArray(items))throw Error("本機資料格式不正確");
        await setDoc(doc(db,"users",auth.currentUser.uid,"backups","latest"),{[itemsField]:items,[timestampField]:serverTimestamp()},{merge:true});
        report("已將 "+items.length+" 筆"+languageName+"資料備份至 Firestore。");
      }catch(e){report("備份失敗："+e.message)}
    };
    download.onclick=async()=>{
      if(!auth.currentUser)return;
      if(!confirm("從雲端還原"+languageName+"資料將覆蓋這台裝置的對應題庫與進度。建議先匯出 JSON。確定繼續？"))return;
      try{
        const snap=await getDoc(doc(db,"users",auth.currentUser.uid,"backups","latest"));
        if(!snap.exists())throw Error("雲端還沒有備份");
        const items=snap.data()[itemsField];if(!Array.isArray(items))throw Error("雲端沒有可用的"+languageName+"備份");
        localStorage.setItem(storageKey,JSON.stringify(items));
        report("已還原 "+items.length+" 筆"+languageName+"資料。重新整理頁面以載入更新。");
      }catch(e){report("還原失敗："+e.message)}
    };
  }catch(e){login.hidden=false;login.disabled=true;report("Firebase 初始化失敗："+e.message)}
}