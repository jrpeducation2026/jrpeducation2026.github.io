# JRP Education App – Kaise badlein (Guide)

Live app: https://jrpeducation2026.github.io

Ye app simple HTML + JavaScript mein bana hai. Koi build ya server nahi hai.
GitHub par file badal ke **Commit** karte hi 2–10 minute mein app update ho jata hai.

---

## Roz ka kaam (bina code ke, Teacher Panel se)

Teacher login karke ye sab app ke andar hi hota hai:

| Kaam | Kahan |
|---|---|
| Students dekhna, jodna, password reset, deactivate | **Students** tab |
| Sab students ki Excel list | Students → **All student details** |
| Questions jodna (ek-ek ya bahut saare) | **Questions** tab → *Add question* / *Paste many* |
| Chapter list aur notes | **Syllabus & Notes** tab |
| Fixed samay wala test | **Test Series** tab |
| Notice | **Notices** tab |
| Book payment approve karna | **Payments** tab |
| MCQ / notes AI se banwana | Upar **NareX** button |

---

## GitHub par file kaise badlein (phone se)

1. Chrome mein **github.com** kholo, `jrpeducation2026` se login karo
2. Repository **jrpeducation2026.github.io** kholo
3. File par tap karo (zyadatar kaam `app.js` mein hai)
4. Upar **✏️ (pencil / Edit)** dabao
5. Badlaav karo
6. **Commit changes** dabao

Tip: lambi file mein jagah dhoondhne ke liye neeche diye "Dhoondho" wale shabd use karo (browser ka *Find in page*).

---

## Aam badlaav – `app.js` mein

### UPI ID lagana (book payment ke liye)
Dhoondho: `const UPI_ID = "";`
Badlo: `const UPI_ID = "9876543210@ybl";` (apna UPI ID, double quotes ke andar)

### YouTube channel link
Dhoondho: `const YOUTUBE_URL =`

### Formula Book ka daam ya likhawat
Dhoondho: `const BOOKS = [`
`price: 9` ko badal sakte ho. `title`, `sub`, `points` mein text badal sakte ho.

### Free Mock Test ke questions
Dhoondho: `const MOCK = {`
`English: [...]` aur `Hindi: [...]` mein har sawal ka format:
`{ chapter: "...", q: "sawal", opts: ["A", "B", "C", "D"], ans: 1, sol: "hal" }`
`ans` mein sahi option ka number: **A = 0, B = 1, C = 2, D = 3**

### Default chapter list (NCERT)
Dhoondho: `const DEFAULT_SYLLABUS = {`
Note: Teacher Panel → *Syllabus & Notes* se save ki gayi list hamesha isse upar maani jaati hai, isliye aam taur par code badalne ki zaroorat nahi.

### Test ke niyam
Dhoondho: `const MARK_RIGHT = 4, MARK_WRONG = 1, CHAPTER_Q = 10, FULL_Q = 25;`
(sahi par +4, galat par −1, chapter test mein 10 sawal, full test mein 25)

### NareX ki roz ki limit
Dhoondho: `const NAREX = { daily: 15`
(student ke roz ke sawal; teacher ki limit `S.admin ? 100` mein hai)

---

## Nayi locked book jodna (developer ke liye)

1. PDF ko AES-256-GCM se encrypt karo: file = 12-byte IV + ciphertext (tag ke saath)
2. Encrypted file `books/<book-id>.bin` aur cover `books/<book-id>-cover.jpg` upload karo
3. `app.js` mein `BOOKS` list mein nayi entry jodo (`id`, `title`, `sub`, `price`, `pages`, `file`, `cover`, `points`)
4. Key (base64, 44 akshar) Teacher Panel → **Payments** → book ke **Book key** box mein save karo

Key kabhi GitHub par mat daalna.

---

## Files

| File | Kaam |
|---|---|
| `index.html` | App ka dhaancha, Install button |
| `app.js` | Saara logic: login, tests, teacher panel, NareX, books |
| `styles.css` | Rang aur design |
| `firebase-config.js` | Firebase project ka config (secret nahi hai) |
| `manifest.json`, `sw.js`, `icon-*.png` | Phone par install hone ke liye |
| `books/` | Locked (encrypted) books aur cover |
| `logo.png` | JRP logo |

## Firebase

- Project: **jrp-education** (console.firebase.google.com)
- Login: Authentication → Email/Password
- Data: Firestore Database (asia-south1)
- Database ke niyam (Security Rules): Firestore → **Rules** tab. Naye feature ke saath ye badalne pad sakte hain; purana rules hamesha wahan dikhta hai, badalne se pehle copy karke rakh lena.
- NareX AI: AI Logic → Gemini Developer API (free)
- Plan: **Spark (free)**, card nahi juda
