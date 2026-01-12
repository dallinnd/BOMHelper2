// Global State
let allVerses = [];
let uniqueWords = [];
let chapterList = []; // Ordered list of unique Chapter IDs (e.g. ["1 Nephi 1", "1 Nephi 2"...])
let legalTextContent = ""; 
let currentChapterIndex = -1; // Tracks where we are for next/prev logic
const BIBLE_URL = 'bom.txt';

// DOM Elements
const input = document.getElementById('search-input');
const sendBtn = document.getElementById('send-btn');
const suggestionsArea = document.getElementById('suggestions-area');
const resultsArea = document.getElementById('results-area');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.querySelector('.modal-content');
const modalText = document.getElementById('modal-text');
const modalRef = document.querySelector('.modal-ref');
const closeBtn = document.querySelector('.close-btn');
const legalLink = document.getElementById('legal-link');
const modalFooter = document.querySelector('.modal-footer') || createModalFooter();
const prevBtn = document.getElementById('prev-chapter-btn');
const nextBtn = document.getElementById('next-chapter-btn');

// Helper to create footer if missing (legacy check)
function createModalFooter() {
    const f = document.createElement('div');
    f.className = 'modal-footer';
    document.querySelector('.modal-content').appendChild(f);
    return f;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedData = localStorage.getItem('bom_data_v7'); 
    
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            allVerses = parsed.verses;
            uniqueWords = parsed.words;
            legalTextContent = parsed.legal;
            chapterList = parsed.chapters || []; 
            updateStatus("Ready to search.");
            return; 
        } catch (e) { console.warn("Saved data corrupt, reloading..."); }
    }
    await loadAndParseText();
});

function updateStatus(msg) {
    const el = document.querySelector('.placeholder-msg');
    if(el) el.innerText = msg;
}

async function loadAndParseText() {
    updateStatus("Downloading scripture file...");
    try {
        const response = await fetch(BIBLE_URL);
        if (!response.ok) throw new Error("File not found.");
        const fullText = await response.text();

        const allLines = fullText.split(/\r?\n/);
        legalTextContent = allLines.slice(0, 260).join('\n');
        const rawScriptureText = allLines.slice(260).join('\n');

        const rawParagraphs = rawScriptureText.split(/\n\s*\n/);
        
        const tempWords = new Set();
        const tempChapters = new Set();
        allVerses = []; 

        rawParagraphs.forEach((para, index) => {
            let cleanPara = para.trim();
            if (cleanPara.length < 5) return;

            const lines = cleanPara.split('\n');
            let reference = "";
            let textContent = cleanPara;

            if (lines.length > 1 && lines[0].length < 50 && /\d+[:]\d+/.test(lines[0])) {
                reference = lines[0].trim(); 
                textContent = lines.slice(1).join(' ').trim(); 
            } else {
                reference = cleanPara.substring(0, 30).trim() + "...";
            }

            // Chapter ID Logic
            let chapterId = "Unknown";
            if (reference.includes(":")) {
                chapterId = reference.split(":")[0].trim();
            } else {
                chapterId = reference; 
            }
            tempChapters.add(chapterId);

            allVerses.push({ 
                id: index, 
                ref: reference,  
                text: textContent,
                chapterId: chapterId 
            });

            const words = textContent.toLowerCase().match(/\b[a-z]{3,}\b/g);
            if (words) words.forEach(w => tempWords.add(w));
        });

        uniqueWords = Array.from(tempWords).sort();
        chapterList = Array.from(tempChapters); // Create ordered list of chapters

        localStorage.setItem('bom_data_v7', JSON.stringify({
            verses: allVerses,
            words: uniqueWords,
            legal: legalTextContent,
            chapters: chapterList
        }));

        updateStatus("Ready to search.");
    } catch (err) { updateStatus(`Error: ${err.message}`); }
}

// --- Search & UI ---

input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    suggestionsArea.innerHTML = '';
    if (val.length < 2) return;

    const matches = uniqueWords.filter(w => w.startsWith(val)).slice(0, 15);
    matches.forEach(word => {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.innerText = word;
        pill.onclick = () => {
            input.value = word;
            suggestionsArea.innerHTML = '';
            performSearch(word);
        };
        suggestionsArea.appendChild(pill);
    });
});

sendBtn.addEventListener('click', () => performSearch(input.value));
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(input.value); });

