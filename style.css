:root {
    --bg-color: #050511;
    --card-bg: rgba(20, 20, 35, 0.85);
    --primary: #00f3ff;
    --secondary: #bc13fe;
    --text: #ffffff;
    --text-dim: #8892b0;
    --success: #00ff9d;
    --warning: #ffbe0b;
    --danger: #ff0055;
    --font-head: 'Orbitron', sans-serif;
    --font-body: 'Poppins', sans-serif;
}

* { box-sizing: border-box; transition: all 0.2s ease; }

body {
    margin: 0; padding: 0;
    background-color: var(--bg-color);
    background-image: radial-gradient(circle at 50% 0%, #1a1a2e 0%, #000 80%);
    color: var(--text);
    font-family: var(--font-body);
    height: 100vh; overflow: hidden;
    display: flex; justify-content: center; align-items: center;
}

.app-container { width: 100%; max-width: 500px; height: 100vh; display: flex; flex-direction: column; padding: 20px; position: relative; }
.screen { display: none; flex-direction: column; height: 100%; justify-content: center; animation: fadeIn 0.4s ease-out; }
.screen.active { display: flex; }

/* Components */
.glass {
    background: var(--card-bg);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px; padding: 25px;
    box-shadow: 0 0 30px rgba(0, 243, 255, 0.1);
}

.logo { font-family: var(--font-head); font-size: 2rem; text-align: center; margin-bottom: 20px; text-shadow: 0 0 10px var(--primary); }
.flicker { color: var(--secondary); text-shadow: 0 0 10px var(--secondary); }

/* Inputs & Buttons */
.btn { width: 100%; padding: 15px; border: none; border-radius: 12px; font-family: var(--font-head); font-weight: bold; font-size: 1rem; cursor: pointer; text-transform: uppercase; margin-top: 15px; }
.btn-neon { background: linear-gradient(135deg, var(--secondary), #7b2cbf); color: white; box-shadow: 0 0 15px rgba(188, 19, 254, 0.4); }
.btn-neon:active { transform: scale(0.98); }
.btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); }
.btn-sm { background: none; color: var(--text-dim); font-size: 0.8rem; width: auto; margin: 10px auto; display: block; }

input { width: 100%; background: rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px; color: white; font-family: var(--font-head); text-align: center; outline: none; font-size: 1.2rem; }
input:focus { border-color: var(--primary); box-shadow: 0 0 15px rgba(0, 243, 255, 0.3); }
.big-input { font-size: 2rem; letter-spacing: 10px; }

/* Game UI */
.timer-wrapper { width: 100%; height: 6px; background: rgba(255,255,255,0.1); margin-bottom: 20px; border-radius: 3px; overflow: hidden; }
.timer-bar { height: 100%; width: 100%; background: var(--warning); transition: width 1s linear; }

.scoreboard { display: flex; justify-content: space-between; padding: 15px 25px; margin-bottom: 20px; }
.score-box { text-align: center; }
.score-box .label { font-size: 0.7rem; color: var(--text-dim); letter-spacing: 2px; }
.score-box .value { font-family: var(--font-head); font-size: 1.5rem; color: var(--primary); }

.game-board { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.input-area { display: flex; gap: 10px; padding: 15px; margin-bottom: 15px; transition: opacity 0.3s; }
.input-area.disabled { opacity: 0.4; pointer-events: none; }
.icon-btn { width: auto; margin: 0; padding: 0 25px; }

.history-feed { flex: 1; overflow-y: auto; display: flex; flex-direction: column-reverse; gap: 10px; padding-right: 5px; }
.log-item { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid transparent; }
.log-item.mine { border-left-color: var(--primary); }
.log-item.theirs { border-left-color: var(--secondary); }
.guess-num { font-family: var(--font-head); font-size: 1.2rem; letter-spacing: 2px; }
.feedback { display: flex; gap: 8px; font-size: 0.8rem; }
.pill { padding: 4px 8px; border-radius: 4px; background: rgba(0,0,0,0.3); }
.pill.green { color: var(--success); border: 1px solid var(--success); }
.pill.yellow { color: var(--warning); border: 1px solid var(--warning); }
.log-msg { text-align: center; width: 100%; font-size: 0.9rem; color: var(--warning); font-style: italic; }

.code-display { background: rgba(0,0,0,0.4); border: 1px dashed var(--secondary); padding: 15px; border-radius: 8px; font-family: monospace; font-size: 2rem; letter-spacing: 5px; cursor: pointer; display: flex; justify-content: center; gap: 15px; align-items: center; margin: 15px 0; color: var(--secondary); font-weight: bold; }
.hidden { display: none !important; }
.range-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
input[type=range] { flex: 1; accent-color: var(--primary); }

@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
