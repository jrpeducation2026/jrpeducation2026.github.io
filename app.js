import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, createUserWithEmailAndPassword, updatePassword, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where,
  getDocs, orderBy, limit, serverTimestamp, writeBatch, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ---------- setup ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// second instance so the teacher stays signed in while creating student accounts
const app2 = initializeApp(firebaseConfig, "secondary");
const auth2 = initializeAuth(app2, { persistence: inMemoryPersistence });
const db2 = getFirestore(app2);

// teacher account is identified by a hash so the official email is not shown in the app's code
const ADMIN_HASH = "4350f11b33b0b686dafc573981e8d6fb067f8b092816e47c0c18958003679c36";
async function isTeacherEmail(email) {
  if (!email) return false;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("") === ADMIN_HASH;
}
const STUDENT_DOMAIN = "students.jrpeducation.app";
const CLASSES = [6, 7, 8, 9, 10, 11, 12];
// Only Mathematics for now. Add subject names here later to bring them back.
const SUBJECTS_LOWER = ["Mathematics"];
const SUBJECTS_UPPER = ["Mathematics"];
const GLYPH = { Mathematics: "∑", "Vedic Maths": "Ve", "Olympiad Maths": "Ol", Science: "Sc", English: "En", Hindi: "Hi", "Social Science": "SS", Sanskrit: "Sa", Physics: "Ph", Chemistry: "Ch", Biology: "Bi" };
const MEDIUMS = ["English", "Hindi"];
// Official NCERT Maths textbook codes (ncert.nic.in). Each part: [code, number of chapters]
const NCERT_BOOKS = {
  "6|English": [["fegp1", 10]], "6|Hindi": [["fhgp1", 10]],
  "7|English": [["gegp1", 8], ["gegp2", 7]], "7|Hindi": [["ghgp1", 8], ["ghgp2", 7]],
  "8|English": [["hegp1", 7], ["hegp2", 7]], "8|Hindi": [["hhgp1", 7], ["hhgp2", 7]],
  "9|English": [["iemh1", 12]], "9|Hindi": [["ihmh1", 12]],
  "10|English": [["jemh1", 14]], "10|Hindi": [["jhmh1", 14]],
  "11|English": [["kemh1", 14]], "11|Hindi": [["khmh1", 14]],
  "12|English": [["lemh1", 6], ["lemh2", 7]], "12|Hindi": [["lhmh1", 6], ["lhmh2", 7]]
};
function ncertChapterUrl(cls, subject, medium, chapter) {
  if (subject !== "Mathematics") return "";
  const list = DEFAULT_SYLLABUS[`${cls}|${subject}|${medium}`] || [], parts = NCERT_BOOKS[`${cls}|${medium}`];
  let i = list.indexOf(chapter);
  if (i < 0 || !parts) return "";
  for (const [code, n] of parts) { if (i < n) return `https://ncert.nic.in/textbook/pdf/${code}${String(i + 1).padStart(2, "0")}.pdf`; i -= n; }
  return "";
}
function ncertBookUrls(cls, subject, medium) {
  if (subject !== "Mathematics") return [];
  return (NCERT_BOOKS[`${cls}|${medium}`] || []).map(([code, n]) => `https://ncert.nic.in/textbook.php?${code}=0-${n}`);
}
const DEFAULT_SYLLABUS = {
  "6|Mathematics|English": ["Patterns in Mathematics", "Lines and Angles", "Number Play", "Data Handling and Presentation", "Prime Time",
    "Perimeter and Area", "Fractions", "Playing with Constructions", "Symmetry", "The Other Side of Zero"],
  "6|Mathematics|Hindi": ["गणित में पैटर्न", "रेखाएँ और कोण", "संख्याओं का खेल", "आँकड़ों का प्रबंधन और प्रस्तुतीकरण", "अभाज्य समय",
    "परिमाप और क्षेत्रफल", "भिन्न", "रचनाओं के साथ खेलना", "सममिति", "शून्य के दूसरी ओर"],
  "7|Mathematics|English": ["Large Numbers Around Us", "Arithmetic Expressions", "A Peek Beyond the Point", "Expressions using Letter-Numbers",
    "Parallel and Intersecting Lines", "Number Play", "A Tale of Three Intersecting Lines", "Working with Fractions",
    "Geometric Twins", "Operations with Integers", "Finding Common Ground", "Another Peek Beyond the Point", "Connecting the Dots",
    "Constructions and Tilings", "Finding the Unknown"],
  "7|Mathematics|Hindi": ["हमारे आस-पास की बड़ी संख्याएँ", "अंकगणितीय व्यंजक", "बिंदु से परे एक दृष्टि", "अक्षर-संख्याओं के उपयोगी व्यंजक",
    "समांतर और प्रतिच्छेदी रेखाएँ", "संख्याओं का खेल", "तीन प्रतिच्छेदी रेखाओं की एक कथा", "भिन्नों के साथ कार्य करना",
    // भाग 2 (Hindi names to be confirmed from the book; edit in Teacher → Content → Syllabus)
    "Geometric Twins", "Operations with Integers", "Finding Common Ground", "Another Peek Beyond the Point", "Connecting the Dots",
    "Constructions and Tilings", "Finding the Unknown"],
  "8|Mathematics|English": ["A Square and A Cube", "Power Play", "A Story of Numbers", "Quadrilaterals", "Number Play",
    "We Distribute, Yet Things Multiply", "Proportional Reasoning", "Fractions in Disguise", "The Baudhayana-Pythagoras Theorem",
    "Proportional Reasoning - 2", "Exploring Some Geometric Themes", "Tales by Dots and Lines", "Algebra Play", "Area"],
  "8|Mathematics|Hindi": ["वर्ग और घन", "घातों का खेल", "संख्याओं की कहानी", "चतुर्भुज", "संख्याओं का खेल",
    "जितना बाँटेंगे उतना बढ़ेगा", "समानुपातिक तर्कण-1",
    // भाग 2 (Hindi names to be confirmed from the book; edit in Teacher → Content → Syllabus)
    "Fractions in Disguise", "The Baudhayana-Pythagoras Theorem", "Proportional Reasoning - 2", "Exploring Some Geometric Themes",
    "Tales by Dots and Lines", "Algebra Play", "Area"],
  "9|Mathematics|English": ["Number Systems", "Polynomials", "Coordinate Geometry", "Linear Equations in Two Variables",
    "Introduction to Euclid's Geometry", "Lines and Angles", "Triangles", "Quadrilaterals", "Circles", "Heron's Formula",
    "Surface Areas and Volumes", "Statistics"],
  "9|Mathematics|Hindi": ["संख्या पद्धति", "बहुपद", "निर्देशांक ज्यामिति", "दो चरों वाले रैखिक समीकरण", "यूक्लिड की ज्यामिति का परिचय",
    "रेखाएँ और कोण", "त्रिभुज", "चतुर्भुज", "वृत्त", "हीरोन का सूत्र", "पृष्ठीय क्षेत्रफल और आयतन", "सांख्यिकी"],
  "11|Mathematics|English": ["Sets", "Relations and Functions", "Trigonometric Functions", "Complex Numbers and Quadratic Equations",
    "Linear Inequalities", "Permutations and Combinations", "Binomial Theorem", "Sequences and Series", "Straight Lines",
    "Conic Sections", "Introduction to Three Dimensional Geometry", "Limits and Derivatives", "Statistics", "Probability"],
  "11|Mathematics|Hindi": ["समुच्चय", "संबंध एवं फलन", "त्रिकोणमितीय फलन", "सम्मिश्र संख्याएँ और द्विघातीय समीकरण", "रैखिक असमिकाएँ",
    "क्रमचय और संचय", "द्विपद प्रमेय", "अनुक्रम तथा श्रेणी", "सरल रेखाएँ", "शंकु परिच्छेद", "त्रिविमीय ज्यामिति का परिचय",
    "सीमा और अवकलज", "सांख्यिकी", "प्रायिकता"],
  "12|Mathematics|English": ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants",
    "Continuity and Differentiability", "Application of Derivatives", "Integrals", "Application of Integrals",
    "Differential Equations", "Vector Algebra", "Three Dimensional Geometry", "Linear Programming", "Probability"],
  "12|Mathematics|Hindi": ["संबंध एवं फलन", "प्रतिलोम त्रिकोणमितीय फलन", "आव्यूह", "सारणिक", "सांतत्य तथा अवकलनीयता",
    "अवकलज के अनुप्रयोग", "समाकलन", "समाकलनों के अनुप्रयोग", "अवकल समीकरण", "सदिश बीजगणित", "त्रि-विमीय ज्यामिति",
    "रैखिक प्रोग्रामन", "प्रायिकता"],
  "10|Mathematics|Hindi": ["वास्तविक संख्याएँ", "बहुपद", "दो चर वाले रैखिक समीकरण युग्म", "द्विघात समीकरण", "समांतर श्रेढ़ियाँ", "त्रिभुज",
    "निर्देशांक ज्यामिति", "त्रिकोणमिति का परिचय", "त्रिकोणमिति के कुछ अनुप्रयोग", "वृत्त", "वृत्तों से संबंधित क्षेत्रफल",
    "पृष्ठीय क्षेत्रफल और आयतन", "सांख्यिकी", "प्रायिकता"],
  "10|Mathematics|English": ["Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations",
    "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry",
    "Some Applications of Trigonometry", "Circles", "Areas Related to Circles", "Surface Areas and Volumes",
    "Statistics", "Probability"]
};
const FULL = "Full Syllabus Test";
const YOUTUBE_URL = "https://www.youtube.com/@jrpedu2026";
// Paid books. The PDF is stored encrypted; its key is released by the database only after the teacher approves payment.
const UPI_ID = "";            // set to the coaching UPI ID (e.g. "9876543210@ybl") to enable UPI payment
const UPI_NAME = "JRP Education";
const BOOKS = [
  // Demo book at ₹9. Add more books below with their own price.
  { id: "formula-10-hindi", title: "JRP Maths Concepts", sub: "Demo Book · Class 10 · Hindi Edition", price: 9, pages: 58, demo: true,
    file: "books/formula-10-hindi.bin", cover: "books/formula-10-hindi-cover.jpg",
    points: ["सभी 14 अध्याय", "सूत्र-सारांश और हल सहित उदाहरण", "मॉडल पेपर और 7 दिन की योजना"] }
];
const ytCard = () => `<a class="yt" href="${YOUTUBE_URL}" target="_blank" rel="noopener">
  <span class="yt-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 8.5v7l6-3.5z"/></svg></span>
  <span class="yt-t"><b>JRP Education on YouTube</b><small>Watch video lessons · @jrpedu2026</small></span><span class="yt-go">Open</span></a>`;
const MARK_RIGHT = 4, MARK_WRONG = 1, CHAPTER_Q = 10, FULL_Q = 25;
const L = "ABCD";

const S = { user: null, profile: null, admin: false, myResults: null, syllabus: {} };
const $app = document.getElementById("app");
const $nav = document.getElementById("nav");
const $tnav = document.getElementById("tnav");

