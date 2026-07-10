# SMEL-Plataforma de Eventos — Frontend (Next.js 14 Web App + PWA)

Este é a interface de usuário do **SMEL-Plataforma de Eventos**, construída com **Next.js 14**, **TypeScript**, **Tailwind CSS**, componentes **shadcn/ui** e habilitada como um **PWA (Progressive Web App)** para funcionamento offline de portaria.

---

## 🛠️ Tecnologias e Funcionalidades

* **Framework**: Next.js 14 (App Router)
* **PWA**: Configurado com `@ducanh2912/next-pwa` para service workers e manifest.
* **Offline Client**: Desenvolvido com **Dexie.js** (IndexedDB) para armazenamento local e validação offline de ingressos e check-ins.
* **Comunicações**:
  * Clientes Axios com interceptadores globais de autenticação silenciosa (silent refresh JWT).
  * Socket.io-client para ouvir transmissões WebSocket em tempo real.
* **Design System**: Tailwind CSS, lucide-react e shadcn/ui.

---

## 📂 Organização de Diretórios

```text
apps/frontend/
├── public/              ← Manifesto, ícones do PWA e assets estáticos
├── src/
│   ├── app/             ← Roteamento e páginas da aplicação (App Router)
│   │   ├── (auth)/      ← Fluxo de login, registro, recuperação e verificação de e-mail
│   │   ├── admin/       ← Painel administrativo (detalhes, e-mails, logs de auditoria)
│   │   ├── checkin/     ← Scanner de portaria móvel com câmera
│   │   ├── offline/     ← Rota de fallback exibida quando a conexão é perdida
│   │   └── page.tsx     ← Landing page pública
│   ├── components/      ← Componentes React reutilizáveis (gráficos, tabelas, forms, etc.)
│   ├── hooks/           ← Hooks customizados (permissões, WebSockets, etc.)
│   ├── lib/             ← Utilitários comuns (Axios, DexieDB, Socket)
│   └── worker/          ← Registrador do Service Worker
├── next.config.mjs      ← Arquivo de configuração habilitando o PWA
└── package.json
```

---

## 🚀 Comandos de Desenvolvimento

```bash
# Instalar dependências (executar no root ou filter)
pnpm install

# Iniciar servidor local
pnpm --filter frontend run dev

# Compilar para produção (Next Standalone)
pnpm --filter frontend run build
```
