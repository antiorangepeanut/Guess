let myCode;
let opponentCode;
let endTime;

function start(){
  myCode = document.getElementById("myCode").value;
  if(myCode.length !== 4) return;

  let payload = btoa(JSON.stringify({
    code: myCode,
    t: Date.now() + 120000
  }));

  let link = location.origin + location.pathname + "#" + payload;

  alert("Send this link to friend:\n\n" + link);

  document.getElementById("setup").style.display="none";
  document.getElementById("game").style.display="block";
}

if(location.hash){
  let data = JSON.parse(atob(location.hash.slice(1)));
  opponentCode = data.code;
  endTime = data.t;

  document.getElementById("setup").style.display="none";
  document.getElementById("game").style.display="block";

  startTimer();
}

function startTimer(){
  let t = setInterval(()=>{
    let left = Math.floor((endTime - Date.now())/1000);
    if(left <= 0){
      document.getElementById("timer").innerText="Time up";
      clearInterval(t);
      return;
    }
    document.getElementById("timer").innerText="Time: " + left + "s";
  }, 500);
}

function makeGuess(){
  let g = document.getElementById("guess").value;
  if(!opponentCode) return;

  let bulls=0, cows=0;

  for(let i=0;i<4;i++){
    if(g[i] === opponentCode[i]) bulls++;
    else if(opponentCode.includes(g[i])) cows++;
  }

  log(g + " → " + bulls + "B " + cows + "C");

  if(bulls === 4) log("You cracked it!");
}

function log(t){
  let l = document.getElementById("log");
  l.innerHTML += "<div>" + t + "</div>";
}
