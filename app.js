/**
 * Data Management & Sync Logic
 */

const sheetUrl = "https://docs.google.com/spreadsheets/d/1uX0KsZ7YqNgJFz7LXAg3rVfkGi7LW0OUHCU76zpIvAg/export?format=csv";

let words = [];
let streakCounter = 0;
let lastSessionDate = "";

function loadData() {
    const data = localStorage.getItem("linguapp_words");
    if (data) {
        words = JSON.parse(data);
    }
    
    const streak = localStorage.getItem("linguapp_streak");
    if (streak) {
        streakCounter = parseInt(streak, 10);
    }

    const lastDate = localStorage.getItem("linguapp_lastDate");
    if (lastDate) {
        lastSessionDate = lastDate;
        const today = new Date().toISOString().split('T')[0];
        if (today !== lastDate) {
            const dateOld = new Date(lastDate);
            const dateNew = new Date(today);
            const diffTime = Math.abs(dateNew - dateOld);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays > 1) {
                streakCounter = 0;
                localStorage.setItem("linguapp_streak", streakCounter);
            }
        }
    }
}

function saveData() {
    localStorage.setItem("linguapp_words", JSON.stringify(words));
}

function saveStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (lastSessionDate !== today) {
        streakCounter += 1;
        lastSessionDate = today;
        localStorage.setItem("linguapp_streak", streakCounter);
        localStorage.setItem("linguapp_lastDate", lastSessionDate);
    }
}

