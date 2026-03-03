# Versao de Ensino em React (Vite)

Esta pasta e uma ponte entre:

1. `hmtl-version` (HTML/CSS/JS puro)
2. `src/app` (Next.js)

Ela introduz os fundamentos de React com uma toolchain moderna (Vite).

## O que os alunos podem aprender aqui

- Componentes (`App`, `LeaderboardTable`, `FilterControls`, `AddPlayerForm`)
- Props e estado (`useState`)
- Dados derivados da UI (`useMemo`)
- Inputs controlados
- Tratamento de eventos (`onChange`, `onSubmit`, `onClick`)
- Renderizacao condicional (estado vazio)

## Estrutura de arquivos

- `index.html`: ponto de entrada HTML do Vite
- `src/main.jsx`: inicializacao do React
- `src/App.jsx`: componentes e logica principal
- `src/styles.css`: estilos em CSS puro

## Como instalar e rodar

Na raiz do repositorio:

```bash
cd react-version
npm install
npm run dev
```

Abra a URL mostrada pelo Vite (geralmente `http://localhost:5173`).

## Build de producao e preview

```bash
npm run build
npm run preview
```
