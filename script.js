// --- Game State Variables ---
let peer = null;
let conn = null;
let myId = '';
let isHost = false;

// Game Logic
let turnDuration = 30; // Default, will be overwritten by host settings
let mySecretCode = '';
let opponentSecretCodeIsSet = false;
let mySecretCodeIsSet = false;
let isMyTurn = false;
let timerInterval = null;
let timeLeft = 0;

// --- DOM Elements ---
const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
};

const els = {
    myPeerId: document.getElementById('my-peer-id'),
    joinInput: document.getElementById('join-id-input'),
    lobbyMsg: document.getElementById('lobby-msg'),
    secretInput: document.getElementById('secret-input'),
    hostSettings: document.getElementById('host-settings'),
    timerSetting: document.getElementById('timer-setting'),
    setupStatus: document.getElementById('setup-status'),
    turnBadge: document.getElementById('turn-badge'),
    timerDisplay: document.getElementById('timer-display'),
    gameInput: document.getElementById('game-input'),
    history: document.getElementById('game-history'),
    inputSection: document.getElementById('input-section'),
    endTitle: document.getElementById('end-title'),
    endReason: document.getElementById('end-reason')
};

// --- Initialization ---

function hostGame() {
    isHost = true;
    els.hostSettings.classList.remove('hidden'); // Show timer input to host
    showScreen('lobby');
    initPeer();
}

function joinGame() {
    const id = els.joinInput.value.trim();
    if (!id) return alert("Enter an ID first!");
    isHost = false;
    els.hostSettings.classList.add('hidden'); // Hide timer input from joiner
    showScreen('lobby');
    initPeer(id);
}

function initPeer(destId = null) {
    peer = new Peer(null, { debug: 1 });

    peer.on('open', (id) => {
        els.myPeerId.innerText = id;
        if (destId) {
            els.lobbyMsg.innerText = "Connecting to host...";
            conn = peer.connect(destId);
            setupConnection();
        }
    });

    peer.on('connection', (c) => {
        if (isHost) {
            conn = c;
            setupConnection();
        }
    });

    peer.on('error', (err) => {
        alert("Connection Error: " + err.type);
        showScreen('menu');
    });
}

function setupConnection() {
    conn.on('open', () => {
        showScreen('setup');
    });

    conn.on('data', (data) => {
        handleData(data);
    });

    conn.on('close', () => {
        alert("Opponent disconnected.");
        location.reload();
    });
}

// --- Setup Phase ---

function confirmSecretCode() {
    const code = els.secretInput.value;
    if (code.length !== 4 || isNaN(code)) return alert("Please enter a 4-digit code.");

    mySecretCode = code;
    mySecretCodeIsSet = true;
    
    // Capture timer setting if host
    if (isHost) {
        turnDuration = parseInt(els.timerSetting.value) || 30;
    }

    // Lock UI
    els.secretInput.disabled = true;
    document.getElementById('lock-in-btn').disabled = true;
    document.getElementById('lock-in-btn').innerText = "Locked In";
    els.setupStatus.innerText = "Waiting for opponent...";

    conn.send({ type: 'CODE_SET_READY' });
    checkStartGame();
}

function checkStartGame() {
    if (mySecretCodeIsSet && opponentSecretCodeIsSet) {
        // If Host, send the Start signal with the timer settings
        if (isHost) {
            conn.send({ type: 'START_GAME', settings: { timeLimit: turnDuration } });
            startGame();
        }
    }
}

// --- Game Logic ---

function startGame() {
    showScreen('game');
    // Host goes first
    if (isHost) startTurn(true);
    else startTurn(false);
}

function startTurn(isMine) {
    isMyTurn = isMine;
    timeLeft = turnDuration;
    updateTimerDisplay();
    clearInterval(timerInterval);

    if (isMyTurn) {
        els.turnBadge.innerText = "YOUR TURN";
        els.turnBadge.className = "badge your-turn";
        els.inputSection.classList.remove('disabled');
        els.gameInput.value = '';
        els.gameInput.focus();
        
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) handleTimeout();
        }, 1000);
    } else {
        els.turnBadge.innerText = "OPPONENT'S TURN";
        els.turnBadge.className = "badge their-turn";
        els.inputSection.classList.add('disabled');
    }
}

function updateTimerDisplay() {
    els.timerDisplay.innerText = timeLeft;
    els.timerDisplay.style.color = timeLeft <= 10 ? '#ef4444' : '#f59e0b';
}