/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const subjectsFor = c => (c >= 11 ? SUBJECTS_UPPER : SUBJECTS_LOWER);
const sylKey = (c, s, m = "English") => `${c}|${s}|${m}`;
const medOf = x => (x && x.medium) || "English";
const myMed = () => medOf(S.profile);
const sylDocId = (c, s, m = "English") => m === "English" ? `${c}_${s}` : `${c}_${s}_${m}`;
const medOptions = sel => MEDIUMS.map(m => `<option ${m === sel ? "selected" : ""}>${m}</option>`).join("");
const testKey = (c, s, ch) => `${c}|${s}|${ch}`;
const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const initials = n => String(n || "?").trim().split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtDate = ms => ms ? new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
const usernameToEmail = u => u.includes("@") ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@${STUDENT_DOMAIN}`;
let toastT;
function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }
function loading(msg = "Loading…") { $app.innerHTML = `<div class="loading"><div><div class="spin"></div>${esc(msg)}</div></div>`; }
function errText(e) {
  const c = e?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-email")) return "Incorrect username or password.";
  if (c.includes("too-many-requests")) return "Too many attempts. Please wait a few minutes and try again.";
  if (c.includes("network")) return "No internet connection. Please check your network.";
  if (c.includes("email-already-in-use")) return "This username is already taken.";
  if (c.includes("weak-password")) return "Password must be at least 6 characters.";
  if (c.includes("permission-denied")) return "You don't have permission for this action.";
  return e?.message || "Something went wrong. Please try again.";
}
const LOGO = "logo.png";
function header(title, sub, backTo) {
  return `<div class="top"><div class="in">
    ${backTo ? `<button class="back" data-back aria-label="Back">←</button>` : ""}
    <div class="top-mark"><img src="${LOGO}" alt=""></div>
    <div class="tt"><h2>${esc(title)}</h2>${sub ? `<small>${esc(sub)}</small>` : ""}</div>
  </div></div>`;
}

/* ---------- simple router with phone back button support ---------- */
const stack = [];
let current = null;
function go(view, args = {}, opts = {}) {
  if (current && !opts.replace) stack.push(current);
  current = { view, args };
  if (!opts.replace) history.pushState({ d: stack.length }, "");
  render();
}
function back() { if (stack.length) { current = stack.pop(); render(); } }
function resetTo(view, args = {}) { stack.length = 0; current = { view, args }; render(); }
window.addEventListener("popstate", () => {
  if (TEST.running) { history.pushState({}, ""); toast("Submit the test before leaving."); return; }
  back();
});
function render() {
  window.scrollTo(0, 0);
  const v = VIEWS[current.view];
  const tabs = { home: "home", notices: "home", courses: "courses", subjects: "courses", chapters: "courses", notes: "courses", board10: "courses",
    practice: "practice", daily: "practice", tests: "tests", results: "tests", board: "tests", series: "tests", profile: "profile" };
  $nav.hidden = !tabs[current.view];
  $nav.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tabs[current.view] ? "page" : "false"));
  const sec = current.view === "teacher" ? (current.args.sec || "dash") : "";
  $tnav.hidden = !sec;
  $tnav.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", b.dataset.sec === sec ? "page" : "false"));
  v(current.args);
}
$nav.addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) resetTo(b.dataset.tab); });
$tnav.addEventListener("click", e => { const b = e.target.closest("[data-sec]"); if (b) resetTo("teacher", { sec: b.dataset.sec }); });
$app.addEventListener("click", e => { if (e.target.closest("[data-back]")) history.back(); if (e.target.closest("[data-menu]")) openDrawer(); });

/* ----- student side menu (drawer) ----- */
function openDrawer() {
  const p = S.profile; if (!p) return;
  const old = document.getElementById("drawer"); if (old) old.remove();
  const nNew = ALERTS.notices;
  const item = (key, icon, label, end = "") => `<button class="dr-i" data-dr="${key}">${svg(icon)}<span>${label}</span>${end}</button>`;
  const d = document.createElement("div"); d.id = "drawer"; d.className = "drawer";
  d.innerHTML = `<div class="dr-bg" data-dr="close"></div>
    <aside class="dr-panel" role="dialog" aria-label="Menu">
      <div class="dr-head">
        <div class="dr-av">${esc(initials(p.name))}</div>
        <div class="dr-who"><b>${esc(p.name)}</b><span>${esc(p.username || "")}</span><span>Class ${esc(p.cls)} · ${myMed()} medium</span>
          <button class="link" data-dr="profile">View profile</button></div>
      </div>
      <nav class="dr-list">
        ${item("home", "board", "Home")}
        ${item("series", "trophy", "Test Series", `<em class="dr-ok">Active</em>`)}
        ${item("notes", "notes", "Study Notes", `<em class="dr-ok">Active</em>`)}
        ${item("books", "books", "Books", `<em class="dr-new">NEW</em>`)}
        ${item("results", "test", "My Results")}
        ${item("notices", "bell", "Notifications", nNew ? `<em class="dr-new">${nNew}</em>` : "")}
        ${item("doubt", "help", "Doubts", `<em class="dr-ask">Ask a Doubt ${svg("spark")}</em>`)}
        ${item("logout", "logout", "Log out")}
      </nav>
    </aside>`;
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add("open"));
  const close = () => { d.classList.remove("open"); setTimeout(() => d.remove(), 260); };
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-dr]"); if (!b) return;
    const k = b.dataset.dr; close();
    const cls = Number(p.cls);
    if (k === "close") return;
    if (k === "home") resetTo("home");
    else if (k === "series") go("series");
    else if (k === "notes") go("chapters", { cls, subject: "Mathematics" });
    else if (k === "books") go("book", { id: BOOKS[0].id });
    else if (k === "results") go("results");
    else if (k === "notices") go("notices");
    else if (k === "doubt") go("narex");
    else if (k === "profile") resetTo("profile");
    else if (k === "logout") signOut(auth);
  });
}

/* ---------- data ---------- */
const VIDEOS = {};
async function getSyllabus(c, s, m = "English") {
  const k = sylKey(c, s, m);
  if (S.syllabus[k]) return S.syllabus[k];
  let list = DEFAULT_SYLLABUS[k] || [];
  try {
    const d = await getDoc(doc(db, "syllabus", sylDocId(c, s, m)));
    if (d.exists()) { const v = d.data(); if (Array.isArray(v.chapters) && v.chapters.length) list = v.chapters; VIDEOS[k] = v.videos || {}; }
  } catch (e) {}
  S.syllabus[k] = list; return list;
}
const videoFor = (c, s, m, ch) => (VIDEOS[sylKey(c, s, m)] || {})[ch] || "";
async function loadMyResults(force) {
  if (S.myResults && !force) return S.myResults;
  const snap = await getDocs(query(collection(db, "results"), where("uid", "==", S.user.uid)));
  S.myResults = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
  return S.myResults;
}

/* ---------- auth ---------- */
onAuthStateChanged(auth, async user => {
  S.user = user; S.profile = null; S.admin = false; S.myResults = null; stack.length = 0;
  if (!user) { ALERTS.notices = ALERTS.tests = ALERTS.live = 0; updateBadge(); narexModel = null; narexChat = null; narexHist = []; }
  if (!user) { resetTo("login"); return; }
  loading();
  try {
    if (await isTeacherEmail(user.email)) {
      if (!user.emailVerified) { await user.reload(); }
      if (!auth.currentUser.emailVerified) { resetTo("verify"); return; }
      S.admin = true; resetTo("teacher"); return;
    }
    const p = await getDoc(doc(db, "users", user.uid));
    if (p.exists() && p.data().status === "pending") { S.profile = { id: user.uid, ...p.data() }; resetTo("pending"); return; }
    const isGoogle = user.providerData.some(x => x.providerId === "google.com");
    if (!p.exists() && isGoogle) { resetTo("gsetup"); return; }
    if (!p.exists() || p.data().active === false) {
      await signOut(auth);
      LOGIN_MSG = "This account is not active. Please contact JRP Education.";
      return;
    }
    S.profile = { id: user.uid, ...p.data() };
    resetTo("home");
  } catch (e) { LOGIN_MSG = errText(e); await signOut(auth); }
});
let LOGIN_MSG = "";

/* ---------- views ---------- */
const VIEWS = {};

VIEWS.login = () => {
  let role = "s";
  $app.innerHTML = `
  <div class="band"><div class="in"><div class="crest"><img src="${LOGO}" alt="JRP Education logo"></div></div></div>
  <main><div class="in">
    <form class="card lift" id="f" novalidate>
      <div class="seg" role="tablist">
        <button type="button" role="tab" id="segS" aria-selected="true">Student</button>
        <button type="button" role="tab" id="segT" aria-selected="false">Teacher</button>
      </div>
      <h1 id="h" style="font-size:24px">Student login</h1>
      <div class="field"><label for="u" id="ul">Username</label><input id="u" type="text" autocomplete="username" autocapitalize="none" placeholder="e.g. rahul10"></div>
      <div class="field"><label for="p">Password</label><input id="p" type="password" autocomplete="current-password" placeholder="Password"></div>
      <div class="err" id="err" ${LOGIN_MSG ? "" : "hidden"}>${esc(LOGIN_MSG)}</div>
      <button class="btn btn-navy" id="go" type="submit">Log in</button>
      <p class="hint" id="hint">New student? Create your free account.</p>
      <button type="button" class="btn btn-gold" id="signup">Create student account</button>
    </form>
    ${mockCard()}
    ${ytCard()}
  </div></main>`;
  LOGIN_MSG = "";
  const set = r => {
    role = r;
    segS.setAttribute("aria-selected", r === "s"); segT.setAttribute("aria-selected", r === "t");
    h.textContent = r === "s" ? "Student login" : "Teacher login";
    ul.textContent = r === "s" ? "Username" : "Email";
    u.placeholder = r === "s" ? "e.g. rahul10" : "Teacher email";
    u.type = r === "s" ? "text" : "email";
    hint.textContent = r === "s" ? "New student? Create your free account." : "For JRP Education staff only.";
    signup.hidden = r !== "s";
    $app.querySelectorAll("[data-mock]").forEach(x => x.hidden = r !== "s");
  };
  const { segS, segT, h, ul, u, p, hint, err, f, signup } = Object.fromEntries([...$app.querySelectorAll("[id]")].map(x => [x.id, x]));
  segS.onclick = () => set("s"); segT.onclick = () => set("t");
  signup.onclick = () => go("signup");
  wireMock();
  f.onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    if (!u.value.trim() || !p.value) { err.textContent = "Enter your username and password."; err.hidden = false; return; }
    const btn = document.getElementById("go"); btn.disabled = true; btn.textContent = "Logging in…";
    try { await signInWithEmailAndPassword(auth, usernameToEmail(u.value), p.value); }
    catch (x) { err.textContent = errText(x); err.hidden = false; btn.disabled = false; btn.textContent = "Log in"; }
  };
};

/* ----- Google sign-in for students ----- */
async function googleSignIn(err, btn) {
  err.hidden = true; btn.disabled = true;
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, provider); }
  catch (x) {
    const c = x && x.code || "";
    if (c.includes("popup-blocked") || c.includes("operation-not-supported")) { try { await signInWithRedirect(auth, provider); return; } catch (y) { x = y; } }
    btn.disabled = false;
    if (c.includes("popup-closed") || c.includes("cancelled-popup")) return;
    err.textContent = c.includes("unauthorized-domain") || c.includes("operation-not-allowed") ? "Google sign-in is not switched on yet. Please tell your teacher." : errText(x);
    err.hidden = false;
  }
}
getRedirectResult(auth).catch(() => {});

VIEWS.gsetup = () => {
  const u = S.user;
  $app.innerHTML = header("Complete your profile", u.email, false) + `
  <main><div class="in">
    <form class="card" id="f" novalidate>
      <h2 style="font-size:20px">Welcome to JRP Education!</h2>
      <p class="hint">One last step. Tell us your class and details.</p>
      <div class="field"><label for="a1">Full name</label><input id="a1" type="text" autocomplete="name" value="${esc(u.displayName || "")}"></div>
      <div class="two"><div class="field"><label for="a2">Class</label><select id="a2">${classOptions(10)}</select></div>
      <div class="field"><label for="a3">Medium</label><select id="a3">${medOptions("English")}</select></div></div>
      <div class="field"><label for="a4">Mobile</label><input id="a4" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number"></div>
      <div class="field"><label for="a5">Father's name</label><input id="a5" type="text"></div>
      <div class="field"><label for="a6">School (optional)</label><input id="a6" type="text"></div>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" type="submit" id="go">Start learning</button>
      <button class="btn btn-line" type="button" id="out">Use a different Gmail</button>
    </form>
  </div></main>`;
  const $ = id => document.getElementById(id);
  $("out").onclick = () => signOut(auth);
  $("f").onsubmit = async e => {
    e.preventDefault(); const err = $("err"); err.hidden = true;
    const fail = m => { err.textContent = m; err.hidden = false; };
    const name = $("a1").value.trim(), mobile = $("a4").value.trim();
    if (!name) return fail("Enter your name.");
    if (!/^\d{10}$/.test(mobile)) return fail("Enter a 10-digit mobile number.");
    $("go").disabled = true;
    const prof = { name, cls: Number($("a2").value), medium: $("a3").value, mobile, father: $("a5").value.trim(), school: $("a6").value.trim(),
      username: (u.email || "").split("@")[0], email: u.email || "", provider: "google", role: "student", active: true, status: "approved", selfSignup: true, createdAt: serverTimestamp() };
    try { await setDoc(doc(db, "users", u.uid), prof); S.profile = { id: u.uid, ...prof }; resetTo("home"); }
    catch (x) { fail(errText(x)); $("go").disabled = false; }
  };
};

VIEWS.signup = () => {
  $app.innerHTML = header("Create account", "JRP Education", true) + `
  <main><div class="in">
    <form class="card" id="f" novalidate>
      <h2 style="font-size:20px">Student details</h2>
      <div class="field"><label for="a1">Full name</label><input id="a1" type="text" autocomplete="name" placeholder="Your name"></div>
      <div class="two"><div class="field"><label for="a2">Class</label><select id="a2">${classOptions(10)}</select></div>
      <div class="field"><label for="a3">Medium</label><select id="a3">${medOptions("English")}</select></div></div>
      <div class="field"><label for="a4">Mobile</label><input id="a4" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number"></div>
      <div class="field"><label for="a5">Father's name</label><input id="a5" type="text"></div>
      <div class="field"><label for="a6">School (optional)</label><input id="a6" type="text"></div>
      <h2 style="font-size:20px;margin-top:6px">Login details</h2>
      <div class="field"><label for="a7">Username</label><input id="a7" type="text" autocapitalize="none" autocomplete="username" placeholder="Letters and numbers, e.g. rahul10"></div>
      <div class="two"><div class="field"><label for="a8">Password</label><input id="a8" type="password" autocomplete="new-password" placeholder="Min 6 characters"></div>
      <div class="field"><label for="a9">Confirm</label><input id="a9" type="password" autocomplete="new-password"></div></div>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" type="submit" id="go">Create account</button>
      <p class="hint">Your account is ready as soon as you create it.</p>
    </form>
  </div></main>`;
  const $ = id => document.getElementById(id);
  $("a1").oninput = () => { if (!$("a7").dataset.t) $("a7").value = slug($("a1").value.split(" ")[0] || "") + $("a2").value; };
  $("a7").oninput = () => $("a7").dataset.t = "1";
  $("f").onsubmit = async e => {
    e.preventDefault(); const err = $("err"); err.hidden = true;
    const fail = m => { err.textContent = m; err.hidden = false; };
    const name = $("a1").value.trim(), cls = Number($("a2").value), medium = $("a3").value, mobile = $("a4").value.trim();
    const username = slug($("a7").value), password = $("a8").value;
    if (!name) return fail("Enter your name.");
    if (!/^\d{10}$/.test(mobile)) return fail("Enter a 10-digit mobile number.");
    if (username.length < 3) return fail("Username needs at least 3 letters or numbers.");
    if (password.length < 6) return fail("Password must be at least 6 characters.");
    if (password !== $("a9").value) return fail("Passwords do not match.");
    $("go").disabled = true; $("go").textContent = "Creating…";
    try {
      const c = await createUserWithEmailAndPassword(auth2, usernameToEmail(username), password);
      const uid = c.user.uid;
      await setDoc(doc(db2, "users", uid), { name, cls, medium, mobile, father: $("a5").value.trim(), school: $("a6").value.trim(), username,
        role: "student", active: true, status: "approved", selfSignup: true, createdAt: serverTimestamp() });
      await setDoc(doc(db2, "secrets", uid), { username, password });
      await signOut(auth2);
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    } catch (x) { fail(errText(x)); $("go").disabled = false; $("go").textContent = "Create account"; try { await signOut(auth2); } catch (e) {} }
  };
};

VIEWS.pending = () => {
  const p = S.profile;
  $app.innerHTML = header("Account pending", "JRP Education") + `
  <main><div class="in">
    <div class="card">
      <h2 style="font-size:21px">Waiting for approval</h2>
      <p>Thank you, ${esc(p.name)}. Your account (<b>${esc(p.username)}</b>) has been sent to JRP Education. You can start taking tests once your teacher approves it.</p>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" id="chk">Check again</button>
      <button class="btn btn-line" id="out">Log out</button>
    </div>
  </div></main>`;
  document.getElementById("out").onclick = () => signOut(auth);
  document.getElementById("chk").onclick = async () => {
    const d = await getDoc(doc(db, "users", S.user.uid)).catch(() => null);
    const v = d && d.exists() ? d.data() : null;
    if (v && v.active !== false && v.status !== "pending") { S.profile = { id: S.user.uid, ...v }; resetTo("home"); }
    else if (v && v.status === "rejected") { LOGIN_MSG = "Your account request was not approved. Please contact JRP Education."; signOut(auth); }
    else { const e = document.getElementById("err"); e.textContent = "Not approved yet. Please check again later."; e.hidden = false; }
  };
};

VIEWS.verify = () => {
  $app.innerHTML = header("Verify email", "Teacher account") + `
  <main><div class="in">
    <div class="card">
      <h2 style="font-size:20px">Check your inbox</h2>
      <p>A verification link was sent to the teacher email. Open Gmail, tap the link, then come back and tap <b>I have verified</b>. Check the Spam folder if it is not in the inbox.</p>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" id="ok">I have verified</button>
      <div class="row"><button class="btn btn-line" id="re">Resend link</button><button class="btn btn-line" id="out">Log out</button></div>
    </div>
  </div></main>`;
  ok.onclick = async () => { await auth.currentUser.reload(); if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); S.admin = true; resetTo("teacher"); } else { err.textContent = "Not verified yet. Tap the link in the email first."; err.hidden = false; } };
  re.onclick = async () => { try { await sendEmailVerification(auth.currentUser); toast("Verification link sent"); } catch (x) { toast(errText(x)); } };
  out.onclick = () => signOut(auth);
};

/* ----- student: home ----- */
/* icons for tiles and quick actions */
const ICON = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  board: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  notes: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  test: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12l2 2 4-4M9 17h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  books: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16 5l3.5-1 3 15-3.5 1z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  megaphone: '<path d="M3 10v4h4l7 5V5L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  rupee: '<path d="M6 4h12M6 9h12M9 4c4 0 6 2 6 5s-2 5-6 5H6l8 7"/>',
  spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>'
};
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
function appbar(right = "") {
  const menu = S.profile && !S.admin ? `<button class="ab-menu" data-menu aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>` : "";
  return `<header class="appbar"><div class="in">${menu}<img src="${LOGO}" alt="" class="ab-logo"><div class="ab-t"><b>JRP EDUCATION</b><small>Think · Learn · Grow · Succeed</small></div>${right}</div></header>`;
}
function ring(pct, size = 76) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" class="ring-t">${pct}%</text></svg>`;
}
// courses shown as tiles; each opens the chapter list of a subject for the student's class
function courseList(cls) {
  return [
    { id: "maths", title: cls <= 10 ? "Foundation Maths" : "Mathematics", sub: `Class ${cls} · NCERT`, icon: "book", tone: "t-blue", subject: "Mathematics" },
    { id: "board", title: "RBSE Board", sub: "Notes & Questions", icon: "board", tone: "t-purple", view: "board10" }
  ];
}
function courseTiles(box, cls) {
  courseList(cls).forEach(c => {
    const b = document.createElement("button"); b.className = "tile " + c.tone;
    b.innerHTML = `<span class="ti">${svg(c.icon)}</span><b>${esc(c.title)}</b><small>${esc(c.sub)}</small>${c.soon ? `<span class="soon-chip">Coming soon</span>` : ""}`;
    b.onclick = async () => {
      if (c.soon) return toast(`${c.title} is coming soon.`);
      if (c.view) return go(c.view, { cls });
      const chs = await getSyllabus(cls, c.subject, myMed());
      chs.length ? go("chapters", { cls, subject: c.subject }) : toast(`${c.title} will be added soon.`);
    };
    box.appendChild(b);
  });
}
async function learningProgress(cls) {
  const [chs, mine] = await Promise.all([getSyllabus(cls, "Mathematics", myMed()), loadMyResults().catch(() => [])]);
  const done = chs.filter(ch => mine.some(r => r.testKey === testKey(cls, "Mathematics", ch))).length;
  return { done, total: chs.length, pct: chs.length ? Math.round(done / chs.length * 100) : 0 };
}

/* ----- Weekly Topper: best average % in a class (and medium) for a Monday–Sunday week ----- */
function weekStart(offsetWeeks = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  return d.getTime();
}
function topperOf(rs, from, to) {
  const by = {};
  rs.filter(r => r.atMs >= from && r.atMs < to && !(r.endMs && r.endMs > Date.now())).forEach(r => {
    const u = by[r.uid] || (by[r.uid] = { uid: r.uid, name: r.name, n: 0, sum: 0, score: 0 });
    u.n++; u.sum += Math.max(0, r.score) / r.max; u.score += Math.max(0, r.score);
  });
  const list = Object.values(by).map(u => ({ ...u, pct: Math.round(u.sum / u.n * 100) }))
    .sort((a, b) => b.pct - a.pct || b.n - a.n || b.score - a.score);
  return list[0] || null;
}
async function weeklyToppers(cls, med) {
  const snap = await getDocs(query(collection(db, "results"), where("studentCls", "==", Number(cls))));
  const rs = snap.docs.map(d => d.data()).filter(r => !med || (r.studentMedium || "English") === med);
  const thisW = weekStart(0), lastW = weekStart(-1);
  return { last: topperOf(rs, lastW, thisW), now: topperOf(rs, thisW, thisW + 7 * 864e5) };
}
async function fillTopper(box) {
  const p = S.profile; if (!box || !p) return;
  let t; try { t = await weeklyToppers(p.cls, myMed()); } catch (e) { return; }
  const top = t.last || t.now; if (!top || !box.isConnected) return;
  const me = top.uid === S.user.uid, live = !t.last;
  box.innerHTML = `<div class="topper${me ? " me" : ""}">
    <div class="tp-medal">${svg("trophy")}</div>
    <div class="tp-t"><small>Congratulations 🎉</small>
      <b>${esc(top.name)}</b>
      <span>${live ? "Leading this week" : "Weekly Topper"} · Class ${esc(p.cls)} · ${top.pct}% avg · ${top.n} test${top.n > 1 ? "s" : ""}</span>
      ${me ? `<em>${live ? "You are on top this week. Keep going!" : "You are last week's topper!"}</em>` : ""}</div>
    <span class="tp-conf" aria-hidden="true"></span></div>`;
  box.hidden = false;
}

VIEWS.home = () => {
  const p = S.profile, cls = Number(p.cls), first = (p.name || "").split(" ")[0];
  $app.innerHTML = appbar(`<button class="ab-bell" id="bell" aria-label="Notices">${svg("bell")}<i id="bdot" hidden></i></button>`) + `
  <main><div class="in">
    <div id="topper" hidden></div>
    <button class="promo" id="promo" data-book="${BOOKS[0].id}">
      <img src="${BOOKS[0].cover}" alt="" class="pm-cover">
      <span class="pm-t"><span class="pm-tag">${BOOKS[0].demo ? "Demo Book · Try at ₹9" : "New · Formula Book"}</span><b>${esc(BOOKS[0].title)}</b><small>${esc(BOOKS[0].sub)}</small>
        <span class="pm-row"><span class="pm-price">₹${BOOKS[0].price}</span><span class="pm-cta" id="pmCta">Unlock now →</span></span></span>
    </button>
    <div class="welcome"><div class="wl-av">${esc(initials(p.name))}</div><div class="wl-t"><small>Welcome back!</small><h1>${esc(first)}</h1><p>Class ${cls} · ${myMed()} medium · Keep learning, keep growing!</p></div></div>
    <button class="progress card" id="prog"><span class="pr-ring">${ring(0)}</span><span class="pr-t"><small>Your learning progress</small><b id="prN">–/–</b><span>Maths chapters completed</span></span><span class="link">View details →</span></button>
    <button class="banner live" id="liveAlert" hidden></button>
    <div class="list" id="notices" hidden></div>
    <div class="sec-h"><h2>My Courses</h2><button class="link" id="allC">View all →</button></div>
    <div class="tiles" id="tiles"></div>
    <div class="quick">
      <button data-q="notes"><span class="qi q-orange">${svg("notes")}</span>Notes</button>
      <button data-q="tests"><span class="qi q-green">${svg("test")}</span>Tests</button>
      <button data-q="doubt"><span class="qi q-blue">${svg("help")}</span>Doubt Support</button>
      <button data-q="books"><span class="qi q-red">${svg("books")}</span>Books</button>
    </div>
    <button class="banner challenge" id="daily"><span class="ic">${svg("target")}</span><div style="flex:1;min-width:0"><h3>Daily Maths Challenge</h3><p id="dailyT">Solve a new question every day!</p></div><span class="go">→</span></button>
    <div class="sec-h"><h2>Test Series</h2><button class="link" id="allT">View all →</button></div>
    <div class="chs" id="series"></div>
    <div class="sec-h" id="booksH"><h2>Books</h2><span>Study material</span></div>
    <div class="list" id="books"></div>
    ${ytCard()}
  </div></main>`;
  const $ = id => document.getElementById(id);
  courseTiles($("tiles"), cls);
  fillTopper($("topper"));
  $("promo").onclick = () => go("book", { id: BOOKS[0].id });
  myPurchase(BOOKS[0]).then(pur => {
    const c = $("pmCta"); if (!c || !pur) return;
    if (pur.status === "approved") { c.textContent = "Read now →"; $("promo").onclick = () => go("reader", { id: BOOKS[0].id }); }
    else if (pur.status === "pending") c.textContent = "Payment under review";
  });
  $("allC").onclick = () => resetTo("courses");
  $("allT").onclick = () => go("series");
  $("bell").onclick = () => go("notices");
  $("daily").onclick = () => go("daily");
  $("prog").onclick = () => go("chapters", { cls, subject: "Mathematics" });
  $app.querySelector('[data-q="notes"]').onclick = () => go("chapters", { cls, subject: "Mathematics" });
  $app.querySelector('[data-q="tests"]').onclick = () => resetTo("tests");
  $app.querySelector('[data-q="doubt"]').onclick = () => go("narex");
  $app.querySelector('[data-q="books"]').onclick = () => $("booksH").scrollIntoView({ behavior: "smooth" });
  if (dailyState().done) $("dailyT").textContent = `Done for today · ${dailyStreak()} day streak`;
  learningProgress(cls).then(pr => { const e = $("prN"); if (!e) return; e.textContent = `${pr.done}/${pr.total}`; $app.querySelector(".pr-ring").innerHTML = ring(pr.pct); });
  fillBooks($("books"));
  fillSeries($("series"), false);
  fillNotices($("notices"), false).then(() => { const d = $("bdot"); if (d) d.hidden = !ALERTS.notices; });
};

VIEWS.courses = () => {
  const cls = Number(S.profile.cls);
  $app.innerHTML = appbar() + `<main><div class="in">
    <div class="sec-h"><h2>My Courses</h2><span>Class ${cls} · ${myMed()}</span></div>
    <div class="tiles" id="tiles"></div>
    ${mockCard()}
    <div class="sec-h"><h2>Maths for all classes</h2><span>6th to 12th</span></div>
    <div class="classes" id="cg"></div>
  </div></main>`;
  courseTiles(document.getElementById("tiles"), cls);
  wireMock();
  const cg = document.getElementById("cg");
  CLASSES.forEach(n => {
    const b = document.createElement("button");
    b.className = "cls" + (n === 10 || n === 12 ? " board" : "") + (cls === n ? " mine" : "");
    b.innerHTML = `<b>${n}<sup>th</sup></b><span>${cls === n ? "Your class" : (n === 10 || n === 12 ? "Board" : "Class")}</span>`;
    b.onclick = () => go("chapters", { cls: n, subject: "Mathematics" });
    cg.appendChild(b);
  });
};

VIEWS.board10 = ({ cls }) => {
  $app.innerHTML = header("RBSE Board", `Class ${cls} · Notes & Questions`, true) + `<main><div class="in">
    <div class="full"><h3>Full Syllabus Test</h3><p>A mixed paper from all Maths chapters in board exam format.</p>
      <div class="meta"><span>${FULL_Q} questions</span><span>+${MARK_RIGHT} / −${MARK_WRONG}</span></div>
      <button class="btn btn-gold" id="full" style="align-self:flex-start">Start test</button></div>
    ${ncertBookUrls(cls, "Mathematics", myMed()).map((u, i, a) => `<a class="yt ncert" href="${u}" target="_blank" rel="noopener"><span class="yt-ic nb">N</span><span class="yt-t"><b>NCERT Maths Book${a.length > 1 ? " · Part " + (i + 1) : ""}</b><small>Official textbook · ${myMed()} medium</small></span><span class="yt-go">Open</span></a>`).join("")}
    <button class="banner" id="chap"><div class="ic">∑</div><div><h3>Chapter-wise tests & notes</h3><p>Practise every chapter of the board syllabus.</p></div></button>
    <div class="sec-h"><h2>Test Series</h2></div><div class="chs" id="series"></div>
    <div class="sec-h"><h2>Books</h2></div><div class="list" id="books"></div>
  </div></main>`;
  document.getElementById("full").onclick = () => go("test", { cls, subject: "Mathematics", chapter: FULL });
  document.getElementById("chap").onclick = () => go("chapters", { cls, subject: "Mathematics" });
  fillSeries(document.getElementById("series"), false);
  fillBooks(document.getElementById("books"));
};

