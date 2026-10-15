
(() => {
  "use strict";

  window.ArcadeGames = window.ArcadeGames || {};

  window.ArcadeGames.pacman = {
    init(canvas, api) {
      const ctx = canvas.getContext("2d");

      // =========================================================
      // CONFIGURAÇÕES
      // =========================================================
      const TILE = 36;
      const COLS = 20;
      const ROWS = 15;
      const WIDTH = COLS * TILE;
      const HEIGHT = ROWS * TILE;

      const PLAYER_SPEED = 145;
      const GHOST_SPEED = 76;
      const PLAYER_RADIUS = 12;
      const GHOST_RADIUS = 12;
      const TURN_TOLERANCE = 7;

      const DIRECTIONS = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
      };

      const COLORS = {
        background: "#060713",
        wall: "#18245a",
        wallGlow: "#00e5ff",
        player: "#ffe34d",
        dot: "#e8eaff",
        power: "#ff4edb",
        text: "#d9ddff"
      };

      let raf = 0;
      let last = 0;
      let paused = false;
      let over = false;
      let destroyed = false;

      let score = 0;
      let lives = 3;
      let level = 1;

      let mouth = 0;
      let mouthDir = 1;
      let invulnerable = 0;
      let frightenedTimer = 0;
      let gameTime = 0;

      let walls = new Set();
      let dots = new Set();
      let powerDots = new Set();

      let player = null;
      let ghosts = [];

      // =========================================================
      // FUNÇÕES AUXILIARES
      // =========================================================
      const keyOf = (x, y) => `${x},${y}`;

      function safeSound(name) {
        try {
          if (api && typeof api.sound === "function") {
            api.sound(name);
          }
        } catch (_) {
          // O áudio não pode interromper o jogo.
        }
      }

      function updateScore() {
        if (api && typeof api.setScore === "function") {
          api.setScore(score);
        }
      }

      function updateLives() {
        if (api && typeof api.setLives === "function") {
          api.setLives(lives);
        }
      }

      function updateLevel() {
        if (api && typeof api.setLevel === "function") {
          api.setLevel(level);
        }
      }

      function finishGame(message) {
        if (over) return;

        over = true;

        if (player) {
          player.dir = { x: 0, y: 0 };
          player.next = { x: 0, y: 0 };
        }

        if (api && typeof api.end === "function") {
          api.end(message);
        }
      }

      function centerOf(x, y) {
        return {
          x: x * TILE + TILE / 2,
          y: y * TILE + TILE / 2
        };
      }

      function tileAt(x, y) {
        return {
          x: Math.floor(x / TILE),
          y: Math.floor(y / TILE)
        };
      }

      function isWall(x, y) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) {
          return true;
        }

        return walls.has(keyOf(x, y));
      }

      function canMoveFromTile(x, y, direction) {
        if (!direction || (!direction.x && !direction.y)) {
          return false;
        }

        return !isWall(
          x + direction.x,
          y + direction.y
        );
      }

      function isWalkable(x, y, radius) {
        const points = [
          [x - radius, y - radius],
          [x + radius, y - radius],
          [x - radius, y + radius],
          [x + radius, y + radius]
        ];

        return points.every(([px, py]) => {
          const tile = tileAt(px, py);
          return !isWall(tile.x, tile.y);
        });
      }

      function nearTileCenter(entity, tolerance = TURN_TOLERANCE) {
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

      function addHorizontalWall(y, startX, endX) {
        for (let x = startX; x <= endX; x++) {
          walls.add(keyOf(x, y));
        }
      }

      function addVerticalWall(x, startY, endY) {
        for (let y = startY; y <= endY; y++) {
          walls.add(keyOf(x, y));
        }
      }

      // =========================================================
      // CONSTRUÇÃO DO LABIRINTO
      // =========================================================
      function buildMap() {
        walls = new Set();
        dots = new Set();
        powerDots = new Set();

        // Bordas externas.
        for (let x = 0; x < COLS; x++) {
          walls.add(keyOf(x, 0));
          walls.add(keyOf(x, ROWS - 1));
        }

        for (let y = 0; y < ROWS; y++) {
          walls.add(keyOf(0, y));
          walls.add(keyOf(COLS - 1, y));
        }

        // Paredes internas.
        addHorizontalWall(3, 2, 6);
        addHorizontalWall(3, 9, 10);
        addHorizontalWall(3, 13, 17);

        addHorizontalWall(5, 3, 7);
        addHorizontalWall(5, 12, 16);

        addHorizontalWall(7, 2, 5);
        addHorizontalWall(7, 8, 11);
        addHorizontalWall(7, 14, 17);

        addHorizontalWall(9, 3, 6);
        addHorizontalWall(9, 13, 16);

        addHorizontalWall(11, 2, 7);
        addHorizontalWall(11, 12, 17);

        addVerticalWall(4, 1, 2);
        addVerticalWall(8, 4, 6);
        addVerticalWall(11, 8, 10);
        addVerticalWall(15, 1, 2);

        addVerticalWall(2, 8, 10);
        addVerticalWall(7, 12, 13);
        addVerticalWall(13, 6, 8);
        addVerticalWall(17, 12, 13);

        // Posições iniciais livres.
        [
          [1, 1],
          [18, 1],
          [1, 13],
          [18, 13],
          [9, 7],
          [10, 7]
        ].forEach(([x, y]) => {
          walls.delete(keyOf(x, y));
        });

        // Distribui os pontos pelas células livres.
        for (let y = 1; y < ROWS - 1; y++) {
          for (let x = 1; x < COLS - 1; x++) {
            if (isWall(x, y)) continue;

            const ghostSpawn =
              (x === 18 && y === 1) ||
              (x === 1 && y === 13) ||
              (x === 18 && y === 13);

            if (!ghostSpawn) {
              dots.add(keyOf(x, y));
            }
          }
        }

        // Superpontos.
        [
          [1, 1],
          [18, 1],
          [1, 13],
          [18, 13]
        ].forEach(([x, y]) => {
          if (!isWall(x, y)) {
            dots.delete(keyOf(x, y));
            powerDots.add(keyOf(x, y));
          }
        });
      }

      // =========================================================
      // PERSONAGENS
      // =========================================================
      function createPlayer() {
        const position = centerOf(1, 1);

        return {
          x: position.x,
          y: position.y,
          dir: { x: 0, y: 0 },
          next: { x: 0, y: 0 },
          speed: PLAYER_SPEED
        };
      }

      function createGhost(x, y, color, personality) {
        const position = centerOf(x, y);

        return {
          x: position.x,
          y: position.y,
          startX: position.x,
          startY: position.y,
          dir: { x: 0, y: 0 },
          speed: GHOST_SPEED,
          color,
          personality,
          respawnTimer: 0
        };
      }

      function createGhosts() {
        ghosts = [
          createGhost(18, 1, "#ff4e70", "chase"),
          createGhost(1, 13, "#00e5ff", "ambush"),
          createGhost(18, 13, "#ff9e42", "random")
        ];
      }

      // =========================================================
      // REINICIALIZAÇÃO
      // =========================================================
      function resetGame() {
        score = 0;
        lives = 3;
        level = 1;

        mouth = 0;
        mouthDir = 1;
        invulnerable = 1.5;
        frightenedTimer = 0;
        gameTime = 0;

        paused = false;
        over = false;

        buildMap();

        player = createPlayer();
        createGhosts();

        updateScore();
        updateLives();
        updateLevel();
      }

      // =========================================================
      // CONTROLES DE TECLADO
      // O arcade.js envia os comandos das setas do celular
      // como eventos de teclado para a janela.
      // =========================================================
      function onKey(event) {
        const rawKey = String(event.key || "").toLowerCase();

        const keyDirections = {
          arrowup: DIRECTIONS.ArrowUp,
          arrowdown: DIRECTIONS.ArrowDown,
          arrowleft: DIRECTIONS.ArrowLeft,
          arrowright: DIRECTIONS.ArrowRight,

          w: DIRECTIONS.ArrowUp,
          s: DIRECTIONS.ArrowDown,
          a: DIRECTIONS.ArrowLeft,
          d: DIRECTIONS.ArrowRight
        };

        const direction = keyDirections[rawKey];

        if (!direction) return;

        // Evita a rolagem da página pelas setas.
        event.preventDefault();

        if (over || paused || destroyed || !player) {
          return;
        }

        // Armazena a próxima direção. A curva será realizada
        // assim que o personagem puder alinhar-se ao corredor.
        player.next = { ...direction };
      }

      // =========================================================
      // COLETA DE PONTOS
      // =========================================================
      function collectItems() {
        const tile = tileAt(player.x, player.y);
        const key = keyOf(tile.x, tile.y);

        if (dots.has(key)) {
          dots.delete(key);
          score += 10;

          updateScore();
          safeSound("collect");
        }

        if (powerDots.has(key)) {
          powerDots.delete(key);
          score += 50;
          frightenedTimer = 7;

          updateScore();
          safeSound("power");
        }

        if (dots.size === 0 && powerDots.size === 0) {
          level++;

          updateLevel();
          safeSound("clear");

          buildMap();

          player = createPlayer();
          createGhosts();

          invulnerable = 1.5;
          frightenedTimer = 0;
        }
      }

      // =========================================================
      // MOVIMENTAÇÃO DO PAC-MAN
      // =========================================================
      function movePlayer(dt) {
        const distance = player.speed * dt;
        const steps = Math.max(1, Math.ceil(distance / 2));
        const stepDt = dt / steps;

        for (let step = 0; step < steps; step++) {
          const info = nearTileCenter(player);

          if (info.near) {
            // Alinha precisamente ao centro da célula.
            player.x = info.center.x;
            player.y = info.center.y;

            // Prioriza a direção solicitada pelo usuário.
            if (
              canMoveFromTile(
                info.tile.x,
                info.tile.y,
                player.next
              )
            ) {
              player.dir = { ...player.next };
            }

            // Se não for possível continuar na direção atual,
            // para e aguarda um novo comando.
            if (
              !canMoveFromTile(
                info.tile.x,
                info.tile.y,
                player.dir
              )
            ) {
              player.dir = { x: 0, y: 0 };
            }
          }

          if (!player.dir.x && !player.dir.y) {
            break;
          }

          const nx =
            player.x + player.dir.x * player.speed * stepDt;

          const ny =
            player.y + player.dir.y * player.speed * stepDt;

          if (isWalkable(nx, ny, PLAYER_RADIUS)) {
            player.x = nx;
            player.y = ny;
          } else {
            // Impede que o personagem atravesse uma parede.
            const current = tileAt(player.x, player.y);
            const center = centerOf(current.x, current.y);

            if (player.dir.x !== 0) {
              player.x = center.x;
            }

            if (player.dir.y !== 0) {
              player.y = center.y;
            }

            player.dir = { x: 0, y: 0 };
            break;
          }

          collectItems();

          if (over || destroyed) return;
        }

        // Animação da boca.
        mouth += dt * 11 * mouthDir;

        if (mouth > 1) {
          mouth = 1;
          mouthDir = -1;
        } else if (mouth < 0) {
          mouth = 0;
          mouthDir = 1;
        }
      }

      // =========================================================
      // FANTASMAS
      // =========================================================
      function getGhostChoices(ghost, tile) {
        const reverse = {
          x: -ghost.dir.x,
          y: -ghost.dir.y
        };

        return [
          { x: 0, y: -1 },
          { x: 0, y: 1 },
          { x: -1, y: 0 },
          { x: 1, y: 0 }
        ].filter(direction => {
          if (
            direction.x === reverse.x &&
            direction.y === reverse.y
          ) {
            return false;
          }

          return canMoveFromTile(
            tile.x,
            tile.y,
            direction
          );
        });
      }

      function chooseGhostDirection(ghost, choices) {
        if (choices.length === 0) {
          return {
            x: -ghost.dir.x,
            y: -ghost.dir.y
          };
        }

        if (
          frightenedTimer > 0 ||
          ghost.personality === "random"
        ) {
          return choices[
            Math.floor(Math.random() * choices.length)
          ];
        }

        const target = tileAt(player.x, player.y);

        if (ghost.personality === "ambush") {
          target.x += player.dir.x * 2;
          target.y += player.dir.y * 2;
        }

        let best = choices[0];
        let bestDistance = Infinity;

        for (const direction of choices) {
          const nextX =
            ghost.x / TILE - 0.5 + direction.x;

          const nextY =
            ghost.y / TILE - 0.5 + direction.y;

          const distance =
            Math.abs(target.x - nextX) +
            Math.abs(target.y - nextY);

          if (distance < bestDistance) {
            bestDistance = distance;
            best = direction;
          }
        }

        return best;
      }

      function moveGhosts(dt) {
        for (const ghost of ghosts) {
          if (ghost.respawnTimer > 0) {
            ghost.respawnTimer -= dt;

            if (ghost.respawnTimer <= 0) {
              ghost.x = ghost.startX;
              ghost.y = ghost.startY;
              ghost.dir = { x: 0, y: 0 };
            }

            continue;
          }

          const distance = ghost.speed * dt;
          const steps = Math.max(1, Math.ceil(distance / 2));
          const stepDt = dt / steps;

          for (let step = 0; step < steps; step++) {
            const info = nearTileCenter(ghost, 5);

            if (info.near) {
              ghost.x = info.center.x;
              ghost.y = info.center.y;

              const choices = getGhostChoices(
                ghost,
                info.tile
              );

              ghost.dir = chooseGhostDirection(
                ghost,
                choices
              );
            }

            const nx =
              ghost.x + ghost.dir.x * ghost.speed * stepDt;

            const ny =
              ghost.y + ghost.dir.y * ghost.speed * stepDt;

            if (isWalkable(nx, ny, GHOST_RADIUS)) {
              ghost.x = nx;
              ghost.y = ny;
            } else {
              const tile = tileAt(ghost.x, ghost.y);
              const center = centerOf(tile.x, tile.y);

              ghost.x = center.x;
              ghost.y = center.y;
              ghost.dir = { x: 0, y: 0 };
            }
          }
        }
      }

      // =========================================================
      // COLISÕES
      // =========================================================
      function checkCollisions() {
        if (invulnerable > 0 || over) return;

        for (const ghost of ghosts) {
          if (ghost.respawnTimer > 0) continue;

          const dx = player.x - ghost.x;
          const dy = player.y - ghost.y;
          const distance = Math.hypot(dx, dy);

          if (
            distance >= PLAYER_RADIUS + GHOST_RADIUS
          ) {
            continue;
          }

          if (frightenedTimer > 0) {
            score += 200;

            updateScore();
            safeSound("collect");

            ghost.x = ghost.startX;
            ghost.y = ghost.startY;
            ghost.dir = { x: 0, y: 0 };
            ghost.respawnTimer = 1.2;
          } else {
            lives--;

            updateLives();
            safeSound("hit");

            if (lives <= 0) {
              finishGame(
                "Fim de jogo! Você perdeu todas as vidas."
              );
              return;
            }

            player = createPlayer();
            invulnerable = 2;

            return;
          }
        }
      }

      // =========================================================
      // DESENHO DO LABIRINTO
      // =========================================================
      function drawMap() {
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        for (const wall of walls) {
          const [x, y] = wall.split(",").map(Number);
          const px = x * TILE;
          const py = y * TILE;

          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(
            px + 2,
            py + 2,
            TILE - 4,
            TILE - 4
          );

          ctx.strokeStyle = COLORS.wallGlow;
          ctx.lineWidth = 1.2;

          ctx.strokeRect(
            px + 4,
            py + 4,
            TILE - 8,
            TILE - 8
          );
        }

        ctx.fillStyle = COLORS.dot;

        for (const dot of dots) {
          const [x, y] = dot.split(",").map(Number);
          const center = centerOf(x, y);

          ctx.beginPath();
          ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        for (const dot of powerDots) {
          const [x, y] = dot.split(",").map(Number);
          const center = centerOf(x, y);

          ctx.beginPath();
          ctx.fillStyle = COLORS.power;

          ctx.arc(
            center.x,
            center.y,
            7 + Math.sin(gameTime * 5) * 1.5,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      }

      // =========================================================
      // DESENHO DO PAC-MAN
      // =========================================================
      function drawPlayer() {
        if (
          invulnerable > 0 &&
          Math.floor(gameTime * 12) % 2 === 0
        ) {
          return;
        }

        let angle = 0;

        if (player.dir.x === -1) angle = Math.PI;
        if (player.dir.y === -1) angle = -Math.PI / 2;
        if (player.dir.y === 1) angle = Math.PI / 2;

        const opening = mouth * 0.22;

        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);

        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.moveTo(0, 0);

        ctx.arc(
          0,
          0,
          PLAYER_RADIUS,
          opening * Math.PI,
          (2 - opening) * Math.PI
        );

        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // =========================================================
      // DESENHO DOS FANTASMAS
      // =========================================================
      function drawGhost(ghost) {
        if (ghost.respawnTimer > 0) return;

        const x = ghost.x;
        const y = ghost.y;
        const r = GHOST_RADIUS;

        ctx.save();

        ctx.fillStyle =
          frightenedTimer > 0 ? "#3158db" : ghost.color;

        ctx.beginPath();
        ctx.arc(x, y - 2, r, Math.PI, 0);
        ctx.lineTo(x + r, y + r);

        ctx.lineTo(x + r / 2, y + r - 4);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r / 2, y + r - 4);
        ctx.lineTo(x - r, y + r);

        ctx.closePath();
        ctx.fill();

        if (frightenedTimer <= 0) {
          ctx.fillStyle = "#ffffff";

          ctx.beginPath();

          ctx.ellipse(
            x - 4, y - 2, 3.5, 4.5,
            0, 0, Math.PI * 2
          );

          ctx.ellipse(
            x + 4, y - 2, 3.5, 4.5,
            0, 0, Math.PI * 2
          );

          ctx.fill();

          ctx.fillStyle = "#15152b";

          ctx.beginPath();
          ctx.arc(x - 3, y - 1, 1.8, 0, Math.PI * 2);
          ctx.arc(x + 5, y - 1, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.moveTo(x - 5, y + 2);
          ctx.lineTo(x - 2, y + 4);
          ctx.lineTo(x + 1, y + 2);
          ctx.lineTo(x + 4, y + 4);
          ctx.stroke();
        }

        ctx.restore();
      }

      // =========================================================
      // INTERFACE DO JOGO
      // =========================================================
      function drawHUD() {
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 13px monospace";
        ctx.textBaseline = "top";

        ctx.fillText("PAC-MAN", 10, 8);
        ctx.fillText("PONTOS: " + score, 120, 8);
        ctx.fillText("FASE: " + level, 280, 8);
        ctx.fillText("VIDAS: " + lives, 400, 8);

        if (paused && !over) {
          drawOverlay(
            "JOGO PAUSADO",
            "Pressione continuar para jogar"
          );
        }

        if (over) {
          drawOverlay(
            "FIM DE JOGO",
            "Pontuação: " + score
          );
        }
      }

      function drawOverlay(title, subtitle) {
        ctx.fillStyle = "rgba(3, 5, 20, 0.78)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 32px monospace";

        ctx.fillText(
          title,
          WIDTH / 2,
          HEIGHT / 2 - 18
        );

        ctx.fillStyle = "#ffffff";
        ctx.font = "15px monospace";

        ctx.fillText(
          subtitle,
          WIDTH / 2,
          HEIGHT / 2 + 20
        );

        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }

      function draw() {
        drawMap();

        if (player) {
          drawPlayer();
        }

        ghosts.forEach(drawGhost);
        drawHUD();
      }

      // =========================================================
      // LOOP PRINCIPAL
      // =========================================================
      function loop(time) {
        if (destroyed) return;

        const dt = Math.min(
          (time - (last || time)) / 1000,
          0.02
        );

        last = time;

        if (!paused && !over) {
          gameTime += dt;

          invulnerable = Math.max(
            0,
            invulnerable - dt
          );

          frightenedTimer = Math.max(
            0,
            frightenedTimer - dt
          );

          movePlayer(dt);

          if (!over && !destroyed) {
            moveGhosts(dt);
            checkCollisions();
          }
        }

        draw();

        if (!destroyed) {
          raf = requestAnimationFrame(loop);
        }
      }

      // =========================================================
      // INICIALIZAÇÃO
      // =========================================================
      resetGame();

      // Recebe os comandos enviados pelo arcade.js.
      window.addEventListener("keydown", onKey, true);

      raf = requestAnimationFrame(loop);

      // =========================================================
      // CONTROLES DO SISTEMA ARCADE
      // =========================================================
      return {
        pause() {
          paused = true;

          if (player) {
            player.dir = { x: 0, y: 0 };
          }
        },

        resume() {
          if (over || destroyed) return;

          paused = false;
          last = 0;
        },

        destroy() {
          if (destroyed) return;

          destroyed = true;

          cancelAnimationFrame(raf);

          window.removeEventListener(
            "keydown",
            onKey,
            true
          );
        }
      };
    }
  };
})();
