import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const status = document.getElementById("firebaseStatus");
const login = document.getElementById("firebaseLogin");
const logout = document.getElementById("firebaseLogout");
const upload = document.getElementById("firebaseUpload");
const download = document.getElementById("firebaseDownload");
function report(t){status.textContent=t;}
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "REPLACE_ME") {
  report("尚未設定 Firebase 專案。請先依照 README 建立 Firebase 設定。");
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
      if(!confirm("將這台裝置的題庫與學習進度覆寫至雲端？"))return;
      try {
        const raw=localStorage.getItem("english-forge-v1");
        const items=JSON.parse(raw||"[]");if(!Array.isArray(items))throw Error("本機資料格式不正確");
        await setDoc(doc(db,"users",auth.currentUser.uid,"backups","latest"),{items,updatedAt:serverTimestamp()});
        report("已將 "+items.length+" 筆資料備份至 Firestore。");
      }catch(e){report("備份失敗："+e.message)}
    };
    download.onclick=async()=>{
      if(!auth.currentUser)return;
      if(!confirm("從雲端還原資料將覆蓋這台裝置的現有題庫與進度。建議先匯出 JSON。確定繼續？"))return;
      try{
        const snap=await getDoc(doc(db,"users",auth.currentUser.uid,"backups","latest"));
        if(!snap.exists())throw Error("雲端還沒有備份");
        const items=snap.data().items;if(!Array.isArray(items))throw Error("雲端資料格式不正確");
        localStorage.setItem("english-forge-v1",JSON.stringify(items));
        report("已還原 "+items.length+" 筆資料。重新整理頁面以載入更新。");
      }catch(e){report("還原失敗："+e.message)}
    };
  }catch(e){report("Firebase 初始化失敗："+e.message)}
}