/* ----- Daily Maths Challenge: one question a day, same for the whole class ----- */
const today = () => new Date().toLocaleDateString("en-CA");
const dKey = k => `jrp-daily-${k}-${S.user.uid}`;
function dailyState() { try { return JSON.parse(localStorage.getItem(dKey(today()))) || {}; } catch (e) { return {}; } }
function dailyStreak() {
  let n = 0; const d = new Date();
  for (;;) { let st = {}; try { st = JSON.parse(localStorage.getItem(dKey(d.toLocaleDateString("en-CA")))) || {}; } catch (e) {} if (!st.done) break; n++; d.setDate(d.getDate() - 1); }
  return n;
}
VIEWS.daily = async () => {
  const cls = Number(S.profile.cls), med = myMed();
  $app.innerHTML = header("Daily Maths Challenge", today(), true) + `<main><div class="in" id="in"><div class="spin"></div></div></main>`;
  const box = document.getElementById("in");
  let q = null;
  const cacheK = dKey("q-" + today());
  try { q = JSON.parse(localStorage.getItem(cacheK)); } catch (e) {}
  if (!q) {
    let pool = [];
    try { pool = (await getDocs(query(collection(db, "questions"), where("cls", "==", cls), where("subject", "==", "Mathematics"), limit(30)))).docs.map(d => ({ id: d.id, ...d.data() })).filter(x => medOf(x) === med); } catch (e) {}
    if (!pool.length) pool = MOCK[med].map((x, i) => ({ id: "mock" + i, ...x }));
    const seed = [...today()].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    q = pool[seed % pool.length];
    try { localStorage.setItem(cacheK, JSON.stringify(q)); } catch (e) {}
  }
  const st = dailyState();
  const draw = () => {
    const s2 = dailyState(), answered = s2.done;
    box.innerHTML = `<div class="card"><div class="qtag">${esc(q.chapter || "Mathematics")}</div><p class="qtext">${esc(q.q)}</p><div class="opts" id="op"></div>
      ${answered ? `<div class="${s2.right ? "ok-msg" : "err"}" style="font-size:16px"><b>${s2.right ? "Correct! Well done." : "Not quite."}</b> Correct answer: ${L[q.ans]}) ${esc(q.opts[q.ans])}</div>${q.sol ? `<p class="rv-ex">${esc(q.sol)}</p>` : ""}` : `<p class="hint">Choose one answer. You get one try per day.</p>`}
      <div class="stats three"><div><b>${dailyStreak()}</b><span>Day streak</span></div><div><b>${answered ? (s2.right ? "✓" : "✗") : "–"}</b><span>Today</span></div><div><b>${new Date().getDate()}</b><span>${new Date().toLocaleDateString("en-IN", { month: "short" })}</span></div></div></div>
      <p class="hint" style="text-align:center">A new question appears every day at midnight.</p>`;
    const op = document.getElementById("op");
    q.opts.forEach((t, i) => {
      const b = document.createElement("button"); b.className = "opt";
      if (answered) { b.disabled = true; if (i === q.ans) b.classList.add("right"); else if (i === s2.pick) b.classList.add("wrong"); }
      b.innerHTML = `<span class="bub">${L[i]}</span><span></span>`; b.lastChild.textContent = t;
      b.onclick = () => { try { localStorage.setItem(dKey(today()), JSON.stringify({ done: true, pick: i, right: i === q.ans })); } catch (e) {} draw(); };
      op.appendChild(b);
    });
  };
  draw();
};

/* ----- Practice tab ----- */
VIEWS.practice = async () => {
  const cls = Number(S.profile.cls), st = dailyState();
  $app.innerHTML = appbar() + `<main><div class="in">
    <div class="sec-h"><h2>Practice</h2><span>Class ${cls}</span></div>
    <button class="banner challenge" id="daily"><span class="ic">${svg("target")}</span><div style="flex:1;min-width:0"><h3>Daily Maths Challenge</h3><p>${st.done ? `Done for today · ${dailyStreak()} day streak` : "Solve today's question"}</p></div><span class="go">→</span></button>
    <button class="pcard" id="mist"><span class="qi q-red">${svg("target")}</span><span class="pc-t"><b>Practise my mistakes</b><small id="mN">Questions you got wrong in tests</small></span><span class="go">→</span></button>
    <button class="pcard" id="quick"><span class="qi q-green">${svg("bolt")}</span><span class="pc-t"><b>Quick practice</b><small>10 random questions from your class</small></span><span class="go">→</span></button>
    <button class="pcard" id="nx"><span class="qi q-blue">${svg("help")}</span><span class="pc-t"><b>Ask NareX</b><small>Stuck on a question? Ask with a photo</small></span><span class="go">→</span></button>
    ${mockCard()}
  </div></main>`;
  const $ = id => document.getElementById(id);
  $("daily").onclick = () => go("daily");
  $("nx").onclick = () => go("narex");
  wireMock();
  const mine = await loadMyResults().catch(() => []);
  const wrong = [...new Set(mine.flatMap(r => r.wrongIds || []))];
  if ($("mN")) $("mN").textContent = wrong.length ? `${wrong.length} questions to revise` : "No mistakes saved yet. Take a chapter test first.";
  $("mist").onclick = () => wrong.length ? go("ptest", { mode: "mistakes" }) : toast("Take a chapter test first.");
  $("quick").onclick = () => go("ptest", { mode: "quick" });
};
VIEWS.ptest = async ({ mode }) => {
  const cls = Number(S.profile.cls), med = myMed();
  loading("Preparing practice…");
  let qs = [];
  try {
    if (mode === "mistakes") {
      const mine = await loadMyResults();
      const ids = [...new Set(mine.flatMap(r => r.wrongIds || []))].slice(0, 20);
      qs = (await fetchQuestions(ids)).filter(q => q.ans >= 0);
    } else {
      qs = (await getDocs(query(collection(db, "questions"), where("cls", "==", cls), where("subject", "==", "Mathematics"), limit(80)))).docs.map(d => ({ id: d.id, ...d.data() })).filter(q => medOf(q) === med);
      qs = shuffle(qs).slice(0, 10);
    }
  } catch (e) {}
  if (!qs.length) { $app.innerHTML = header("Practice", "", true) + `<main><div class="in"><div class="empty"><h3>No questions yet</h3><p>Questions for your class will appear here once your teacher adds them.</p></div></div></main>`; return; }
  const t0 = Date.now(), title = mode === "mistakes" ? "Practise my mistakes" : "Quick practice";
  runTest({ qs, startMs: t0, deadlineMs: t0 + Math.ceil(qs.length * 1.5) * 60000, tag: q => q.chapter || "Mathematics",
    onFinish: ({ ans, timeSec, auto }) => showResult({ rec: { subject: "Mathematics", cls, chapter: title, ...scoreOf(qs, ans), timeSec }, qs, ans, auto, saved: true }) });
};

/* ----- Tests tab ----- */
VIEWS.tests = async () => {
  const cls = Number(S.profile.cls);
  $app.innerHTML = appbar() + `<main><div class="in">
    <div class="stats three" id="ts"><div><b>–</b><span>Tests taken</span></div><div><b>–</b><span>Average</span></div><div><b>–</b><span>Best</span></div></div>
    <div class="row"><button class="btn btn-navy" id="res">My results</button><button class="btn btn-gold" id="rank">Leaderboard</button></div>
    <div class="sec-h"><h2>Test Series</h2><button class="link" id="allT">View all →</button></div>
    <div class="chs" id="series"></div>
    <div class="full"><h3>Full Syllabus Test</h3><p>Class ${cls} Maths · board exam format.</p>
      <div class="meta"><span>${FULL_Q} questions</span><span>+${MARK_RIGHT} / −${MARK_WRONG}</span></div>
      <button class="btn btn-gold" id="full" style="align-self:flex-start">Start test</button></div>
    <button class="banner" id="chap"><div class="ic">∑</div><div><h3>Chapter-wise tests</h3><p>Pick a chapter and test yourself.</p></div></button>
    ${mockCard()}
  </div></main>`;
  const $ = id => document.getElementById(id);
  $("res").onclick = () => go("results"); $("rank").onclick = () => go("board"); $("allT").onclick = () => go("series");
  $("full").onclick = () => go("test", { cls, subject: "Mathematics", chapter: FULL });
  $("chap").onclick = () => go("chapters", { cls, subject: "Mathematics" });
  wireMock();
  fillSeries($("series"), false);
  const rs = (await loadMyResults().catch(() => [])).filter(r => !(r.endMs && r.endMs > Date.now()));
  if ($("ts") && rs.length) {
    const avg = Math.round(rs.reduce((a, r) => a + Math.max(0, r.score) / r.max, 0) / rs.length * 100);
    const best = Math.max(...rs.map(r => Math.round(Math.max(0, r.score) / r.max * 100)));
    $("ts").innerHTML = `<div><b>${rs.length}</b><span>Tests taken</span></div><div><b>${avg}%</b><span>Average</span></div><div><b>${best}%</b><span>Best</span></div>`;
  }
};

VIEWS.subjects = async ({ cls }) => {
  $app.innerHTML = header(`Class ${cls}`, "Select subject", true) + `<main><div class="in"><div class="subjects" id="sg"></div></div></main>`;
  const sg = document.getElementById("sg");
  const subs = subjectsFor(cls);
  const lists = await Promise.all(subs.map(s => getSyllabus(cls, s, myMed())));
  subs.forEach((s, i) => {
    const n = lists[i].length;
    const b = document.createElement("button");
    const soon = !n || s === "Vedic Maths" || s === "Olympiad Maths";
    b.className = "sub" + (soon ? "" : " on");
    b.innerHTML = `<div class="glyph">${esc(GLYPH[s] || s[0])}</div><h3>${esc(s)}</h3>` + (soon ? `<span class="soon">Coming soon</span>` : `<span>${n} chapters</span>`);
    b.onclick = () => soon ? toast(`${s} is coming soon.`) : go("chapters", { cls, subject: s });
    sg.appendChild(b);
  });
};

VIEWS.chapters = async ({ cls, subject }) => {
  $app.innerHTML = header(subject, `Class ${cls} · Chapter-wise`, true) + `<main><div class="in" id="in"><div class="loading" style="min-height:30vh"><div class="spin"></div></div></div></main>`;
  const [chs, mine] = await Promise.all([getSyllabus(cls, subject, myMed()), loadMyResults().catch(() => [])]);
  const best = {};
  mine.forEach(r => { if (!best[r.testKey] || r.score > best[r.testKey].score) best[r.testKey] = r; });
  const fb = best[testKey(cls, subject, FULL)];
  const box = document.getElementById("in");
  box.innerHTML = `
    <div class="full">
      <h3>Full Syllabus Test</h3>
      <p>A mixed paper from all chapters in board exam format.</p>
      <div class="meta"><span>${FULL_Q} questions</span><span>+${MARK_RIGHT} / −${MARK_WRONG}</span>${fb ? `<span>Best: ${fb.score}/${fb.max}</span>` : ""}</div>
      <button class="btn btn-gold" id="full" style="align-self:flex-start">Start test</button>
    </div>
    ${ncertBookUrls(cls, subject, myMed()).map((u, i, a) => `<a class="yt ncert" href="${u}" target="_blank" rel="noopener"><span class="yt-ic nb">N</span><span class="yt-t"><b>NCERT ${subject} Book${a.length > 1 ? " · Part " + (i + 1) : ""}</b><small>Official textbook · Class ${cls} · ${myMed()} medium</small></span><span class="yt-go">Open</span></a>`).join("")}
    <div class="sec-h"><h2>Chapters</h2><span>${chs.length}</span></div>
    <div class="chs" id="chs"></div>`;
  document.getElementById("full").onclick = () => go("test", { cls, subject, chapter: FULL });
  const list = document.getElementById("chs");
  chs.forEach((c, i) => {
    const r = best[testKey(cls, subject, c)];
    const d = document.createElement("div"); d.className = "ch";
    d.innerHTML = `<div class="ch-top"><div class="ch-n">${i + 1}</div><div class="ch-t"><h3>${esc(c)}</h3>
      <span class="${r ? "done" : ""}">${r ? `Best score: ${r.score}/${r.max}` : `${CHAPTER_Q} questions · Not attempted`}</span></div></div>
      <div class="ch-b"><button class="btn btn-gold" data-a="t">Take test</button><button class="btn btn-line" data-a="n">Notes</button>${videoFor(cls, subject, myMed(), c) ? `<a class="btn btn-line vid" href="${esc(videoFor(cls, subject, myMed(), c))}" target="_blank" rel="noopener">Video</a>` : ""}${ncertChapterUrl(cls, subject, myMed(), c) ? `<a class="btn btn-line" href="${ncertChapterUrl(cls, subject, myMed(), c)}" target="_blank" rel="noopener">NCERT</a>` : ""}</div>`;
    d.querySelector('[data-a="t"]').onclick = () => go("test", { cls, subject, chapter: c });
    d.querySelector('[data-a="n"]').onclick = () => go("notes", { cls, subject, chapter: c });
    list.appendChild(d);
  });
};

VIEWS.notes = async ({ cls, subject, chapter }) => {
  $app.innerHTML = header(chapter, `Class ${cls} · ${subject} · Notes`, true) + `<main><div class="in" id="in"><div class="loading" style="min-height:30vh"><div class="spin"></div></div></div></main>`;
  let text = "";
  try { const d = await getDoc(doc(db, "notes", `${cls}_${subject}_${chapter}`)); if (d.exists()) text = d.data().text || ""; } catch (e) {}
  document.getElementById("in").innerHTML = text
    ? `<div class="card"><div class="notes">${esc(text)}</div></div>`
    : `<div class="empty"><h3>Notes coming soon</h3><p>Your teacher has not added notes for this chapter yet.</p></div>`;
};

/* ----- student: test ----- */
const TEST = { running: false, timer: null };
VIEWS.test = async ({ cls, subject, chapter }) => {
  loading("Preparing your test…");
  let qs = [];
  try {
    const cons = [where("cls", "==", Number(cls)), where("subject", "==", subject)];
    if (chapter !== FULL) cons.push(where("chapter", "==", chapter));
    const snap = await getDocs(query(collection(db, "questions"), ...cons));
    qs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => medOf(q) === myMed());
  } catch (e) { $app.innerHTML = header(chapter, subject, true) + `<main><div class="in"><div class="err">${esc(errText(e))}</div></div></main>`; return; }
  if (!qs.length) {
    $app.innerHTML = header(chapter, `Class ${cls} · ${subject}`, true) + `<main><div class="in"><div class="empty"><h3>Questions coming soon</h3><p>Your teacher has not added questions for this test yet.</p></div></div></main>`;
    return;
  }
  qs = shuffle(qs).slice(0, chapter === FULL ? FULL_Q : CHAPTER_Q);
  const N = qs.length, LIMIT = Math.ceil(N * 1.5) * 60;
  // intro
  $app.innerHTML = header(chapter, `Class ${cls} · ${subject}`, true) + `
  <main><div class="in">
    <div class="card">
      <div class="qtag">${esc(subject)}</div>
      <h1 style="font-size:24px">${esc(chapter)}</h1>
      <div class="stats three"><div><b>${N}</b><span>Questions</span></div><div><b>${LIMIT / 60}</b><span>Minutes</span></div><div><b>${N * MARK_RIGHT}</b><span>Max marks</span></div></div>
      <ul class="hint" style="margin:0;padding-left:20px;font-size:15px;display:flex;flex-direction:column;gap:4px">
        <li>+${MARK_RIGHT} for a correct answer, −${MARK_WRONG} for a wrong answer, 0 if skipped.</li>
        <li>Tap an option again to clear it.</li>
        <li>The test submits automatically when time runs out.</li>
      </ul>
      <button class="btn btn-navy" id="start">Start test</button>
    </div>
  </div></main>`;
  document.getElementById("start").onclick = () => {
    const t0 = Date.now();
    runTest({
      qs, startMs: t0, deadlineMs: t0 + LIMIT * 1000,
      tag: q => chapter === FULL ? q.chapter : `${subject} · Class ${cls}`,
      onFinish: async ({ ans, timeSec, auto }) => {
        const sc = scoreOf(qs, ans);
        const rec = { uid: S.user.uid, name: S.profile.name, username: S.profile.username, studentCls: Number(S.profile.cls), studentMedium: myMed(),
          cls: Number(cls), subject, chapter, testKey: testKey(cls, subject, chapter), ...sc, timeSec, atMs: Date.now(), at: serverTimestamp(),
          wrongIds: qs.filter((q, i) => ans[i] !== null && ans[i] !== undefined && ans[i] !== q.ans).map(q => q.id).filter(Boolean) };
        loading("Saving your result…");
        let saved = true;
        try { await addDoc(collection(db, "results"), rec); S.myResults = null; } catch (e) { saved = false; }
        showResult({ rec, qs, ans, auto, saved, retake: true });
      }
    });
  };
};

function scoreOf(qs, ans) {
  let correct = 0, wrong = 0, skipped = 0;
  ans.forEach((a, i) => { if (a === null || a === undefined) skipped++; else if (a === qs[i].ans) correct++; else wrong++; });
  return { score: correct * MARK_RIGHT - wrong * MARK_WRONG, max: qs.length * MARK_RIGHT, correct, wrong, skipped, total: qs.length };
}

// generic timed test screen; storeKey keeps answers on this phone so a reopened test resumes
function runTest({ qs, startMs, deadlineMs, tag, onFinish, storeKey }) {
  const N = qs.length;
  let ans = Array(N).fill(null);
  if (storeKey) { try { const s = JSON.parse(localStorage.getItem(storeKey)); if (Array.isArray(s) && s.length === N) ans = s; } catch (e) {} }
  const keep = () => { if (storeKey) try { localStorage.setItem(storeKey, JSON.stringify(ans)); } catch (e) {} };
  let cur = 0;
  TEST.running = true;
  $nav.hidden = true;
  $app.innerHTML = `
  <div class="tbar"><div class="in"><div class="qcount" id="qc"></div><div class="prog"><i id="pf"></i></div><div class="timer" id="tm"></div></div></div>
  <main><div class="in">
    <div class="qtag" id="qt"></div>
    <p class="qtext" id="qx"></p>
    <div class="opts" id="op"></div>
    <div class="row"><button class="btn btn-line" id="pv">← Previous</button><button class="btn btn-navy" id="nx">Next →</button></div>
    <div class="sec-h"><h2 style="font-size:16px">Question palette</h2><span id="cnt"></span></div>
    <div class="palette" id="pl"></div>
    <button class="btn btn-gold" id="sb">Submit test</button>
    <div class="confirm" id="cf" hidden><p id="cft"></p><div class="row"><button class="btn btn-navy" id="yes">Submit</button><button class="btn btn-line" id="no">Continue test</button></div></div>
  </div></main>`;
  const el = id => document.getElementById(id);
  for (let i = 0; i < N; i++) { const b = document.createElement("button"); b.className = "pal"; b.textContent = i + 1; b.onclick = () => { cur = i; draw(); }; el("pl").appendChild(b); }
  function draw() {
    const q = qs[cur];
    el("qc").textContent = `Q ${cur + 1}/${N}`;
    el("qt").textContent = tag(q);
    el("qx").textContent = `${cur + 1}. ${q.q}`;
    const op = el("op"); op.innerHTML = "";
    q.opts.forEach((t, i) => {
      const b = document.createElement("button"); b.className = "opt"; b.setAttribute("aria-pressed", ans[cur] === i);
      b.innerHTML = `<span class="bub">${L[i]}</span><span></span>`; b.lastChild.textContent = t;
      b.onclick = () => { ans[cur] = ans[cur] === i ? null : i; keep(); draw(); };
      op.appendChild(b);
    });
    el("pv").disabled = cur === 0; el("nx").disabled = cur === N - 1;
    const done = ans.filter(a => a !== null).length;
    el("pf").style.width = (done / N * 100) + "%";
    el("cnt").textContent = `${done} of ${N} answered`;
    [...el("pl").children].forEach((b, i) => { b.classList.toggle("done", ans[i] !== null); b.classList.toggle("cur", i === cur); });
    el("cf").hidden = true;
  }
  const tick = () => { const left = Math.floor((deadlineMs - Date.now()) / 1000); el("tm").textContent = fmtTime(left); el("tm").classList.toggle("low", left <= 60); if (left <= 0) finish(true); };
  el("pv").onclick = () => { cur--; draw(); window.scrollTo(0, 0); };
  el("nx").onclick = () => { cur++; draw(); window.scrollTo(0, 0); };
  el("sb").onclick = () => { const l = ans.filter(a => a === null).length; el("cft").textContent = l ? `${l} question${l > 1 ? "s are" : " is"} unanswered. Submit anyway?` : "All questions answered. Submit the test?"; el("cf").hidden = false; el("cf").scrollIntoView({ behavior: "smooth", block: "center" }); };
  el("no").onclick = () => el("cf").hidden = true;
  el("yes").onclick = () => finish(false);
  clearInterval(TEST.timer); TEST.timer = setInterval(tick, 1000); draw(); tick();

  let finished = false;
  function finish(auto) {
    if (finished) return; finished = true;
    clearInterval(TEST.timer); TEST.running = false;
    const timeSec = Math.max(0, Math.floor((Math.min(Date.now(), deadlineMs) - startMs) / 1000));
    onFinish({ ans: ans.slice(), timeSec, auto });
    if (storeKey) try { localStorage.removeItem(storeKey); } catch (e) {}
  }
}

function showResult({ rec, qs, ans, auto, saved, retake, rankText }) {
  $nav.hidden = true;
  const pct = Math.max(0, Math.round(rec.score / rec.max * 100));
  const verdict = pct >= 90 ? "Outstanding performance." : pct >= 70 ? "Good work. Review the questions you missed." : pct >= 40 ? "Fair attempt. Revise this chapter and try again." : "Needs more practice. Read the solutions below carefully.";
  $app.innerHTML = header("Result", `${rec.subject} · Class ${rec.cls}`) + `
  <main><div class="in">
    <div class="card">
      <div class="qtag">${esc(rec.chapter)}</div>
      ${auto ? `<p class="hint">Time was up, so the test was submitted automatically.</p>` : ""}
      <div class="score"><b>${rec.score}</b><span>/ ${rec.max} · ${pct}%</span></div>
      <p style="font-size:17px;font-weight:500">${verdict}</p>
      <div class="stats"><div class="g"><b>${rec.correct}</b><span>Correct</span></div><div class="r"><b>${rec.wrong}</b><span>Wrong</span></div><div><b>${rec.skipped}</b><span>Skipped</span></div><div><b>${fmtTime(rec.timeSec)}</b><span>Time</span></div></div>
      ${saved ? "" : `<div class="err">Your result could not be saved. Check your internet connection.</div>`}
      ${rankText ? `<div class="ok-msg" style="font-size:16px"><b>${esc(rankText)}</b></div>` : ""}
      <div class="row">${retake ? `<button class="btn btn-navy" id="again">Retake test</button>` : ""}<button class="btn btn-line" id="done">Done</button></div>
    </div>
    <h2 style="font-size:20px">Answer review</h2>
    <div class="list" id="rv"></div>
  </div></main>`;
  const rv = document.getElementById("rv");
  qs.forEach((q, i) => {
    const a = ans[i] ?? null, cls = a === null ? "skip" : (a === q.ans ? "ok" : "no");
    const d = document.createElement("div"); d.className = "rv " + cls;
    d.innerHTML = `<div class="rv-h"><span><b>Q${i + 1}</b> · ${esc(q.chapter)}</span><span class="tag">${cls === "ok" ? `Correct +${MARK_RIGHT}` : cls === "no" ? `Wrong −${MARK_WRONG}` : "Skipped"}</span></div>
      <p class="rv-q">${esc(q.q)}</p>
      <p class="rv-a">${a !== null && a !== q.ans ? `<span class="y">Your answer: ${L[a]}) ${esc(q.opts[a])}</span><br>` : ""}<span class="c">Correct answer: ${L[q.ans]}) ${esc(q.opts[q.ans])}</span></p>
      ${q.sol ? `<p class="rv-ex">${esc(q.sol)}</p>` : ""}`;
    rv.appendChild(d);
  });
  if (retake) document.getElementById("again").onclick = () => go("test", { cls: rec.cls, subject: rec.subject, chapter: rec.chapter }, { replace: true });
  document.getElementById("done").onclick = () => { history.back(); };
}

