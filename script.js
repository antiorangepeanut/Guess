// --- Game State & Variables ---
let peer = null;
let conn = null;
let myRole = ''; // 'setter' or 'guesser'
let secretCode = '';
let isMyTurn = false;

// UI Elements
const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};
const els = {
    myId: document.getElementById('my-peer-id'),
    lobbyStatus: document.getElementById('lobby-status'),
    roleDisplay: document.getElementById('role-display'),
    instruction: document.getElementById('instruction-text'),
    input: document.getElementById('game-input'),
    btn: document.getElementById('action-btn'),
    history: document.getElementById('game-history')
};

// --- PeerJS Setup ---
function initPeer() {
    // Create a random ID for this peer
    peer = new Peer(null, { debug: 2 });

    peer.on('open', (id) => {
        els.myId.value = id;
        els.lobbyStatus.innerText = "Waiting for connection...";
    });

    peer.on('connection', (c) => {
        // Connection received (Host side)
        conn = c;
        setupConnection();
        startGame('setter'); // Host sets the code first
    });

    peer.on('error', (err) => {
        alert("Connection Error: " + err.type);
    });
}

function hostGame() {
    showScreen('lobby');
    initPeer();
}

function joinGame() {
    const friendId = document.getElementById('join-id-input').value.trim();
    if (!friendId) return alert("Please enter an ID");
    
    peer = new Peer(null, { debug: 2 });
    peer.on('open', () => {
        conn = peer.connect(friendId);
        setupConnection();
        startGame('guesser'); // Joiner guesses first
    });
}

function setupConnection() {
    conn.on('open', () => {
        console.log("Connected to peer");
        showScreen('game');
    });

    conn.on('data', (data) => {
        handleData(data);
    });

    conn.on('close', () => {
        alert("Opponent disconnected!");
        location.reload();
    });
}

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

// --- Game Logic ---

function startGame(role) {
    myRole = role;
    els.history.innerHTML = ''; // Clear history
    els.input.value = '';

    if (myRole === 'setter') {
        els.roleDisplay.innerText = "You are the SETTER";
        els.instruction.innerText = "Enter a secret 4-digit code for your friend to guess.";
        isMyTurn = true;
        els.input.placeholder = "Secret Code";
        els.input.disabled = false;
        els.btn.disabled = false;
    } else {
        els.roleDisplay.innerText = "You are the GUESSER";
        els.instruction.innerText = "Waiting for host to set the secret code...";
        isMyTurn = false;
        els.input.placeholder = "Wait...";
        els.input.disabled = true;
        els.btn.disabled = true;
    }
}

function submitAction() {
    const val = els.input.value;
    if (val.length !== 4 || isNaN(val)) {
        alert("Please enter exactly 4 digits.");
        return;
    }

    if (myRole === 'setter' && isMyTurn) {
        // Setting the code
        secretCode = val;
        isMyTurn = false;
        
        // Update UI
        els.instruction.innerText = "Code set! Waiting for opponent to guess...";
        els.input.value = '';
        els.input.disabled = true;
        els.btn.disabled = true;

        // Tell opponent code is ready
        conn.send({ type: 'CODE_SET' });

    } else if (myRole === 'guesser' && isMyTurn) {
        // Making a guess
        conn.send({ type: 'GUESS', value: val });
        isMyTurn = false;
        els.instruction.innerText = `Guessed ${val}. Waiting for result...`;
        els.input.value = '';
        els.input.disabled = true;
        els.btn.disabled = true;
    }
}

function handleData(data) {
    switch (data.type) {
        case 'CODE_SET':
            // Opponent set the code, now I guess
            if (myRole === 'guesser') {
                isMyTurn = true;
                els.instruction.innerText = "Code is set! Enter your guess.";
                els.input.disabled = false;
                els.btn.disabled = false;
                els.input.placeholder = "Guess (e.g. 1234)";
                els.input.focus();
            }
            break;

        case 'GUESS':
            // Opponent sent a guess, I (Setter) validate it
            if (myRole === 'setter') {
                const guess = data.value;
                const feedback = calculateFeedback(secretCode, guess);
                
                // Send results back
                conn.send({ type: 'RESULT', guess: guess, feedback: feedback });
                
                // Update my UI
                addHistoryItem(guess, feedback);

                if (feedback.correct === 4) {
                    els.instruction.innerText = "They guessed it! Game Over.";
                }
            }
            break;

        case 'RESULT':
            // I (Guesser) received results
            if (myRole === 'guesser') {
                addHistoryItem(data.guess, data.feedback);
                
                if (data.feedback.correct === 4) {
                    els.instruction.innerText = "VICTORY! You cracked the code!";
                    els.roleDisplay.innerText = "WINNER";
                    els.roleDisplay.style.color = "#4cc9f0";
                } else {
                    isMyTurn = true;
                    els.instruction.innerText = "Wrong! Try again.";
                    els.input.disabled = false;
                    els.btn.disabled = false;
                    els.input.focus();
                }
            }
            break;
    }
}

// Logic to calculate Bulls (Correct Position) and Cows (Wrong Position)
function calculateFeedback(secret, guess) {
    let bulls = 0; // Correct number, correct place
    let cows = 0;  // Correct number, wrong place

    const secretArr = secret.split('');
    const guessArr = guess.split('');
    
    const secretFreq = {};
    const guessFreq = {};

    // 1. Check Bulls first
    for (let i = 0; i < 4; i++) {
        if (secretArr[i] === guessArr[i]) {
            bulls++;
            // Mark as matched so we don't count as cow
            secretArr[i] = null;
            guessArr[i] = null;
        }
    }

    // 2. Count frequencies of remaining digits for Cows
    for (let i = 0; i < 4; i++) {
        if (secretArr[i] !== null) {
            secretFreq[secretArr[i]] = (secretFreq[secretArr[i]] || 0) + 1;
        }
        if (guessArr[i] !== null) {
            guessFreq[guessArr[i]] = (guessFreq[guessArr[i]] || 0) + 1;
        }
    }

    // 3. Calculate Cows
    for (let key in guessFreq) {
        if (secretFreq[key]) {
            cows += Math.min(guessFreq[key], secretFreq[key]);
        }
    }

    return { correct: bulls, wrongPlace: cows };
}

function addHistoryItem(guess, feedback) {
    const div = document.createElement('div');
    div.className = 'guess-row';
    div.innerHTML = `
        <span class="guess-code">${guess}</span>
        <span class="guess-result">
            <span class="bulls">${feedback.correct} Correct</span> | 
            <span class="cows">${feedback.wrongPlace} Right Num, Wrong Place</span>
        </span>
    `;
    els.history.prepend(div);
}

// Input validation (numbers only)
els.input.addEventListener('input', function (e) {
    this.value = this.value.replace(/[^0-9]/g, '');
});

// Enter key support
els.input.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') submitAction();
});
