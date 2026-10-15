"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const soundToggle = document.getElementById("soundToggle");
  const soundActions = document.querySelectorAll(".sound-action");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /*
   * Áudio sintetizado via Web Audio API.
   * Nenhum arquivo de áudio externo é necessário.
   * O som só é ativado após uma interação explícita do visitante.
   */

  let audioContext = null;
  let soundEnabled = false;

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return null;

      audioContext = new AudioContextClass();
    }

    return audioContext;
  }

  function playTone(frequency, duration, type = "square", volume = 0.025) {
    if (!soundEnabled) return;

    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      context.currentTime + 0.008
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration + 0.015);
  }

  function playClick() {
    playTone(620, 0.045, "square", 0.018);
  }

  function playConfirm() {
    playTone(520, 0.07, "square", 0.02);

    window.setTimeout(() => {
      playTone(780, 0.09, "square", 0.018);
    }, 65);
  }

  function updateSoundButton() {
    if (!soundToggle) return;

    soundToggle.setAttribute("aria-pressed", String(soundEnabled));

    const icon = soundToggle.querySelector("i");
    const label = soundToggle.querySelector("span");

    if (icon) {
      icon.className = soundEnabled
        ? "fa-solid fa-volume-high"
        : "fa-solid fa-volume-xmark";
    }

    if (label) {
      label.textContent = soundEnabled ? "SOM ON" : "SOM OFF";
    }

    soundToggle.setAttribute(
      "aria-label",
      soundEnabled ? "Desativar efeitos sonoros" : "Ativar efeitos sonoros"
    );
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", async () => {
      soundEnabled = !soundEnabled;

      if (soundEnabled) {
        const context = getAudioContext();

        if (context && context.state === "suspended") {
          try {
            await context.resume();
          } catch {
            soundEnabled = false;
            updateSoundButton();
            return;
          }
        }

        updateSoundButton();
        playConfirm();
      } else {
        updateSoundButton();
      }
    });
  }

  soundActions.forEach((element) => {
    element.addEventListener("click", () => {
      if (element instanceof HTMLButtonElement && element.disabled) return;

      playClick();
    });
  });

  // Efeitos discretos de hover no desktop.
  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  if (finePointer && !reducedMotion) {
    const hoverTargets = document.querySelectorAll(
      ".project-card, .mission-card, .skill-row, .contact-method"
    );

    hoverTargets.forEach((element) => {
      element.addEventListener("mouseenter", () => {
        element.classList.add("is-hovered");
      });

      element.addEventListener("mouseleave", () => {
        element.classList.remove("is-hovered");
      });
    });
  }

  // Interação de terminal: feedback visual ao focar campos.
  document.querySelectorAll(".form-field input, .form-field select, .form-field textarea")
    .forEach((field) => {
      field.addEventListener("focus", () => {
        field.closest(".form-field")?.classList.add("field-active");
      });

      field.addEventListener("blur", () => {
        field.closest(".form-field")?.classList.remove("field-active");
      });
    });

  updateSoundButton();
});