/* ----- "new" alerts: remembered per student on this phone ----- */
const seenKey = k => `jrp-seen-${k}-${S.user?.uid}`;
const getSeen = k => { try { return Number(localStorage.getItem(seenKey(k))) || 0; } catch (e) { return 0; } };
const markSeen = k => { try { localStorage.setItem(seenKey(k), String(Date.now())); } catch (e) {} };
const ALERTS = { notices: 0, tests: 0, live: 0 };
function updateBadge() {
  const n = ALERTS.notices + ALERTS.tests + ALERTS.live;
  try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (e) {}
  const dot = $nav.querySelector('[data-tab="home"]'); if (dot) dot.classList.toggle("dot", n > 0);
}

/* ----- test series (scheduled tests) ----- */
const tStatus = t => { const n = Date.now(); return n < t.startMs ? "up" : n < t.endMs ? "live" : "ended"; };
const fmtDT = ms => new Date(ms).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
async function loadTests(cls) {
  const snap = await getDocs(query(collection(db, "tests"), where("cls", "==", Number(cls))));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !S.profile || medOf(t) === myMed()).sort((a, b) => a.startMs - b.startMs);
}
function seriesItem(t, done, isNew) {
  const st = tStatus(t);
  const chip = st === "live" ? `<span class="chip live">Live now</span>` : st === "up" ? `<span class="chip up">Upcoming</span>` : `<span class="chip end">Ended</span>`;
  let action = "";
  if (st === "live") action = done ? `<span class="hint">Submitted. Result after ${esc(fmtDT(t.endMs))}</span>` : `<button class="btn btn-gold" data-open>Start test</button>`;
  else if (st === "up") action = `<span class="hint">Opens ${esc(fmtDT(t.startMs))}</span>`;
  else action = done ? `<button class="btn btn-line" data-open>View result & rank</button>` : `<span class="hint">Not attempted</span>`;
  const d = document.createElement("div"); d.className = "ch";
  d.innerHTML = `<div class="ch-top"><div class="ch-t" style="flex:1"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${isNew ? `<span class="chip new">New</span>` : ""}${chip}<span class="hint">${esc(t.subject)}</span></div>
    <h3 style="margin-top:4px">${esc(t.title)}</h3><span>${esc(fmtDT(t.startMs))} · ${t.durationMin} min · ${t.qids.length} questions</span></div></div>
    <div class="ch-b">${action}</div>`;
  const b = d.querySelector("[data-open]"); if (b) b.onclick = () => go("stest", { id: t.id });
  return d;
}
async function fillSeries(box, all) {
  box.innerHTML = `<div class="spin"></div>`;
  let tests = [], mine = [];
  try { [tests, mine] = await Promise.all([loadTests(S.profile.cls), loadMyResults(true)]); } catch (e) { box.innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  const done = new Set(mine.filter(r => r.testId).map(r => r.testId));
  const order = { live: 0, up: 1, ended: 2 };
  let list = tests.slice().sort((a, b) => order[tStatus(a)] - order[tStatus(b)] || (tStatus(a) === "ended" ? b.startMs - a.startMs : a.startMs - b.startMs));
  if (!all) list = list.filter(t => tStatus(t) !== "ended" || Date.now() - t.endMs < 7 * 864e5).slice(0, 3);
  box.innerHTML = "";
  if (!list.length) { box.innerHTML = `<div class="empty"><h3>No scheduled tests</h3><p>Upcoming tests from JRP Education will appear here.</p></div>`; return; }
  const seen = getSeen("tests"), made = t => t.createdAtMs || t.startMs;
  list.forEach(t => box.appendChild(seriesItem(t, done.has(t.id), !all && seen > 0 && made(t) > seen && tStatus(t) !== "ended")));
  if (!all) {
    const live = tests.filter(t => tStatus(t) === "live" && !done.has(t.id));
    ALERTS.live = live.length;
    ALERTS.tests = seen ? tests.filter(t => made(t) > seen && tStatus(t) === "up").length : 0;
    const top = document.getElementById("liveAlert");
    if (top && live.length) {
      const t = live[0];
      top.innerHTML = `<div class="ic">!</div><div style="flex:1;min-width:0"><h3></h3><p>Live now · closes ${esc(fmtDT(t.endMs))}</p></div>`;
      top.querySelector("h3").textContent = live.length > 1 ? `${live.length} tests are live` : t.title;
      top.hidden = false; top.onclick = () => live.length > 1 ? go("series") : go("stest", { id: t.id });
    } else if (top) top.hidden = true;
    updateBadge();
    setTimeout(() => markSeen("tests"), 4000);
  }
}
VIEWS.series = () => {
  $app.innerHTML = header("Test Series", `Class ${S.profile.cls}`, true) + `<main><div class="in"><div class="chs" id="sl"></div></div></main>`;
  fillSeries(document.getElementById("sl"), true);
};

async function fetchQuestions(ids) {
  const docs = await Promise.all(ids.map(id => getDoc(doc(db, "questions", id)).catch(() => null)));
  return docs.map(d => d && d.exists() ? { id: d.id, ...d.data() } : { q: "(This question was removed by the teacher)", opts: ["–", "–", "–", "–"], ans: -1, chapter: "" });
}
VIEWS.stest = async ({ id }) => {
  loading();
  const uid = S.user.uid, rid = `${id}_${uid}`;
  let t, res;
  try {
    const [td, rd] = await Promise.all([getDoc(doc(db, "tests", id)), getDoc(doc(db, "results", rid))]);
    if (!td.exists()) { $app.innerHTML = header("Test", "", true) + `<main><div class="in"><div class="empty"><h3>Test not found</h3><p>This test may have been removed.</p></div></div></main>`; return; }
    t = { id, ...td.data() }; res = rd.exists() ? rd.data() : null;
  } catch (e) { $app.innerHTML = header("Test", "", true) + `<main><div class="in"><div class="err">${esc(errText(e))}</div></div></main>`; return; }
  const st = tStatus(t);
  const shell = inner => { $app.innerHTML = header(t.title, `${t.subject} · Class ${t.cls}`, true) + `<main><div class="in">${inner}</div></main>`; };
  if (res && st !== "ended") { shell(`<div class="card"><h2 style="font-size:20px">Test submitted</h2><p>Your answers are saved. Your score, answer review and rank will be available after the test closes on <b>${esc(fmtDT(t.endMs))}</b>.</p></div>`); return; }
  if (res && st === "ended") { return showSeriesResult(t, res); }
  if (st === "up") { shell(`<div class="card"><h2 style="font-size:20px">Not open yet</h2><p>This test opens on <b>${esc(fmtDT(t.startMs))}</b>. Come back at that time.</p></div>`); return; }
  if (st === "ended") { shell(`<div class="card"><h2 style="font-size:20px">Test closed</h2><p>This test closed on ${esc(fmtDT(t.endMs))}. You did not attempt it.</p></div>`); return; }
  // live: check for an attempt already in progress
  let att = null;
  try { const a = await getDoc(doc(db, "attempts", rid)); if (a.exists()) att = a.data(); } catch (e) {}
  const deadlineFor = startedAt => Math.min(startedAt + t.durationMin * 60000, t.endMs);
  if (att && deadlineFor(att.startedAtMs) <= Date.now()) {
    shell(`<div class="card"><h2 style="font-size:20px">Time is over</h2><p>You started this test earlier and the time has run out. Submitting what was saved on this phone.</p><button class="btn btn-navy" id="sub">Submit now</button></div>`);
    document.getElementById("sub").onclick = async () => { const qs = await fetchQuestions(t.qids); let ans = []; try { ans = JSON.parse(localStorage.getItem("jrp-t-" + id)) || []; } catch (e) {} await submitSeries(t, qs, qs.map((_, i) => ans[i] ?? null), Math.floor((deadlineFor(att.startedAtMs) - att.startedAtMs) / 1000), true); };
    return;
  }
  shell(`<div class="card">
      <div class="qtag">${esc(t.subject)}</div>
      <h1 style="font-size:24px">${esc(t.title)}</h1>
      <div class="stats three"><div><b>${t.qids.length}</b><span>Questions</span></div><div><b>${t.durationMin}</b><span>Minutes</span></div><div><b>${t.qids.length * MARK_RIGHT}</b><span>Max marks</span></div></div>
      <ul class="hint" style="margin:0;padding-left:20px;font-size:15px;display:flex;flex-direction:column;gap:4px">
        <li>You can take this test only once.</li>
        <li>The timer starts when you tap Start and keeps running even if you close the app.</li>
        <li>+${MARK_RIGHT} for a correct answer, −${MARK_WRONG} for a wrong answer, 0 if skipped.</li>
        <li>Results and rank are shown after the test closes on ${esc(fmtDT(t.endMs))}.</li>
      </ul>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" id="go">${att ? "Resume test" : "Start test"}</button>
    </div>`);
  document.getElementById("go").onclick = async () => {
    const btn = document.getElementById("go"); btn.disabled = true; btn.textContent = "Loading…";
    try {
      if (!att) { att = { uid, testId: id, startedAtMs: Date.now() }; await setDoc(doc(db, "attempts", rid), att); }
      const qs = await fetchQuestions(t.qids);
      runTest({ qs, startMs: att.startedAtMs, deadlineMs: deadlineFor(att.startedAtMs), storeKey: "jrp-t-" + id, tag: q => q.chapter || t.subject,
        onFinish: ({ ans, timeSec, auto }) => submitSeries(t, qs, ans, timeSec, auto) });
    } catch (e) { const er = document.getElementById("err"); er.textContent = errText(e); er.hidden = false; btn.disabled = false; btn.textContent = "Start test"; }
  };
};
async function submitSeries(t, qs, ans, timeSec, auto) {
  loading("Submitting your answers…");
  const rec = { uid: S.user.uid, name: S.profile.name, username: S.profile.username, studentCls: Number(S.profile.cls), studentMedium: myMed(),
    cls: Number(t.cls), subject: t.subject, chapter: t.title, testKey: "T|" + t.id, testId: t.id, endMs: t.endMs,
    ...scoreOf(qs, ans), answers: ans.map(a => a ?? -1), timeSec, atMs: Date.now(), at: serverTimestamp(),
    wrongIds: qs.filter((q, i) => ans[i] != null && ans[i] !== q.ans).map(q => q.id).filter(Boolean) };
  try {
    await setDoc(doc(db, "results", `${t.id}_${S.user.uid}`), rec); S.myResults = null;
    $app.innerHTML = header(t.title, `${t.subject} · Class ${t.cls}`) + `<main><div class="in"><div class="card">
      <h2 style="font-size:22px">Test submitted</h2>
      ${auto ? `<p class="hint">Time was up, so the test was submitted automatically.</p>` : ""}
      <p>Your answers are saved. Your score, answer review and rank will be available after <b>${esc(fmtDT(t.endMs))}</b>.</p>
      <button class="btn btn-navy" id="ok">Done</button></div></div></main>`;
    document.getElementById("ok").onclick = () => resetTo("home");
  } catch (e) {
    $app.innerHTML = header(t.title, "") + `<main><div class="in"><div class="card"><div class="err">${esc(errText(e))}</div><p>Check your internet connection and try again. Your answers are kept on this phone.</p><button class="btn btn-navy" id="retry">Try again</button></div></div></main>`;
    document.getElementById("retry").onclick = () => submitSeries(t, qs, ans, timeSec, auto);
  }
}
async function showSeriesResult(t, res) {
  loading();
  let qs = [], all = [];
  try { [qs, all] = await Promise.all([fetchQuestions(t.qids), getDocs(query(collection(db, "results"), where("testId", "==", t.id))).then(s => s.docs.map(d => d.data()))]); } catch (e) {}
  all.sort((a, b) => b.score - a.score || a.timeSec - b.timeSec);
  const rank = all.findIndex(r => r.uid === S.user.uid) + 1;
  const ans = (res.answers || []).map(a => a < 0 ? null : a);
  showResult({ rec: res, qs, ans, saved: true, rankText: rank ? `Rank ${rank} of ${all.length}` : "" });
}

/* ----- notices ----- */
async function loadNotices(cls) {
  const q = cls ? query(collection(db, "notices"), where("cls", "in", [0, Number(cls)])) : collection(db, "notices");
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.atMs - a.atMs);
}
function noticeCard(n, extra, isNew) {
  const d = document.createElement("div"); d.className = "notice" + (n.pinned ? " pin" : "");
  d.innerHTML = `<div class="rv-h"><span>${isNew ? `<span class="chip new">New</span> ` : ""}${n.pinned ? "<b>Pinned</b> · " : ""}${n.cls ? "Class " + n.cls : "All classes"} · ${esc(fmtDate(n.atMs))}</span></div><h3></h3><p class="nb"></p>`;
  d.querySelector("h3").textContent = n.title; d.querySelector(".nb").textContent = n.body;
  if (extra) d.appendChild(extra);
  return d;
}
async function fillNotices(box, all) {
  let ns = [];
  try { ns = await loadNotices(S.profile.cls); } catch (e) { return; }
  if (!all) ns = ns.filter(n => n.pinned || Date.now() - n.atMs < 14 * 864e5).slice(0, 2);
  box.innerHTML = "";
  if (!ns.length) { ALERTS.notices = 0; updateBadge(); if (all) box.innerHTML = `<div class="empty"><h3>No notices</h3><p>Announcements from JRP Education will appear here.</p></div>`; box.hidden = !all; return; }
  box.hidden = false;
  if (!all) { const h = document.createElement("div"); h.className = "sec-h"; h.innerHTML = `<h2>Notices</h2><button class="link">View all</button>`; h.querySelector("button").onclick = () => go("notices"); box.appendChild(h); }
  const seen = getSeen("notices");
  const isNew = n => seen > 0 ? n.atMs > seen : Date.now() - n.atMs < 2 * 864e5;
  ns.forEach(n => box.appendChild(noticeCard(n, null, isNew(n))));
  ALERTS.notices = ns.filter(isNew).length; updateBadge();
  if (all) markSeen("notices"); else setTimeout(() => markSeen("notices"), 4000);
}
VIEWS.notices = () => {
  $app.innerHTML = header("Notices", "JRP Education", true) + `<main><div class="in"><div class="list" id="nl"></div></div></main>`;
  fillNotices(document.getElementById("nl"), true);
};


/* ----- free mock test (built in, no login needed) ----- */
const MOCK = {
  title: { English: "Free Mock Test", Hindi: "निःशुल्क मॉक टेस्ट" },
  sub: "Class 10 · Mathematics", minutes: 15,
  English: [
    { chapter: "Real Numbers", q: "If HCF(a, b) = 6 and a × b = 432, then LCM(a, b) is:", opts: ["36", "72", "144", "2592"], ans: 1, sol: "HCF × LCM = a × b, so LCM = 432 ÷ 6 = 72." },
    { chapter: "Polynomials", q: "The zeroes of the polynomial x² − 3x − 4 are:", opts: ["−4 and 1", "2 and −2", "4 and −1", "1 and 4"], ans: 2, sol: "x² − 3x − 4 = (x − 4)(x + 1), so the zeroes are 4 and −1." },
    { chapter: "Pair of Linear Equations in Two Variables", q: "The solution of x + y = 10 and x − y = 2 is:", opts: ["x = 6, y = 4", "x = 4, y = 6", "x = 5, y = 5", "x = 8, y = 2"], ans: 0, sol: "Adding both equations gives 2x = 12, so x = 6 and y = 10 − 6 = 4." },
    { chapter: "Quadratic Equations", q: "The roots of 2x² − 4x + 3 = 0 are:", opts: ["Two distinct real roots", "Two equal real roots", "No real roots", "Only one root"], ans: 2, sol: "D = b² − 4ac = 16 − 24 = −8. Since D < 0, there are no real roots." },
    { chapter: "Arithmetic Progressions", q: "The 10th term of the AP 2, 7, 12, … is:", opts: ["45", "47", "50", "52"], ans: 1, sol: "aₙ = a + (n − 1)d = 2 + 9 × 5 = 47." },
    { chapter: "Coordinate Geometry", q: "The distance between the points (2, 3) and (−4, −5) is:", opts: ["8", "√52", "14", "10"], ans: 3, sol: "√[(−4 − 2)² + (−5 − 3)²] = √(36 + 64) = √100 = 10." },
    { chapter: "Introduction to Trigonometry", q: "If tan A = 3/4 (A is acute), then sin A is:", opts: ["4/5", "3/5", "3/4", "5/3"], ans: 1, sol: "Perpendicular = 3, base = 4, so hypotenuse = 5. sin A = 3/5." },
    { chapter: "Circles", q: "From a point 13 cm from the centre, the length of the tangent to a circle of radius 5 cm is:", opts: ["12 cm", "8 cm", "18 cm", "√194 cm"], ans: 0, sol: "The tangent is perpendicular to the radius: √(13² − 5²) = √144 = 12 cm." },
    { chapter: "Statistics", q: "If the median of a data is 22 and the mean is 20, then the mode is:", opts: ["24", "22", "18", "26"], ans: 3, sol: "Mode = 3 × Median − 2 × Mean = 66 − 40 = 26." },
    { chapter: "Probability", q: "A die is thrown once. The probability of getting a prime number is:", opts: ["1/2", "1/3", "2/3", "1/6"], ans: 0, sol: "The prime numbers on a die are 2, 3 and 5, so the probability is 3/6 = 1/2." }
  ],
  Hindi: [
    { chapter: "वास्तविक संख्याएँ", q: "यदि HCF(a, b) = 6 और a × b = 432 है, तो LCM(a, b) है:", opts: ["36", "72", "144", "2592"], ans: 1, sol: "HCF × LCM = a × b, अतः LCM = 432 ÷ 6 = 72।" },
    { chapter: "बहुपद", q: "बहुपद x² − 3x − 4 के शून्यक हैं:", opts: ["−4 और 1", "2 और −2", "4 और −1", "1 और 4"], ans: 2, sol: "x² − 3x − 4 = (x − 4)(x + 1), अतः शून्यक 4 और −1 हैं।" },
    { chapter: "दो चर वाले रैखिक समीकरण युग्म", q: "समीकरण युग्म x + y = 10 और x − y = 2 का हल है:", opts: ["x = 6, y = 4", "x = 4, y = 6", "x = 5, y = 5", "x = 8, y = 2"], ans: 0, sol: "दोनों समीकरणों को जोड़ने पर 2x = 12, अतः x = 6 और y = 10 − 6 = 4।" },
    { chapter: "द्विघात समीकरण", q: "समीकरण 2x² − 4x + 3 = 0 के मूल हैं:", opts: ["दो भिन्न वास्तविक मूल", "दो बराबर वास्तविक मूल", "कोई वास्तविक मूल नहीं", "केवल एक मूल"], ans: 2, sol: "विविक्तकर D = b² − 4ac = 16 − 24 = −8। D < 0 है, अतः कोई वास्तविक मूल नहीं है।" },
    { chapter: "समांतर श्रेढ़ियाँ", q: "समांतर श्रेढ़ी 2, 7, 12, … का 10वाँ पद है:", opts: ["45", "47", "50", "52"], ans: 1, sol: "aₙ = a + (n − 1)d = 2 + 9 × 5 = 47।" },
    { chapter: "निर्देशांक ज्यामिति", q: "बिंदुओं (2, 3) और (−4, −5) के बीच की दूरी है:", opts: ["8", "√52", "14", "10"], ans: 3, sol: "√[(−4 − 2)² + (−5 − 3)²] = √(36 + 64) = √100 = 10।" },
    { chapter: "त्रिकोणमिति का परिचय", q: "यदि tan A = 3/4 है (A न्यून कोण है), तो sin A का मान है:", opts: ["4/5", "3/5", "3/4", "5/3"], ans: 1, sol: "लंब = 3, आधार = 4, अतः कर्ण = 5। sin A = 3/5।" },
    { chapter: "वृत्त", q: "केंद्र से 13 cm दूर स्थित बिंदु से 5 cm त्रिज्या वाले वृत्त पर खींची गई स्पर्श रेखा की लंबाई है:", opts: ["12 cm", "8 cm", "18 cm", "√194 cm"], ans: 0, sol: "स्पर्श रेखा त्रिज्या पर लंब होती है: √(13² − 5²) = √144 = 12 cm।" },
    { chapter: "सांख्यिकी", q: "यदि किसी आँकड़े का माध्यक 22 और माध्य 20 है, तो बहुलक है:", opts: ["24", "22", "18", "26"], ans: 3, sol: "बहुलक = 3 × माध्यक − 2 × माध्य = 66 − 40 = 26।" },
    { chapter: "प्रायिकता", q: "एक पासे को एक बार फेंका जाता है। अभाज्य संख्या आने की प्रायिकता है:", opts: ["1/2", "1/3", "2/3", "1/6"], ans: 0, sol: "पासे पर अभाज्य संख्याएँ 2, 3 और 5 हैं, अतः प्रायिकता = 3/6 = 1/2।" }
  ]
};
const mockCard = () => `<button class="banner mock" data-mock>
  <div class="ic">10</div><div style="flex:1;min-width:0"><h3>Free Mock Test</h3><p>Class 10 Maths · 10 MCQs · English & Hindi medium</p></div></button>`;
