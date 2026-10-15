
(() => {
  "use strict";

  window.ArcadeGames = window.ArcadeGames || {};

  window.ArcadeGames.tetris = {
    init(canvas, api) {
      const ctx = canvas.getContext("2d");
      const COLS = 10;
      const ROWS = 20;
      const CELL = 23;
      const BOARD_W = COLS * CELL;
      const BOARD_H = ROWS * CELL;
      const offsetX = Math.floor((canvas.width - BOARD_W) / 2);
      const offsetY = Math.floor((canvas.height - BOARD_H) / 2);

      const shapes = [
        { matrix: [[1, 1, 1, 1]], color: "#00e5ff" },
        { matrix: [[1, 1], [1, 1]], color: "#ffe45c" },
        { matrix: [[0, 1, 0], [1, 1, 1]], color: "#b58aff" },
        { matrix: [[1, 0, 0], [1, 1, 1]], color: "#ff9e57" },
        { matrix: [[0, 0, 1], [1, 1, 1]], color: "#548bff" },
        { matrix: [[1, 1, 0], [0, 1, 1]], color: "#a3ff5e" },
        { matrix: [[0, 1, 1], [1, 1, 0]], color: "#ff4edb" }
      ];

      let board, piece, score, lines, level;
      let dropTimer = 0;
      let dropInterval = 0.7;
      let last = 0;
      let raf = 0;
      let paused = false;
      let over = false;

      function randomPiece() {
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const matrix = shape.matrix.map(row => [...row]);
        return {
          matrix,
          color: shape.color,
          x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2),
          y: 0
        };
      }

      function collides(testPiece, dx = 0, dy = 0, matrix = testPiece.matrix) {
        for (let y = 0; y < matrix.length; y++) {
          for (let x = 0; x < matrix[y].length; x++) {
            if (!matrix[y][x]) continue;
            const bx = testPiece.x + x + dx;
            const by = testPiece.y + y + dy;

            if (bx < 0 || bx >= COLS || by >= ROWS) return true;
            if (by >= 0 && board[by][bx]) return true;
          }
        }
        return false;
      }

      function spawn() {
        piece = randomPiece();
        if (collides(piece)) {
          over = true;
          api.end("As peças chegaram ao topo.");
        }
      }

      function merge() {
        piece.matrix.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value && piece.y + y >= 0) {
              board[piece.y + y][piece.x + x] = piece.color;
            }
          });
        });
      }

      function clearLines() {
        let cleared = 0;

        for (let y = ROWS - 1; y >= 0; y--) {
          if (board[y].every(Boolean)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(null));
            cleared++;
            y++;
          }
        }

        if (cleared) {
          const rewards = [0, 100, 300, 500, 800];
          score += (rewards[cleared] || cleared * 200) * level;
          lines += cleared;
          level = Math.floor(lines / 10) + 1;
          dropInterval = Math.max(0.12, 0.7 - (level - 1) * 0.055);
          api.setScore(score);
          api.setLevel(level);
          api.sound("clear");
        }
      }

      function lockPiece() {
        merge();
        clearLines();
        spawn();
      }

      function move(dx, dy) {
        if (!collides(piece, dx, dy)) {
          piece.x += dx;
          piece.y += dy;
          return true;
        }
        return false;
      }

      function rotateMatrix(matrix) {
        return matrix[0].map((_, i) =>
          matrix.map(row => row[i]).reverse()
        );
      }

      function rotate() {
        const rotated = rotateMatrix(piece.matrix);
        for (const shift of [0, -1, 1, -2, 2]) {
          if (!collides(piece, shift, 0, rotated)) {
            piece.x += shift;
            piece.matrix = rotated;
            api.sound("move");
            return;
          }
        }
      }

      function hardDrop() {
        let distance = 0;
        while (move(0, 1)) distance++;
        score += distance * 2;
        api.setScore(score);
        lockPiece();
        api.sound("hit");
      }

      function onKey(event) {
        const key = event.key.toLowerCase();
        if (["arrowleft", "arrowright", "arrowdown", "arrowup", " "].includes(key)) {
          event.preventDefault();
        }
        if (paused || over) return;

        if (key === "arrowleft" || key === "a") {
          if (move(-1, 0)) api.sound("move");
        } else if (key === "arrowright" || key === "d") {
          if (move(1, 0)) api.sound("move");
        } else if (key === "arrowdown" || key === "s") {
          if (move(0, 1)) {
            score += 1;
            api.setScore(score);
          } else {
            lockPiece();
          }
        } else if (key === "arrowup" || key === "w") {
          rotate();
        } else if (key === " ") {
          hardDrop();
        }
      }

      function drawCell(x, y, color) {
        const px = offsetX + x * CELL;
        const py = offsetY + y * CELL;
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "#ffffff25";
        ctx.fillRect(px + 2, py + 2, CELL - 4, 3);
        ctx.fillStyle = "#00000025";
        ctx.fillRect(px + 2, py + CELL - 5, CELL - 4, 3);
      }

      function draw() {
        ctx.fillStyle = "#070717";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#11152c";
        ctx.fillRect(offsetX, offsetY, BOARD_W, BOARD_H);

        ctx.strokeStyle = "#252847";
        ctx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath();
          ctx.moveTo(offsetX + x * CELL, offsetY);
          ctx.lineTo(offsetX + x * CELL, offsetY + BOARD_H);
          ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath();
          ctx.moveTo(offsetX, offsetY + y * CELL);
          ctx.lineTo(offsetX + BOARD_W, offsetY + y * CELL);
          ctx.stroke();
        }

        board.forEach((row, y) =>
          row.forEach((color, x) => {
            if (color) drawCell(x, y, color);
          })
        );

        if (piece) {
          piece.matrix.forEach((row, y) =>
            row.forEach((value, x) => {
              if (value && piece.y + y >= 0) {
                drawCell(piece.x + x, piece.y + y, piece.color);
              }
            })
          );
        }

        ctx.fillStyle = "#00e5ff";
        ctx.font = "12px monospace";
        ctx.fillText("LINHAS: " + lines, 18, 28);
        ctx.fillText("NÍVEL: " + level, 18, 47);
        ctx.fillStyle = "#8c8cae";
        ctx.fillText("ESPAÇO = DROP", 18, canvas.height - 20);
      }

      function loop(time) {
        if (!paused && !over) {
          const dt = Math.min((time - (last || time)) / 1000, 0.05);
          last = time;
          dropTimer += dt;

          if (dropTimer >= dropInterval) {
            dropTimer = 0;
            if (!move(0, 1)) lockPiece();
          }
        } else {
          last = time;
        }

        draw();
        raf = requestAnimationFrame(loop);
      }

      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      score = 0;
      lines = 0;
      level = 1;
      dropTimer = 0;
      spawn();

      api.setScore(0);
      api.setLevel(1);
      window.addEventListener("keydown", onKey);
      raf = requestAnimationFrame(loop);

      return {
        pause() { paused = true; },
        resume() { paused = false; last = 0; },
        destroy() {
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", onKey);
        }
      };
    }
  };
})();