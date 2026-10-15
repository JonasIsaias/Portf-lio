
(() => {
  "use strict";

  window.ArcadeGames = window.ArcadeGames || {};

  window.ArcadeGames.pacman = {
    init(canvas, api) {
      const ctx = canvas.getContext("2d");

      const TILE = 36;
      const COLS = 20;
      const ROWS = 15;
      const WIDTH = COLS * TILE;
      const HEIGHT = ROWS * TILE;

      const PLAYER_SPEED = 145;
      const GHOST_SPEED = 76;
      const PLAYER_RADIUS = 12;
      const GHOST_RADIUS = 12;

      let raf = 0;
      let last = 0;
      let paused = false;
      let over = false;
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

      const key = (x, y) => `${x},${y}`;

      const wallAt = (x, y) => {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
        return walls.has(key(x, y));
      };

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

      function buildMap() {
        walls = new Set();
        dots = new Set();
        powerDots = new Set();

        // Contorno do labirinto.
        for (let x = 0; x < COLS; x++) {
          walls.add(key(x, 0));
          walls.add(key(x, ROWS - 1));
        }

        for (let y = 0; y < ROWS; y++) {
          walls.add(key(0, y));
          walls.add(key(COLS - 1, y));
        }

        // Barreiras desenhadas de forma simétrica.
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

        // Aberturas para conectar os corredores.
        const openings = [
          [3, 4], [7, 3], [7, 4],
          [12, 3], [16, 4],
          [6, 7], [13, 7],
          [3, 10], [9, 10],
          [16, 11], [6, 12],
          [12, 12],

          // Corredores centrais e conexões horizontais.
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

        // Garantir que todas as posições de início sejam transitáveis.
        [
          [1, 1], [18, 1],
          [1, 13], [18, 13],
          [10, 7], [10, 6]
        ].forEach(([x, y]) => walls.delete(key(x, y)));

        // Pontos comuns.
        for (let y = 1; y < ROWS - 1; y++) {
          for (let x = 1; x < COLS - 1; x++) {
            if (!wallAt(x, y)) dots.add(key(x, y));
          }
        }

        // Espaços iniciais dos personagens sem pontos.
        [
          [1, 1], [18, 1],
          [1, 13], [18, 13],
          [10, 7]
        ].forEach(([x, y]) => dots.delete(key(x, y)));

        // Quatro pontos especiais nos cantos do labirinto.
        const special = [
          [1, 1], [18, 1],
          [1, 13], [18, 13]
        ];

        special.forEach(([x, y]) => {
          if (!wallAt(x, y)) {
            dots.delete(key(x, y));
            powerDots.add(key(x, y));
          }
        });
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

        const spawnGhost = (x, y, color, id) => {
          const p = centerOf(x, y);
          return {
            x: p.x,
            y: p.y,
            color,
            id,
            dir: { x: 0, y: 0 },
            changeTimer: 0,
            eaten: false
          };
        };

        ghosts = [
          spawnGhost(18, 1, "#ff4e91", 0),
          spawnGhost(18, 13, "#00e5ff", 1),
          spawnGhost(1, 13, "#ff9e57", 2)
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
        if (dir.x === 0 && dir.y === 0) return false;
        return !wallAt(x + dir.x, y + dir.y);
      }

      function onKey(event) {
        if (over || paused) return;

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

        event.preventDefault();
        player.next = { ...dirs[keyName] };
      }

      function nearTileCenter(entity, tolerance = 4) {
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

          if (canMoveFromTile(info.tile.x, info.tile.y, player.next)) {
            player.dir = { ...player.next };
          }

          if (!canMoveFromTile(info.tile.x, info.tile.y, player.dir)) {
            player.dir = { x: 0, y: 0 };
          }
        }

        if (player.dir.x !== 0 || player.dir.y !== 0) {
          const nx = player.x + player.dir.x * player.speed * dt;
          const ny = player.y + player.dir.y * player.speed * dt;

          if (isWalkable(nx, ny, PLAYER_RADIUS)) {
            player.x = nx;
            player.y = ny;
          } else {
            // Encosta no centro do corredor para evitar ficar preso em paredes.
            const tile = tileAt(player.x, player.y);
            const center = centerOf(tile.x, tile.y);

            if (player.dir.x !== 0) player.y = center.y;
            if (player.dir.y !== 0) player.x = center.x;

            if (!isWalkable(
              player.x + player.dir.x * 2,
              player.y + player.dir.y * 2,
              PLAYER_RADIUS
            )) {
              player.dir = { x: 0, y: 0 };
            }
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

        if (dots.has(current)) {
          dots.delete(current);
          score += 10;
          api.setScore(score);
          api.sound("collect");
        }

        if (powerDots.has(current)) {
          powerDots.delete(current);
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
          !(dir.x === reverse.x && dir.y === reverse.y)
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
          // No modo especial, os fantasmas tentam se afastar do jogador.
          choices.sort((a, b) => {
            const pa = centerOf(tile.x + a.x, tile.y + a.y);
            const pb = centerOf(tile.x + b.x, tile.y + b.y);
            return distance(pb, player) - distance(pa, player);
          });

          const top = choices.slice(0, Math.min(2, choices.length));
          ghost.dir = { ...top[Math.floor(Math.random() * top.length)] };
          return;
        }

        // Um pouco de perseguição sem tornar todos os movimentos previsíveis.
        if (Math.random() < 0.65) {
          choices.sort((a, b) => {
            const pa = centerOf(tile.x + a.x, tile.y + a.y);
            const pb = centerOf(tile.x + b.x, tile.y + b.y);
            return distance(pa, player) - distance(pb, player);
          });

          ghost.dir = { ...choices[0] };
        } else {
          ghost.dir = { ...choices[Math.floor(Math.random() * choices.length)] };
        }
      }

      
    function moveGhosts(dt) {
        for (const ghost of ghosts) {
            if (ghost.eaten) continue;

            ghost.timer = (ghost.timer || 0) - dt;

            const tileX = Math.floor(ghost.x / TILE);
            const tileY = Math.floor(ghost.y / TILE);

            // Escolhe uma nova direção quando necessário.
            if (ghost.timer <= 0) {
            const directions = [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 }
            ];

            const possible = directions.filter(dir => {
                const nextX = tileX + dir.x;
                const nextY = tileY + dir.y;

                return isWalkable(
                nextX * TILE + TILE / 2,
                nextY * TILE + TILE / 2,
                2
                );
            });

            if (possible.length > 0) {
                // Evita voltar imediatamente pelo mesmo caminho,
                // exceto quando não houver outra saída.
                let choices = possible.filter(dir =>
                !(dir.x === -ghost.dir.x && dir.y === -ghost.dir.y)
                );

                if (choices.length === 0) choices = possible;

                if (frightened) {
                ghost.dir = choices[
                    Math.floor(Math.random() * choices.length)
                ];
                } else {
                // Em geral, escolhe a direção que aproxima do jogador.
                choices.sort((a, b) => {
                    const distanceA = Math.hypot(
                    tileX + a.x - Math.floor(player.x / TILE),
                    tileY + a.y - Math.floor(player.y / TILE)
                    );

                    const distanceB = Math.hypot(
                    tileX + b.x - Math.floor(player.x / TILE),
                    tileY + b.y - Math.floor(player.y / TILE)
                    );

                    return distanceA - distanceB;
                });

                // Às vezes escolhe uma rota alternativa para não ficar preso.
                ghost.dir = Math.random() < 0.2
                    ? choices[Math.floor(Math.random() * choices.length)]
                    : choices[0];
                }
            }

            ghost.timer = 0.25;
            }

            const speed = frightened ? 65 : 85;

            const nextX = ghost.x + ghost.dir.x * speed * dt;
            const nextY = ghost.y + ghost.dir.y * speed * dt;

            if (isWalkable(nextX, nextY, 5)) {
            ghost.x = nextX;
            ghost.y = nextY;
            } else {
            // Se bater em uma parede, força a escolha de outra direção.
            ghost.timer = 0;
            }

            // Colisão com o Pac-Man.
            const distance = Math.hypot(
            player.x - ghost.x,
            player.y - ghost.y
            );

            if (distance < TILE * 0.65) {
            if (frightened) {
                ghost.eaten = true;
                score += 200;
                api.setScore(score);
                api.sound?.("collect");

                ghost.x = ghost.startX;
                ghost.y = ghost.startY;
                ghost.dir = { x: 0, y: 0 };
                ghost.eaten = false;
                ghost.timer = 0;
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
        if (frightened && ghostModeTimer < 2 && Math.floor(gameTime * 8) % 2) {
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

        // Olhos direcionados ao movimento do fantasma.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(x - 5, y - 2, 4, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 5, y - 2, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#17172d";
        ctx.beginPath();
        ctx.arc(x - 5 + ghost.dir.x * 1.5, y - 2 + ghost.dir.y * 1.5, 2, 0, Math.PI * 2);
        ctx.arc(x + 5 + ghost.dir.x * 1.5, y - 2 + ghost.dir.y * 1.5, 2, 0, Math.PI * 2);
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

        if (invulnerable > 0 && Math.floor(gameTime * 12) % 2 === 0) {
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#070717";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Centraliza o mapa se o Canvas tiver dimensões diferentes.
        const offsetX = Math.max(0, (canvas.width - WIDTH) / 2);
        const offsetY = Math.max(0, (canvas.height - HEIGHT) / 2);

        ctx.save();
        ctx.translate(offsetX, offsetY);

        drawWalls();
        drawDots();

        ghosts.forEach(drawGhost);
        drawPlayer();

        ctx.restore();

        // HUD externo ao labirinto.
        ctx.fillStyle = "#a6a6cf";
        ctx.font = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText("PONTOS: " + dots.size, 12, canvas.height - 12);

        ctx.textAlign = "right";
        ctx.fillText(
          frightened ? "POWER MODE" : "PAC-MAN",
          canvas.width - 12,
          canvas.height - 12
        );

        ctx.textAlign = "left";
      }

      function loop(time) {
        if (over) {
          draw();
          return;
        }

        const dt = Math.min((time - (last || time)) / 1000, 0.035);
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

      // Inicialização.
      buildMap();
      resetPositions();

      score = 0;
      lives = 3;
      api.setScore(score);
      api.setLives(lives);
      api.setLevel(1);

      draw();

      window.addEventListener("keydown", onKey);
      raf = requestAnimationFrame(loop);

      return {
        pause() {
          paused = true;
        },

        resume() {
          paused = false;
          last = 0;
        },

        destroy() {
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", onKey);
        }
      };
    }
  };
})();