function wireMock() { $app.querySelectorAll("[data-mock]").forEach(b => b.onclick = () => go("mock")); }
VIEWS.mock = ({ medium } = {}) => {
  const med = medium || (S.profile ? myMed() : "English");
  const qs = MOCK[med];
  $app.innerHTML = header(MOCK.title[med], MOCK.sub, true) + `
  <main><div class="in">
    <div class="card">
      <div class="qtag">Free · No login needed</div>
      <h1 style="font-size:24px">${esc(MOCK.title[med])}</h1>
      <div class="field"><label for="mm">Medium</label><select id="mm">${medOptions(med)}</select></div>
      <div class="stats three"><div><b>${qs.length}</b><span>Questions</span></div><div><b>${MOCK.minutes}</b><span>Minutes</span></div><div><b>${qs.length * MARK_RIGHT}</b><span>Max marks</span></div></div>
      <ul class="hint" style="margin:0;padding-left:20px;font-size:15px;display:flex;flex-direction:column;gap:4px">
        <li>+${MARK_RIGHT} for a correct answer, −${MARK_WRONG} for a wrong answer, 0 if skipped.</li>
        <li>Questions from the full Class 10 Maths syllabus.</li>
        <li>You will see the correct answers and solutions at the end.</li>
      </ul>
      <button class="btn btn-navy" id="go">Start mock test</button>
    </div>
  </div></main>`;
  document.getElementById("mm").onchange = e => { current.args = { medium: e.target.value }; render(); };
  document.getElementById("go").onclick = () => {
    const t0 = Date.now();
    runTest({ qs, startMs: t0, deadlineMs: t0 + MOCK.minutes * 60000, tag: q => q.chapter,
      onFinish: ({ ans, timeSec, auto }) => {
        const rec = { subject: "Mathematics", cls: 10, chapter: MOCK.title[med], ...scoreOf(qs, ans), timeSec };
        showResult({ rec, qs, ans, auto, saved: true });
        if (!S.user) {
          const cta = document.createElement("div"); cta.className = "card";
          cta.innerHTML = `<h3 style="font-size:18px">Want more tests like this?</h3><p>Create a free student account to get chapter tests, test series and your rank.</p><button class="btn btn-gold" id="cta">Create student account</button>`;
          document.querySelector("main .in").insertBefore(cta, document.querySelector("main .in").children[1]);
          document.getElementById("cta").onclick = () => go("signup", {}, { replace: true });
        }
      } });
  };
};


/* ----- paid books ----- */
const purId = (bookId, uid) => `${bookId}_${uid}`;
async function myPurchase(b) {
  try { const d = await getDoc(doc(db, "purchases", purId(b.id, S.user.uid))); return d.exists() ? d.data() : null; } catch (e) { return null; }
}
function bookCard(b, pur) {
  const st = pur ? pur.status : "";
  const d = document.createElement("button"); d.className = "book";
  d.innerHTML = `<img src="${b.cover}" alt="" loading="lazy"><div class="mid"><b></b><span></span>
    <em class="${st === "approved" ? "ok" : st === "pending" ? "wait" : ""}">${st === "approved" ? "Unlocked · Read now" : st === "pending" ? "Payment under review" : `₹${b.price} · Unlock`}</em></div>`;
  d.querySelector("b").textContent = b.title; d.querySelector(".mid span").textContent = b.sub;
  d.onclick = () => go(st === "approved" ? "reader" : "book", { id: b.id });
  return d;
}
async function fillBooks(box) {
  const purs = await Promise.all(BOOKS.map(myPurchase));
  box.innerHTML = ""; BOOKS.forEach((b, i) => box.appendChild(bookCard(b, purs[i])));
}
VIEWS.book = async ({ id }) => {
  const b = BOOKS.find(x => x.id === id);
  $app.innerHTML = header(b.title, b.sub, true) + `<main><div class="in" id="in"><div class="spin"></div></div></main>`;
  const pur = await myPurchase(b);
  if (pur && pur.status === "approved") { go("reader", { id }, { replace: true }); return; }
  const box = document.getElementById("in");
  const head = `<div class="card"><div style="display:flex;gap:14px"><img src="${b.cover}" alt="" class="cover"><div style="min-width:0">
      <h2 style="font-size:20px">${esc(b.title)}</h2><p class="hint">${esc(b.sub)} · ${b.pages} pages</p>
      <p class="price">₹${b.price}</p></div></div>
      <ul class="hint" style="margin:0;padding-left:20px;font-size:15px">${b.points.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  if (pur && pur.status === "pending") {
    box.innerHTML = head + `<div class="card"><h3 style="font-size:18px">Payment under review</h3><p>Your request was sent on ${esc(fmtDate(pur.atMs))}${pur.utr ? ` with transaction ID <b>${esc(pur.utr)}</b>` : ""}. The book unlocks as soon as JRP Education confirms your payment.</p><button class="btn btn-navy" id="chk">Check again</button></div>`;
    document.getElementById("chk").onclick = () => render();
    return;
  }
  const upiLink = UPI_ID ? `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${b.price}&cu=INR&tn=${encodeURIComponent(b.title + " " + S.profile.username)}` : "";
  box.innerHTML = head + `<form class="card" id="f" novalidate>
      <h3 style="font-size:18px">Unlock for ₹${b.price}</h3>
      ${UPI_ID ? `<p><b>Step 1.</b> Pay ₹${b.price} with any UPI app.</p>
        <a class="btn btn-gold" href="${upiLink}">Pay ₹${b.price} with UPI</a>
        <p class="hint">UPI ID: <b id="upi">${esc(UPI_ID)}</b> <button type="button" class="link" id="cpu">Copy</button></p>
        <p><b>Step 2.</b> Enter the transaction ID (UTR) shown in your UPI app after payment.</p>
        <div class="field"><label for="utr">Transaction ID / UTR</label><input id="utr" type="text" inputmode="numeric" placeholder="12-digit number"></div>`
      : `<p>Pay ₹${b.price} to JRP Education, then send your request below. The book unlocks when your teacher confirms the payment.</p>
        <div class="field"><label for="utr">Payment note (optional)</label><input id="utr" type="text" placeholder="e.g. Paid in cash to sir"></div>`}
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" type="submit" id="go">${UPI_ID ? "Submit payment details" : "Request access"}</button>
    </form>`;
  const cpu = document.getElementById("cpu");
  if (cpu) cpu.onclick = async () => { try { await navigator.clipboard.writeText(UPI_ID); toast("UPI ID copied"); } catch (e) { toast(UPI_ID); } };
  document.getElementById("f").onsubmit = async e => {
    e.preventDefault(); const err = document.getElementById("err"); err.hidden = true;
    const utr = document.getElementById("utr").value.trim();
    if (UPI_ID && !/^\w{6,30}$/.test(utr)) { err.textContent = "Enter the transaction ID from your UPI app."; err.hidden = false; return; }
    try {
      await setDoc(doc(db, "purchases", purId(b.id, S.user.uid)), { uid: S.user.uid, product: b.id, title: b.title, price: b.price, utr,
        name: S.profile.name, username: S.profile.username, cls: Number(S.profile.cls), status: "pending", atMs: Date.now(), at: serverTimestamp() });
      toast("Request sent"); render();
    } catch (x) { err.textContent = errText(x); err.hidden = false; }
  };
};

let pdfjsReady = null;
function loadPdfJs() {
  if (!pdfjsReady) pdfjsReady = new Promise((ok, bad) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; ok(window.pdfjsLib); };
    sc.onerror = () => { pdfjsReady = null; bad(new Error("Could not load the book viewer. Check your internet connection.")); };
    document.head.appendChild(sc);
  });
  return pdfjsReady;
}
const b64ToBytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
VIEWS.reader = async ({ id }) => {
  const b = BOOKS.find(x => x.id === id);
  $app.innerHTML = header(b.title, b.sub, true) + `<main class="reader"><div class="in" id="in"><div class="loading" style="min-height:40vh"><div><div class="spin"></div><span id="st">Opening book…</span></div></div></div></main>`;
  const st = t => { const e = document.getElementById("st"); if (e) e.textContent = t; };
  try {
    const kd = await getDoc(doc(db, "bookKeys", b.id));
    if (!kd.exists()) throw new Error("This book is not ready yet. Please ask your teacher.");
    st("Downloading book…");
    const [lib, buf] = await Promise.all([loadPdfJs(), fetch(b.file).then(r => { if (!r.ok) throw new Error("Download failed"); return r.arrayBuffer(); })]);
    st("Unlocking…");
    const key = await crypto.subtle.importKey("raw", b64ToBytes(kd.data().key), "AES-GCM", false, ["decrypt"]);
    const all = new Uint8Array(buf);
    const pdfBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12));
    const pdf = await lib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    const box = document.getElementById("in");
    if (!box) return;
    box.innerHTML = `<p class="hint" style="text-align:center">${pdf.numPages} pages · Licensed to ${esc(S.profile.name)}</p><div id="pages" class="pages"></div>`;
    const wrap = document.getElementById("pages");
    const mark = `${S.profile.name} · ${S.profile.username}`;
    const slots = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const sl = document.createElement("div"); sl.className = "page"; sl.dataset.n = i; sl.style.aspectRatio = "0.707";
      sl.innerHTML = `<span class="pg-n">${i}</span>`;
      wrap.appendChild(sl); slots.push(sl);
    }
    const drawPage = async sl => {
      if (sl.dataset.done) return; sl.dataset.done = "1";
      const page = await pdf.getPage(Number(sl.dataset.n));
      const w = sl.clientWidth || 360, v0 = page.getViewport({ scale: 1 });
      const scale = (w / v0.width) * Math.min(2, window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale });
      const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
      sl.style.aspectRatio = `${v0.width} / ${v0.height}`;
      const ctx = cv.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = "#0f2a6b"; ctx.font = `${Math.round(cv.width / 26)}px sans-serif`;
      ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate(-Math.PI / 6);
      for (let y = -cv.height; y < cv.height; y += cv.width / 5) ctx.fillText(mark, -ctx.measureText(mark).width / 2, y);
      ctx.restore();
      sl.innerHTML = ""; sl.appendChild(cv);
    };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) drawPage(e.target); }), { rootMargin: "600px 0px" });
    slots.forEach(sl => io.observe(sl));
    wrap.addEventListener("contextmenu", e => e.preventDefault());
  } catch (e) {
    const box = document.getElementById("in");
    if (box) box.innerHTML = `<div class="err">${esc(e.code ? errText(e) : e.message)}</div>`;
  }
};

/* ----- teacher: books & payments ----- */
async function tabPayments(pane) {
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="sec-h"><h2 style="font-size:17px">Payment requests</h2><span id="cnt"></span></div>
    <div class="list" id="l"></div>
    <div class="sec-h"><h2 style="font-size:17px">Books</h2></div>
    <div class="list" id="bk"></div></div>`;
  const $ = id => document.getElementById(id);
  // book setup
  const bk = $("bk");
  for (const b of BOOKS) {
    let has = false; try { has = (await getDoc(doc(db, "bookKeys", b.id))).exists(); } catch (e) {}
    const c = document.createElement("div"); c.className = "card";
    c.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><img src="${b.cover}" alt="" class="cover" style="width:56px"><div style="min-width:0"><b>${esc(b.title)}</b><p class="hint">${esc(b.sub)} · ₹${b.price}</p>
      <p class="${has ? "ok-msg" : "err"}" style="margin-top:6px;padding:4px 10px">${has ? "Ready: approved students can read it" : "Not activated yet"}</p></div></div>
      <div class="field"><label for="k-${b.id}">Book key</label><input id="k-${b.id}" type="text" autocapitalize="none" placeholder="${has ? "Already set. Paste only to replace." : "Paste the key you received"}"></div>
      <button class="btn btn-navy" data-k>Save key</button>`;
    c.querySelector("[data-k]").onclick = async () => {
      const v = document.getElementById("k-" + b.id).value.trim();
      if (!/^[A-Za-z0-9+/]{43}=$/.test(v)) { toast("That key looks incomplete"); return; }
      try { await setDoc(doc(db, "bookKeys", b.id), { key: v }); toast("Book activated"); showTab(); } catch (x) { toast(errText(x)); }
    };
    bk.appendChild(c);
  }
  // requests
  let ps = [];
  try { ps = (await getDocs(collection(db, "purchases"))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (x) { $("l").innerHTML = `<div class="err">${esc(errText(x))}</div>`; return; }
  ps.sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || b.atMs - a.atMs);
  const pend = ps.filter(p => p.status === "pending").length, paid = ps.filter(p => p.status === "approved");
  $("cnt").textContent = `${pend} pending · ₹${paid.reduce((a, p) => a + (p.price || 0), 0)} received`;
  const l = $("l");
  if (!ps.length) { l.innerHTML = `<div class="empty"><h3>No payment requests</h3><p>When a student pays for a book, the request appears here for you to approve.</p></div>`; return; }
  ps.forEach(p => {
    const d = document.createElement("div"); d.className = "detail"; d.style.marginTop = "0";
    d.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><b></b><p class="hint"></p></div><span class="chip ${p.status === "approved" ? "live" : "up"}">${p.status === "approved" ? "Approved" : "Pending"}</span></div>
      <div class="kv"><span>Transaction ID / note</span><b>${esc(p.utr || "–")}</b></div>
      ${p.status === "pending" ? `<div class="row"><button class="btn btn-navy" data-a="ok">Approve</button><button class="btn btn-danger" data-a="no">Reject</button></div>` : ""}`;
    d.querySelector("b").textContent = `${p.name} · ₹${p.price}`;
    d.querySelector(".hint").textContent = `${p.title} · Class ${p.cls} · ${p.username} · ${fmtDate(p.atMs)}`;
    const ok = d.querySelector('[data-a="ok"]'), no = d.querySelector('[data-a="no"]');
    if (ok) ok.onclick = async () => { try { await updateDoc(doc(db, "purchases", p.id), { status: "approved", approvedAtMs: Date.now() }); toast("Approved"); showTab(); } catch (x) { toast(errText(x)); } };
    if (no) no.onclick = async () => { if (no.dataset.c !== "1") { no.dataset.c = "1"; no.textContent = "Tap again"; return; } try { await deleteDoc(doc(db, "purchases", p.id)); toast("Request rejected"); showTab(); } catch (x) { toast(errText(x)); } };
    l.appendChild(d);
  });
}


/* ----- NareX: AI doubt solver (Gemini free tier via Firebase AI Logic) ----- */
const NAREX = { daily: 15, sdks: ["12.6.0", "12.2.1", "12.0.0"], models: ["gemini-flash-latest", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"] };
let narexModel = null, narexChat = null, narexHist = [];
function narexPrompt() {
  if (S.admin) return `You are NareX, the AI assistant of JRP Education, a maths coaching institute in Rajasthan, India (NCERT / RBSE, classes 6 to 12, Hindi and English medium).
You are helping the teacher, not a student. Reply in the language the teacher writes in (Hindi in Devanagari, English, or Hinglish).
The teacher may send photos of book pages or question papers; read them carefully (for example, to turn them into MCQs in the format below).
You help the teacher to: write MCQ questions, solutions, chapter notes and formula lists, notices for students, and explain topics.
When asked for MCQs, ALWAYS use exactly this format so the teacher can paste it into the app, with one blank line between questions:
Q: question text
A) option
B) option
C) option
D) option
Ans: B
Sol: short solution
Check every answer carefully before writing it; exactly one option must be correct. Match the NCERT chapter and class asked for.
Write maths in plain text with symbols like ², ³, √, π, ×, ÷, θ. Do not use LaTeX, markdown tables or code blocks.`;
  const p = S.profile, hi = myMed() === "Hindi";
  return `You are NareX, the friendly maths teacher assistant of JRP Education, a coaching institute in Rajasthan, India (author of the book "JRP Maths Concepts").
You are talking to ${p.name}, a Class ${p.cls} student studying in ${hi ? "Hindi" : "English"} medium (NCERT / RBSE syllabus).
Rules:
- ${hi ? "Reply in simple Hindi written in Devanagari script. Keep maths terms as used in NCERT Hindi books." : "Reply in simple English."}
- The student may send a photo of a question from a book or notebook. Read it carefully, write the question in text first, then solve it. If the photo is unclear, ask for a clearer photo.
- Solve maths and study doubts step by step, the way a good teacher explains on a board. Number the steps. Show the formula first, then substitution, then the answer.
- Keep answers short and clear for a Class ${p.cls} student. End with the final answer on its own line.
- Write maths in plain text with symbols like ², ³, √, π, ×, ÷, θ. Do not use LaTeX or code blocks.
- If a question is not about studies, politely say you only help with studies and invite a maths question.
- If you are not sure, say so and suggest asking the teacher at JRP Education.
- Address the student as "student" (in Hindi: "विद्यार्थी") or by first name. Never call the student Sir, Madam or Ma'am.
- Never claim to be a human. Never share personal data.`;
}
async function narexInit() {
  if (narexModel) return narexModel;
  let mods = null;
  for (const v of NAREX.sdks) {
    const base = `https://www.gstatic.com/firebasejs/${v}/`;
    try { mods = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-ai.js")]); break; } catch (e) {}
  }
  if (!mods) throw new Error("NareX could not load. Check your internet.");
  const [{ initializeApp: ia, getApps }, ai] = mods;
  const aiApp = getApps().find(a => a.name === "narex") || ia(firebaseConfig, "narex");
  const inst = ai.getAI(aiApp, { backend: new ai.GoogleAIBackend() });
  let lastErr;
  for (const m of NAREX.models) {
    try {
      const model = ai.getGenerativeModel(inst, { model: m, systemInstruction: narexPrompt() });
      await model.countTokens("ok");
      narexModel = model; return model;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("NareX is not available right now.");
}
const narexLimit = () => S.admin ? 100 : NAREX.daily;
const narexKey = () => `jrp-narex-${S.user.uid}-${new Date().toISOString().slice(0, 10)}`;
const narexUsed = () => { try { return Number(localStorage.getItem(narexKey())) || 0; } catch (e) { return 0; } };
const narexUse = () => { try { localStorage.setItem(narexKey(), String(narexUsed() + 1)); } catch (e) {} };
// resize a photo to at most 1280px so it uploads fast and uses less of the free quota
function shrinkImage(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, im.height));
      const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      const d = c.toDataURL("image/jpeg", 0.85); URL.revokeObjectURL(url);
      ok({ mimeType: "image/jpeg", data: d.split(",")[1], url: d });
    };
    im.onerror = () => { URL.revokeObjectURL(url); bad(new Error("bad image")); };
    im.src = url;
  });
}
function narexHtml(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\$+/g, "").replace(/\n/g, "<br>");
}
VIEWS.narex = () => {
  const T = S.admin, hi = !T && myMed() === "Hindi";
  $app.innerHTML = header("NareX", T ? "AI assistant for teachers" : "AI maths helper · JRP Education", true) + `
  <main class="chatmain"><div class="in">
    <div class="chat" id="chat"></div>
    ${T ? "" : `<p class="hint" style="text-align:center">NareX is an AI and can make mistakes. Check important answers with your teacher.</p>`}
  </div></main>
  <form class="composer" id="cf"><div class="in" id="prev" hidden><div class="att"><img id="pimg" alt="Attached photo"><button type="button" class="link" id="prm">Remove</button></div></div><div class="in">
    <label class="attach" for="cimg" aria-label="Add photo"><svg viewBox="0 0 24 24"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg></label>
    <input id="cimg" type="file" accept="image/*" hidden>
    <textarea id="cq" rows="1" placeholder="${T ? "Type here…" : hi ? "सवाल लिखें…" : "Ask a question…"}"></textarea>
    <button class="btn btn-navy" id="cs" type="submit" aria-label="Send">Send</button>
  </div><div class="in"><span class="hint" id="left"></span></div></form>`;
  const chat = document.getElementById("chat"), cq = document.getElementById("cq"), cs = document.getElementById("cs"), left = document.getElementById("left");
  const bubble = (who, html) => { const d = document.createElement("div"); d.className = "msg " + who; d.innerHTML = (who === "bot" ? `<span class="nx">N</span>` : "") + `<div class="b">${html}</div>`; chat.appendChild(d); d.scrollIntoView({ block: "end" }); return d.querySelector(".b"); };
  const addCopy = (b, text) => { const c = document.createElement("button"); c.type = "button"; c.className = "link cp"; c.textContent = "Copy"; c.onclick = async () => { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch (e) { toast("Copy not allowed on this phone"); } }; b.appendChild(c); };
  const showLeft = () => { const L = narexLimit(), l = L - narexUsed(); left.textContent = l > 0 ? `${l} of ${L} questions left today` : "Daily limit reached. Come back tomorrow."; cs.disabled = l <= 0; };
  if (T) bubble("bot", narexHtml(`Hello Sir! I'm NareX. I can help you prepare material for JRP Education.\n\nTry:\n• "Class 10 Polynomials ke 10 MCQ Hindi mein banao"\n• "Write notes and formulas for Class 9 Number Systems"\n• "Kal chhutti ka notice likho"\n\nTap Copy under my answer, then paste MCQs into Questions → Paste many.`));
  else bubble("bot", narexHtml(hi
    ? `नमस्ते विद्यार्थी! मैं NareX हूँ। गणित का कोई भी सवाल पूछो, मैं स्टेप-बाय-स्टेप समझाऊँगा।\n\nजैसे: "x² − 5x + 6 = 0 हल करो" या "sin 30° + cos 60° का मान?"`
    : `Hi student! I'm NareX. Ask me any maths doubt and I'll explain it step by step.\n\nFor example: "Solve x² − 5x + 6 = 0" or "What is sin 30° + cos 60°?"`));
  narexHist.forEach(m => { const b = bubble(m.who, narexHtml(m.text)); if (m.who === "bot") addCopy(b, m.text); });
  showLeft();
  let img = null; // {mimeType, data, url}
  const prev = document.getElementById("prev"), pimg = document.getElementById("pimg"), cimg = document.getElementById("cimg");
  cimg.onchange = async () => {
    const f = cimg.files && cimg.files[0]; cimg.value = ""; if (!f) return;
    try { img = await shrinkImage(f); pimg.src = img.url; prev.hidden = false; cq.placeholder = T ? "Add a note…" : hi ? "कुछ लिखें…" : "Add a note…"; }
    catch (e) { toast("Could not read this photo"); }
  };
  document.getElementById("prm").onclick = () => { img = null; prev.hidden = true; };
  cq.addEventListener("input", () => { cq.style.height = "auto"; cq.style.height = Math.min(cq.scrollHeight, 140) + "px"; });
  document.getElementById("cf").onsubmit = async e => {
    e.preventDefault();
    const q = cq.value.trim() || (img ? (hi ? "इस फोटो वाले सवाल को स्टेप-बाय-स्टेप हल करो।" : "Solve the question in this photo step by step.") : "");
    if (!q || cs.disabled) return;
    if (narexUsed() >= narexLimit()) { showLeft(); return; }
    cq.value = ""; cq.style.height = "auto"; cs.disabled = true;
    const sent = img; img = null; prev.hidden = true;
    const mb = bubble("me", (sent ? `<img class="qimg" src="${sent.url}" alt="">` : "") + narexHtml(q)); narexHist.push({ who: "me", text: q });
    const out = bubble("bot", `<span class="dots"><i></i><i></i><i></i></span>`);
    try {
      const model = await narexInit();
      if (!narexChat) narexChat = model.startChat({ history: [] });
      const res = await narexChat.sendMessageStream(sent ? [q, { inlineData: { mimeType: sent.mimeType, data: sent.data } }] : q);
      let text = "";
      for await (const ch of res.stream) { text += ch.text(); out.innerHTML = narexHtml(text); out.scrollIntoView({ block: "end" }); }
      narexHist.push({ who: "bot", text }); narexUse(); addCopy(out, text);
    } catch (x) {
      const m = String(x && (x.message || x.code) || "");
      out.innerHTML = m.includes("quota") || m.includes("429") ? "NareX is busy right now. Please try again in a few minutes."
        : m.includes("api-not-enabled") || m.includes("not been used") || m.includes("disabled") ? "NareX is not switched on yet. Please tell your teacher."
        : "Sorry, I could not answer. Check your internet and try again.";
      narexChat = null;
    }
    showLeft(); cq.focus();
  };
};