function handleTimeout() {
    clearInterval(timerInterval);
    // Timeout logic: Skip turn instead of lose game
    conn.send({ type: 'SKIP_TURN' });
    
    // Log it locally
    addLogMessage("You ran out of time! Turn skipped.", "skipped-msg");
    
    // Pass turn
    startTurn(false);
}

function submitGuess() {
    const guess = els.gameInput.value;
    if (guess.length !== 4 || isNaN(guess)) return;

    clearInterval(timerInterval);
    isMyTurn = false;
    els.inputSection.classList.add('disabled');
    conn.send({ type: 'GUESS', guess: guess });
}

function calculateFeedback(secret, guess) {
    let bulls = 0, cows = 0;
    const sArr = secret.split(''), gArr = guess.split('');
    const sFreq = {}, gFreq = {};

    for (let i = 0; i < 4; i++) {
        if (sArr[i] === gArr[i]) {
            bulls++;
            sArr[i] = null; gArr[i] = null;
        }
    }

    for (let i = 0; i < 4; i++) {
        if (sArr[i] !== null) sFreq[sArr[i]] = (sFreq[sArr[i]] || 0) + 1;
        if (gArr[i] !== null) gFreq[gArr[i]] = (gFreq[gArr[i]] || 0) + 1;
    }

    for (let key in gFreq) {
        if (sFreq[key]) cows += Math.min(gFreq[key], sFreq[key]);
    }
    return { bulls, cows };
}

// --- Data Handling ---

function handleData(data) {
    switch (data.type) {
        case 'CODE_SET_READY':
            opponentSecretCodeIsSet = true;
            if (!mySecretCodeIsSet) els.setupStatus.innerText = "Opponent ready! Waiting for you...";
            else checkStartGame();
            break;

        case 'START_GAME':
            // Client receives start signal and settings
            if (data.settings && data.settings.timeLimit) {
                turnDuration = data.settings.timeLimit;
            }
            startGame();
            break;

        case 'GUESS':
            const feedback = calculateFeedback(mySecretCode, data.guess);
            if (feedback.bulls === 4) {
                conn.send({ type: 'RESULT', guess: data.guess, feedback: feedback, winner: true });
                endGame(false, `Opponent cracked your code (${mySecretCode})!`);
            } else {
                conn.send({ type: 'RESULT', guess: data.guess, feedback: feedback, winner: false });
                addToLog(data.guess, feedback, "Opponent");
                startTurn(true);
            }
            break;

        case 'RESULT':
            addToLog(data.guess, data.feedback, "You");
            if (data.winner) endGame(true, "VICTORY! You cracked the code.");
            else startTurn(false);
            break;
            
        case 'SKIP_TURN':
            // Opponent timed out
            addLogMessage("Opponent timed out!", "skipped-msg");
            startTurn(true); // My turn now
            break;
    }
}

// --- UI Helpers ---

function addToLog(guess, fb, who) {
    const item = document.createElement('div');
    item.className = 'guess-item';
    item.style.borderLeftColor = who === "You" ? 'var(--primary)' : 'var(--accent)';
    const label = who === "You" ? "" : `<span style='font-size:0.7rem; color:#aaa; margin-right:5px'>(Opp)</span>`;
    item.innerHTML = `
        <div class="guess-val">${label}${guess}</div>
        <div class="guess-feedback">
            <span class="fb-pill fb-correct"><i class="fas fa-check-circle"></i> ${fb.bulls}</span>
            <span class="fb-pill fb-place"><i class="fas fa-random"></i> ${fb.cows}</span>
        </div>
    `;
    els.history.prepend(item);
}

function addLogMessage(msg, className) {
    const item = document.createElement('div');
    item.className = `guess-item ${className}`;
    item.innerText = msg;
    els.history.prepend(item);
}

function endGame(win, reason) {
    clearInterval(timerInterval);
    showScreen('end');
    els.endTitle.innerText = win ? "YOU WIN" : "DEFEAT";
    els.endTitle.style.color = win ? "var(--success)" : "var(--accent)";
    els.endReason.innerText = reason;
}

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

function copyId() {
    navigator.clipboard.writeText(els.myPeerId.innerText);
    alert("ID Copied!");
}

[els.secretInput, els.gameInput].forEach(inp => {
    inp.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
    inp.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (this.id === 'secret-input') confirmSecretCode();
            else submitGuess();
        }
    });
});
