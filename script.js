// --- CONFIG ---
let turnTime = 30;

// --- STATE ---
let peer = null;
let conn = null;
let isHost = false;
let myCode = null;
let opCodeReady = false;
let myCodeReady = false;
let isMyTurn = false;
let timerInt = null;
let timeLeft = 0;
let myRematch = false;
let opRematch = false;

// --- DOM ---
const ui = {
    screens: document.querySelectorAll('.screen'),
    myId: document.getElementById('my-peer-id'),
    joinId: document.getElementById('join-id'),
    hostControls: document.getElementById('host-controls'),
    timerSlider: document.getElementById('timer-slider'),
    secretInput: document.getElementById('secret-input'),
    setupMsg: document.getElementById('setup-msg'),
    turnDisplay: document.getElementById('turn-display'),
    timerDisplay: document.getElementById('timer-display'),
    inputArea: document.getElementById('input-area'),
    guessInput: document.getElementById('guess-input'),
    history: document.getElementById('history-feed'),
    endTitle: document.getElementById('end-title'),
    endMsg: document.getElementById('end-msg'),
    rematchBtn: document.getElementById('rematch-btn'),
    rematchStatus: document.getElementById('rematch-status')
};

// --- PEERJS ---
function initPeer(id = null) {
    // If no ID provided (Host), generate random 6-digit
    const myPeerId = id || Math.floor(100000 + Math.random() * 900000).toString();
    
    peer = new Peer(myPeerId);

    peer.on('open', (id) => {
        ui.myId.innerText = id;
        if (!isHost) {
            // Joiner: connect immediately
            const hostId = ui.joinId.value;
            conn = peer.connect(hostId);
            setupConn();
        }
    });

    peer.on('connection', (c) => {
        // Host: receive connection
        if (isHost) {
            conn = c;
            setupConn();
        }
    });

    peer.on('error', (err) => {
        alert("System Error: " + err.type);
        location.reload();
    });
}

function setupConn() {
    conn.on('open', () => {
        showScreen('screen-setup');
    });
    conn.on('data', handleData);
    conn.on('close', () => {
        alert("Connection Lost.");
        location.reload();
    });
}

function hostGame() {
    isHost = true;
    ui.hostControls.classList.remove('hidden');
    showScreen('screen-lobby');
    initPeer();
}

function joinGame() {
    const id = ui.joinId.value;
    if (id.length !== 6) return alert("INVALID ID FORMAT");
    isHost = false;
    ui.hostControls.classList.add('hidden');
    showScreen('screen-lobby');
    // Joiners get a 'p2_' prefix to avoid ID collision
    initPeer('p2_' + Math.floor(100000 + Math.random() * 900000));
}

// --- GAME LOGIC ---

function lockInCode() {
    const val = ui.secretInput.value;
    if (val.length !== 4) return alert("REQUIRE 4 DIGITS");
    
    myCode = val;
    myCodeReady = true;
    if (isHost) turnTime = parseInt(ui.timerSlider.value);

    ui.secretInput.disabled = true;
    document.getElementById('lock-btn').disabled = true;
    document.getElementById('lock-btn').innerText = "LOCKED";
    ui.setupMsg.innerText = "AWAITING TARGET...";

    conn.send({ type: 'READY' });
    checkStart();
}

function checkStart() {
    if (myCodeReady && opCodeReady) {
        if (isHost) {
            conn.send({ type: 'START', time: turnTime });
            startGame();
        }
    }
}

function startGame() {
    showScreen('screen-game');
    ui.history.innerHTML = ''; // Clear logs
    startTurn(isHost); // Host starts
}

function startTurn(mine) {
    isMyTurn = mine;
    timeLeft = turnTime;
    updateTimer();
    clearInterval(timerInt);

    if (isMyTurn) {
        ui.turnDisplay.innerText = ">> YOUR TURN";
        ui.inputArea.classList.remove('disabled');
        ui.guessInput.value = '';
        ui.guessInput.focus();
        
        timerInt = setInterval(() => {
            timeLeft--;
            updateTimer();
            if (timeLeft <= 0) {
                clearInterval(timerInt);
                log("TIMEOUT - TURN SKIPPED", "log-sys");
                conn.send({ type: 'SKIP' });
                startTurn(false);
            }
        }, 1000);
    } else {
        ui.turnDisplay.innerText = ">> ENEMY TURN";
        ui.inputArea.classList.add('disabled');
    }
}

