/* ==========================================================================
   RT Notation Software - Playback, Web Audio, & Tanpura Engine
   ========================================================================== */

let audioCtx = null;
let activeOctave = 'middle';
let activeAvarthanamIndex = 0;
let activeCellIndex = 0;
let activeOscillators = [];
let playbackRunning = false;
let stopPlaybackFlag = false;

// Tanpura Audio Node Tracking Elements
let tanpuraAudioElement = null;
let tanpuraSourceNode = null;
let tanpuraGainNode = null;

let avarthanamsCount = 1;
let totalBeatsPerCycle = 8;

let cellSpeeds = [new Array(8).fill(1)];
let cellNotes = [Array.from({length: 8}, () => [])];
let internalCursorIndex = 0;

// Direct Extension Lookups matching your compressed directory structure
const TanpuraFileExtensions = {
    'a': 'mp3', 'a-sharp': 'mp3', 'b': 'mp3', 'c': 'mp3', 'c-sharp': 'mp3',
    'd': 'aac', 'd-sharp': 'aac', 'e': 'aac', 'f': 'aac', 'f-sharp': 'aac',
    'g': 'aac', 'g-sharp': 'aac'
};

const SwaraRatios = {
    'S': 1.0, 'R1': 256/243, 'R2': 9/8, 'R3': 32/27, 'G1': 9/8, 'G2': 6/5, 'G3': 5/4,
    'M1': 4/3, 'M2': 45/32, 'P': 3/2, 'D1': 128/81, 'D2': 5/3, 'D3': 16/9, 'N1': 5/3, 'N2': 9/5, 'N3': 15/8
};

const melakartaTableSource = [
    { id: 1, name: "Kanakāngi", r:"R1", g:"G1", m:"M1", d:"D1", n:"N1" },
    { id: 15, name: "Māyāmāḷavagowla", r:"R1", g:"G3", m:"M1", d:"D1", n:"N3" },
    { id: 22, name: "Kharaharapriyā", r:"R2", g:"G2", m:"M1", d:"D2", n:"N2" },
    { id: 29, name: "Dhīraśankarābharaṇam", r:"R2", g:"G3", m:"M1", d:"D2", n:"N3" },
    { id: 65, name: "Mechakalyāni", r:"R2", g:"G3", m:"M2", d:"D2", n:"N3" }
];

// App Navigation & Dynamic Rendering Layout
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if (screenId === 'playerScreen') {
        buildWorkspaceDOM();
    }
}

function toggleMenu(id) {
    document.getElementById(id).classList.toggle('open');
}

function changeFont(font) {
    document.documentElement.style.setProperty('--font-family', font);
}

function changeTheme(theme) {
    const root = document.documentElement;
    if(theme === 'cream') {
        root.style.setProperty('--bg-color', '#fdf6e3'); root.style.setProperty('--container-bg', '#f5edd5');
        root.style.setProperty('--text-color', '#586e75'); root.style.setProperty('--border-color', '#cb4b16');
    } else if(theme === 'dark') {
        root.style.setProperty('--bg-color', '#073642'); root.style.setProperty('--container-bg', '#002b36');
        root.style.setProperty('--text-color', '#93a1a1'); root.style.setProperty('--border-color', '#2aa198');
    } else if(theme === 'highcontrast') {
        root.style.setProperty('--bg-color', '#000000'); root.style.setProperty('--container-bg', '#000000');
        root.style.setProperty('--text-color', '#ffffff'); root.style.setProperty('--border-color', '#ffffff');
    } else if(theme === 'cyberpunk') {
        root.style.setProperty('--bg-color', '#1a0033'); root.style.setProperty('--container-bg', '#2d004d');
        root.style.setProperty('--text-color', '#00ffcc'); root.style.setProperty('--border-color', '#ff007f');
    } else if(theme === 'solarized') {
        root.style.setProperty('--bg-color', '#fdf6e3'); root.style.setProperty('--container-bg', '#ffffff');
        root.style.setProperty('--text-color', '#657b83'); root.style.setProperty('--border-color', '#93a1a1');
    } else if(theme === 'forest') {
        root.style.setProperty('--bg-color', '#1e2d24'); root.style.setProperty('--container-bg', '#2a3b30');
        root.style.setProperty('--text-color', '#e1ecd7'); root.style.setProperty('--border-color', '#4e6e58');
    } else if(theme === 'sepia') {
        root.style.setProperty('--bg-color', '#704214'); root.style.setProperty('--container-bg', '#3d2314');
        root.style.setProperty('--text-color', '#f4eedb'); root.style.setProperty('--border-color', '#a0522d');
    } else if(theme === 'nord') {
        root.style.setProperty('--bg-color', '#2e3440'); root.style.setProperty('--container-bg', '#3b4252');
        root.style.setProperty('--text-color', '#d8dee9'); root.style.setProperty('--border-color', '#88c0d0');
    } else if(theme === 'minimal') {
        root.style.setProperty('--bg-color', '#f8f9fa'); root.style.setProperty('--container-bg', '#ffffff');
        root.style.setProperty('--text-color', '#212529'); root.style.setProperty('--border-color', '#ced4da');
    } else {
        root.style.setProperty('--bg-color', '#f4f7f6'); root.style.setProperty('--container-bg', '#ffffff');
        root.style.setProperty('--text-color', '#333333'); root.style.setProperty('--border-color', '#dddddd');
    }
}

