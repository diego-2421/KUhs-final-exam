// 학생 접속 현황: 이름 입력 + 지금 보는 지문을 Firebase Realtime Database에 기록, 연결이 끊기면 서버가 삭제
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, set, onDisconnect, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const KEY = "kuhs-name";
const NOTIFY_URL = "https://script.google.com/macros/s/AKfycbwrYEW_swcdHsyzQqnFh0TF7cNrBW6QcTPZJTiMqkIXzcstXBLBH3MqteBUNfespNUW/exec";
const NKEY = "kuhs-notified";
let name = null, uid = null, page = window.__page || "지문 목록", connected = false, db = null, sent = "";

function getName() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
function saveName(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

// 선생님 메일 알림: 이 기기에서 학생별 하루 한 번만 요청 (스크립트도 하루 첫 접속만 발송)
function notifyOnce() {
  if (!name) return;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const mark = day + "|" + name;
  try { if (localStorage.getItem(NKEY) === mark) return; localStorage.setItem(NKEY, mark); } catch (e) {}
  const body = new URLSearchParams({ name: name, page: window.__page || page || "" });
  fetch(NOTIFY_URL, { method: "POST", mode: "no-cors", body: body }).catch(function () {});
}

function push() {
  if (!db || !uid || !name || !connected) return;
  const sig = name + "|" + page;
  if (sig === sent) return;
  sent = sig;
  set(ref(db, "presence/" + uid), { name: name, page: page, ts: serverTimestamp() }).catch(function () {});
}

function askName(initial) {
  const wrap = document.createElement("div");
  wrap.className = "nm-wrap";
  wrap.innerHTML =
    '<form class="nm-box" novalidate>' +
    '<h2 class="nm-h">이름을 입력해 주세요</h2>' +
    '<p class="nm-p">학습 현황을 확인하는 데만 쓰이고, 창을 닫으면 기록이 지워집니다</p>' +
    '<label for="nm-in" class="nm-l">이름</label>' +
    '<input id="nm-in" class="nm-in" maxlength="20" autocomplete="name" placeholder="예: 김민준">' +
    '<p class="nm-err" id="nm-err" aria-live="polite"></p>' +
    '<button class="nm-btn" type="submit">시작하기</button></form>';
  document.body.appendChild(wrap);
  const input = wrap.querySelector("#nm-in");
  input.value = initial || "";
  setTimeout(function () { input.focus(); }, 50);
  wrap.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { wrap.querySelector("#nm-err").textContent = "이름을 입력해야 시작할 수 있습니다."; return; }
    name = v.slice(0, 20); saveName(name); wrap.remove(); push(); renderBadge(); notifyOnce();
  });
}

function renderBadge() {
  let b = document.getElementById("nm-badge");
  if (!b) {
    b = document.createElement("button");
    b.id = "nm-badge"; b.className = "nm-badge"; b.type = "button";
    b.addEventListener("click", function () { askName(name); });
    document.body.appendChild(b);
  }
  b.textContent = (name || "이름 없음") + " · 이름 바꾸기";
}

window.reportPage = function (label) { page = String(label).slice(0, 40); push(); };

name = getName();
if (!name) askName(""); else { renderBadge(); setTimeout(notifyOnce, 800); }

try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  const auth = getAuth(app);
  onAuthStateChanged(auth, function (user) {
    if (!user) { signInAnonymously(auth).catch(function () {}); return; }
    uid = user.uid;
    onValue(ref(db, ".info/connected"), function (snap) {
      connected = snap.val() === true;
      if (!connected) return;
      sent = "";
      onDisconnect(ref(db, "presence/" + uid)).remove().then(push).catch(function () {});
    });
  });
} catch (e) { /* 접속 기록이 안 돼도 학습 화면은 그대로 사용 */ }
