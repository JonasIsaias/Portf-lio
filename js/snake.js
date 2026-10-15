
(() => {
  "use strict";

  window.ArcadeGames = window.ArcadeGames || {};

  window.ArcadeGames.snake = {
    init(canvas, api) {
      const ctx = canvas.getContext("2d");
      const CELL = 24;
      const COLS = Math.floor(canvas.width / CELL);
      const ROWS = Math.floor(canvas.height / CELL);

      let snake, direction, nextDirection, food;
      let score = 0;
      let speed = 140;
      let timer = 0;
      let last = 0;
      let raf = 0;
      let paused = false;
      let over = false;

      function randomFood() {
        let candidate;
        do {
          candidate = {
            x: Math.floor(Math.random() * COLS),
            y: Math.floor(Math.random() * ROWS)
          };
        } while (snake.some(part =>
          part.x === candidate.x && part.y === candidate.y
        ));
        return candidate;
      }

      function reset() {
        snake = [
          { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
          { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
          { x: Math.floor(COLS / 2) - 2, y: Math.floor(ROWS / 2) }
        ];
        direction = { x: 1, y: 0 };
        nextDirection = { x: 1, y: 0 };
        food = randomFood();
      }

      function onKey(event) {
        const key = event.key.toLowerCase();
        const dirs = {
          arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
          arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
          arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
          arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 }
        };

        if (!dirs[key]) return;
        event.preventDefault();

        const next = dirs[key];
        if (next.x === -direction.x && next.y === -direction.y) return;
        nextDirection = next;
      }

      function step() {
        direction = nextDirection;
        const head = {
          x: snake[0].x + direction.x,
          y: snake[0].y + direction.y
        };

        const hitWall =
          head.x < 0 || head.x >= COLS ||
          head.y < 0 || head.y >= ROWS;

        const eating = head.x === food.x && head.y === food.y;
        const body = eating ? snake : snake.slice(0, -1);
        const hitSelf = body.some(part =>
          part.x === head.x && part.y === head.y
        );

        if (hitWall || hitSelf) {
          over = true;
          api.setLives(0);
          api.end("A cobrinha colidiu. Tente uma nova partida!");
          return;
        }

        snake.unshift(head);

        if (eating) {
          score += 10;
          speed = Math.max(55, speed - 4);
          food = randomFood();
          api.setScore(score);
          api.setLevel(Math.floor(score / 100) + 1);
          api.sound("collect");
        } else {
          snake.pop();
        }
      }

      function draw() {
        ctx.fillStyle = "#080816";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "#20203c";
        ctx.lineWidth = 1;

        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath();
          ctx.moveTo(x * CELL, 0);
          ctx.lineTo(x * CELL, ROWS * CELL);
          ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath();
          ctx.moveTo(0, y * CELL);
          ctx.lineTo(COLS * CELL, y * CELL);
          ctx.stroke();
        }

        // Comida com efeito de brilho.
        ctx.save();
        ctx.shadowColor = "#ff4edb";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff4edb";
        ctx.fillRect(food.x * CELL + 5, food.y * CELL + 5, CELL - 10, CELL - 10);
        ctx.restore();

        snake.forEach((part, index) => {
          const x = part.x * CELL;
          const y = part.y * CELL;

          ctx.fillStyle = index === 0 ? "#d2ff9b" : "#69e84d";
          ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);

          if (index === 0) {
            ctx.fillStyle = "#102a18";
            ctx.fillRect(x + 6, y + 6, 3, 3);
            ctx.fillRect(x + CELL - 9, y + 6, 3, 3);
          }
        });

        ctx.fillStyle = "#a3ff5e";
        ctx.font = "13px monospace";
        ctx.fillText("LENGTH: " + snake.length, 12, 20);
        ctx.fillStyle = "#a5a5c7";
        ctx.fillText("SCORE: " + score, 12, canvas.height - 14);
      }

      function loop(time) {
        if (!paused && !over) {
          const dt = Math.min((time - (last || time)) / 1000, 0.05);
          last = time;
          timer += dt * 1000;

          if (timer >= speed) {
            timer = 0;
            step();
          }
        } else {
          last = time;
        }

        draw();
        raf = requestAnimationFrame(loop);
      }

      reset();
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