// Populating Rāgam Selection Form UI Element
const rSelect = document.getElementById('melakartaSelect');
if (rSelect) {
    melakartaTableSource.forEach(m => {
        let o = document.createElement('option'); o.value = m.id; o.innerText = `${m.id}. ${m.name}`;
        if(m.id === 15) o.selected = true; 
        rSelect.appendChild(o);
    });
}

// Audio System Initialization Matrix
function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function toggleTanpuraLayer() {
    initAudioContext();
    const isChecked = document.getElementById('tanpuraToggle').checked;
    if (isChecked) {
        startTanpuraStream();
    } else {
        stopTanpuraStream();
    }
}

function startTanpuraStream() {
    stopTanpuraStream(); 

    const pitchSelect = document.getElementById('pitchSelect');
    const activeOption = pitchSelect.options[pitchSelect.selectedIndex];
    const pitchName = activeOption.getAttribute('data-name');
    const ext = TanpuraFileExtensions[pitchName] || 'mp3';
    
    // Core file reference pointer targeting your workspace directory
    const filename = `${pitchName}-tanpura-thick.${ext}`;
    tanpuraAudioElement = new Audio(filename);
    tanpuraAudioElement.loop = true;
    tanpuraAudioElement.crossOrigin = "anonymous";

    tanpuraSourceNode = audioCtx.createMediaElementSource(tanpuraAudioElement);
    tanpuraGainNode = audioCtx.createGain();
    
    const currentVol = parseFloat(document.getElementById('tanpuraVol').value);
    tanpuraGainNode.gain.setValueAtTime(currentVol, audioCtx.currentTime);

    tanpuraSourceNode.connect(tanpuraGainNode);
    tanpuraGainNode.connect(audioCtx.destination);

    tanpuraAudioElement.play().catch(err => {
        console.log("Interactivity blocker active. Waiting for player trigger initialization.", err);
    });
}

function stopTanpuraStream() {
    if (tanpuraAudioElement) {
        tanpuraAudioElement.pause();
        tanpuraAudioElement = null;
    }
    if (tanpuraSourceNode) {
        tanpuraSourceNode.disconnect();
        tanpuraSourceNode = null;
    }
}

function updateLiveTanpuraPitch() {
    if (document.getElementById('tanpuraToggle') && document.getElementById('tanpuraToggle').checked) {
        startTanpuraStream();
    }
}

function adjustTanpuraVolume(val) {
    if (tanpuraGainNode && audioCtx) {
        tanpuraGainNode.gain.setValueAtTime(parseFloat(val), audioCtx.currentTime);
    }
}

function getMaxCapacity(avarthanamIdx, cellIdx) {
    let baseNadai = parseInt(document.getElementById('nadaiSelect').value);
    return baseNadai * cellSpeeds[avarthanamIdx][cellIdx];
}