function performSearch(query) {
    if (!query) return;
    resultsArea.innerHTML = '';
    const q = query.toLowerCase();

    const results = allVerses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 50);

    if (results.length === 0) {
        resultsArea.innerHTML = '<div class="placeholder-msg">No matches found.</div>';
        return;
    }

    results.forEach(verse => {
        const box = document.createElement('div');
        box.className = 'verse-box';
        const snippet = verse.text.replace(new RegExp(`(${q})`, 'gi'), '<b style="color:var(--primary);">$1</b>');

        box.innerHTML = `
            <span class="verse-ref">${verse.ref}</span>
            <div class="verse-snippet">${snippet}</div>
        `;
        box.onclick = () => openPopup(verse);
        resultsArea.appendChild(box);
    });
    
    if (results.length === 50) {
        const hint = document.createElement('div');
        hint.innerText = "Results limited to 50 verses.";
        hint.style.cssText = "text-align:center; padding:10px; color:var(--text-light);";
        resultsArea.appendChild(hint);
    }
}

// --- Popup & Navigation Logic ---

function openPopup(verseOrTitle, textIfRef) {
    modalOverlay.classList.remove('hidden');
    modalFooter.innerHTML = '';
    
    // Hide Navigation Arrows initially (only show in Chapter View)
    prevBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    
    if (typeof verseOrTitle === 'string') {
        modalRef.innerText = verseOrTitle;
        modalText.innerText = textIfRef;
        return;
    }

    const verse = verseOrTitle;
    modalRef.innerText = verse.ref;
    modalText.innerText = verse.text;
    modalText.scrollTop = 0;

    const chapterBtn = document.createElement('button');
    chapterBtn.className = 'action-btn';
    chapterBtn.innerText = `View Chapter (${verse.chapterId})`;
    chapterBtn.onclick = () => viewChapter(verse.chapterId);
    
    modalFooter.appendChild(chapterBtn);
}

function viewChapter(chapterId) {
    // 1. Find index
    currentChapterIndex = chapterList.indexOf(chapterId);
    
    if (currentChapterIndex === -1) return;

    // 2. Load Content
    loadChapterContent(chapterId);

    // 3. Show Navigation Arrows
    prevBtn.classList.remove('hidden');
    nextBtn.classList.remove('hidden');

    // 4. Update Header State
    updateNavButtons();

    // 5. Clear footer (remove "View Chapter" button)
    modalFooter.innerHTML = '';
}

function loadChapterContent(chapterId) {
    const chapterVerses = allVerses.filter(v => v.chapterId === chapterId);
    // Combine text with verse numbers if desired, or just text.
    // Here we add verse numbers back for clarity in block reading
    const fullText = chapterVerses.map(v => {
        // Extract verse number from Ref if possible (e.g. "1:5" -> "5")
        const verseNum = v.ref.includes(':') ? v.ref.split(':')[1] : '';
        return verseNum ? `<b>${verseNum}</b> ${v.text}` : v.text;
    }).join('\n\n');

    modalRef.innerText = chapterId;
    modalText.innerHTML = fullText; // Use innerHTML to render bold numbers
    modalText.scrollTop = 0;
}

function updateNavButtons() {
    // Disable/Hide arrows if at start or end
    prevBtn.style.opacity = currentChapterIndex <= 0 ? '0.3' : '1';
    nextBtn.style.opacity = currentChapterIndex >= chapterList.length - 1 ? '0.3' : '1';
}

function navigateChapter(direction) {
    const newIndex = currentChapterIndex + direction;
    
    if (newIndex >= 0 && newIndex < chapterList.length) {
        currentChapterIndex = newIndex;
        const newChapterId = chapterList[newIndex];
        
        // Add a small fade animation effect
        modalText.style.opacity = 0;
        setTimeout(() => {
            loadChapterContent(newChapterId);
            updateNavButtons();
            modalText.style.opacity = 1;
        }, 150);
    }
}

// Button Listeners
prevBtn.onclick = () => navigateChapter(-1);
nextBtn.onclick = () => navigateChapter(1);

// --- Swipe Gestures ---
let touchStartX = 0;
let touchEndX = 0;

modalContent.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, {passive: true});

modalContent.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, {passive: true});

function handleSwipe() {
    // Ensure we are in Chapter View (arrows are visible)
    if (nextBtn.classList.contains('hidden')) return;

    const threshold = 50; // min distance to count as swipe
    const swipeDistance = touchStartX - touchEndX;

    if (swipeDistance > threshold) {
        // Swiped Left -> Next Chapter
        navigateChapter(1);
    } else if (swipeDistance < -threshold) {
        // Swiped Right -> Prev Chapter
        navigateChapter(-1);
    }
}

// --- Close Logic ---
if(legalLink) {
    legalLink.onclick = (e) => {
        e.preventDefault();
        openPopup("Legal Disclosure", legalTextContent || "Loading...");
    };
}
function closePopup() { modalOverlay.classList.add('hidden'); }
closeBtn.onclick = closePopup;
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closePopup(); });