function updateTimer() {
    ui.timerDisplay.innerText = timeLeft;
    ui.timerDisplay.style.color = timeLeft < 10 ? 'red' : 'inherit';
}

function submitGuess() {
    const g = ui.guessInput.value;
    if (g.length !== 4) return;
    
    clearInterval(timerInt);
    ui.inputArea.classList.add('disabled');
    conn.send({ type: 'GUESS', val: g });
}

function calcStats(secret, guess) {
    let bulls = 0, cows = 0;
    let s = secret.split(''), g = guess.split('');
    // Bulls
    for(let i=0; i<4; i++) {
        if(s[i] === g[i]) { bulls++; s[i]=null; g[i]=null; }
    }
    // Cows
    for(let i=0; i<4; i++) {
        if(g[i]===null) continue;
        let idx = s.indexOf(g[i]);
        if(idx !== -1) { cows++; s[idx]=null; }
    }
    return { bulls, cows };
}

// --- DATA ---
function handleData(d) {
    switch(d.type) {
        case 'READY':
            opCodeReady = true;
            if(myCodeReady) checkStart();
            else ui.setupMsg.innerText = "TARGET READY. WAITING FOR YOU.";
            break;
        case 'START':
            turnTime = d.time;
            startGame();
            break;
        case 'GUESS':
            // They guessed my code
            const res = calcStats(myCode, d.val);
            if(res.bulls === 4) {
                conn.send({ type: 'WIN', guess: d.val });
                endGame(false, `DEFEAT. CODE ${myCode} CRACKED.`);
            } else {
                conn.send({ type: 'MISS', guess: d.val, res: res });
                log(`ENEMY GUESSED ${d.val}: ${res.bulls}B / ${res.cows}C`, 'theirs');
                startTurn(true);
            }
            break;
        case 'MISS':
            // I guessed, missed
            log(`YOU GUESSED ${d.guess}: ${d.res.bulls}B / ${d.res.cows}C`, 'mine');
            startTurn(false);
            break;
        case 'WIN':
            endGame(true, "VICTORY. SYSTEM HACKED.");
            break;
        case 'SKIP':
            log("ENEMY TIMEOUT", 'log-sys');
            startTurn(true);
            break;
        case 'REMATCH_REQ':
            opRematch = true;
            ui.rematchStatus.innerText = "ENEMY WANTS REBOOT...";
            checkRematch();
            break;
        case 'REMATCH_GO':
            resetGame();
            break;
    }
}

// --- UTILS ---
function log(msg, type) {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerText = msg;
    ui.history.prepend(div);
}

function showScreen(id) {
    ui.screens.forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function endGame(win, msg) {
    clearInterval(timerInt);
    showScreen('screen-end');
    ui.endTitle.innerText = win ? "VICTORY" : "FAILURE";
    ui.endTitle.style.color = win ? "var(--neon)" : "var(--alert)";
    ui.endMsg.innerText = msg;
}

function requestRematch() {
    myRematch = true;
    ui.rematchBtn.disabled = true;
    ui.rematchBtn.innerText = "WAITING...";
    conn.send({ type: 'REMATCH_REQ' });
    checkRematch();
}

function checkRematch() {
    if(myRematch && opRematch) {
        conn.send({ type: 'REMATCH_GO' });
        resetGame();
    }
}

function resetGame() {
    myCode = null; myCodeReady = false; opCodeReady = false;
    myRematch = false; opRematch = false;
    ui.secretInput.value = ''; ui.secretInput.disabled = false;
    document.getElementById('lock-btn').disabled = false;
    document.getElementById('lock-btn').innerText = "[ LOCK CODE ]";
    ui.setupMsg.innerText = '';
    ui.rematchBtn.disabled = false;
    ui.rematchBtn.innerText = "[ REBOOT SYSTEM ]";
    ui.rematchStatus.innerText = '';
    showScreen('screen-setup');
}

function copyId() {
    navigator.clipboard.writeText(ui.myId.innerText);
    alert("COORDINATES COPIED");
}