function buildWorkspaceDOM() {
    const workspace = document.getElementById('studioWorkspace');
    if (!workspace) return;
    workspace.innerHTML = "";
    for (let a = 0; a < avarthanamsCount; a++) {
        let section = document.createElement('div');
        section.className = "avarthanam-block";
        let header = document.createElement('div');
        header.className = "avarthanam-header";
        header.innerText = `Āvarthanam Cycle #${a + 1}`;
        section.appendChild(header);

        let gridContainer = document.createElement('div');
        gridContainer.className = "notation-grid";
        
        for (let i = 0; i < totalBeatsPerCycle; i++) {
            let div = document.createElement('div');
            div.className = `grid-cell ${(a === activeAvarthanamIndex && i === activeCellIndex) ? 'focused' : ''}`;
            div.id = `c-${a}-${i}`;
            if (cellSpeeds[a][i] === 2) div.classList.add('speed-2');
            if (cellSpeeds[a][i] === 4) div.classList.add('speed-3');

            div.onclick = () => focusCell(a, i);
            let speedText = cellSpeeds[a][i] === 2 ? "Speed 2" : (cellSpeeds[a][i] === 4 ? "Speed 3" : "");

            div.innerHTML = `
                <span class="cell-number">${i + 1}</span>
                <span class="cell-speed-indicator" id="speed-ind-${a}-${i}">${speedText}</span>
                <div class="swaram-wrapper"><pre class="swaram-input" id="s-${a}-${i}">-</pre></div>
                <input type="text" class="lyrics-input" placeholder="lyrics" onclick="event.stopPropagation();">`;
            gridContainer.appendChild(div);
        }
        section.appendChild(gridContainer);
        workspace.appendChild(section);
        for (let i = 0; i < totalBeatsPerCycle; i++) renderCellText(a, i);
    }
}

function focusCell(aIdx, cIdx) {
    let oldCell = document.getElementById(`c-${activeAvarthanamIndex}-${activeCellIndex}`);
    if(oldCell) oldCell.classList.remove('focused');
    activeAvarthanamIndex = aIdx; activeCellIndex = cIdx;
    let newCell = document.getElementById(`c-${activeAvarthanamIndex}-${activeCellIndex}`);
    if(newCell) newCell.classList.add('focused');
    if (cellNotes[activeAvarthanamIndex] && cellNotes[activeAvarthanamIndex][activeCellIndex]) {
        internalCursorIndex = cellNotes[activeAvarthanamIndex][activeCellIndex].length;
    }
    renderCellText(activeAvarthanamIndex, activeCellIndex);
}

function renderCellText(a, idx) {
    const inputElement = document.getElementById(`s-${a}-${idx}`);
    if (!inputElement || !cellNotes[a] || !cellNotes[a][idx]) return;
    let notesArr = [...cellNotes[a][idx]];
    if (notesArr.length === 0) { inputElement.innerText = "-"; return; }
    if (a === activeAvarthanamIndex && idx === activeCellIndex && !playbackRunning) {
        notesArr.splice(internalCursorIndex, 0, "|");
    }
    inputElement.innerText = notesArr.join(" ");
}

function handleInput(note) {
    let maxCap = getMaxCapacity(activeAvarthanamIndex, activeCellIndex);
    if (cellNotes[activeAvarthanamIndex][activeCellIndex].length >= maxCap) return;
    let formattedNote = note;
    if(note !== ',') {
        if(activeOctave === 'below') formattedNote = note + "̣";
        if(activeOctave === 'above') formattedNote = note + "̇";
    }
    cellNotes[activeAvarthanamIndex][activeCellIndex].splice(internalCursorIndex, 0, formattedNote);
    internalCursorIndex++;
    renderCellText(activeAvarthanamIndex, activeCellIndex);
}

function applyGamakam(symbol) {
    if (internalCursorIndex > 0) {
        let targetIdx = internalCursorIndex - 1;
        let targetNote = cellNotes[activeAvarthanamIndex][activeCellIndex][targetIdx];
        if (!targetNote.includes('/') && !targetNote.includes('\\') && !targetNote.includes('~') && targetNote !== ',') {
            cellNotes[activeAvarthanamIndex][activeCellIndex][targetIdx] = targetNote + symbol;
            renderCellText(activeAvarthanamIndex, activeCellIndex);
        }
    }
}

function handleBackspace() {
    if (internalCursorIndex > 0) {
        cellNotes[activeAvarthanamIndex][activeCellIndex].splice(internalCursorIndex - 1, 1);
        internalCursorIndex--;
        renderCellText(activeAvarthanamIndex, activeCellIndex);
    }
}

