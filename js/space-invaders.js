
(() => {
  "use strict";

  window.ArcadeGames = window.ArcadeGames || {};

  window.ArcadeGames.invaders = {
    init(canvas, api) {
      const ctx = canvas.getContext("2d");

      let player, bullets, enemies, particles;
      let score = 0;
      let wave = 1;
      let keys = new Set();
      let enemyDirection = 1;
      let enemySpeed = 24;
      let shootCooldown = 0;
      let last = 0;
      let raf = 0;
      let paused = false;
      let over = false;
      let stars = [];

      function reset() {
        player = {
          x: canvas.width / 2,
          y: canvas.height - 55,
          w: 34,
          h: 24,
          speed: 290
        };
        bullets = [];
        particles = [];
        enemyDirection = 1;
        enemySpeed = 24;
        shootCooldown = 0;
        createWave();
        stars = Array.from({ length: 65 }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.7 + 0.2
        }));
      }

      function createWave() {
        enemies = [];
        const rows = Math.min(3 + Math.floor((wave - 1) / 2), 5);
        const cols = 8;
        const spacingX = 57;
        const spacingY = 42;
        const totalWidth = (cols - 1) * spacingX;
        const startX = (canvas.width - totalWidth) / 2;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            enemies.push({
              x: startX + col * spacingX,
              y: 80 + row * spacingY,
              w: 27,
              h: 22,
              color: ["#a3ff5e", "#00e5ff", "#ff4edb"][row % 3],
              alive: true
            });
          }
        }
        enemySpeed = 24 + wave * 5;
      }

      function onKeyDown(event) {
        const key = event.key.toLowerCase();
        if (["arrowleft", "arrowright", " ", "a", "d"].includes(key)) {
          event.preventDefault();
        }
        keys.add(key);
      }

      function onKeyUp(event) {
        keys.delete(event.key.toLowerCase());
      }

      function shoot() {
        if (shootCooldown > 0 || over) return;
        bullets.push({
          x: player.x,
          y: player.y - 12,
          vy: -430,
          w: 4,
          h: 12
        });
        shootCooldown = 0.24;
        api.sound("shoot");
      }

      function createExplosion(x, y, color) {
        for (let i = 0; i < 7; i++) {
          particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150,
            life: 0.35 + Math.random() * 0.3,
            color
          });
        }
      }

      function update(dt) {
        if (keys.has("arrowleft") || keys.has("a")) {
          player.x -= player.speed * dt;
        }
        if (keys.has("arrowright") || keys.has("d")) {
          player.x += player.speed * dt;
        }
        if (keys.has(" ")) shoot();

        player.x = Math.max(player.w / 2 + 4,
          Math.min(canvas.width - player.w / 2 - 4, player.x));

        shootCooldown = Math.max(0, shootCooldown - dt);

        bullets.forEach(bullet => {
          bullet.y += bullet.vy * dt;
        });
        bullets = bullets.filter(bullet => bullet.y > -20);

        let reachedEdge = false;
        enemies.forEach(enemy => {
          if (!enemy.alive) return;
          enemy.x += enemyDirection * enemySpeed * dt;
          if (enemy.x > canvas.width - 25 || enemy.x < 25) {
            reachedEdge = true;
          }
        });

        if (reachedEdge) {
          enemyDirection *= -1;
          enemies.forEach(enemy => {
            enemy.y += 13;
          });
        }

        for (const bullet of bullets) {
          for (const enemy of enemies) {
            if (!enemy.alive) continue;

            if (
              bullet.x > enemy.x - enemy.w / 2 &&
              bullet.x < enemy.x + enemy.w / 2 &&
              bullet.y > enemy.y - enemy.h / 2 &&
              bullet.y < enemy.y + enemy.h / 2
            ) {
              enemy.alive = false;
              bullet.y = -100;
              score += 10;
              api.setScore(score);
              createExplosion(enemy.x, enemy.y, enemy.color);
              api.sound("collect");
              break;
            }
          }
        }

        particles.forEach(particle => {
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.life -= dt;
        });
        particles = particles.filter(particle => particle.life > 0);

        if (enemies.some(enemy => enemy.alive && enemy.y > player.y - 28)) {
          over = true;
          api.setLives(0);
          api.end("Os invasores chegaram à sua linha de defesa.");
          return;
        }

        if (enemies.every(enemy => !enemy.alive)) {
          wave++;
          api.setLevel(wave);
          api.sound("clear");
          createWave();
        }
      }

      function drawShip(x, y) {
        ctx.fillStyle = "#ff4edb";
        ctx.beginPath();
        ctx.moveTo(x, y - 18);
        ctx.lineTo(x + 19, y + 12);
        ctx.lineTo(x + 7, y + 8);
        ctx.lineTo(x, y + 14);
        ctx.lineTo(x - 7, y + 8);
        ctx.lineTo(x - 19, y + 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#00e5ff";
        ctx.fillRect(x - 3, y - 2, 6, 12);
      }

      function drawEnemy(enemy) {
        const x = enemy.x;
        const y = enemy.y;

        ctx.fillStyle = enemy.color;
        ctx.fillRect(x - 12, y - 8, 24, 14);
        ctx.fillRect(x - 8, y - 12, 16, 5);
        ctx.fillRect(x - 15, y - 3, 4, 7);
        ctx.fillRect(x + 11, y - 3, 4, 7);
        ctx.fillRect(x - 9, y + 6, 5, 5);
        ctx.fillRect(x + 4, y + 6, 5, 5);

        ctx.fillStyle = "#101020";
        ctx.fillRect(x - 7, y - 4, 4, 4);
        ctx.fillRect(x + 3, y - 4, 4, 4);
      }

      function draw() {
        ctx.fillStyle = "#060713";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        stars.forEach(star => {
          ctx.globalAlpha = star.alpha;
          ctx.fillStyle = "#d9ddff";
          ctx.fillRect(star.x, star.y, star.size, star.size);
        });
        ctx.globalAlpha = 1;

        ctx.strokeStyle = "#ff4edb70";
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(0, player.y + 28);
        ctx.lineTo(canvas.width, player.y + 28);
        ctx.stroke();
        ctx.setLineDash([]);

        enemies.forEach(enemy => {
          if (enemy.alive) drawEnemy(enemy);
        });

        bullets.forEach(bullet => {
          ctx.fillStyle = "#00e5ff";
          ctx.shadowColor = "#00e5ff";
          ctx.shadowBlur = 10;
          ctx.fillRect(bullet.x - bullet.w / 2, bullet.y, bullet.w, bullet.h);
          ctx.shadowBlur = 0;
        });

        drawShip(player.x, player.y);

        particles.forEach(particle => {
          ctx.globalAlpha = Math.max(0, particle.life * 2);
          ctx.fillStyle = particle.color;
          ctx.fillRect(particle.x, particle.y, 4, 4);
        });
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#00e5ff";
        ctx.font = "13px monospace";
        ctx.fillText("WAVE: " + wave, 15, 24);
        ctx.fillStyle = "#a5a5c7";
        ctx.fillText("SCORE: " + score, 15, 44);
      }

      function loop(time) {
        if (!paused && !over) {
          const dt = Math.min((time - (last || time)) / 1000, 0.04);
          last = time;
          update(dt);
        } else {
          last = time;
        }

        draw();
        raf = requestAnimationFrame(loop);
      }

      reset();
      api.setScore(0);
      api.setLevel(1);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      raf = requestAnimationFrame(loop);

      return {
        pause() {
          paused = true;
          keys.clear();
        },
        resume() {
          paused = false;
          last = 0;
        },
        destroy() {
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keyup", onKeyUp);
          keys.clear();
        }
      };
    }
  };
})();