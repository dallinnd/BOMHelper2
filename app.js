// Global State
let allVerses = [];
let uniqueWords = [];
let legalTextContent = ""; 
const BIBLE_URL = 'bom.txt';

// DOM Elements
const input = document.getElementById('search-input');
const sendBtn = document.getElementById('send-btn');
const suggestionsArea = document.getElementById('suggestions-area');
const resultsArea = document.getElementById('results-area');
const modalOverlay = document.getElementById('modal-overlay');
const modalText = document.getElementById('modal-text');
const modalRef = document.querySelector('.modal-ref');
const closeBtn = document.querySelector('.close-btn');
const legalLink = document.getElementById('legal-link');
// New Element for the button container in the modal
const modalFooter = document.createElement('div');
modalFooter.className = 'modal-footer';
document.querySelector('.modal-content').appendChild(modalFooter);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedData = localStorage.getItem('bom_data_v6'); // Bump to v6
    
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            allVerses = parsed.verses;
            uniqueWords = parsed.words;
            legalTextContent = parsed.legal;
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
        if (!response.ok) throw new Error("File not found or network error.");
        const fullText = await response.text();

        const allLines = fullText.split(/\r?\n/);
        legalTextContent = allLines.slice(0, 260).join('\n');
        const rawScriptureText = allLines.slice(260).join('\n');

        const rawParagraphs = rawScriptureText.split(/\n\s*\n/);
        
        const tempWords = new Set();
        allVerses = []; 

        rawParagraphs.forEach((para, index) => {
            let cleanPara = para.trim();
            if (cleanPara.length < 5) return;

            const lines = cleanPara.split('\n');
            let reference = "";
            let textContent = cleanPara;

            // Logic to find Reference and separate it from Text
            if (lines.length > 1 && lines[0].length < 50 && /\d+[:]\d+/.test(lines[0])) {
                reference = lines[0].trim(); 
                textContent = lines.slice(1).join(' ').trim(); 
            } else {
                reference = cleanPara.substring(0, 30).trim() + "...";
            }

            // --- NEW: Generate Chapter ID ---
            // If reference is "1 Nephi 3:7", chapterId becomes "1 Nephi 3"
            let chapterId = "Unknown";
            if (reference.includes(":")) {
                chapterId = reference.split(":")[0].trim();
            } else {
                chapterId = reference; // Fallback
            }

            allVerses.push({ 
                id: index, 
                ref: reference,  
                text: textContent,
                chapterId: chapterId // Store this for the chapter view
            });

            const words = textContent.toLowerCase().match(/\b[a-z]{3,}\b/g);
            if (words) words.forEach(w => tempWords.add(w));
        });

        uniqueWords = Array.from(tempWords).sort();

        localStorage.setItem('bom_data_v6', JSON.stringify({
            verses: allVerses,
            words: uniqueWords,
            legal: legalTextContent
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
        // Pass the whole verse object now
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

// --- Popup & Chapter Logic ---

function openPopup(verseOrTitle, textIfRef) {
    modalOverlay.classList.remove('hidden');
    modalFooter.innerHTML = ''; // Clear previous buttons
    
    // Check if called with just text (Legal link) or a Verse Object
    if (typeof verseOrTitle === 'string') {
        // Simple View (Legal Text)
        modalRef.innerText = verseOrTitle;
        modalText.innerText = textIfRef;
        return;
    }

    // Verse View
    const verse = verseOrTitle;
    modalRef.innerText = verse.ref;
    modalText.innerText = verse.text;
    modalText.scrollTop = 0; // Reset scroll

    // Create "View Chapter" Button
    const chapterBtn = document.createElement('button');
    chapterBtn.className = 'action-btn';
    chapterBtn.innerText = `View Chapter (${verse.chapterId})`;
    chapterBtn.onclick = () => viewChapter(verse.chapterId);
    
    modalFooter.appendChild(chapterBtn);
}

function viewChapter(chapterId) {
    // 1. Find all verses in this chapter
    const chapterVerses = allVerses.filter(v => v.chapterId === chapterId);
    
    // 2. Combine them (Double newline for spacing)
    // We do NOT include the reference, just the text.
    const fullText = chapterVerses.map(v => v.text).join('\n\n');

    // 3. Update Modal
    modalRef.innerText = chapterId; // Title becomes "2 Nephi 2"
    modalText.innerText = fullText;
    modalText.scrollTop = 0;

    // 4. Clear the footer (remove the button since we are already viewing the chapter)
    modalFooter.innerHTML = '';
}

if(legalLink) {
    legalLink.onclick = (e) => {
        e.preventDefault();
        openPopup("Legal Disclosure", legalTextContent || "Loading...");
    };
}

function closePopup() { modalOverlay.classList.add('hidden'); }
closeBtn.onclick = closePopup;
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closePopup(); });
