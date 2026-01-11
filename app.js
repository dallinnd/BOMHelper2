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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedData = localStorage.getItem('bom_data_v5'); // Bump version to v5
    
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

        // 1. Split Lines & Separate Legal Text
        const allLines = fullText.split(/\r?\n/);
        legalTextContent = allLines.slice(0, 260).join('\n');
        const rawScriptureText = allLines.slice(260).join('\n');

        // 2. Split by Double Newline (Paragraphs)
        const rawParagraphs = rawScriptureText.split(/\n\s*\n/);
        
        const tempWords = new Set();
        allVerses = []; 

        rawParagraphs.forEach((para, index) => {
            let cleanPara = para.trim();
            if (cleanPara.length < 5) return; // Skip empty stuff

            // --- SMARTER PARSING START ---
            // We check if the FIRST line looks like a reference (e.g. "1 Nephi 3:7")
            // This Regex looks for: Digits, Names, Digits, Colon, Digits
            // Example match: "1 Nephi 3:7" or "Alma 30:44"
            const lines = cleanPara.split('\n');
            let reference = "";
            let textContent = cleanPara;

            // If the first line is short and has a number/colon, assume it is the Header
            if (lines.length > 1 && lines[0].length < 50 && /\d+[:]\d+/.test(lines[0])) {
                reference = lines[0].trim(); // "1 Nephi 1:5"
                // Remove the first line from the text content
                textContent = lines.slice(1).join(' ').trim(); 
            } else {
                // Fallback: Use the first 30 chars as the reference
                reference = cleanPara.substring(0, 30).trim() + "...";
            }
            // --- SMARTER PARSING END ---

            allVerses.push({ 
                id: index, 
                ref: reference,  // Store distinct Reference
                text: textContent // Store distinct Text
            });

            // Tokenize words from text only
            const words = textContent.toLowerCase().match(/\b[a-z]{3,}\b/g);
            if (words) words.forEach(w => tempWords.add(w));
        });

        uniqueWords = Array.from(tempWords).sort();

        localStorage.setItem('bom_data_v5', JSON.stringify({
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
        
        // Highlight found word in the text
        const snippet = verse.text.replace(new RegExp(`(${q})`, 'gi'), '<b style="color:var(--primary);">$1</b>');

        box.innerHTML = `
            <span class="verse-ref">${verse.ref}</span>
            <div class="verse-snippet">${snippet}</div>
        `;
        // Pass distinct ref and text to popup
        box.onclick = () => openPopup(verse.ref, verse.text);
        resultsArea.appendChild(box);
    });
    
    if (results.length === 50) {
        const hint = document.createElement('div');
        hint.innerText = "Results limited to 50 verses.";
        hint.style.cssText = "text-align:center; padding:10px; color:var(--text-light);";
        resultsArea.appendChild(hint);
    }
}

// --- Popup & Legal Logic ---

function openPopup(title, text) {
    modalRef.innerText = title; // This is now JUST "1 Nephi 1:5"
    modalText.innerText = text; // This is the scripture text
    modalOverlay.classList.remove('hidden');
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