/* ----- student: results, rank, profile ----- */
VIEWS.results = async () => {
  $app.innerHTML = header("My results", S.profile.name) + `<main><div class="in" id="in"><div class="loading" style="min-height:30vh"><div class="spin"></div></div></div></main>`;
  let rs = [];
  try { rs = await loadMyResults(true); } catch (e) { document.getElementById("in").innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  const pending = r => r.endMs && r.endMs > Date.now();
  const box = document.getElementById("in");
  if (!rs.length) { box.innerHTML = `<div class="empty"><h3>No tests taken yet</h3><p>Your scores will appear here after each test.</p></div>`; return; }
  const fin = rs.filter(r => !pending(r));
  const avg = fin.length ? Math.round(fin.reduce((s, r) => s + Math.max(0, r.score) / r.max, 0) / fin.length * 100) : 0;
  const bestPct = fin.length ? Math.max(...fin.map(r => Math.round(Math.max(0, r.score) / r.max * 100))) : 0;
  box.innerHTML = `<div class="stats three"><div><b>${rs.length}</b><span>Tests taken</span></div><div><b>${avg}%</b><span>Average</span></div><div><b>${bestPct}%</b><span>Best</span></div></div><div class="list" id="l"></div>`;
  const l = document.getElementById("l");
  rs.forEach(r => {
    const d = document.createElement("div"); d.className = "item";
    d.innerHTML = `<div class="av">${esc((GLYPH[r.subject] || r.subject[0]))}</div><div class="mid"><b>${esc(r.chapter)}</b><span>${r.testId ? "Test Series · " : ""}${esc(r.subject)} · Class ${r.cls} · ${fmtDate(r.atMs)}</span></div><div class="end">${pending(r) ? `<small>Result after<br>${esc(fmtDT(r.endMs))}</small>` : `${r.score}<small>/${r.max}</small>`}</div>`;
    if (r.testId && !pending(r)) { d.style.cursor = "pointer"; d.onclick = () => go("stest", { id: r.testId }); }
    l.appendChild(d);
  });
};

function rankRows(rs, mode) {
  // mode "all": average % per student across tests; otherwise best score per student in that test
  const by = {};
  rs.forEach(r => {
    const u = by[r.uid] || (by[r.uid] = { uid: r.uid, name: r.name, n: 0, sum: 0, best: null });
    u.n++; u.sum += Math.max(0, r.score) / r.max;
    if (!u.best || r.score > u.best.score) u.best = r;
  });
  const rows = Object.values(by);
  if (mode === "all") rows.forEach(u => u.val = Math.round(u.sum / u.n * 100)), rows.sort((a, b) => b.val - a.val || b.n - a.n);
  else rows.sort((a, b) => b.best.score - a.best.score || a.best.timeSec - b.best.timeSec);
  return rows;
}
function drawBoard(el, rs, key, meUid) {
  el.innerHTML = "";
  const sel = key === "all" ? rs : rs.filter(r => r.testKey === key);
  const rows = rankRows(sel, key);
  if (!rows.length) { el.innerHTML = `<div class="empty"><h3>No results yet</h3><p>Rankings appear once students take tests.</p></div>`; return; }
  rows.slice(0, 50).forEach((u, i) => {
    const d = document.createElement("div"); d.className = "item" + (u.uid === meUid ? " me" : "");
    d.innerHTML = `<div class="av ${i === 0 ? "r1" : ""}">${i + 1}</div><div class="mid"><b></b><span></span></div><div class="end"></div>`;
    d.querySelector(".mid b").textContent = u.name + (u.uid === meUid ? " (you)" : "");
    d.querySelector(".mid span").textContent = key === "all" ? `${u.n} test${u.n > 1 ? "s" : ""} taken` : `Time ${fmtTime(u.best.timeSec)}`;
    d.querySelector(".end").innerHTML = key === "all" ? `${u.val}%` : `${u.best.score}<small>/${u.best.max}</small>`;
    el.appendChild(d);
  });
}
VIEWS.board = async () => {
  const c = Number(S.profile.cls);
  $app.innerHTML = header("Leaderboard", `Class ${c} · ${myMed()} medium`) + `<main><div class="in" id="in"><div class="loading" style="min-height:30vh"><div class="spin"></div></div></div></main>`;
  let rs = [];
  try { rs = (await getDocs(query(collection(db, "results"), where("studentCls", "==", c)))).docs.map(d => d.data()).filter(r => (!r.endMs || r.endMs <= Date.now()) && (r.studentMedium || "English") === myMed()); }
  catch (e) { document.getElementById("in").innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  const tests = [...new Set(rs.map(r => r.testKey))];
  const box = document.getElementById("in");
  box.innerHTML = `<div class="field"><label for="tsel">Ranking</label><select id="tsel"><option value="all">All tests (average %)</option>${tests.map(t => { const r = rs.find(x => x.testKey === t); return `<option value="${esc(t)}">${esc(r.chapter)} · ${esc(r.subject)}${Number(r.cls) !== c ? " · Class " + r.cls : ""}</option>`; }).join("")}</select></div><div class="list" id="l"></div>`;
  const l = document.getElementById("l"), tsel = document.getElementById("tsel");
  tsel.onchange = () => drawBoard(l, rs, tsel.value, S.user.uid);
  drawBoard(l, rs, "all", S.user.uid);
};

VIEWS.profile = () => {
  const p = S.profile;
  const rows = [["Name", p.name], ["Username", p.username], ["Class", p.cls + "th"], ["Medium", myMed()], ["Gmail", p.email], ["Mobile", p.mobile], ["Father's name", p.father], ["School", p.school]].filter(r => r[1]);
  $app.innerHTML = appbar() + `
  <main><div class="in">
    <div class="card"><div style="display:flex;gap:12px;align-items:center"><div class="av" style="width:52px;height:52px;font-size:18px">${esc(initials(p.name))}</div><div><h2 style="font-size:20px">${esc(p.name)}</h2><p class="hint">Student · Class ${esc(p.cls)}</p></div></div>
      <div>${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
    </div>
    <div class="list">
      <button class="pcard" data-p="results"><span class="qi q-green">${svg("test")}</span><span class="pc-t"><b>My results</b><small>All your test scores</small></span><span class="go">→</span></button>
      <button class="pcard" data-p="board"><span class="qi q-gold">${svg("trophy")}</span><span class="pc-t"><b>Leaderboard</b><small>Your rank in Class ${esc(p.cls)}</small></span><span class="go">→</span></button>
      <button class="pcard" data-p="notices"><span class="qi q-blue">${svg("bell")}</span><span class="pc-t"><b>Notices</b><small>Announcements from JRP Education</small></span><span class="go">→</span></button>
    </div>
    ${ytCard()}
    <p class="hint">To change your details or password, contact JRP Education.</p>
    <button class="btn btn-line" id="out">Log out</button>
  </div></main>`;
  document.getElementById("out").onclick = () => signOut(auth);
  $app.querySelectorAll("[data-p]").forEach(b => b.onclick = () => go(b.dataset.p));
};

/* ---------- teacher panel ---------- */
let TTAB = "st", TFILTER = "", TOPEN = false;
const TSECS = {
  content: [["qs", "Questions"], ["sy", "Syllabus, Notes & Videos"]],
  tests: [["ts", "Test Series"], ["rs", "Results"]],
  more: [["nb", "Notices"], ["pay", "Payments"]]
};
VIEWS.teacher = async ({ sec = "dash", sub } = {}) => {
  const bar = appbar(`<button class="ab-nx" id="nxb">${svg("spark")}NareX</button>`);
  if (sec === "dash") return teacherDash(bar);
  if (sec === "st") { TTAB = "st"; }
  else { const list = TSECS[sec]; if (!list.some(x => x[0] === TTAB)) TTAB = sub || list[0][0]; }
  const tabs = TSECS[sec] ? `<div class="tabs" role="tablist">${TSECS[sec].map(([k, t]) => `<button class="tb" data-t="${k}">${t}</button>`).join("")}</div>` : "";
  $app.innerHTML = bar + `<main><div class="in">
    ${sec === "st" ? `<div class="sec-h"><h2>Students</h2><button class="link" id="allD">All details →</button></div>` : ""}
    ${tabs}
    <div id="pane"></div>
    ${sec === "more" ? `<button class="pcard" id="out"><span class="qi q-red">${svg("logout")}</span><span class="pc-t"><b>Log out</b><small>Teacher account</small></span></button>` : ""}
  </div></main>`;
  document.getElementById("nxb").onclick = () => go("narex");
  const o = document.getElementById("out"); if (o) o.onclick = () => signOut(auth);
  const ad = document.getElementById("allD"); if (ad) ad.onclick = () => go("allStudents");
  $app.querySelectorAll(".tb").forEach(b => b.onclick = () => { TTAB = b.dataset.t; showTab(); });
  showTab();
};
function showTab() {
  $app.querySelectorAll(".tb").forEach(b => b.setAttribute("aria-selected", b.dataset.t === TTAB));
  const pane = document.getElementById("pane");
  pane.innerHTML = `<div class="loading" style="min-height:30vh"><div class="spin"></div></div>`;
  ({ pay: tabPayments, nb: tabNotices, ts: tabSeries, st: tabStudents, rs: tabResults, qs: tabQuestions, sy: tabSyllabus })[TTAB](pane);
}
const toMs = v => v && typeof v.toMillis === "function" ? v.toMillis() : (typeof v === "number" ? v : 0);
function growthChart(times) {
  const W = 320, H = 130, P = 26, days = 30, now = new Date(); now.setHours(23, 59, 59, 999);
  const start = now.getTime() - (days - 1) * 864e5;
  const before = times.filter(t => t && t < start).length;
  const pts = [];
  for (let i = 0; i < days; i++) { const end = start + i * 864e5; pts.push(before + times.filter(t => t && t >= start && t <= end).length); }
  const total = times.length, max = Math.max(4, ...pts), stepY = Math.ceil(max / 4);
  const top = stepY * 4, x = i => P + i * (W - P - 8) / (days - 1), y = v => H - 18 - v / top * (H - 30);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(days - 1).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`;
  const grid = [0, 1, 2, 3, 4].map(k => `<line x1="${P}" x2="${W - 4}" y1="${y(k * stepY)}" y2="${y(k * stepY)}" class="g"/><text x="${P - 6}" y="${y(k * stepY) + 4}" text-anchor="end" class="lab">${k * stepY}</text>`).join("");
  const fmt = ms => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Students joined in the last 30 days">${grid}
    <path d="${area}" class="area"/><path d="${line}" class="ln"/>
    <circle cx="${x(days - 1)}" cy="${y(pts[days - 1])}" r="4.5" class="pt"/>
    <text x="${x(0)}" y="${H - 2}" class="lab">${fmt(start)}</text><text x="${x(days - 1)}" y="${H - 2}" text-anchor="end" class="lab">Today · ${total}</text></svg>`;
}
async function teacherDash(bar) {
  $app.innerHTML = bar + `<main><div class="in">
    <div class="welcome t"><div class="wl-av">${svg("board")}</div><div class="wl-t"><small>JRP Education</small><h1>Welcome, Teacher!</h1><p>Create · Teach · Inspire</p></div></div>
    <div class="kpis" id="kp">${["Students", "Tests taken", "Questions", "Revenue"].map(t => `<div><b>–</b><span>${t}</span></div>`).join("")}</div>
    <div id="req"></div>
    <div class="sec-h"><h2>Quick Actions</h2></div>
    <div class="qa">
      <button data-go="st:add"><span class="qi q-blue">${svg("user")}</span>Add Student</button>
      <button data-go="content:qs"><span class="qi q-green">${svg("plus")}</span>Add Questions</button>
      <button data-go="content:sy"><span class="qi q-red">${svg("video")}</span>Notes & Video</button>
      <button data-go="tests:ts"><span class="qi q-orange">${svg("test")}</span>Create Test</button>
      <button data-go="more:nb"><span class="qi q-purple">${svg("megaphone")}</span>Post Notice</button>
      <button data-go="more:pay"><span class="qi q-gold">${svg("rupee")}</span>Payments</button>
      <button data-go="narex"><span class="qi q-navy">${svg("spark")}</span>NareX AI</button>
      <button data-go="allStudents"><span class="qi q-teal">${svg("chart")}</span>Reports</button>
    </div>
    <div class="sec-h"><h2>Weekly Toppers</h2><span>Last week</span></div>
    <div class="list" id="toppers"><div class="spin"></div></div>
    <div class="sec-h"><h2>My Batches</h2><button class="link" data-go="st">View all →</button></div>
    <div class="list" id="batches"><div class="spin"></div></div>
    <div class="card"><div class="sec-h"><h2 style="font-size:17px">Student Growth</h2><span>Last 30 days</span></div><div id="growth"><div class="spin"></div></div></div>
    <div class="two dash2">
      <div class="card"><h3 style="font-size:15px">Revenue Overview</h3><div id="rev"><div class="spin"></div></div></div>
      <div class="card"><h3 style="font-size:15px">Top Courses</h3><ol class="top" id="topc"><li>–</li></ol></div>
    </div>
    <div class="sec-h"><h2>Recent Activity</h2></div>
    <div class="list" id="act"><div class="spin"></div></div>
  </div></main>`;
  const $ = id => document.getElementById(id);
  $("nxb").onclick = () => go("narex");
  $app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
    const [sec, sub] = b.dataset.go.split(":");
    if (sec === "narex" || sec === "allStudents") return go(sec);
    if (sec === "st") { TFILTER = ""; TOPEN = sub === "add"; return resetTo("teacher", { sec: "st" }); }
    TTAB = sub; resetTo("teacher", { sec });
  });
  let users = [], results = [], purchases = [], qCount = 0;
  try {
    const [u, r, p, qc] = await Promise.all([getDocs(collection(db, "users")), getDocs(query(collection(db, "results"), orderBy("atMs", "desc"), limit(500))),
      getDocs(collection(db, "purchases")), getCountFromServer(collection(db, "questions")).catch(() => null)]);
    users = u.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.status !== "rejected");
    results = r.docs.map(d => d.data()); purchases = p.docs.map(d => d.data()); qCount = qc ? qc.data().count : 0;
  } catch (e) { const ac = $("act"); if (ac) ac.innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  if (!$("kp")) return;
  const paid = purchases.filter(x => x.status === "approved"), revenue = paid.reduce((a, x) => a + (x.price || 0), 0);
  const active = users.filter(x => x.status !== "pending");
  $("kp").innerHTML = `<div class="k-blue"><span class="ki">${svg("user")}</span><b>${active.length}</b><span>Students</span></div><div class="k-green"><span class="ki">${svg("test")}</span><b>${results.length}${results.length >= 500 ? "+" : ""}</b><span>Tests taken</span></div><div class="k-orange"><span class="ki">${svg("book")}</span><b>${qCount}</b><span>Questions</span></div><div class="k-purple"><span class="ki">${svg("rupee")}</span><b>₹${revenue}</b><span>Revenue</span></div>`;
  // pending requests (old sign-ups) and payments needing action
  const pend = users.filter(x => x.status === "pending").length, pp = purchases.filter(x => x.status === "pending").length;
  if (pend || pp) $("req").innerHTML = `<button class="banner live" id="todo"><div class="ic">!</div><div style="flex:1"><h3>Needs your attention</h3><p>${[pend ? `${pend} student request${pend > 1 ? "s" : ""}` : "", pp ? `${pp} payment${pp > 1 ? "s" : ""} to approve` : ""].filter(Boolean).join(" · ")}</p></div></button>`;
  const todo = $("todo"); if (todo) todo.onclick = () => { if (pp && !pend) { TTAB = "pay"; resetTo("teacher", { sec: "more" }); } else resetTo("teacher", { sec: "st" }); };
  // batches = classes
  const bt = $("batches"); bt.innerHTML = "";
  const byCls = CLASSES.map(c => ({ c, list: active.filter(x => Number(x.cls) === c) })).filter(x => x.list.length);
  if (!byCls.length) bt.innerHTML = `<div class="empty"><h3>No students yet</h3><p>Share the app link so students can create their accounts.</p></div>`;
  byCls.forEach(({ c, list }) => {
    const en = list.filter(x => medOf(x) === "English").length, hi = list.length - en;
    const b = document.createElement("button"); b.className = "item batch";
    b.innerHTML = `<div class="av bt">${c}</div><div class="mid"><b>Class ${c}${c === 10 || c === 12 ? " · RBSE Board" : ""}</b><span>${list.length} students · English ${en} · Hindi ${hi}</span></div><div class="end"><small>View →</small></div>`;
    b.onclick = () => { TFILTER = String(c); TOPEN = false; resetTo("teacher", { sec: "st" }); };
    bt.appendChild(b);
  });
  {
    const thisW = weekStart(0), lastW = weekStart(-1), rows = [];
    CLASSES.forEach(c => MEDIUMS.forEach(m => {
      const rs = results.filter(r => Number(r.studentCls) === c && (r.studentMedium || "English") === m);
      const lastT = topperOf(rs, lastW, thisW), t = lastT || topperOf(rs, thisW, thisW + 7 * 864e5);
      if (t) rows.push({ c, m, t, live: !lastT });
    }));
    $("toppers").innerHTML = rows.length ? rows.map(x => `<div class="item"><div class="av r1">${x.c}</div><div class="mid"><b>${esc(x.t.name)}</b><span>Class ${x.c} · ${x.m} · ${x.t.n} test${x.t.n > 1 ? "s" : ""}${x.live ? " · this week so far" : ""}</span></div><div class="end">${x.t.pct}%</div></div>`).join("")
      : `<div class="empty"><h3>No toppers yet</h3><p>Toppers appear once students take tests.</p></div>`;
  }
  $("growth").innerHTML = growthChart(active.map(x => toMs(x.createdAt)).filter(Boolean));
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const monthRev = paid.filter(x => (x.approvedAtMs || x.atMs) >= m0.getTime()).reduce((a, x) => a + (x.price || 0), 0);
  $("rev").innerHTML = `<p class="big">₹${monthRev}</p><p class="hint">This month</p><p class="hint" style="margin-top:6px">Total ₹${revenue} · ${paid.length} sale${paid.length === 1 ? "" : "s"}</p>`;
  const bySub = {}; results.forEach(r => { const k = r.testId ? "Test Series" : (r.subject || "Other"); bySub[k] = (bySub[k] || 0) + 1; });
  const top = Object.entries(bySub).sort((a, b) => b[1] - a[1]).slice(0, 4);
  $("topc").innerHTML = top.length ? top.map(([k, n]) => `<li><span>${esc(k)}</span><b>${n}</b></li>`).join("") : `<li class="hint">No tests yet</li>`;
  // recent activity
  const ev = [
    ...results.slice(0, 12).map(r => ({ t: r.atMs, ic: "test", tone: "q-green", h: `${r.name} scored ${r.score}/${r.max}`, s: `${r.chapter} · ${r.subject}` })),
    ...active.map(x => ({ t: toMs(x.createdAt), ic: "user", tone: "q-blue", h: `${x.name} joined`, s: `Class ${x.cls} · ${medOf(x)} medium` })),
    ...purchases.map(x => ({ t: x.atMs, ic: "rupee", tone: "q-gold", h: `${x.name} ${x.status === "approved" ? "bought" : "requested"} ${x.title}`, s: `₹${x.price}` }))
  ].filter(e => e.t).sort((a, b) => b.t - a.t).slice(0, 8);
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : fmtDate(t); };
  $("act").innerHTML = ev.length ? ev.map(e => `<div class="item"><span class="qi sm ${e.tone}">${svg(e.ic)}</span><div class="mid"><b>${esc(e.h)}</b><span>${esc(e.s)} · ${ago(e.t)}</span></div></div>`).join("") : `<div class="empty"><h3>No activity yet</h3><p>Sign-ups, tests and payments will show here.</p></div>`;
}
const classOptions = (sel, any) => (any ? `<option value="">All classes</option>` : "") + CLASSES.map(c => `<option value="${c}" ${Number(sel) === c ? "selected" : ""}>Class ${c}</option>`).join("");
const subjectOptions = (c, sel) => subjectsFor(Number(c)).map(s => `<option ${s === sel ? "selected" : ""}>${esc(s)}</option>`).join("");
const genPass = () => String(Math.floor(100000 + Math.random() * 900000));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function tabStudents(pane) {
  pane.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
    <div id="req"></div>
    <div class="row"><button class="btn btn-gold" id="add">+ Add student</button><button class="btn btn-line" id="allD">All student details</button></div>
    <form class="card" id="f" hidden novalidate>
      <h3 style="font-size:18px">New student</h3>
      <div class="field"><label for="sn">Full name</label><input id="sn" type="text" placeholder="Student name"></div>
      <div class="two"><div class="field"><label for="sc">Class</label><select id="sc">${classOptions(10)}</select></div>
      <div class="field"><label for="sm">Mobile</label><input id="sm" type="tel" inputmode="numeric" placeholder="10-digit number"></div></div>
      <div class="field"><label for="smd">Medium</label><select id="smd">${medOptions("English")}</select></div>
      <div class="field"><label for="sf">Father's name</label><input id="sf" type="text"></div>
      <div class="field"><label for="ss">School (optional)</label><input id="ss" type="text"></div>
      <div class="two"><div class="field"><label for="su">Username</label><input id="su" type="text" autocapitalize="none" placeholder="Auto"></div>
      <div class="field"><label for="sp">Password</label><input id="sp" type="text" placeholder="Auto"></div></div>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" type="submit" id="save">Save student</button>
    </form>
    <div class="ok-msg" id="done" hidden></div>
    <div class="filters"><div class="field"><label for="fc">Class</label><select id="fc">${classOptions("", true)}</select></div><div class="field"><label for="fq">Search</label><input id="fq" type="search" placeholder="Name or username"></div></div>
    <div class="list" id="l"></div></div>`;
  const $ = id => document.getElementById(id);
  $("add").onclick = () => { $("f").hidden = !$("f").hidden; };
  $("allD").onclick = () => go("allStudents");
  if (TFILTER) { $("fc").value = TFILTER; TFILTER = ""; }
  if (TOPEN) { $("f").hidden = false; TOPEN = false; }
  const autoU = () => { if (!$("su").dataset.touched) $("su").value = slug(($("sn").value.split(" ")[0] || "")) + $("sc").value; };
  $("sn").oninput = autoU; $("sc").onchange = autoU; $("su").oninput = () => $("su").dataset.touched = "1";
  $("sp").value = genPass();
  $("f").onsubmit = async e => {
    e.preventDefault(); $("err").hidden = true;
    const name = $("sn").value.trim(), cls = Number($("sc").value), username = slug($("su").value || ""), password = $("sp").value.trim() || genPass();
    if (!name) { $("err").textContent = "Enter the student's name."; $("err").hidden = false; return; }
    if (username.length < 3) { $("err").textContent = "Username needs at least 3 letters or numbers."; $("err").hidden = false; return; }
    if (password.length < 6) { $("err").textContent = "Password must be at least 6 characters."; $("err").hidden = false; return; }
    $("save").disabled = true; $("save").textContent = "Saving…";
    try {
      const c = await createUserWithEmailAndPassword(auth2, usernameToEmail(username), password);
      const uid = c.user.uid; await signOut(auth2);
      const b = writeBatch(db);
      b.set(doc(db, "users", uid), { name, cls, medium: $("smd").value, username, mobile: $("sm").value.trim(), father: $("sf").value.trim(), school: $("ss").value.trim(), role: "student", active: true, status: "approved", createdAt: serverTimestamp() });
      b.set(doc(db, "secrets", uid), { username, password });
      await b.commit();
      $("done").innerHTML = `Student added. Share these login details:<br><b>Username:</b> ${esc(username)}<br><b>Password:</b> ${esc(password)}`;
      $("done").hidden = false; $("f").reset(); $("f").hidden = true; $("su").dataset.touched = ""; $("sp").value = genPass();
      loadList();
    } catch (x) { $("err").textContent = errText(x); $("err").hidden = false; }
    $("save").disabled = false; $("save").textContent = "Save student";
  };
  let all = [];
  async function loadList() {
    try { all = (await getDocs(collection(db, "users"))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)); }
    catch (e) { $("l").innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
    drawRequests(all.filter(x => x.status === "pending"));
    all = all.filter(x => x.status !== "pending" && x.status !== "rejected");
    draw();
  }
  function drawRequests(rq) {
    const box = $("req"); box.innerHTML = "";
    if (!rq.length) return;
    box.innerHTML = `<div class="card" style="border-color:var(--gold)"><div class="sec-h"><h2 style="font-size:18px">New requests</h2><span>${rq.length}</span></div><div class="list" data-l></div></div>`;
    const l = box.querySelector("[data-l]");
    rq.forEach(s => {
      const d = document.createElement("div"); d.className = "detail"; d.style.marginTop = "0";
      d.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div class="av">${esc(initials(s.name))}</div><div class="mid" style="flex:1;min-width:0"><b></b><br><span class="hint"></span></div></div>
        <div class="row"><button class="btn btn-navy" data-a="ok">Approve</button><button class="btn btn-danger" data-a="no">Reject</button></div>`;
      d.querySelector(".mid b").textContent = s.name;
      d.querySelector(".mid span").textContent = `Class ${s.cls} · ${medOf(s)} · ${s.username} · ${s.mobile || ""}${s.father ? " · Father: " + s.father : ""}`;
      d.querySelector('[data-a="ok"]').onclick = async () => { try { await updateDoc(doc(db, "users", s.id), { status: "approved", active: true }); toast(`${s.name} approved`); loadList(); } catch (x) { toast(errText(x)); } };
      const no = d.querySelector('[data-a="no"]');
      no.onclick = async () => { if (no.dataset.c !== "1") { no.dataset.c = "1"; no.textContent = "Tap again"; return; } try { await updateDoc(doc(db, "users", s.id), { status: "rejected", active: false }); toast("Request rejected"); loadList(); } catch (x) { toast(errText(x)); } };
      l.appendChild(d);
    });
  }
  function draw() {
    const fc = $("fc").value, fq = $("fq").value.trim().toLowerCase();
    const rows = all.filter(s => (!fc || Number(s.cls) === Number(fc)) && (!fq || s.name.toLowerCase().includes(fq) || s.username.includes(fq)));
    const l = $("l"); l.innerHTML = "";
    if (!rows.length) { l.innerHTML = `<div class="empty"><h3>${all.length ? "No matching students" : "No students yet"}</h3><p>${all.length ? "Try another class or search." : "Tap Add student to create the first login."}</p></div>`; return; }
    // grouped: class 6 → 12, then English → Hindi medium, names A → Z
    const medRank = m => MEDIUMS.indexOf(m) < 0 ? 9 : MEDIUMS.indexOf(m);
    rows.sort((a, b) => Number(a.cls) - Number(b.cls) || medRank(medOf(a)) - medRank(medOf(b)) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    const sum = document.createElement("p"); sum.className = "hint"; sum.textContent = `${rows.length} students`; l.appendChild(sum);
    let lastC = null, lastM = null, sn = 0;
    rows.forEach(s => {
      sn++;
      if (Number(s.cls) !== lastC) {
        lastC = Number(s.cls); lastM = null;
        const n = rows.filter(x => Number(x.cls) === lastC).length;
        const h = document.createElement("div"); h.className = "grp-c"; h.innerHTML = `<b>Class ${lastC}</b><span>${n} student${n > 1 ? "s" : ""}</span>`; l.appendChild(h);
      }
      if (medOf(s) !== lastM) {
        lastM = medOf(s);
        const n = rows.filter(x => Number(x.cls) === lastC && medOf(x) === lastM).length;
        const h = document.createElement("div"); h.className = "grp-m"; h.textContent = `${lastM} medium · ${n}`; l.appendChild(h);
      }
      const b = document.createElement("button"); b.className = "item";
      b.innerHTML = `<div class="av sn">${sn}</div><div class="mid"><b></b><span></span></div><div class="end mob">${s.mobile ? esc(s.mobile) : "<small>No number</small>"}${s.active === false ? "<br><small>Inactive</small>" : ""}</div>`;
      b.querySelector(".mid b").textContent = s.name; b.querySelector(".mid span").textContent = `${s.username}${s.father ? " · Father: " + s.father : ""}`;
      const d = document.createElement("div"); d.className = "detail"; d.hidden = true;
      b.onclick = async () => { d.hidden = !d.hidden; if (!d.hidden && !d.dataset.ok) await studentDetail(d, s, loadList); };
      l.appendChild(b); l.appendChild(d);
    });
  }
  $("fc").onchange = draw; $("fq").oninput = draw;
  loadList();
}
async function studentDetail(d, s, reload) {
  d.innerHTML = `<div class="spin"></div>`;
  let sec = {}, rs = [];
  try { const x = await getDoc(doc(db, "secrets", s.id)); if (x.exists()) sec = x.data(); } catch (e) {}
  try { rs = (await getDocs(query(collection(db, "results"), where("uid", "==", s.id)))).docs.map(x => x.data()); } catch (e) {}
  const avg = rs.length ? Math.round(rs.reduce((a, r) => a + Math.max(0, r.score) / r.max, 0) / rs.length * 100) + "%" : "–";
  d.dataset.ok = "1";
  d.innerHTML = [["Medium", medOf(s)], ["Username", s.username], ["Password", sec.password || "–"], ["Mobile", s.mobile || "–"], ["Father's name", s.father || "–"], ["School", s.school || "–"], ["Tests taken", rs.length], ["Average", avg]]
    .map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>`).join("") +
    `<div class="row"><button class="btn btn-line" data-a="pw">Reset password</button><button class="btn ${s.active === false ? "btn-line" : "btn-danger"}" data-a="ac">${s.active === false ? "Activate" : "Deactivate"}</button></div><div class="hint" data-msg></div>`;
  const msg = d.querySelector("[data-msg]");
  d.querySelector('[data-a="pw"]').onclick = async () => {
    if (!sec.password) { msg.textContent = "Old password not on record, so it cannot be reset here."; return; }
    const np = genPass(); msg.textContent = "Resetting…";
    try {
      const c = await signInWithEmailAndPassword(auth2, usernameToEmail(s.username), sec.password);
      await updatePassword(c.user, np); await signOut(auth2);
      await setDoc(doc(db, "secrets", s.id), { username: s.username, password: np });
      sec.password = np; d.querySelectorAll(".kv b")[1].textContent = np; msg.textContent = `New password: ${np}`;
    } catch (x) { msg.textContent = errText(x); }
  };
  d.querySelector('[data-a="ac"]').onclick = async () => {
    try { await updateDoc(doc(db, "users", s.id), { active: s.active === false }); toast(s.active === false ? "Student activated" : "Student deactivated"); reload(); }
    catch (x) { msg.textContent = errText(x); }
  };
}

async function tabResults(pane) {
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filters"><div class="field"><label for="rc">Class</label><select id="rc">${classOptions("", true)}</select></div><div class="field"><label for="rq">Search</label><input id="rq" type="search" placeholder="Student or chapter"></div></div>
    <div class="list" id="l"></div></div>`;
  let all = [];
  try { all = (await getDocs(query(collection(db, "results"), orderBy("atMs", "desc"), limit(500)))).docs.map(d => d.data()); }
  catch (e) { document.getElementById("l").innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  const draw = () => {
    const c = document.getElementById("rc").value, q = document.getElementById("rq").value.trim().toLowerCase();
    const rows = all.filter(r => (!c || r.studentCls === Number(c)) && (!q || r.name.toLowerCase().includes(q) || r.chapter.toLowerCase().includes(q)));
    const l = document.getElementById("l"); l.innerHTML = "";
    if (!rows.length) { l.innerHTML = `<div class="empty"><h3>No results yet</h3><p>Results appear here as soon as students submit tests.</p></div>`; return; }
    rows.forEach(r => {
      const d = document.createElement("div"); d.className = "item";
      d.innerHTML = `<div class="av">${esc(initials(r.name))}</div><div class="mid"><b></b><span></span></div><div class="end">${r.score}<small>/${r.max}</small></div>`;
      d.querySelector(".mid b").textContent = r.name;
      d.querySelector(".mid span").textContent = `${r.chapter} · ${r.subject} ${r.cls} · ${fmtDate(r.atMs)} · ✓${r.correct} ✗${r.wrong}`;
      l.appendChild(d);
    });
  };
  document.getElementById("rc").onchange = draw; document.getElementById("rq").oninput = draw; draw();
}

/* questions: bulk text format
Q: question text
A) option
B) option
C) option
D) option
Ans: B
Sol: solution (optional)
(blank line between questions) */
function parseBulk(txt) {
  const out = [], errs = [];
  txt.replace(/\r/g, "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).forEach((blk, n) => {
    const q = { q: "", opts: ["", "", "", ""], ans: -1, sol: "" };
    let last = null;
    blk.split("\n").forEach(line => {
      let m;
      if ((m = line.match(/^\s*(?:Q\d*|\d+)\s*[:.)]\s*(.*)$/i))) { q.q = m[1]; last = "q"; }
      else if ((m = line.match(/^\s*\(?([A-Da-d])[).:]\s*(.*)$/))) { const i = "abcd".indexOf(m[1].toLowerCase()); q.opts[i] = m[2]; last = i; }
      else if ((m = line.match(/^\s*(?:Ans(?:wer)?)\s*[:.-]\s*\(?([A-Da-d])/i))) { q.ans = "abcd".indexOf(m[1].toLowerCase()); last = null; }
      else if ((m = line.match(/^\s*(?:Sol(?:ution)?|Exp(?:lanation)?)\s*[:.-]\s*(.*)$/i))) { q.sol = m[1]; last = "sol"; }
      else if (last === "q") q.q += "\n" + line.trim();
      else if (last === "sol") q.sol += "\n" + line.trim();
      else if (typeof last === "number") q.opts[last] += " " + line.trim();
      else if (!q.q) { q.q = line.trim(); last = "q"; }
    });
    if (!q.q || q.opts.some(o => !o.trim()) || q.ans < 0) errs.push(n + 1); else out.push(q);
  });
  return { out, errs };
}
async function tabQuestions(pane) {
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filters"><div class="field"><label for="qc">Class</label><select id="qc">${classOptions(10)}</select></div><div class="field"><label for="qsj">Subject</label><select id="qsj"></select></div></div>
    <div class="field"><label for="qm">Medium</label><select id="qm">${medOptions("English")}</select></div>
    <div class="field"><label for="qch">Chapter</label><select id="qch"></select></div>
    <div class="row"><button class="btn btn-gold" id="one">+ Add question</button><button class="btn btn-line" id="bulk">Paste many</button></div>
    <form class="card" id="f1" hidden novalidate>
      <div class="field"><label for="qq">Question</label><textarea id="qq"></textarea></div>
      ${[0, 1, 2, 3].map(i => `<div class="field"><label for="o${i}">Option ${L[i]}</label><input id="o${i}" type="text"></div>`).join("")}
      <div class="field"><label for="qa">Correct answer</label><select id="qa">${[0, 1, 2, 3].map(i => `<option value="${i}">${L[i]}</option>`).join("")}</select></div>
      <div class="field"><label for="qsol">Solution (optional)</label><textarea id="qsol"></textarea></div>
      <div class="err" id="e1" hidden></div>
      <button class="btn btn-navy" type="submit">Save question</button>
    </form>
    <form class="card" id="f2" hidden novalidate>
      <p class="hint">Paste questions in this format, with a blank line between questions:</p>
      <pre class="rv-ex" style="margin:0;overflow-x:auto">Q: What is 2 + 3?
A) 4
B) 5
C) 6
D) 7
Ans: B
Sol: 2 + 3 = 5</pre>
      <div class="field"><label for="bt">Questions</label><textarea id="bt" style="min-height:200px"></textarea></div>
      <div class="err" id="e2" hidden></div>
      <button class="btn btn-navy" type="submit">Check and save</button>
    </form>
    <div class="sec-h"><h2 style="font-size:17px">Questions in this chapter</h2><span id="qn"></span></div>
    <div class="list" id="l"></div></div>`;
  const $ = id => document.getElementById(id);
  const fillSubj = () => { $("qsj").innerHTML = subjectOptions($("qc").value, $("qsj").value); };
  const fillCh = async () => {
    const chs = await getSyllabus(Number($("qc").value), $("qsj").value, $("qm").value);
    $("qch").innerHTML = chs.length ? chs.map(c => `<option>${esc(c)}</option>`).join("") : `<option value="">Add chapters in Syllabus & Notes first</option>`;
    loadQ();
  };
  fillSubj(); await fillCh();
  $("qc").onchange = async () => { fillSubj(); await fillCh(); };
  $("qsj").onchange = fillCh; $("qm").onchange = fillCh; $("qch").onchange = loadQ;
  $("one").onclick = () => { $("f1").hidden = !$("f1").hidden; $("f2").hidden = true; };
  $("bulk").onclick = () => { $("f2").hidden = !$("f2").hidden; $("f1").hidden = true; };
  const base = () => ({ cls: Number($("qc").value), subject: $("qsj").value, chapter: $("qch").value, medium: $("qm").value });
  $("f1").onsubmit = async e => {
    e.preventDefault(); $("e1").hidden = true;
    if (!$("qch").value) { $("e1").textContent = "Select a chapter first."; $("e1").hidden = false; return; }
    const q = { q: $("qq").value.trim(), opts: [0, 1, 2, 3].map(i => $("o" + i).value.trim()), ans: Number($("qa").value), sol: $("qsol").value.trim() };
    if (!q.q || q.opts.some(o => !o)) { $("e1").textContent = "Fill in the question and all four options."; $("e1").hidden = false; return; }
    try { await addDoc(collection(db, "questions"), { ...base(), ...q, createdAt: serverTimestamp() }); $("f1").reset(); toast("Question saved"); loadQ(); }
    catch (x) { $("e1").textContent = errText(x); $("e1").hidden = false; }
  };
  $("f2").onsubmit = async e => {
    e.preventDefault(); $("e2").hidden = true;
    if (!$("qch").value) { $("e2").textContent = "Select a chapter first."; $("e2").hidden = false; return; }
    const { out, errs } = parseBulk($("bt").value);
    if (errs.length) { $("e2").textContent = `Check question number ${errs.join(", ")}: each needs Q, options A–D and Ans.`; $("e2").hidden = false; return; }
    if (!out.length) { $("e2").textContent = "Paste at least one question."; $("e2").hidden = false; return; }
    try {
      for (let i = 0; i < out.length; i += 400) { const b = writeBatch(db); out.slice(i, i + 400).forEach(q => b.set(doc(collection(db, "questions")), { ...base(), ...q, createdAt: serverTimestamp() })); await b.commit(); }
      $("bt").value = ""; toast(`${out.length} questions saved`); loadQ();
    } catch (x) { $("e2").textContent = errText(x); $("e2").hidden = false; }
  };
  async function loadQ() {
    const l = $("l"); if (!l) return;
    if (!$("qch").value) { l.innerHTML = ""; $("qn").textContent = ""; return; }
    l.innerHTML = `<div class="spin"></div>`;
    let qs = [];
    try { qs = (await getDocs(query(collection(db, "questions"), where("cls", "==", Number($("qc").value)), where("subject", "==", $("qsj").value), where("chapter", "==", $("qch").value)))).docs.map(d => ({ id: d.id, ...d.data() })).filter(q => medOf(q) === $("qm").value); }
    catch (x) { l.innerHTML = `<div class="err">${esc(errText(x))}</div>`; return; }
    $("qn").textContent = qs.length + (qs.length < CHAPTER_Q ? ` (add ${CHAPTER_Q - qs.length}+ more)` : "");
    l.innerHTML = "";
    if (!qs.length) { l.innerHTML = `<div class="empty"><h3>No questions yet</h3><p>Add at least ${CHAPTER_Q} questions so students get a full test.</p></div>`; return; }
    qs.forEach((q, i) => {
      const d = document.createElement("div"); d.className = "rv";
      d.innerHTML = `<div class="rv-h"><b>Q${i + 1}</b><button class="btn btn-danger" style="padding:4px 10px;font-size:13px">Delete</button></div><p class="rv-q"></p><p class="rv-a"></p>`;
      d.querySelector(".rv-q").textContent = q.q;
      d.querySelector(".rv-a").innerHTML = q.opts.map((o, j) => `<span class="${j === q.ans ? "c" : ""}">${L[j]}) ${esc(o)}</span>`).join("<br>");
      const del = d.querySelector("button");
      del.onclick = async () => {
        if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Tap again to delete"; return; }
        try { await deleteDoc(doc(db, "questions", q.id)); toast("Question deleted"); loadQ(); } catch (x) { toast(errText(x)); }
      };
      l.appendChild(d);
    });
  }
}

async function tabSyllabus(pane) {
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filters"><div class="field"><label for="yc">Class</label><select id="yc">${classOptions(10)}</select></div><div class="field"><label for="ys">Subject</label><select id="ys"></select></div></div>
    <div class="field"><label for="ym">Medium</label><select id="ym">${medOptions("English")}</select></div>
    <div class="card" id="ov"></div>
    <form class="card" id="f1" novalidate>
      <h3 style="font-size:18px">Edit chapters</h3>
      <p class="hint">One chapter per line, in order. A subject shows as "Coming soon" until it has chapters.</p>
      <div class="field"><label for="yl">Chapter list</label><textarea id="yl" style="min-height:220px"></textarea></div>
      <button class="btn btn-navy" type="submit">Save chapters</button>
    </form>
    <form class="card" id="f2" novalidate>
      <h3 style="font-size:18px">Notes</h3>
      <div class="field"><label for="nc">Chapter</label><select id="nc"></select></div>
      <div class="field"><label for="nv">YouTube video link (optional)</label><input id="nv" type="url" inputmode="url" placeholder="https://youtu.be/…"></div>
      <div class="field"><label for="nt">Notes and formulas</label><textarea id="nt" style="min-height:220px" placeholder="Key points, formulas and examples for this chapter"></textarea></div>
      <button class="btn btn-navy" type="submit">Save notes & video</button>
    </form></div>`;
  const $ = id => document.getElementById(id);
  const fillSubj = () => { $("ys").innerHTML = subjectOptions($("yc").value, $("ys").value); };
  const load = async () => {
    const c = Number($("yc").value), s = $("ys").value, m = $("ym").value;
    delete S.syllabus[sylKey(c, s, m)];
    const chs = await getSyllabus(c, s, m);
    $("yl").value = chs.join("\n");
    $("nc").innerHTML = chs.map(x => `<option>${esc(x)}</option>`).join("");
    loadNote();
    overview(c, s, m, chs);
  };
  async function overview(c, s, m, chs) {
    const ov = $("ov");
    ov.innerHTML = `<h3 style="font-size:18px">Syllabus overview</h3><p class="hint">Class ${c} · ${esc(s)} · ${m} medium</p><div class="spin"></div>`;
    if (!chs.length) { ov.innerHTML = `<h3 style="font-size:18px">Syllabus overview</h3><p class="hint">No chapters yet for Class ${c} · ${esc(s)} · ${m} medium. Add them below.</p>`; return; }
    let counts = {}, notes = {};
    try {
      (await getDocs(query(collection(db, "questions"), where("cls", "==", c), where("subject", "==", s)))).docs.forEach(d => { const q = d.data(); if (medOf(q) === m) counts[q.chapter] = (counts[q.chapter] || 0) + 1; });
      const nd = await Promise.all(chs.map(ch => getDoc(doc(db, "notes", `${c}_${s}_${ch}`)).catch(() => null)));
      nd.forEach((d, i) => notes[chs[i]] = !!(d && d.exists() && d.data().text));
    } catch (e) {}
    const totalQ = chs.reduce((a, ch) => a + (counts[ch] || 0), 0), ready = chs.filter(ch => (counts[ch] || 0) >= CHAPTER_Q).length;
    ov.innerHTML = `<h3 style="font-size:18px">Syllabus overview</h3><p class="hint">Class ${c} · ${esc(s)} · ${m} medium</p>
      <div class="stats three"><div><b>${chs.length}</b><span>Chapters</span></div><div><b>${totalQ}</b><span>Questions</span></div><div><b>${ready}/${chs.length}</b><span>Tests ready</span></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Chapter</th><th>Questions</th><th>Notes</th></tr></thead><tbody>
      ${chs.map((ch, i) => { const n = counts[ch] || 0; return `<tr><td>${i + 1}</td><td>${esc(ch)}</td><td class="${n >= CHAPTER_Q ? "g" : n ? "w" : "r"}">${n}</td><td class="${notes[ch] ? "g" : "r"}">${notes[ch] ? "Added" : "–"}</td></tr>`; }).join("")}
      </tbody></table></div><p class="hint">A chapter test needs at least ${CHAPTER_Q} questions.</p>`;
  }
  const loadNote = async () => {
    $("nt").value = ""; $("nv").value = videoFor(Number($("yc").value), $("ys").value, $("ym").value, $("nc").value);
    if (!$("nc").value) return;
    try { const d = await getDoc(doc(db, "notes", `${$("yc").value}_${$("ys").value}_${$("nc").value}`)); $("nt").value = d.exists() ? d.data().text || "" : ""; } catch (e) {}
  };
  fillSubj(); await load();
  $("yc").onchange = async () => { fillSubj(); await load(); };
  $("ys").onchange = load; $("ym").onchange = load; $("nc").onchange = loadNote;
  $("f1").onsubmit = async e => {
    e.preventDefault();
    const chapters = $("yl").value.split("\n").map(x => x.trim()).filter(Boolean);
    try { await setDoc(doc(db, "syllabus", sylDocId($("yc").value, $("ys").value, $("ym").value)), { chapters, medium: $("ym").value }, { merge: true }); toast("Chapters saved"); await load(); } catch (x) { toast(errText(x)); }
  };
  $("f2").onsubmit = async e => {
    e.preventDefault();
    if (!$("nc").value) { toast("Add chapters first"); return; }
    const url = $("nv").value.trim();
    if (url && !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) { toast("Paste a YouTube link"); return; }
    try {
      await setDoc(doc(db, "notes", `${$("yc").value}_${$("ys").value}_${$("nc").value}`), { text: $("nt").value });
      const c = Number($("yc").value), sb = $("ys").value, m = $("ym").value, k = sylKey(c, sb, m);
      const v = { ...(VIDEOS[k] || {}) }; if (url) v[$("nc").value] = url; else delete v[$("nc").value];
      await setDoc(doc(db, "syllabus", sylDocId(c, sb, m)), { videos: v }, { mergeFields: ["videos"] });
      VIDEOS[k] = v; toast("Saved");
    } catch (x) { toast(errText(x)); }
  };
}