function setSpeed(multiplier) {
    cellSpeeds[activeAvarthanamIndex][activeCellIndex] = multiplier;
    buildWorkspaceDOM();
}

if (document.getElementById('speed1Btn')) document.getElementById('speed1Btn').onclick = () => setSpeed(1);
if (document.getElementById('speed2Btn')) document.getElementById('speed2Btn').onclick = () => setSpeed(2);
if (document.getElementById('speed3Btn')) document.getElementById('speed3Btn').onclick = () => setSpeed(4);

if (document.getElementById('addAvarthanamBtn')) {
    document.getElementById('addAvarthanamBtn').onclick = function() {
        avarthanamsCount++;
        cellSpeeds.push(new Array(totalBeatsPerCycle).fill(1));
        cellNotes.push(Array.from({length: totalBeatsPerCycle}, () => []));
        buildWorkspaceDOM();
    };
}

function clearActiveCell() { cellNotes[activeAvarthanamIndex][activeCellIndex] = []; internalCursorIndex = 0; renderCellText(activeAvarthanamIndex, activeCellIndex); }
function clearAllCells() { for(let a=0; a<avarthanamsCount; a++) { for(let i=0; i<totalBeatsPerCycle; i++) cellNotes[a][i] = []; } buildWorkspaceDOM(); }

function getNoteFreq(swaraChar) {
    if (!swaraChar || swaraChar === ',') return 0;
    const base = parseFloat(document.getElementById('pitchSelect').value);
    const mId = parseInt(document.getElementById('melakartaSelect').value);
    const raga = melakartaTableSource.find(m => m.id === mId) || melakartaTableSource[1];
    
    let cleanKey = swaraChar.replace(/[̣̇/\~\\\s]/g, '');
    let code = cleanKey;

    if(cleanKey === 'R') code = raga.r;
    if(cleanKey === 'G') code = raga.g;
    if(cleanKey === 'M') code = raga.m;
    if(cleanKey === 'D') code = raga.d;
    if(cleanKey === 'N') code = raga.n;

    let ratio = SwaraRatios[code] || 1.0;
    if(swaraChar.includes('̣')) ratio *= 0.5;
    if(swaraChar.includes('̇')) ratio *= 2.0;

    return base * ratio;
}

function executeSynthTone(swaraString, nextSwaraString, duration) {
    if (!swaraString || swaraString.startsWith(',')) return;
    
    const type = document.getElementById('instrumentSelect').value;
    const vol = parseFloat(document.getElementById('toneVol').value);
    const now = audioCtx.currentTime;

    let startFreq = getNoteFreq(swaraString);
    if (startFreq === 0) return;
    
    const mainOsc = audioCtx.createOscillator();
    const mainGain = audioCtx.createGain();
    mainOsc.connect(mainGain);
    mainGain.connect(audioCtx.destination);
    activeOscillators.push(mainOsc);

    mainOsc.type = (type === 'veena') ? 'triangle' : (type === 'flute' ? 'sine' : 'square');
    mainGain.gain.setValueAtTime((type === 'piano' ? vol * 0.15 : vol * 0.4), now);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    mainOsc.frequency.setValueAtTime(startFreq, now);

    if (swaraString.includes('/') || swaraString.includes('\\')) {
        let endFreq = (nextSwaraString && nextSwaraString !== ',') ? getNoteFreq(nextSwaraString) : startFreq * 1.25;
        mainOsc.frequency.linearRampToValueAtTime(endFreq, now + duration);
    } else if (swaraString.includes('~')) {
        let varBound = startFreq * 0.035;
        mainOsc.frequency.linearRampToValueAtTime(startFreq + varBound, now + (duration * 0.25));
        mainOsc.frequency.linearRampToValueAtTime(startFreq - varBound, now + (duration * 0.5));
        mainOsc.frequency.linearRampToValueAtTime(startFreq + varBound, now + (duration * 0.75));
        mainOsc.frequency.linearRampToValueAtTime(startFreq, now + duration);
    }

    mainOsc.start(now);
    mainOsc.stop(now + duration);
}

