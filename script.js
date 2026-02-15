// --- STATE ---
let peer = null;
let conn = null;
let isHost = false;

// Game Config
let turnTime = 30;
let mySecret = "";
let mySecretSet = false;
let opSecretSet = false;
let isMyTurn = false;
let timerInt = null;
let timeLeft = 0;
let myRematch = false;
let opRematch = false;

// --- DOM ELEMENTS ---
const els = {
    screens: {
        menu: document.getElementById('screen-menu'),
        lobby: document.getElementById('screen-lobby'),
        setup: document.getElementById('screen-setup'),
        game: document.getElementById('screen-game'),
        end: document.getElementById('screen-end')
    },
    myId: document.getElementById('my-peer-id'),
    joinInput: document.getElementById('join-id'),
    lobbyStatus: document.getElementById('lobby-status'),
    secretInput: document.getElementById('secret-input'),
    hostControl: document.getElementById('host-timer-control'),
    timerSlider: document.getElementById('timer-slider'),
    lockBtn: document.getElementById('lock-btn'),
    setupStatus: document.getElementById('setup-status'),
    turnBadge: document.getElementById('turn-badge'),
    timerBadge: document.getElementById('timer-badge'),
    guessInput: document.getElementById('guess-input'),
    history: document.getElementById('game-history'),
    endTitle: document.getElementById('end-title'),
    endMsg: document.getElementById('end-msg'),
    rematchBtn: document.getElementById('rematch-btn'),
    rematchStatus: document.getElementById('rematch-status')
};

// --- PEERJS LOGIC ---
function initPeer(customId = null) {
    // Generate a simple 4-digit ID for Host to make it easier to type
    // We add a random prefix internally to avoid global collisions, but show user simple ID?
    // Actually, PeerJS IDs must be unique. Let's use a 5-digit random number.
    const idToUse = customId || Math.floor(10000 + Math.random() * 90000).toString();
    
    peer = new Peer(idToUse);

    peer.on('open', (id) => {
        els.myId.innerText = id;
        els.lobbyStatus.innerText = "Waiting for opponent...";
        
        if (!isHost) {
            // If joining, connect immediately
            const hostId = els.joinInput.value.trim();
            if(!hostId) return alert("Enter Host ID");
            
            els.lobbyStatus.innerText = "Connecting to " + hostId + "...";
            conn = peer.connect(hostId);
            setupConn();
        }
    });

    peer.on('connection', (c) => {
        // Host receives connection
        if (isHost) {
            conn = c;
            setupConn();
        }
    });

    peer.on('error', (err) => {
        console.error(err);
        if(err.type === 'unavailable-id') {
            // ID taken, retry with new random ID
            initPeer(); 
        } else {
            alert("Connection Error: " + err.type);
        }
    });
}

function setupConn() {
    conn.on('open', () => {
        showScreen('setup');
        if(isHost) els.hostControl.classList.remove('hidden');
    });

    conn.on('data', handleData);
    
    conn.on('close', () => {
        alert("Opponent Disconnected");
        location.reload();
    });
}

function hostGame() {
    isHost = true;
    showScreen('lobby');
    initPeer();
}

function joinGame() {
    isHost = false;
    showScreen('lobby');
    // Joiner needs a different ID than Host.
    // We prefix with 'p2_' to ensure uniqueness from the host's number-only ID
    initPeer("p2_" + Math.floor(10000 + Math.random() * 90000));
}

// --- GAME LOGIC ---

function lockInCode() {
    const val = els.secretInput.value;
    if (val.length !== 4 || isNaN(val)) return alert("Enter 4 digits.");

    mySecret = val;
    mySecretSet = true;
    
    els.secretInput.disabled = true;
    els.lockBtn.disabled = true;
    els.lockBtn.innerText = "Locked";
    els.setupStatus.innerText = "Waiting for opponent...";

    if(isHost) turnTime = parseInt(els.timerSlider.value);

    conn.send({ type: 'READY' });
    checkStart();
}

function checkStart() {
    if (mySecretSet && opSecretSet) {
        if (isHost) {
            conn.send({ type: 'START', time: turnTime });
            startGame();
        }
    }
}

function startGame() {
    showScreen('game');
    els.history.innerHTML = ''; 
    startTurn(isHost); 
}

function startTurn(mine) {
    isMyTurn = mine;
    timeLeft = turnTime;
    updateTimer();
    clearInterval(timerInt);

    if (isMyTurn) {
        els.turnBadge.innerText = "YOUR TURN";
        els.turnBadge.style.color = "#d4af37";
        els.guessInput.disabled = false;
        els.guessInput.value = '';
        els.guessInput.focus();
        
        timerInt = setInterval(() => {
            timeLeft--;
            updateTimer();
            if (timeLeft <= 0) {
                clearInterval(timerInt);
                conn.send({ type: 'SKIP' });
                addLog("Time Out", 0, 0, true);
                startTurn(false);
            }
        }, 1000);
    } else {
        els.turnBadge.innerText = "OPPONENT TURN";
        els.turnBadge.style.color = "#888";
        els.guessInput.disabled = true;
    }
}

function updateTimer() {
    els.timerBadge.innerText = timeLeft + "s";
}