/* ----- teacher: test series ----- */
const toLocalInput = ms => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
async function tabSeries(pane) {
  const tomorrow10 = (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.getTime(); })();
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <button class="btn btn-gold" id="new">+ Schedule a test</button>
    <form class="card" id="f" hidden novalidate>
      <h3 style="font-size:18px">New scheduled test</h3>
      <div class="field"><label for="tt">Test name</label><input id="tt" type="text" placeholder="e.g. Weekly Test 1"></div>
      <div class="two"><div class="field"><label for="tc">Class</label><select id="tc">${classOptions(10)}</select></div><div class="field"><label for="tsb">Subject</label><select id="tsb"></select></div></div>
      <div class="field"><label for="tm">Medium</label><select id="tm">${medOptions("English")}</select></div>
      <div class="field"><label>Chapters</label><div id="tch" class="chk"></div></div>
      <div class="two"><div class="field"><label for="tn">Questions</label><input id="tn" type="number" min="1" max="100" value="25"></div><div class="field"><label for="td">Duration (minutes)</label><input id="td" type="number" min="5" max="300" value="45"></div></div>
      <div class="field"><label for="ts1">Opens at</label><input id="ts1" type="datetime-local" value="${toLocalInput(tomorrow10)}"></div>
      <div class="field"><label for="ts2">Closes at</label><input id="ts2" type="datetime-local" value="${toLocalInput(tomorrow10 + 2 * 3600e3)}"></div>
      <p class="hint">Students can start any time between these two times. Each student gets the full duration, but the test always ends at the closing time. Results and rank are shown after closing.</p>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" type="submit" id="save">Schedule test</button>
    </form>
    <div class="sec-h"><h2 style="font-size:17px">Scheduled tests</h2><span id="cnt"></span></div>
    <div class="list" id="l"></div></div>`;
  const $ = id => document.getElementById(id);
  const fillSubj = () => { $("tsb").innerHTML = subjectOptions($("tc").value, $("tsb").value); };
  const fillCh = async () => {
    const chs = await getSyllabus(Number($("tc").value), $("tsb").value, $("tm").value);
    $("tch").innerHTML = chs.length ? `<label class="chk-row"><input type="checkbox" id="chAll" checked> <b>All chapters</b></label>` + chs.map((c, i) => `<label class="chk-row"><input type="checkbox" class="chx" value="${esc(c)}" checked> ${esc(c)}</label>`).join("") : `<p class="hint">No chapters yet. Add them in Syllabus & Notes.</p>`;
    const all = $("chAll"); if (all) all.onchange = () => $app.querySelectorAll(".chx").forEach(x => x.checked = all.checked);
  };
  fillSubj(); fillCh();
  $("tc").onchange = () => { fillSubj(); fillCh(); }; $("tsb").onchange = fillCh; $("tm").onchange = fillCh;
  $("new").onclick = () => $("f").hidden = !$("f").hidden;
  $("f").onsubmit = async e => {
    e.preventDefault(); const err = $("err"); err.hidden = true;
    const fail = m => { err.textContent = m; err.hidden = false; };
    const title = $("tt").value.trim(), cls = Number($("tc").value), subject = $("tsb").value, medium = $("tm").value;
    const chapters = [...$app.querySelectorAll(".chx:checked")].map(x => x.value);
    const n = Number($("tn").value), dur = Number($("td").value);
    const startMs = new Date($("ts1").value).getTime(), endMs = new Date($("ts2").value).getTime();
    if (!title) return fail("Enter a test name.");
    if (!chapters.length) return fail("Select at least one chapter.");
    if (!(n > 0)) return fail("Enter the number of questions.");
    if (!(dur >= 5)) return fail("Duration must be at least 5 minutes.");
    if (!startMs || !endMs) return fail("Set the opening and closing time.");
    if (endMs - startMs < dur * 60000) return fail("Closing time must be at least the test duration after the opening time.");
    $("save").disabled = true; $("save").textContent = "Picking questions…";
    try {
      const pool = (await getDocs(query(collection(db, "questions"), where("cls", "==", cls), where("subject", "==", subject)))).docs
        .map(d => ({ id: d.id, ch: d.data().chapter, m: medOf(d.data()) })).filter(q => q.m === medium && chapters.includes(q.ch));
      if (pool.length < n) { fail(`Only ${pool.length} questions are available in the selected chapters. Add more questions or lower the number.`); }
      else {
        // spread questions across chapters in syllabus order
        const picked = shuffle(pool).slice(0, n).sort((a, b) => chapters.indexOf(a.ch) - chapters.indexOf(b.ch));
        await addDoc(collection(db, "tests"), { title, cls, subject, medium, chapters, qids: picked.map(q => q.id), durationMin: dur, startMs, endMs, createdAtMs: Date.now(), createdAt: serverTimestamp() });
        toast("Test scheduled"); $("f").hidden = true; $("tt").value = ""; loadList();
      }
    } catch (x) { fail(errText(x)); }
    $("save").disabled = false; $("save").textContent = "Schedule test";
  };
  async function loadList() {
    const l = $("l"); l.innerHTML = `<div class="spin"></div>`;
    let tests = [];
    try { tests = (await getDocs(collection(db, "tests"))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.startMs - a.startMs); }
    catch (x) { l.innerHTML = `<div class="err">${esc(errText(x))}</div>`; return; }
    $("cnt").textContent = tests.length;
    l.innerHTML = "";
    if (!tests.length) { l.innerHTML = `<div class="empty"><h3>No tests scheduled</h3><p>Tap Schedule a test to set your first test series paper.</p></div>`; return; }
    tests.forEach(t => {
      const st = tStatus(t);
      const b = document.createElement("button"); b.className = "item";
      b.innerHTML = `<div class="mid"><b></b><span></span></div><div class="end"><span class="chip ${st === "live" ? "live" : st === "up" ? "up" : "end"}">${st === "live" ? "Live" : st === "up" ? "Upcoming" : "Ended"}</span></div>`;
      b.querySelector(".mid b").textContent = t.title;
      b.querySelector(".mid span").textContent = `Class ${t.cls} · ${medOf(t)} · ${t.subject} · ${fmtDT(t.startMs)} – ${fmtDT(t.endMs)} · ${t.qids.length} Q · ${t.durationMin} min`;
      const d = document.createElement("div"); d.className = "detail"; d.hidden = true;
      b.onclick = async () => { d.hidden = !d.hidden; if (!d.hidden) await seriesDetail(d, t, loadList); };
      l.appendChild(b); l.appendChild(d);
    });
  }
  loadList();
}
async function seriesDetail(d, t, reload) {
  d.innerHTML = `<div class="spin"></div>`;
  let rs = [];
  try { rs = (await getDocs(query(collection(db, "results"), where("testId", "==", t.id)))).docs.map(x => x.data()); } catch (e) {}
  rs.sort((a, b) => b.score - a.score || a.timeSec - b.timeSec);
  d.innerHTML = `<div class="kv"><span>Chapters</span><b>${esc((t.chapters || []).join(", "))}</b></div><div class="kv"><span>Submitted</span><b>${rs.length}</b></div>
    <div class="list" data-l></div>
    <button class="btn btn-danger" data-del>Delete test</button>`;
  const l = d.querySelector("[data-l]");
  if (!rs.length) l.innerHTML = `<p class="hint">No submissions yet.</p>`;
  rs.forEach((r, i) => {
    const it = document.createElement("div"); it.className = "item";
    it.innerHTML = `<div class="av ${i === 0 ? "r1" : ""}">${i + 1}</div><div class="mid"><b></b><span></span></div><div class="end">${r.score}<small>/${r.max}</small></div>`;
    it.querySelector(".mid b").textContent = r.name;
    it.querySelector(".mid span").textContent = `✓${r.correct} ✗${r.wrong} · ${fmtTime(r.timeSec)}`;
    l.appendChild(it);
  });
  const del = d.querySelector("[data-del]");
  del.onclick = async () => {
    if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Tap again to delete this test"; return; }
    try { await deleteDoc(doc(db, "tests", t.id)); toast("Test deleted"); reload(); } catch (x) { toast(errText(x)); }
  };
}

/* ----- teacher: notices ----- */
async function tabNotices(pane) {
  pane.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
    <form class="card" id="f" novalidate>
      <h3 style="font-size:18px">Post a notice</h3>
      <div class="field"><label for="nt1">Title</label><input id="nt1" type="text" placeholder="e.g. Holiday on Monday"></div>
      <div class="field"><label for="nt2">Message</label><textarea id="nt2" placeholder="Write the announcement"></textarea></div>
      <div class="two"><div class="field"><label for="nt3">Show to</label><select id="nt3"><option value="0">All classes</option>${CLASSES.map(c => `<option value="${c}">Class ${c}</option>`).join("")}</select></div>
      <label class="chk-row" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="nt4"> Pin to top</label></div>
      <div class="err" id="err" hidden></div>
      <button class="btn btn-navy" type="submit" id="save">Post notice</button>
    </form>
    <div class="sec-h"><h2 style="font-size:17px">Posted notices</h2><span id="cnt"></span></div>
    <div class="list" id="l"></div></div>`;
  const $ = id => document.getElementById(id);
  $("f").onsubmit = async e => {
    e.preventDefault(); $("err").hidden = true;
    const title = $("nt1").value.trim(), body = $("nt2").value.trim();
    if (!title || !body) { $("err").textContent = "Enter a title and a message."; $("err").hidden = false; return; }
    $("save").disabled = true;
    try { await addDoc(collection(db, "notices"), { title, body, cls: Number($("nt3").value), pinned: $("nt4").checked, atMs: Date.now(), at: serverTimestamp() }); $("f").reset(); toast("Notice posted"); load(); }
    catch (x) { $("err").textContent = errText(x); $("err").hidden = false; }
    $("save").disabled = false;
  };
  async function load() {
    const l = $("l"); l.innerHTML = `<div class="spin"></div>`;
    let ns = [];
    try { ns = await loadNotices(0); } catch (x) { l.innerHTML = `<div class="err">${esc(errText(x))}</div>`; return; }
    $("cnt").textContent = ns.length; l.innerHTML = "";
    if (!ns.length) { l.innerHTML = `<div class="empty"><h3>No notices yet</h3><p>Posted notices appear on students' home screen.</p></div>`; return; }
    ns.forEach(n => {
      const row = document.createElement("div"); row.className = "row";
      row.innerHTML = `<button class="btn btn-line" data-p>${n.pinned ? "Unpin" : "Pin"}</button><button class="btn btn-danger" data-d>Delete</button>`;
      row.querySelector("[data-p]").onclick = async () => { try { await updateDoc(doc(db, "notices", n.id), { pinned: !n.pinned }); load(); } catch (x) { toast(errText(x)); } };
      const del = row.querySelector("[data-d]");
      del.onclick = async () => { if (del.dataset.c !== "1") { del.dataset.c = "1"; del.textContent = "Tap again"; return; } try { await deleteDoc(doc(db, "notices", n.id)); toast("Notice deleted"); load(); } catch (x) { toast(errText(x)); } };
      l.appendChild(noticeCard(n, row));
    });
  }
  load();
}

