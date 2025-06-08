const frases = [
  "Olá! me chamo Jonas Isaias, sou software engineer.",
  "Gosto de resolver problemas com código.",
  "Crio soluções escaláveis e performáticas."
];

let fraseIndex = 0;
let charIndex = 0;
let apagando = false;

const textoElement = document.getElementById("texto-animado");

function digitar() {
  if (!textoElement) return; // ← Proteção para outras páginas

  const fraseAtual = frases[fraseIndex];

  if (!apagando) {
    textoElement.textContent = fraseAtual.slice(0, charIndex + 1);
    charIndex++;

    if (charIndex === fraseAtual.length) {
      setTimeout(() => apagando = true, 2000);
    }
  } else {
    textoElement.textContent = fraseAtual.slice(0, charIndex - 1);
    charIndex--;

    if (charIndex === 0) {
      apagando = false;
      fraseIndex = (fraseIndex + 1) % frases.length;
    }
  }

  const delay = apagando ? 40 : 80;
  setTimeout(digitar, delay);
}

if (textoElement) {
  digitar();

  // Parallax (também com proteção)
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 10;
    const y = (e.clientY / window.innerHeight - 0.5) * 10;
    textoElement.style.transform = `translate(${x}px, ${y}px)`;
  });
} 
  
  // Botão "Saber mais"
  document.getElementById("btn-saber-mais").addEventListener("click", () => {
    document.getElementById("sobre").scrollIntoView({ behavior: "smooth" });
  });
