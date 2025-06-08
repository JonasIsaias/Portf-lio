const projetosContainer = document.getElementById("projetos-container");

async function carregarProjetos() {
  if (!projetosContainer) {
    console.warn("Elemento #projetos-container não encontrado.");
    return;
  }

  try {
    const resposta = await fetch("https://api.github.com/users/JonasIsaias/repos");

    if (!resposta.ok) {
      throw new Error(`Erro ${resposta.status}: ${resposta.statusText}`);
    }

    const repositorios = await resposta.json();
    console.log("Repositórios carregados:", repositorios); // ← Adicionado log

    const projetosFiltrados = repositorios
      .filter(repo => !repo.fork && repo.description)
      .slice(0, 6);

    if (projetosFiltrados.length === 0) {
      projetosContainer.innerHTML = "<p>Nenhum projeto com descrição disponível.</p>";
      return;
    }

    projetosContainer.innerHTML = projetosFiltrados.map(repo => `
      <div class="projeto">
        <h3>${repo.name}</h3>
        <p>${repo.description}</p>
        <a href="${repo.html_url}" target="_blank">Ver projeto</a>
      </div>
    `).join('');
  } catch (erro) {
    console.error("Erro ao buscar projetos do GitHub:", erro);
    projetosContainer.innerHTML = `<p>Erro ao carregar projetos.</p>`;
  }
}

carregarProjetos();