function submitGuess() {
    const val = els.guessInput.value;
    if (val.length !== 4 || isNaN(val)) return;

    clearInterval(timerInt);
    els.guessInput.disabled = true;
    conn.send({ type: 'GUESS', val: val });
}

// --- DATA HANDLER ---

function handleData(data) {
    switch(data.type) {
        case 'READY':
            opSecretSet = true;
            if(mySecretSet) checkStart();
            else els.setupStatus.innerText = "Opponent Ready...";
            break;

        case 'START':
            turnTime = data.time;
            startGame();
            break;

        case 'GUESS':
            // Check their guess against MY secret
            const res = calcStats(mySecret, data.val);
            if(res.correctPlace === 4) {
                conn.send({ type: 'WIN', val: data.val });
                endGame(false); 
            } else {
                conn.send({ type: 'RESULT', val: data.val, res: res });
                // Log opponent guess
                addLog(data.val, res.correctNum, res.correctPlace, false, true);
                startTurn(true); 
            }
            break;

        case 'RESULT':
            // Log my guess result
            addLog(data.val, data.res.correctNum, data.res.correctPlace, false, false);
            startTurn(false);
            break;

        case 'SKIP':
            addLog("Opponent Time Out", 0, 0, true);
            startTurn(true);
            break;

        case 'WIN':
            addLog(data.val, 4, 4, false, false);
            endGame(true);
            break;

        case 'REMATCH_REQ':
            opRematch = true;
            els.rematchStatus.innerText = "Opponent requested reset...";
            checkRematch();
            break;

        case 'REMATCH_START':
            resetGame();
            break;
    }
}

// --- HELPERS ---

function calcStats(secret, guess) {
    let s = secret.split('');
    let g = guess.split('');
    
    // 1. Correct Place (Exact Match)
    let correctPlace = 0;
    for(let i=0; i<4; i++) {
        if(s[i] === g[i]) {
            correctPlace++;
            s[i] = null; // Remove to prevent double counting
            g[i] = null;
        }
    }

    // 2. Correct Number (Wrong Place)
    // Note: You asked for "How many numbers match" (Total Correct Numbers)
    // vs "How many at same place". 
    // Usually "Cows" means Correct Num but Wrong Place.
    // If you want "Total Correct Numbers" (including correct place), logic is slightly different.
    // I will stick to standard logic:
    // Col 1: Total Matching Numbers (regardless of position)
    // Col 2: Correct Position
    
    // Let's reset arrays to count TOTAL matches first
    let s2 = secret.split('');
    let g2 = guess.split('');
    let totalMatches = 0;
    
    for(let i=0; i<4; i++) {
        const idx = s2.indexOf(g2[i]);
        if(idx !== -1) {
            totalMatches++;
            s2[idx] = null; // consume
        }
    }

    return { correctNum: totalMatches, correctPlace: correctPlace };
}

function addLog(guess, numMatch, placeMatch, isMsg, isOpp) {
    const div = document.createElement('div');
    div.className = 'guess-row';
    
    if(isMsg) {
        div.innerHTML = `<span style="width:100%; text-align:center; color:#555;">${guess}</span>`;
    } else {
        const label = isOpp ? `<span style="color:#555; font-size:0.8rem;">(Opp)</span> ` : "";
        
        // 2 COLUMN LAYOUT
        div.innerHTML = `
            <div class="guess-val">${label}${guess}</div>
            <div class="analysis-box">
                <span class="hl-num">${numMatch}</span> Correct Numbers<br>
                <span class="hl-num">${placeMatch}</span> Correct Place
            </div>
        `;
    }
    els.history.prepend(div);
}

function endGame(win) {
    clearInterval(timerInt);
    showScreen('end');
    els.endTitle.innerText = win ? "VICTORY" : "DEFEAT";
    els.endTitle.style.color = win ? "#d4af37" : "#555";
    els.endMsg.innerText = win ? "Sequence Decoded." : "Defense Breached.";
}

function requestRematch() {
    myRematch = true;
    els.rematchBtn.disabled = true;
    els.rematchBtn.innerText = "Requesting...";
    conn.send({ type: 'REMATCH_REQ' });
    checkRematch();
}

function checkRematch() {
    if(myRematch && opRematch) {
        conn.send({ type: 'REMATCH_START' });
        resetGame();
    }
}

function resetGame() {
    mySecret = ""; mySecretSet = false; opSecretSet = false;
    myRematch = false; opRematch = false;
    
    els.secretInput.value = '';
    els.secretInput.disabled = false;
    els.lockBtn.disabled = false;
    els.lockBtn.innerText = "Lock Sequence";
    els.setupStatus.innerText = "";
    els.rematchBtn.disabled = false;
    els.rematchBtn.innerText = "Reset Timeline";
    els.rematchStatus.innerText = "";
    
    showScreen('setup');
}

function showScreen(name) {
    Object.values(els.screens).forEach(s => s.classList.add('hidden'));
    els.screens[name].classList.remove('hidden');
}

function copyId() {
    navigator.clipboard.writeText(els.myId.innerText);
    alert("ID Copied");
}

[els.secretInput, els.guessInput].forEach(inp => {
    inp.addEventListener('input', function() { 
        this.value = this.value.replace(/[^0-9]/g, ''); 
    });
});