/* ----- teacher: all student details ----- */
VIEWS.allStudents = async () => {
  $app.innerHTML = header("All student details", "JRP Education", true) + `<main><div class="in" id="in"><div class="loading" style="min-height:30vh"><div class="spin"></div></div></div></main>`;
  let users = [], secrets = {}, results = [];
  try {
    const [u, sc, r] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "secrets")), getDocs(collection(db, "results"))]);
    users = u.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.status !== "rejected");
    sc.docs.forEach(d => secrets[d.id] = d.data().password || "");
    results = r.docs.map(d => d.data());
  } catch (e) { document.getElementById("in").innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  const stat = {};
  results.forEach(r => { const x = stat[r.uid] || (stat[r.uid] = { n: 0, sum: 0, last: 0 }); x.n++; x.sum += Math.max(0, r.score) / r.max; x.last = Math.max(x.last, r.atMs || 0); });
  const rows = users.map(u => {
    const st = stat[u.id] || { n: 0, sum: 0, last: 0 };
    return { Name: u.name, Class: u.cls, Medium: medOf(u), Username: u.username, Password: secrets[u.id] || "", Mobile: u.mobile || "", "Father's name": u.father || "", School: u.school || "",
      Status: u.status === "pending" ? "Pending" : u.active === false ? "Inactive" : "Active", "Tests taken": st.n, "Average %": st.n ? Math.round(st.sum / st.n * 100) : "", "Last test": st.last ? fmtDate(st.last) : "" };
  }).sort((a, b) => a.Class - b.Class || MEDIUMS.indexOf(a.Medium) - MEDIUMS.indexOf(b.Medium) || a.Name.localeCompare(b.Name, "en", { sensitivity: "base" }));
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const box = document.getElementById("in");
  box.innerHTML = `
    <div class="filters"><div class="field"><label for="ac">Class</label><select id="ac">${classOptions("", true)}</select></div><div class="field"><label for="am">Medium</label><select id="am"><option value="">All mediums</option>${medOptions("")}</select></div></div>
    <div class="sec-h"><h2 style="font-size:17px">Students</h2><span id="cnt"></span></div>
    <div class="row"><button class="btn btn-navy" id="dl">Download Excel file</button><button class="btn btn-line" id="cp">Copy all</button></div>
    <div class="tbl-wrap"><table class="tbl" id="t"></table></div>`;
  const filtered = () => rows.filter(r => (!ac.value || r.Class === Number(ac.value)) && (!am.value || r.Medium === am.value));
  const ac = document.getElementById("ac"), am = document.getElementById("am");
  const draw = () => {
    const fr = filtered();
    document.getElementById("cnt").textContent = fr.length;
    document.getElementById("t").innerHTML = fr.length
      ? `<thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${fr.map(r => `<tr>${cols.map(c => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody>`
      : `<tbody><tr><td>No students match.</td></tr></tbody>`;
  };
  ac.onchange = draw; am.onchange = draw; draw();
  const csv = () => { const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; return "﻿" + [cols.map(q).join(","), ...filtered().map(r => cols.map(c => q(r[c])).join(","))].join("\r\n"); };
  document.getElementById("dl").onclick = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv()], { type: "text/csv;charset=utf-8" }));
    a.download = `JRP-students-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  document.getElementById("cp").onclick = async () => {
    const txt = filtered().map(r => `${r.Name} (Class ${r.Class}, ${r.Medium})\nUsername: ${r.Username}  Password: ${r.Password}\nMobile: ${r.Mobile}  Father: ${r["Father's name"]}\nTests: ${r["Tests taken"]}  Avg: ${r["Average %"]}${r["Average %"] !== "" ? "%" : ""}`).join("\n\n");
    try { await navigator.clipboard.writeText(txt); toast("Copied"); } catch (e) { toast("Copy not allowed on this phone"); }
  };
};