async function fetchCSV() {
    try {
        const btn = document.getElementById("btn-sync");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> Synchronizuję...`;
        
        const response = await fetch(sheetUrl);
        const text = await response.text();
        parseAndSyncCSV(text);
        
        btn.innerHTML = originalText;
        renderDashboard();
    } catch (err) {
        console.error("Failed to fetch CSV", err);
        alert("Błąd synchronizacji. Sprawdź połączenie.");
        document.getElementById("btn-sync").innerHTML = `<span class="material-symbols-outlined text-sm">sync</span> Sync z arkuszem`;
    }
}

function parseAndSyncCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) return;
    
    const newWordsMap = new Map();
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const row = parseCSVLine(line);
        if (row.length >= 5) {
            const EnglishWord = row[0].trim();
            const WordId = EnglishWord.toLowerCase().replace(/\s+/g, '-');
            const obj = {
                WordId: WordId,
                EnglishWord: EnglishWord,
                PolishTranslation: row[1].trim(),
                ExampleSentence: row[2].trim(),
                TagId: row[3].trim(),
                CategoryName: row[4].trim()
            };
            newWordsMap.set(WordId, obj);
        }
    }
    
    let mappedExisting = new Map();
    words.forEach(w => mappedExisting.set(w.WordId, w));
    
    const finalWordsList = [];
    
    newWordsMap.forEach((val, key) => {
        if (mappedExisting.has(key)) {
            const exist = mappedExisting.get(key);
            val.Status = exist.Status;
            val.LastReviewed = exist.LastReviewed || null;
        } else {
            val.Status = 0;
            val.LastReviewed = null;
        }
        finalWordsList.push(val);
    });
    
    words = finalWordsList;
    saveData();
}

function parseCSVLine(text) {
    let ret = [''], i = 0, p = '', s = true;
    for (let l = text.length; i < l; i++) {
        let c = text.charAt(i);
        if (c === '"') {
            if (s && c === '"') { s = !s; }
            else if (text.charAt(i + 1) === '"') { ret[ret.length - 1] += '"'; i++; }
            else { s = !s; }
        } else if (c === ',' && s) { ret.push(''); }
        else { ret[ret.length - 1] += c; }
        p = c;
    }
    return ret;
}

/**
 * UI Manipulation & State
 */

const viewDashboard = document.getElementById("view-dashboard");
const viewLearning = document.getElementById("view-learning");
const viewSessionSummary = document.getElementById("view-session-summary");
const viewArchive = document.getElementById("view-archive");

// Category icons mapped pseudo-randomly by index
const catIcons = ["💼", "⚙️", "🏠", "🎨", "🚀", "💡", "🌍", "🏆"];
const catColors = ["blue", "purple", "orange", "pink", "emerald", "amber", "indigo", "red"];

function hideAllViews() {
    viewDashboard.classList.add("hidden");
    viewDashboard.classList.remove("flex");
    viewLearning.classList.add("hidden");
    viewLearning.classList.remove("flex");
    viewSessionSummary.classList.add("hidden");
    viewSessionSummary.classList.remove("flex");
    viewArchive.classList.add("hidden");
    viewArchive.classList.remove("flex");
}

function showDashboard() {
    hideAllViews();
    viewDashboard.classList.remove("hidden");
    viewDashboard.classList.add("flex");
    renderDashboard();
}

function renderDashboard() {
    document.getElementById("streak-count").innerText = `🔥 ${streakCounter} dni`;
    
    const mastered = words.filter(w => w.Status === 2).length;
    document.getElementById("mastered-count").innerText = mastered;
    
    const globalProgress = words.length > 0 ? Math.round((mastered / words.length) * 100) : 0;
    
    document.getElementById("global-progress-text").innerText = `${globalProgress}%`;
    document.getElementById("global-progress-bar").style.width = `${globalProgress}%`;
    
    const categoriesMap = new Map();
    words.forEach(w => {
        if (!categoriesMap.has(w.CategoryName)) {
            categoriesMap.set(w.CategoryName, { count: 0, tagId: w.TagId });
        }
        categoriesMap.get(w.CategoryName).count++;
    });
    
    const container = document.getElementById("categories-container");
    container.innerHTML = "";
    
    if (categoriesMap.size === 0) {
        container.innerHTML = `<p class="col-span-2 text-center text-sm text-slate-500 py-8">Brak danych. Kliknij Sync z arkuszem.</p>`;
        return;
    }
    
    let index = 0;
    categoriesMap.forEach((data, catName) => {
        const icon = catIcons[index % catIcons.length];
        const color = catColors[index % catColors.length];
        const catWords = words.filter(w => w.CategoryName === catName);
        const catMastered = catWords.filter(w=>w.Status === 2).length;
        const progressPct = catWords.length > 0 ? (catMastered / catWords.length) * 100 : 0;

        const btn = document.createElement("button");
        btn.className = `group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-surface-dark border-b-4 border-slate-200 dark:border-slate-700 active:border-b-0 active:translate-y-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 h-44 w-full`;
        btn.onclick = () => startSession(catName, "learn");
        
        btn.innerHTML = `
            <div class="h-16 w-16 mb-3 rounded-2xl bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center text-3xl">
                ${icon}
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">${catName}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">${data.count} słówek</p>
            <div class="absolute top-3 right-3 text-xs font-bold text-slate-300">
                 ${Math.round(progressPct)}%
            </div>
            <div class="absolute bottom-0 left-0 h-1 bg-${color}-400 rounded-b-2xl" style="width: ${progressPct}%"></div>
        `;
        container.appendChild(btn);
        index++;
    });
}

/**
 * Learning / Exam Session State
 */
let sessionWords = [];
let currentWordIndex = 0;
let sessionType = "learn";
let currentWord = null;
let isFlipped = false;
let examScore = 0;

function startSession(categoryName, type) {
    sessionType = type;
    examScore = 0;
    document.getElementById("exam-score-container").classList.add("hidden");

    let pool = [];
    if (type === "learn") {
        document.getElementById("session-category-name").innerText = categoryName;
        pool = words.filter(w => w.CategoryName === categoryName && w.Status < 2);
        pool = shuffleList(pool).slice(0, 15);
    } else if (type === "exam") {
        document.getElementById("session-category-name").innerText = "Egzamin (Mix)";
        pool = shuffleList([...words]).slice(0, 30);
        document.getElementById("exam-score-container").classList.remove("hidden");
        document.getElementById("exam-score").innerText = "0";
    }
    
    if (pool.length === 0) {
        alert("Brak słówek do nauki w tej kategorii! Zresetuj je z Archiwum.");
        return;
    }
    
    sessionWords = pool;
    currentWordIndex = 0;
    
    hideAllViews();
    viewLearning.classList.remove("hidden");
    viewLearning.classList.add("flex");
    loadWordCard();
}

function loadWordCard() {
    isFlipped = false;
    document.getElementById("flashcard-inner").classList.remove("flip-active");
    document.getElementById("flashcard-actions").classList.add("opacity-0", "pointer-events-none");
    
    currentWord = sessionWords[currentWordIndex];
    
    document.getElementById("card-front-pl").innerText = currentWord.PolishTranslation;
    
    let clozeSentence = currentWord.ExampleSentence;
    // VERY simple case insensitive replacement
    const wordPattern = new RegExp(currentWord.EnglishWord, "gi");
    clozeSentence = currentWord.ExampleSentence.replace(wordPattern, `____`);
    document.getElementById("card-front-en-sentence").innerHTML = clozeSentence;

    document.getElementById("card-back-en").innerText = currentWord.EnglishWord;
    const backSentence = currentWord.ExampleSentence.replace(wordPattern, `<span class="text-primary font-bold dark:text-primary">$&</span>`);
    document.getElementById("card-back-en-sentence").innerHTML = backSentence;
    document.getElementById("card-back-pl-sentence").innerText = `"${currentWord.PolishTranslation}"`;

    const total = sessionWords.length;
    document.getElementById("session-progress-text").innerText = `${currentWordIndex + 1} / ${total}`;
    document.getElementById("session-progress-bar").style.width = `${((currentWordIndex) / total) * 100}%`;
}

function flipCard() {
    if (isFlipped) return;
    isFlipped = true;
    document.getElementById("flashcard-inner").classList.add("flip-active");
    document.getElementById("flashcard-actions").classList.remove("opacity-0", "pointer-events-none");
    
    playTTS(currentWord.EnglishWord);
}

function handleAnswer(correct) {
    if (sessionType === "learn") {
        const idx = words.findIndex(w => w.WordId === currentWord.WordId);
        if (idx !== -1) {
            if (correct) {
                words[idx].Status = 2; // Mastered
            } else {
                words[idx].Status = 1; // Learning
            }
        }
    } else if (sessionType === "exam") {
        if (correct) examScore++;
        document.getElementById("exam-score").innerText = examScore;
    }

    currentWordIndex++;
    if (currentWordIndex >= sessionWords.length) {
        finishSession();
    } else {
        loadWordCard();
    }
}

function finishSession() {
    if (sessionType === "learn") {
        saveData(); 
        saveStreak();
    }
    
    hideAllViews();
    viewSessionSummary.classList.remove("hidden");
    viewSessionSummary.classList.add("flex");

    const titleElem = document.getElementById("summary-title");
    const textElem = document.getElementById("summary-text");

    if (sessionType === "learn") {
        titleElem.innerText = "Koniec Sesji!";
        textElem.innerText = "Świetna robota. Twoje powtórki zostały zapisane.";
    } else {
        titleElem.innerText = "Wynik Egzaminu";
        textElem.innerText = `Zdobyłeś ${examScore} punktów na ${sessionWords.length} możliwych!`;
    }
}

/**
 * Archive
 */
function showArchive() {
    hideAllViews();
    viewArchive.classList.remove("hidden");
    viewArchive.classList.add("flex");
    
    const archiveList = document.getElementById("archive-list-container");
    archiveList.innerHTML = "";
    
    const mastered = words.filter(w => w.Status === 2);
    document.getElementById("archive-count").innerText = `${mastered.length} słów`;
    
    if (mastered.length === 0) {
        archiveList.innerHTML = `<p class="text-center text-slate-500 mt-10">Brak opanowanych słówek.</p>`;
        return;
    }

    mastered.forEach(w => {
        const div = document.createElement("div");
        div.className = "active-press transition-all relative flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-xl shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#0d1c12] border-2 border-slate-100 dark:border-slate-800";
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0 cursor-pointer" onclick="playTTS('${w.EnglishWord}')">
                    <span class="material-symbols-outlined text-[20px]">volume_up</span>
                </div>
                <div class="flex flex-col">
                    <p class="text-lg font-extrabold text-slate-800 dark:text-white leading-tight">${w.EnglishWord}</p>
                    <p class="text-sm font-medium text-slate-400 dark:text-slate-500">${w.PolishTranslation}</p>
                </div>
            </div>
            <button aria-label="Cofnij do nauki" onclick="resetToLearning('${w.WordId}')" class="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors">
                <span class="material-symbols-outlined group-hover:scale-110 transition-transform">replay</span>
            </button>
        `;
        archiveList.appendChild(div);
    });
}

function resetToLearning(wordId) {
    const idx = words.findIndex(w => w.WordId === wordId);
    if (idx !== -1) {
        words[idx].Status = 1;
        saveData();
        showArchive();
    }
}


/**
 * Utils
 */
function shuffleList(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function playTTS(text) {
    if ('speechSynthesis' in window) {
        // Cancel any pending audio
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
    }
}

// Bindings
document.getElementById("btn-sync").addEventListener("click", fetchCSV);
document.getElementById("btn-start-exam").addEventListener("click", () => startSession(null, "exam"));

// Init
window.addEventListener("DOMContentLoaded", () => {
    loadData();
    showDashboard();
});
