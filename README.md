# Sorteio de Letras

PWA simples para sortear letras do alfabeto com um toque. Feito em HTML, CSS e JavaScript puros, sem build e sem dependências de runtime além do [Lucide](https://lucide.dev) (ícones, via CDN).

Demo: https://heytorc.github.io/pwa-sortear-letras/

## Funcionalidades

- Sorteio de letras (A–Z) com animação estilo caça-níquel e sons gerados pela Web Audio API.
- Cor de fundo aleatória a cada sorteio.
- Histórico das letras sorteadas, exibido em chips coloridos.
- Configurações em bottom sheet:
  - permitir ou não letras repetidas;
  - contagem regressiva opcional (1 a 300 segundos) com campainha ao final;
  - botão para ligar/desligar o som.
- Overlay ao abrir as configurações, que impede sortear enquanto o painel está aberto.
- Diálogo de confirmação antes de reiniciar a sessão.
- Estado persistido em `localStorage`.
- Instalável como app (manifest, ícones PNG, `apple-touch-icon`) e funciona offline via service worker.
- Metadados Open Graph e Twitter Card para pré-visualização ao compartilhar o link.
- Suporte a safe area do iPhone (`viewport-fit=cover`).

## Estrutura

```
index.html      Estrutura da página e metadados
style.css       Estilos
app.js          Lógica do sorteio, contagem, sons, estado e interface
sw.js           Service worker (network-first, com fallback em cache)
manifest.json   Manifesto do PWA
deploy.sh       Publicação no GitHub Pages (branch gh-pages)
icons/          Ícones do app e imagem de compartilhamento
```

## Executar localmente

Qualquer servidor estático serve. Exemplo com Python:

```sh
python3 -m http.server 8000
```

Acesse http://localhost:8000.

> O service worker exige `localhost` ou HTTPS. Ao alterar arquivos, se o navegador mostrar uma versão antiga, desregistre o service worker nas ferramentas de desenvolvedor ou incremente `CACHE` em `sw.js`.

## Publicar

O script `deploy.sh` copia os arquivos para a branch `gh-pages` e faz o push:

```sh
sh deploy.sh
```

Requisitos: o repositório precisa ter um remoto `origin` e o GitHub Pages deve estar configurado para servir a branch `gh-pages`.

## Instalar no iPhone

1. Abra o link no Safari.
2. Toque em Compartilhar.
3. Escolha **Adicionar à Tela de Início**.

## Ícones

Os PNGs em `icons/` (180, 192, 512, maskable 512 e `social-share.png`) são referenciados em `manifest.json`, `index.html` e `sw.js`. O `icon.svg` é o arquivo-fonte do ícone.

## Tecnologias

- HTML, CSS e JavaScript (ES2020+)
- Web Audio API
- Service Worker e Web App Manifest
- Lucide Icons
