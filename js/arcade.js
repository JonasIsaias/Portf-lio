
(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const elements = {
    title: document.getElementById("gameTitle"),
    status: document.getElementById("gameStatus"),
    score: document.getElementById("scoreValue"),
    best: document.getElementById("bestValue"),
    lives: document.getElementById("livesValue"),
    level: document.getElementById("levelValue"),
    startOverlay: document.getElementById("startOverlay"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    endOverlay: document.getElementById("endOverlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    endTitle: document.getElementById("endTitle"),
    endText: document.getElementById("endText"),
    start: document.getElementById("startGame"),
    resume: document.getElementById("resumeGame"),
    restart: document.getElementById("restartGame"),
    sound: document.getElementById("soundToggle"),
    hint: document.getElementById("controlHint")
  };

  const games = {
    pacman: {
      title: "PAC-MAN",
      hint: "Colete os pontos do labirinto e evite os fantasmas.",
      controls: "Setas ou WASD para se mover."
    },
    tetris: {
      title: "TETRIS",
      hint: "Complete linhas com os blocos. Espaço derruba a peça.",
      controls: "← → mover · ↑ girar · ↓ acelerar · Espaço derrubar."
    },
    snake: {
      title: "SNAKE",
      hint: "Coma os pontos e evite bater nas paredes ou no próprio corpo.",
      controls: "Setas ou WASD para mudar de direção."
    },
    invaders: {
      title: "SPACE INVADERS",
      hint: "Destrua os invasores antes que cheguem até você.",
      controls: "← → ou A/D para mover · Espaço para atirar."
    }
  };

  let selected = "pacman";
  let instance = null;
  let playing = false;
  let paused = false;
  let soundEnabled = false;
  let audioContext = null;
  let score = 0;
  let lives = 3;
  let level = 1;

  const storageKey = "jonasArcadeRecordsV1";

  function readRecords() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  function writeRecord(game, value) {
    const records = readRecords();
    records[game] = Math.max(Number(records[game]) || 0, value);
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      // O jogo continua funcionando mesmo se o navegador bloquear o armazenamento.
    }
    return records[game];
  }

  function formatNumber(value) {
    return Math.max(0, Number(value) || 0).toString().padStart(6, "0");
  }

  function updateStats() {
    elements.score.textContent = formatNumber(score);
    elements.best.textContent = formatNumber(readRecords()[selected] || 0);
    elements.lives.textContent = String(Math.max(0, lives)).padStart(2, "0");
    elements.level.textContent = String(Math.max(1, level)).padStart(2, "0");
  }

  function setStatus(text, state = "") {
    elements.status.textContent = text;
    elements.status.className = "status-pill";
    if (state) elements.status.classList.add(state);
  }

  function showOnly(overlay) {
    [elements.startOverlay, elements.pauseOverlay, elements.endOverlay]
      .forEach(item => item.classList.add("is-hidden"));

    if (overlay) overlay.classList.remove("is-hidden");
  }

  function unlockAudio() {
    if (!soundEnabled) return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function sound(type = "move") {
    const audio = unlockAudio();
    if (!audio) return;

    const presets = {
      move: [260, 0.035, "square"],
      collect: [680, 0.08, "sine"],
      hit: [120, 0.15, "sawtooth"],
      shoot: [430, 0.045, "square"],
      clear: [880, 0.18, "triangle"],
      over: [160, 0.3, "triangle"]
    };

    const [frequency, duration, wave] = presets[type] || presets.move;

    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      if (type === "clear") {
        oscillator.frequency.linearRampToValueAtTime(1200, audio.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.055, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      // Falhas de áudio não devem interromper a partida.
    }
  }

  function destroyCurrent() {
    if (instance && typeof instance.destroy === "function") {
      instance.destroy();
    }
    instance = null;
    playing = false;
    paused = false;
  }

  function resetDisplay() {
    score = 0;
    lives = 3;
    level = 1;
    updateStats();
  }

  function selectGame(id) {
    if (!games[id] || !window.ArcadeGames || !window.ArcadeGames[id]) return;

    destroyCurrent();
    selected = id;

    document.querySelectorAll(".game-card").forEach(card => {
      const active = card.dataset.game === id;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });

    elements.title.textContent = games[id].title;
    elements.hint.textContent = games[id].hint;
    elements.overlayTitle.textContent = "PRONTO PARA JOGAR?";
    elements.overlayText.textContent = games[id].controls;
    elements.start.textContent = "▶ INICIAR JOGO";

    resetDisplay();
    showOnly(elements.startOverlay);
    setStatus("READY");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#080816";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#5a5a83";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("JONAS ARCADE // " + games[id].title, canvas.width / 2, canvas.height / 2);
  }

  function createGameApi() {
    return {
      canvas,
      ctx,

      setScore(value) {
        score = Math.max(0, Math.floor(Number(value) || 0));
        writeRecord(selected, score);
        updateStats();
      },

      addScore(value) {
        score += Math.max(0, Math.floor(Number(value) || 0));
        writeRecord(selected, score);
        updateStats();
      },

      setLives(value) {
        lives = Math.max(0, Math.floor(Number(value) || 0));
        updateStats();
      },

      setLevel(value) {
        level = Math.max(1, Math.floor(Number(value) || 1));
        updateStats();
      },

      sound,

      end(message = "Sua partida terminou.") {
        if (!playing) return;
        playing = false;
        paused = false;
        if (instance && typeof instance.pause === "function") instance.pause();

        elements.endTitle.textContent = score > 0 ? "FIM DE JOGO" : "FIM DE JOGO";
        elements.endText.textContent = message + " Pontuação: " + formatNumber(score);
        showOnly(elements.endOverlay);
        setStatus("GAME OVER");
        sound("over");
        updateStats();
      },

      win(message = "Parabéns! Você completou o desafio.") {
        if (!playing) return;
        playing = false;
        paused = false;
        if (instance && typeof instance.pause === "function") instance.pause();

        elements.endTitle.textContent = "VOCÊ VENCEU!";
        elements.endText.textContent = message + " Pontuação: " + formatNumber(score);
        showOnly(elements.endOverlay);
        setStatus("COMPLETED");
        sound("clear");
        updateStats();
      },

      getPaused() {
        return paused;
      }
    };
  }

  function startGame() {
    destroyCurrent();
    resetDisplay();

    const game = window.ArcadeGames[selected];
    if (!game || typeof game.init !== "function") {
      elements.overlayText.textContent = "Não foi possível carregar este jogo. Confira os arquivos JavaScript.";
      showOnly(elements.startOverlay);
      return;
    }

    try {
      instance = game.init(canvas, createGameApi());
      playing = true;
      paused = false;
      showOnly(null);
      setStatus("PLAYING", "playing");
    } catch (error) {
      console.error("Erro ao iniciar o jogo:", error);
      destroyCurrent();
      elements.overlayText.textContent = "Erro ao iniciar. Confira o console do navegador (F12).";
      showOnly(elements.startOverlay);
      setStatus("ERROR");
    }
  }

  function pauseGame() {
    if (!playing || paused) return;
    paused = true;
    if (instance && typeof instance.pause === "function") instance.pause();
    showOnly(elements.pauseOverlay);
    setStatus("PAUSED", "paused");
  }

  function resumeGame() {
    if (!playing || !paused) return;
    paused = false;
    if (instance && typeof instance.resume === "function") instance.resume();
    showOnly(null);
    setStatus("PLAYING", "playing");
  }

  document.querySelectorAll(".game-card").forEach(card => {
    card.addEventListener("click", () => selectGame(card.dataset.game));
  });

  elements.start.addEventListener("click", startGame);
  elements.restart.addEventListener("click", startGame);
  elements.resume.addEventListener("click", resumeGame);

  elements.sound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    elements.sound.textContent = soundEnabled ? "♪ SOM: ON" : "♪ SOM: OFF";
    elements.sound.setAttribute("aria-pressed", String(soundEnabled));
    if (soundEnabled) {
      unlockAudio();
      sound("collect");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (paused) resumeGame();
      else pauseGame();
    }

    if (event.key === "Enter" &&
        !playing &&
        elements.startOverlay.classList.contains("is-hidden") === false) {
      startGame();
    }
  });

  document.querySelectorAll("[data-key]").forEach(button => {
    const sendKey = (type, event) => {
        event.preventDefault();

        if (!playing || paused) return;

        window.dispatchEvent(new KeyboardEvent(type, {
        key: button.dataset.key,
        bubbles: true,
        cancelable: true
        }));
    };

    button.addEventListener("pointerdown", event => {
        button.setPointerCapture?.(event.pointerId);
        sendKey("keydown", event);
    });

    button.addEventListener("pointerup", event => {
        sendKey("keyup", event);
    });

    button.addEventListener("pointercancel", event => {
        sendKey("keyup", event);
    });

    button.addEventListener("lostpointercapture", event => {
        sendKey("keyup", event);
    });

    button.addEventListener("contextmenu", event => event.preventDefault());
    });

  window.addEventListener("beforeunload", destroyCurrent);

  selectGame("pacman");
})();