function triggerMetronomeClick(time) {
    const vol = parseFloat(document.getElementById('metroVol').value);
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(900, time);
    gain.gain.setValueAtTime(vol * 0.4, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(time); osc.stop(time + 0.06);
}

if (document.getElementById('playBtn')) {
    document.getElementById('playBtn').onclick = function() {
        initAudioContext();
        if(playbackRunning) return;
        playbackRunning = true; stopPlaybackFlag = false;
        runLoopSequence();
    };
}

async function runLoopSequence() {
    let bpm = parseInt(document.getElementById('tempo').value) || 80;
    let baseBeatLen = 60 / bpm;

    for(let a=0; a<avarthanamsCount; a++) {
        if(stopPlaybackFlag) break;
        for(let i=0; i<totalBeatsPerCycle; i++) {
            if(stopPlaybackFlag) break;
            focusCell(a, i);

            if(document.getElementById('metroToggle') && document.getElementById('metroToggle').checked) {
                triggerMetronomeClick(audioCtx.currentTime);
            }

            let maxCap = getMaxCapacity(a, i);
            let executionNotes = [...cellNotes[a][i]];
            while(executionNotes.length < maxCap) executionNotes.push(',');

            let noteLen = baseBeatLen / maxCap;

            for(let nIdx = 0; nIdx < executionNotes.length; nIdx++) {
                if(stopPlaybackFlag) break;
                let currentSwara = executionNotes[nIdx];
                let nextSwara = executionNotes[nIdx + 1] || null;
                
                executeSynthTone(currentSwara, nextSwara, noteLen);
                await new Promise(r => setTimeout(r, noteLen * 1000));
            }
        }
    }

    if(document.getElementById('repeatToggle') && document.getElementById('repeatToggle').checked && !stopPlaybackFlag) {
        runLoopSequence();
    } else {
        playbackRunning = false;
        focusCell(0, 0);
    }
}

if (document.getElementById('stopBtn')) {
    document.getElementById('stopBtn').onclick = function() {
        stopPlaybackFlag = true; playbackRunning = false;
        activeOscillators.forEach(o => { try{o.stop();}catch(e){} });
        activeOscillators = [];
    };
}

const bB = document.getElementById('octaveBelowBtn'); 
const bM = document.getElementById('octaveMiddleBtn'); 
const bA = document.getElementById('octaveAboveBtn');

function setOct(mode) { 
    activeOctave = mode; 
    if(bB) bB.classList.toggle('active', mode==='below'); 
    if(bM) bM.classList.toggle('active', mode==='middle'); 
    if(bA) bA.classList.toggle('active', mode==='above'); 
}

if(bB) bB.onclick = () => setOct('below'); 
if(bM) bM.onclick = () => setOct('middle'); 
if(bA) bA.onclick = () => setOct('above');

// Event Handlers for Physical Alphanumeric Keyboards
window.addEventListener('keydown', (e) => {
    if(!document.getElementById('playerScreen') || !document.getElementById('playerScreen').classList.contains('active')) return;
    if(document.activeElement.classList.contains('lyrics-input')) return;
    initAudioContext();
    
    if (e.key === 'Backspace') { handleBackspace(); e.preventDefault(); return; }
    if (e.key === 'Delete') { clearActiveCell(); e.preventDefault(); return; }
    
    if (e.key === 'ArrowLeft') {
        if (internalCursorIndex > 0) { internalCursorIndex--; renderCellText(activeAvarthanamIndex, activeCellIndex); }
        else if (activeCellIndex > 0) { focusCell(activeAvarthanamIndex, activeCellIndex - 1); }
        e.preventDefault(); return;
    }
    if (e.key === 'ArrowRight') {
        if (internalCursorIndex < cellNotes[activeAvarthanamIndex][activeCellIndex].length) { internalCursorIndex++; renderCellText(activeAvarthanamIndex, activeCellIndex); }
        else if (activeCellIndex < totalBeatsPerCycle - 1) { focusCell(activeAvarthanamIndex, activeCellIndex + 1); }
        e.preventDefault(); return;
    }

    let k = e.key.toUpperCase();
    if(['S','R','G','M','P','D','N',','].includes(k)) { handleInput(k); e.preventDefault(); }
});

// Initialize workspace automatically if player is visible on page initialization
document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById('playerScreen') && document.getElementById('playerScreen').classList.contains('active')) {
        buildWorkspaceDOM();
    }
});
