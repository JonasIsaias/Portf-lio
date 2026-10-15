
(() => {
  "use strict";

  window.ArcadeGames = window.ArcadeGames || {};

  window.ArcadeGames.pacman = {
    init(canvas, api) {
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Não foi possível inicializar o Canvas do Pac-Man.");
      }

      const TILE = 36;
      const COLS = 20;
      const ROWS = 15;
      const WIDTH = COLS * TILE;
      const HEIGHT = ROWS * TILE;

      const PLAYER_SPEED = 145;
      const GHOST_SPEED = 85;
      const PLAYER_RADIUS = 12;
      const GHOST_RADIUS = 12;
      const CENTER_TOLERANCE = 5;

      const DIRECTIONS = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 }
      };

      let raf = 0;
      let last = 0;
      let paused = false;
      let over = false;
      let destroyed = false;

      let score = 0;
      let lives = 3;
      let mouth = 0;
      let mouthDir = 1;
      let invulnerable = 0;
      let ghostModeTimer = 0;
      let frightened = false;
      let gameTime = 0;

      let walls = new Set();
      let dots = new Set();
      let powerDots = new Set();

      let player;
      let ghosts = [];

      let swipeStart = null;
      let activePointer = null;

      const key = (x, y) => `${x},${y}`;

      const sameDirection = (a, b) =>
        a.x === b.x && a.y === b.y;

      const isZeroDirection = (dir) =>
        dir.x === 0 && dir.y === 0;

      const tileAt = (px, py) => ({
        x: Math.floor(px / TILE),
        y: Math.floor(py / TILE)
      });

      const centerOf = (tileX, tileY) => ({
        x: tileX * TILE + TILE / 2,
        y: tileY * TILE + TILE / 2
      });

      const distance = (a, b) =>
        Math.hypot(a.x - b.x, a.y - b.y);

      function wallAt(x, y) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) {
          return true;
        }

        return walls.has(key(x, y));
      }

      function buildMap() {
        walls = new Set();
        dots = new Set();
        powerDots = new Set();

        // Contorno.
        for (let x = 0; x < COLS; x++) {
          walls.add(key(x, 0));
          walls.add(key(x, ROWS - 1));
        }

        for (let y = 0; y < ROWS; y++) {
          walls.add(key(0, y));
          walls.add(key(COLS - 1, y));
        }

        // Barreiras.
        const blocks = [
          [3, 2, 5, 2],
          [3, 3, 3, 5],
          [7, 2, 7, 4],
          [8, 5, 11, 5],
          [12, 2, 16, 2],
          [16, 3, 16, 5],

          [5, 7, 8, 7],
          [11, 7, 14, 7],

          [3, 9, 3, 12],
          [4, 9, 7, 9],
          [9, 9, 9, 12],
          [12, 9, 16, 9],
          [16, 10, 16, 12],

          [6, 12, 7, 12],
          [12, 12, 13, 12]
        ];

        for (const [x1, y1, x2, y2] of blocks) {
          for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
              walls.add(key(x, y));
            }
          }
        }

        // Aberturas e conexões.
        const openings = [
          [3, 4], [7, 3], [7, 4],
          [12, 3], [16, 4],
          [6, 7], [13, 7],
          [3, 10], [9, 10],
          [16, 11], [6, 12], [12, 12],

          [5, 3], [5, 4], [5, 5],
          [8, 3], [9, 3], [10, 3], [11, 3],
          [14, 3], [14, 4], [14, 5],
          [4, 6], [5, 6], [6, 6],
          [9, 6], [10, 6],
          [13, 6], [14, 6],
          [4, 8], [5, 8], [6, 8],
          [10, 8], [11, 8], [12, 8],
          [8, 10], [10, 10], [11, 10],
          [5, 11], [6, 11], [7, 11],
          [13, 11], [14, 11], [15, 11]
        ];

        openings.forEach(([x, y]) => walls.delete(key(x, y)));

        // Posições iniciais transitáveis.
        [
          [1, 1], [18, 1],
          [1, 13], [18, 13],
          [10, 7], [10, 6]
        ].forEach(([x, y]) => walls.delete(key(x, y)));

        // Pontos comuns.
        for (let y = 1; y < ROWS - 1; y++) {
          for (let x = 1; x < COLS - 1; x++) {
            if (!wallAt(x, y)) {
              dots.add(key(x, y));
            }
          }
        }

        // Posições de início sem pontos comuns.
        [
          [1, 1], [18, 1],
          [1, 13], [18, 13],
          [10, 7]
        ].forEach(([x, y]) => dots.delete(key(x, y)));

        // Pontos especiais.
        [
          [1, 1], [18, 1],
          [1, 13], [18, 13]
        ].forEach(([x, y]) => {
          if (!wallAt(x, y)) {
            dots.delete(key(x, y));
            powerDots.add(key(x, y));
          }
        });
      }

      function createGhost(x, y, color, id) {
        const p = centerOf(x, y);

        return {
          x: p.x,
          y: p.y,
          startX: p.x,
          startY: p.y,
          color,
          id,
          dir: { x: 0, y: 0 },
          timer: 0,
          eaten: false
        };
      }

      function resetPositions() {
        const start = centerOf(1, 1);

        player = {
          x: start.x,
          y: start.y,
          dir: { x: 0, y: 0 },
          next: { x: 0, y: 0 },
          speed: PLAYER_SPEED
        };

        ghosts = [
          createGhost(18, 1, "#ff4e91", 0),
          createGhost(18, 13, "#00e5ff", 1),
          createGhost(1, 13, "#ff9e57", 2)
        ];

        invulnerable = 1.5;
        frightened = false;
        ghostModeTimer = 0;
      }

      function isWalkable(px, py, radius = 10) {
        const points = [
          [px - radius, py],
          [px + radius, py],
          [px, py - radius],
          [px, py + radius]
        ];

        return points.every(([x, y]) => {
          const tile = tileAt(x, y);
          return !wallAt(tile.x, tile.y);
        });
      }

      function canMoveFromTile(x, y, dir) {
        if (isZeroDirection(dir)) return false;

        return !wallAt(x + dir.x, y + dir.y);
      }

      // Recebe direção tanto do teclado quanto dos botões de toque.
      function setDirection(direction) {
        if (!player || over || paused || destroyed) return;

        player.next = {
          x: direction.x,
          y: direction.y
        };
      }

      function onKey(event) {
        const keyName = event.key.toLowerCase();

        const dirs = {
            arrowup: { x: 0, y: -1 },
            w: { x: 0, y: -1 },

            arrowdown: { x: 0, y: 1 },
            s: { x: 0, y: 1 },

            arrowleft: { x: -1, y: 0 },
            a: { x: -1, y: 0 },

            arrowright: { x: 1, y: 0 },
            d: { x: 1, y: 0 }
        };

        if (!dirs[keyName]) return;

        // Evita que as setas movimentem a página.
        event.preventDefault();

        if (over || paused || !player) return;

        // Guarda a direção solicitada para a próxima curva.
        player.next = { ...dirs[keyName] };
      }

      // Também aceita teclas WASD quando o navegador informa maiúsculas.
      function onKeyDown(event) {
        if (event.key === " " || event.code === "Space") return;
        onKey(event);
      }

      function nearTileCenter(entity, tolerance = CENTER_TOLERANCE) {
        const tile = tileAt(entity.x, entity.y);
        const center = centerOf(tile.x, tile.y);

        return {
          near:
            Math.abs(entity.x - center.x) <= tolerance &&
            Math.abs(entity.y - center.y) <= tolerance,
          tile,
          center
        };
      }

      function movePlayer(dt) {
        const info = nearTileCenter(player);

        if (info.near) {
          player.x = info.center.x;
          player.y = info.center.y;

          // Prioriza a direção solicitada pelo jogador.
          if (
            !isZeroDirection(player.next) &&
            canMoveFromTile(info.tile.x, info.tile.y, player.next)
          ) {
            player.dir = { ...player.next };
          }

          // Para apenas quando o corredor à frente está bloqueado.
          if (
            !isZeroDirection(player.dir) &&
            !canMoveFromTile(info.tile.x, info.tile.y, player.dir)
          ) {
            player.dir = { x: 0, y: 0 };
          }
        }

        if (!isZeroDirection(player.dir)) {
          const nx = player.x + player.dir.x * player.speed * dt;
          const ny = player.y + player.dir.y * player.speed * dt;

          if (isWalkable(nx, ny, PLAYER_RADIUS)) {
            player.x = nx;
            player.y = ny;
          } else {
            // Alinha o personagem ao corredor ao alcançar uma parede.
            const tile = tileAt(player.x, player.y);
            const center = centerOf(tile.x, tile.y);

            if (player.dir.x !== 0) {
              player.y = center.y;
            }

            if (player.dir.y !== 0) {
              player.x = center.x;
            }

            player.dir = { x: 0, y: 0 };
          }
        }

        collectItems();

        mouth += dt * 11 * mouthDir;

        if (mouth >= 1) {
          mouth = 1;
          mouthDir = -1;
        } else if (mouth <= 0) {
          mouth = 0;
          mouthDir = 1;
        }
      }

      function collectItems() {
        const tile = tileAt(player.x, player.y);
        const current = key(tile.x, tile.y);

        if (dots.delete(current)) {
          score += 10;
          api.setScore(score);
          api.sound("collect");
        }

        if (powerDots.delete(current)) {
          score += 50;
          api.setScore(score);

          frightened = true;
          ghostModeTimer = 6;

          api.sound("clear");
        }

        if (dots.size === 0 && powerDots.size === 0 && !over) {
          over = true;
          api.win("Você limpou o labirinto e coletou todos os pontos!");
        }
      }

      function getGhostChoices(ghost, tile) {
        const directions = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 }
        ];

        const valid = directions.filter(dir =>
          canMoveFromTile(tile.x, tile.y, dir)
        );

        const reverse = {
          x: -ghost.dir.x,
          y: -ghost.dir.y
        };

        const forward = valid.filter(dir =>
          !sameDirection(dir, reverse)
        );

        return forward.length ? forward : valid;
      }

      function chooseGhostDirection(ghost, tile) {
        const choices = getGhostChoices(ghost, tile);

        if (!choices.length) {
          ghost.dir = { x: 0, y: 0 };
          return;
        }

        if (frightened) {
          choices.sort((a, b) => {
            const pa = centerOf(tile.x + a.x, tile.y + a.y);
            const pb = centerOf(tile.x + b.x, tile.y + b.y);

            return distance(pb, player) - distance(pa, player);
          });

          const top = choices.slice(0, Math.min(2, choices.length));
          ghost.dir = { ...top[Math.floor(Math.random() * top.length)] };
          return;
        }

        if (Math.random() < 0.65) {
          choices.sort((a, b) => {
            const pa = centerOf(tile.x + a.x, tile.y + a.y);
            const pb = centerOf(tile.x + b.x, tile.y + b.y);

            return distance(pa, player) - distance(pb, player);
          });

          ghost.dir = { ...choices[0] };
        } else {
          ghost.dir = {
            ...choices[Math.floor(Math.random() * choices.length)]
          };
        }
      }

      function moveGhosts(dt) {
        for (const ghost of ghosts) {
          if (ghost.eaten) continue;

          ghost.timer -= dt;

          const info = nearTileCenter(ghost, 4);

          if (info.near && ghost.timer <= 0) {
            ghost.x = info.center.x;
            ghost.y = info.center.y;

            chooseGhostDirection(ghost, info.tile);
            ghost.timer = 0.22;
          }

          const speed = frightened ? 65 : GHOST_SPEED;
          const nx = ghost.x + ghost.dir.x * speed * dt;
          const ny = ghost.y + ghost.dir.y * speed * dt;

          if (isWalkable(nx, ny, 5)) {
            ghost.x = nx;
            ghost.y = ny;
          } else {
            ghost.timer = 0;
            ghost.dir = { x: 0, y: 0 };
          }

          // Colisão com o jogador.
          const separation = distance(player, ghost);

          if (separation < PLAYER_RADIUS + GHOST_RADIUS) {
            if (invulnerable > 0) continue;

            if (frightened) {
              ghost.eaten = true;

              score += 200;
              api.setScore(score);
              api.sound("collect");

              // Volta à posição original, sem manter o estado de captura.
              ghost.x = ghost.startX;
              ghost.y = ghost.startY;
              ghost.dir = { x: 0, y: 0 };
              ghost.timer = 0;
              ghost.eaten = false;
            } else {
              loseLife();
              return;
            }
          }
        }
      }

      function loseLife() {
        if (over) return;

        lives -= 1;
        api.setLives(lives);
        api.sound("hit");

        if (lives <= 0) {
          over = true;
          api.end("Os fantasmas venceram desta vez.");
          return;
        }

        resetPositions();
      }

      function drawWalls() {
        for (const wall of walls) {
          const [x, y] = wall.split(",").map(Number);
          const px = x * TILE;
          const py = y * TILE;

          ctx.fillStyle = "#121b4b";
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);

          ctx.strokeStyle = "#1676cf";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);

          ctx.fillStyle = "#253d83";
          ctx.fillRect(px + 6, py + 6, TILE - 12, 2);
        }
      }

      function drawDots() {
        ctx.fillStyle = "#ffe6b3";

        for (const dot of dots) {
          const [x, y] = dot.split(",").map(Number);

          ctx.beginPath();
          ctx.arc(
            x * TILE + TILE / 2,
            y * TILE + TILE / 2,
            3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        for (const dot of powerDots) {
          const [x, y] = dot.split(",").map(Number);
          const pulse = 5 + Math.sin(gameTime * 5) * 1.5;

          ctx.save();
          ctx.shadowColor = "#ffe45c";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#ffe45c";

          ctx.beginPath();
          ctx.arc(
            x * TILE + TILE / 2,
            y * TILE + TILE / 2,
            pulse,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.restore();
        }
      }

      function drawGhost(ghost) {
        const x = ghost.x;
        const y = ghost.y;
        const r = GHOST_RADIUS + 1;

        ctx.save();

        ctx.fillStyle = frightened ? "#5368ff" : ghost.color;

        if (
          frightened &&
          ghostModeTimer < 2 &&
          Math.floor(gameTime * 8) % 2
        ) {
          ctx.fillStyle = "#f5f5ff";
        }

        ctx.beginPath();
        ctx.arc(x, y - 2, r, Math.PI, 0);
        ctx.lineTo(x + r, y + r);
        ctx.lineTo(x + r / 2, y + r - 4);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r / 2, y + r - 4);
        ctx.lineTo(x - r, y + r);
        ctx.closePath();
        ctx.fill();

        // Olhos.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(x - 5, y - 2, 4, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 5, y - 2, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#17172d";
        ctx.beginPath();
        ctx.arc(
          x - 5 + ghost.dir.x * 1.5,
          y - 2 + ghost.dir.y * 1.5,
          2, 0, Math.PI * 2
        );
        ctx.arc(
          x + 5 + ghost.dir.x * 1.5,
          y - 2 + ghost.dir.y * 1.5,
          2, 0, Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
      }

      function drawPlayer() {
        ctx.save();
        ctx.translate(player.x, player.y);

        let angle = 0;

        if (player.dir.x === -1) angle = Math.PI;
        if (player.dir.y === -1) angle = -Math.PI / 2;
        if (player.dir.y === 1) angle = Math.PI / 2;

        ctx.rotate(angle);

        if (
          invulnerable > 0 &&
          Math.floor(gameTime * 12) % 2 === 0
        ) {
          ctx.globalAlpha = 0.4;
        }

        ctx.fillStyle = "#ffdc45";
        ctx.shadowColor = "#ffdc45";
        ctx.shadowBlur = 10;

        ctx.beginPath();

        const open = 0.12 + mouth * 0.42;

        ctx.moveTo(0, 0);
        ctx.arc(
          0,
          0,
          PLAYER_RADIUS + 2,
          open,
          Math.PI * 2 - open
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      function draw() {
        const pixelRatio = window.devicePixelRatio || 1;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        // Ajusta a resolução interna sem distorcer o desenho.
        if (
          displayWidth > 0 &&
          displayHeight > 0 &&
          (
            canvas.width !== Math.round(displayWidth * pixelRatio) ||
            canvas.height !== Math.round(displayHeight * pixelRatio)
          )
        ) {
          canvas.width = Math.round(displayWidth * pixelRatio);
          canvas.height = Math.round(displayHeight * pixelRatio);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#070717";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Escala o mapa para o tamanho disponível no celular ou desktop.
        const scale = Math.min(
          canvas.width / WIDTH,
          canvas.height / HEIGHT
        );

        const offsetX = (canvas.width - WIDTH * scale) / 2;
        const offsetY = (canvas.height - HEIGHT * scale) / 2;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        drawWalls();
        drawDots();

        ghosts.forEach(drawGhost);
        drawPlayer();

        ctx.restore();

        // HUD desenhado fora do mapa.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#a6a6cf";
        ctx.font = `${12 * pixelRatio}px monospace`;
        ctx.textAlign = "left";

        ctx.fillText(
          `PONTOS: ${score}`,
          12 * pixelRatio,
          canvas.height - 12 * pixelRatio
        );

        ctx.textAlign = "right";
        ctx.fillText(
          frightened ? "POWER MODE" : "PAC-MAN",
          canvas.width - 12 * pixelRatio,
          canvas.height - 12 * pixelRatio
        );

        ctx.textAlign = "left";
      }

      // Liga os botões direcionais da página ao jogo.
      const touchButtons = Array.from(
        document.querySelectorAll(".touch-controls [data-key]")
      );

      function onTouchControl(event) {
        const direction = DIRECTIONS[event.currentTarget.dataset.key];

        if (!direction) {
          // Espaço/AÇÃO não tem função no Pac-Man.
          return;
        }

        event.preventDefault();
        setDirection(direction);
      }

      function onTouchControlKey(event) {
        if (event.key !== "Enter" && event.key !== " ") return;

        const direction = DIRECTIONS[event.currentTarget.dataset.key];

        if (!direction) return;

        event.preventDefault();
        setDirection(direction);
      }

      // Permite deslizar o dedo diretamente sobre o labirinto.
      function onPointerDown(event) {
        if (event.pointerType === "mouse") return;
        if (event.target.closest(".touch-controls")) return;

        swipeStart = {
          x: event.clientX,
          y: event.clientY
        };

        activePointer = event.pointerId;
      }

      function onPointerUp(event) {
        if (!swipeStart || event.pointerId !== activePointer) return;

        const dx = event.clientX - swipeStart.x;
        const dy = event.clientY - swipeStart.y;
        const threshold = 18;

        if (Math.max(Math.abs(dx), Math.abs(dy)) >= threshold) {
          if (Math.abs(dx) > Math.abs(dy)) {
            setDirection(
              dx > 0 ? DIRECTIONS.ArrowRight : DIRECTIONS.ArrowLeft
            );
          } else {
            setDirection(
              dy > 0 ? DIRECTIONS.ArrowDown : DIRECTIONS.ArrowUp
            );
          }
        }

        swipeStart = null;
        activePointer = null;
      }

      function onPointerCancel() {
        swipeStart = null;
        activePointer = null;
      }

      function loop(time) {
        if (destroyed) return;

        if (over) {
          draw();
          return;
        }

        const dt = Math.min((time - (last || time)) / 1000, 0.02);
        last = time;

        if (!paused) {
          gameTime += dt;

          if (invulnerable > 0) {
            invulnerable = Math.max(0, invulnerable - dt);
          }

          if (frightened) {
            ghostModeTimer -= dt;

            if (ghostModeTimer <= 0) {
              frightened = false;
              ghostModeTimer = 0;
            }
          }

          movePlayer(dt);

          if (!over) {
            moveGhosts(dt);
          }
        }

        draw();
        raf = requestAnimationFrame(loop);
      }

      function removeListeners() {
        window.removeEventListener("keydown", onKeyDown);

        touchButtons.forEach(button => {
          button.removeEventListener("pointerdown", onTouchControl);
          button.removeEventListener("keydown", onTouchControlKey);
        });

        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
      }

      // Inicialização.
      buildMap();
      resetPositions();

      score = 0;
      lives = 3;

      api.setScore(score);
      api.setLives(lives);
      api.setLevel(1);

      window.addEventListener("keydown", onKeyDown, { passive: false });

      touchButtons.forEach(button => {
        button.addEventListener("pointerdown", onTouchControl, {
          passive: false
        });

        button.addEventListener("keydown", onTouchControlKey);
      });

      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);

      draw();
      raf = requestAnimationFrame(loop);

      return {
        pause() {
          paused = true;
        },

        resume() {
          if (over || destroyed) return;

          paused = false;
          last = 0;
        },

        destroy() {
          destroyed = true;
          cancelAnimationFrame(raf);
          removeListeners();
        }
      };
    }
  };
})();
