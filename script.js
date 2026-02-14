// --- STATE ---
let peer = null;
let conn = null;
let isHost = false;

// Game Config & Variables
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
const screens = {
    menu: document.getElementById('screen-menu'),
    lobby: document.getElementById('screen-lobby'),
    setup: document.getElementById('screen-setup'),
    game: document.getElementById('screen-game'),
    end: document.getElementById('screen-end')
};

const els = {
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

// --- PEERJS ---
function initPeer(id = null) {
    // Generate random 4-6 digit ID if hosting, use passed ID if joining
    const myPeerId = id || Math.floor(100000 + Math.random() * 900000).toString();
    peer = new Peer(myPeerId);

    peer.on('open', (id) => {
        els.myId.innerText = id;
        if (!isHost) {
            // Joiner logic
            const hostId = els.joinInput.value.trim();
            if(!hostId) return alert("Enter Host ID");
            els.lobbyStatus.innerText = "Connecting...";
            conn = peer.connect(hostId);
            setupConn();
        }
    });

    peer.on('connection', (c) => {
        if (isHost) {
            conn = c;
            setupConn();
        }
    });

    peer.on('error', (err) => {
        alert("Connection Error: " + err.type);
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
    // Prefix ID to avoid collision with Host
    initPeer("p2_" + Math.floor(1000 + Math.random() * 9000));
}

// --- GAME LOGIC ---

function lockInCode() {
    const val = els.secretInput.value;
    if (val.length !== 4 || isNaN(val)) return alert("Enter a 4-digit code.");

    mySecret = val;
    mySecretSet = true;
    
    // UI Update
    els.secretInput.disabled = true;
    els.lockBtn.disabled = true;
    els.lockBtn.innerText = "Code Locked";
    els.setupStatus.innerText = "Waiting for opponent...";

    if(isHost) turnTime = parseInt(els.timerSlider.value);

    // Notify opponent
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
    startTurn(isHost); // Host goes first
}

function startTurn(mine) {
    isMyTurn = mine;
    timeLeft = turnTime;
    updateTimer();
    clearInterval(timerInt);

    if (isMyTurn) {
        els.turnBadge.innerText = "YOUR TURN";
        els.turnBadge.style.color = "#4cc9f0";
        els.guessInput.disabled = false;
        els.guessInput.value = '';
        els.guessInput.focus();
        
        timerInt = setInterval(() => {
            timeLeft--;
            updateTimer();
            if (timeLeft <= 0) {
                clearInterval(timerInt);
                // Timeout logic: Skip turn
                conn.send({ type: 'SKIP' });
                addLog("Time ran out! Turn Skipped.", "0", "0", true);
                startTurn(false);
            }
        }, 1000);
    } else {
        els.turnBadge.innerText = "OPPONENT'S TURN";
        els.turnBadge.style.color = "#f72585";
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
    // Send guess to opponent to check against their secret
    conn.send({ type: 'GUESS', val: val });
}

// --- DATA HANDLER ---

function handleData(data) {
    switch(data.type) {
        case 'READY':
            opSecretSet = true;
            if(mySecretSet) checkStart();
            else els.setupStatus.innerText = "Opponent Ready! Waiting for you...";
            break;

        case 'START':
            turnTime = data.time;
            startGame();
            break;

        case 'GUESS':
            // Opponent guessed MY code
            const res = calcStats(mySecret, data.val);
            if(res.correct === 4) {
                conn.send({ type: 'WIN', val: data.val });
                endGame(false); // They won, I lost
            } else {
                conn.send({ type: 'RESULT', val: data.val, res: res });
                // Log their guess on my screen
                addLog(data.val, res.correct, res.place, false, true);
                startTurn(true); // My turn
            }
            break;

        case 'RESULT':
            // Result of MY guess
            addLog(data.val, data.res.correct, data.res.place, false, false);
            startTurn(false);
            break;

        case 'SKIP':
            addLog("Opponent Timed Out!", "0", "0", true);
            startTurn(true);
            break;

        case 'WIN':
            addLog(data.val, 4, 0, false, false);
            endGame(true); // I won
            break;

        case 'REMATCH_REQ':
            opRematch = true;
            els.rematchStatus.innerText = "Opponent wants to play again...";
            checkRematch();
            break;

        case 'REMATCH_START':
            resetGame();
            break;
    }
}

// --- HELPERS ---

function calcStats(secret, guess) {
    let correct = 0;
    let place = 0;
    let s = secret.split('');
    let g = guess.split('');

    // Bulls (Correct)
    for(let i=0; i<4; i++) {
        if(s[i] === g[i]) {
            correct++;
            s[i] = null;
            g[i] = null;
        }
    }
    // Cows (Wrong Place)
    for(let i=0; i<4; i++) {
        if(g[i] !== null) {
            let idx = s.indexOf(g[i]);
            if(idx !== -1) {
                place++;
                s[idx] = null;
            }
        }
    }
    return { correct, place };
}

function addLog(guess, correct, place, isMsg, isOpponent) {
    const div = document.createElement('div');
    div.className = 'guess-row';
    
    if(isMsg) {
        div.innerHTML = `<span style="width:100%; text-align:center; color:#f72585;">${guess}</span>`;
    } else {
        const who = isOpponent ? "<span style='font-size:0.8rem; color:#ccc'>(Opp)</span> " : "";
        div.innerHTML = `
            <span class="guess-val">${who}${guess}</span>
            <span class="guess-res">
                <span class="res-correct">${correct} Correct</span> | 
                <span class="res-place">${place} Right Num, Wrong Place</span>
            </span>
        `;
    }
    els.history.prepend(div);
}

function endGame(win) {
    clearInterval(timerInt);
    showScreen('end');
    els.endTitle.innerText = win ? "VICTORY" : "DEFEAT";
    els.endTitle.style.color = win ? "#4cc9f0" : "#f72585";
    els.endMsg.innerText = win ? "You cracked the code!" : "Your code was cracked.";
}

function requestRematch() {
    myRematch = true;
    els.rematchBtn.disabled = true;
    els.rematchBtn.innerText = "Waiting...";
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
    els.lockBtn.innerText = "Lock In Code";
    els.setupStatus.innerText = "";
    els.rematchBtn.disabled = false;
    els.rematchBtn.innerText = "Play Again";
    els.rematchStatus.innerText = "";
    
    showScreen('setup');
}

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-' + name).classList.remove('hidden');
}

function copyId() {
    navigator.clipboard.writeText(els.myId.innerText);
    alert("ID Copied!");
}

// Number Only Input
[els.secretInput, els.guessInput].forEach(inp => {
    inp.addEventListener('input', function() { 
        this.value = this.value.replace(/[^0-9]/g, ''); 
    });
});
