# SMEL - Plataforma de Eventos
## Manual e Perguntas Frequentes do Sistema

Este documento serve como referência rápida para consulta sobre as regras de negócio, permissões e funcionamento geral da **SMEL-Plataforma de Eventos**.

---

## 1. Controle de Cargos e Permissões (RBAC)

A plataforma utiliza um controle de acesso baseado em funções (RBAC - Role-Based Access Control) que divide os usuários da equipe organizadora em cinco níveis de permissão dentro de cada organização:

| Cargo | Descrição Geral | Principais Ações Permitidas | Ações Restritas |
| :--- | :--- | :--- | :--- |
| **Proprietário (Owner)** | Controle total e irrestrito sobre a organização no sistema. | - Modificar dados cadastrais da organização.<br>- Gerenciar membros (adicionar/remover/mudar cargos).<br>- Gerenciar eventos (criar/editar/deletar).<br>- Visualizar logs de auditoria e segurança.<br>- Ações de manutenção avançada (ex: reprocessar e-mails). | - Criar novas organizações ou enviar convites para participação em organizações (exclusivo do Superadmin). |
| **Administrador (Admin)** | Alta gerência operacional e administrativa da organização. | - Modificar dados cadastrais da organização.<br>- Gerenciar membros (adicionar/remover/mudar cargos).<br>- Gerenciar eventos (criar/editar/deletar). | - Criar novas organizações ou enviar convites para participação em organizações (exclusivo do Superadmin).<br>- Visualizar logs de auditoria e segurança (`audit-logs.view`).<br>- Demitir ou alterar permissões de Proprietários. |
| **Organizador** | Gestão direta e operacional dos eventos. | - Visualizar eventos.<br>- Atualizar/Editar dados de eventos (vagas, horários, etc.), sendo **obrigatório fornecer uma justificativa por escrito**.<br>- Controlar e monitorar check-ins de participantes. | - Criar novos eventos ou categorias de eventos.<br>- Excluir ou deletar eventos do sistema.<br>- Alterar dados da organização (nome, logo, etc.).<br>- Gerenciar membros da equipe.<br>- Visualizar logs de segurança ou dados sensíveis de inscritos (ex: CPF completo). |
| **Checker (Validador)** | Operação de portaria, credenciamento e validação no local. | - Visualizar lista e detalhes operacionais básicos de eventos.<br>- Realizar o check-in/presença dos participantes (leitura de QR Code ou código). | - Criar, editar ou excluir eventos.<br>- Acessar o dashboard administrativo de métricas gerais. |
| **Membro** | Acesso básico de leitura e observação. | - Visualizar a lista de eventos e detalhes operacionais básicos. | - Realizar check-ins ou alterações em eventos.<br>- Acessar qualquer área administrativa. |

---

## 2. Acesso Global e Painel Superadmin

Para fins de governança global do SaaS, existe uma função de **Superadmin** exclusiva e restrita no sistema.

### Quem é o Superadmin?
*   O único usuário com permissões de Superadmin é o e-mail: **`valterpcjr@gmail.com`**.
*   Nenhum outro usuário cadastrado possui acesso a este nível administrativo, independentemente do cargo dele dentro das organizações.

### O que o Superadmin pode fazer?
Ao acessar a rota `/superadmin` (ou clicar em **Painel Superadmin** na página inicial), o usuário tem acesso ao **Painel de Gestão Global**:
1.  **Monitoramento de Métricas Globais**: Visualizar a contagem total de organizações, usuários cadastrados, eventos criados e inscrições realizadas em toda a plataforma.
2.  **Gestão de Organizações**: 
    *   Listar todas as organizações com seus slugs, quantidade de membros e eventos.
    *   **Criar Novas Organizações**: Apenas o Superadmin tem permissão para criar organizações no sistema.
    *   **Enviar Convites**: Apenas o Superadmin pode enviar convites para participação em organizações.
    *   **Ativar/Desativar Organização**: O Superadmin pode desativar qualquer organização.
3.  **Gestão de Usuários**:
    *   Listar todos os usuários da plataforma com estatísticas de participação e verificação de e-mail.
    *   **Bloquear/Desbloquear Conta**: O Superadmin pode desativar o acesso de qualquer usuário ao sistema.
    *   **Excluir Usuário do Sistema**: O Superadmin pode deletar permanentemente usuários do sistema. Esta ação apaga em cascata suas filiações a organizações e inscrições de eventos, mantendo o histórico de auditoria intacto com dados anonimizados. A auto-exclusão e exclusão do Superadmin principal são bloqueadas.

### Segurança e Criação de Contas (Hardening)
*   **Auto-cadastro desativado**: Para evitar a criação indiscriminada de novas contas organizadoras sem validação prévia, o link de auto-cadastro na tela de login foi removido. Novos organizadores devem ter suas contas criadas diretamente pelo Superadmin.
*   **Interface de Produção Limpa**: O sistema está 100% livre de referências internas de desenvolvimento, como tags de levas ou badges de depuração, garantindo uma identidade visual limpa e profissional para a prefeitura e parceiros.

### Regra de Negócio: Bloqueio de Organizações (isActive)
*   **Os dados são excluídos?** Não. A exclusão de uma organização não ocorre fisicamente do banco de dados para fins de segurança jurídica e auditoria. Todos os eventos, inscrições de participantes, certificados emitidos e logs de auditoria permanecem **100% intactos**.
*   **O que acontece quando é Desativada?** O middleware de validação (`TenantInterceptor`) bloqueia imediatamente qualquer operação ou rota associada a esta organização, retornando um erro `403 Forbidden` aos usuários.
*   **Como reativar?** Se o Superadmin clicar em **Ativar** novamente no painel, o acesso é restabelecido na mesma hora e todos os dados voltam a ser exibidos perfeitamente.

### Arquitetura de Containers (Docker)
Todo o ecossistema da aplicação roda de forma isolada e portável dentro de containers Docker, conforme definido no arquivo `docker-compose.prod.yml`:
*   **Banco de Dados**: Container `eventos-postgres-prod` rodando PostgreSQL 16.
*   **Fila e Cache**: Container `eventos-redis-prod` rodando Valkey (Redis) para controle de filas assíncronas do BullMQ.
*   **Armazenamento de Mídia**: Container `eventos-minio-prod` rodando MinIO (compatível com S3) para guardar PDFs de ingressos, logos e certificados.
*   **API (NestJS)**: Container `eventos-api-prod` processando requisições REST de forma ultra-rápida.
*   **Worker (BullMQ)**: Container `eventos-worker-prod` consumindo tarefas pesadas em background.
*   **Frontend (Next.js)**: Container `eventos-frontend-prod` exibindo a interface otimizada de produção.
*   **Nginx**: Container `eventos-nginx-prod` servindo como proxy reverso local.

### Suporte a Centenas e Milhares de Acessos Simultâneos
O sistema foi projetado e está tecnicamente preparado para suportar de **centenas a milhares de acessos simultâneos** com alta estabilidade através das seguintes estratégias técnicas:
1.  **Processamento Assíncrono de Carga**: Tarefas de alta latência (geração de QR Codes, PDFs de ingressos/certificados e envio de e-mails transacionais) são offloadadas para a fila do Valkey/Redis. A API entrega a resposta HTTP ao usuário final em milissegundos e deixa as tarefas pesadas a cargo do container `worker`.
2.  **Prevenção de Overbooking (Pessimistic Locking)**: O banco de dados PostgreSQL bloqueia registros de vagas durante transações de inscrição concorrentes (`SELECT FOR UPDATE`), impedindo que duas inscrições na mesma vaga no mesmo milissegundo resultem em excesso de lotação.
3.  **Logger Não-Bloqueante (Pino)**: O console e logs utilizam buffering assíncrono para evitar que a gravação em disco trave o Event Loop do Node.js.
4.  **Compressão de Dados**: Middleware de Gzip ativo para compactar pacotes HTTP reduzindo consumo de banda na VPS.
5.  **Offline-First no Credenciamento (PWA + Dexie.js)**: Operadores de portaria realizam check-ins locais que são sincronizados em lotes subsequentes, reduzindo gargalos de rede em conexões simultâneas de celulares na portaria.

---

## 3. Acesso e Fluxo do Participante

### Como o participante interage com o sistema?
A plataforma **não possui uma área restrita (com login/senha)** voltada para os participantes. A experiência foi simplificada para ser direta e focada em comunicações por e-mail e páginas públicas:

1.  **Inscrição:** O participante acessa a página pública exclusiva do evento (`/e/[slug_do_evento]`), preenche o formulário e, ao confirmar, recebe um e-mail com o **QR Code da inscrição**.
2.  **Presença:** No dia do evento, a recepção escaneia o QR Code do participante por meio do link de credenciamento (`/checkin/[eventId]`) para validar e confirmar a sua presença.
3.  **Certificados:** Finalizado o evento, o participante recebe por e-mail um link exclusivo para a página de validação e download (`/certificate/[codigo_verificador]`), onde ele pode obter o PDF de participação.

---

## 4. Perguntas Frequentes (FAQ)

### O participante precisa preencher os dados de cadastro toda vez que for se inscrever em um novo evento?
**Sim.** Atualmente, o participante precisa preencher seu Nome, E-mail, CPF e Telefone todas as vezes.

*   **Por que é assim atualmente?**
    1.  **Segurança (LGPD):** Fazer buscas automáticas de dados no banco ao digitar o CPF ou E-mail geraria uma brecha de privacidade, permitindo que terceiros descobrissem dados pessoais de outros usuários.
    2.  **Sem Conta de Participante:** Por não possuírem uma conta com login e senha na plataforma, não há uma sessão de usuário ativa que possa identificar o participante no navegador e auto-preencher os dados dele de forma blindada.

*   **Alternativas Futuras de Melhoria:**
    1.  **Autocompletar Local (LocalStorage):** Salvar os dados do último formulário preenchido localmente no navegador do participante. Assim, quando ele abrir outro formulário de evento no mesmo dispositivo, os dados serão preenchidos automaticamente.
    2.  **Cadastro do Participante (Portal do Participante):** Criar um fluxo de login simplificado (ou login único/social) para os participantes gerenciarem suas inscrições.

### É possível se cadastrar mais de uma vez no mesmo evento com o mesmo CPF?
**Não.** A plataforma realiza duas validações obrigatórias no momento do cadastro:
1. **Validação Matemática**: O CPF digitado é validado matematicamente com base no cálculo dos dígitos verificadores oficiais. CPFs inválidos ou fictícios (como `111.111.111-11`) são rejeitados de imediato com a mensagem: *"CPF inválido. Forneça um número de CPF válido."*
2. **Bloqueio de Duplicidade**: O sistema gera um hash criptográfico seguro (*blind index*) do CPF limpo. Se o mesmo hash for detectado em outra inscrição (ativa ou em lista de espera) para o mesmo evento, o cadastro é bloqueado com o erro: *"Este CPF já está inscrito ou na lista de espera deste evento."* Isso evita que um participante realize múltiplas inscrições usando e-mails diferentes com o mesmo CPF.

---

## 5. Gestão de Oficinas (CONLUZ e Outros Eventos)

A plataforma conta com um sistema flexível e dinâmico para gerenciar eventos que possuem oficinas integradas (como o CONLUZ).

### 5.1. Como Ativar o Recurso de Oficinas
Para que um evento exiba o fluxo de oficinas e palestrantes, faça o seguinte no Painel Administrativo:
1. Acesse a edição do evento ou crie um novo evento.
2. Defina o campo **"Limite de Oficinas por Participante"** (`maxWorkshops`) com um número maior que zero (ex: `2`).
3. Salve o evento. O sistema ativará automaticamente as abas de gerenciamento de oficinas e palestrantes na administração do evento e no formulário público.

### 5.2. Como Cadastrar Oficinas e Palestrantes
No menu do evento correspondente:
1. **Palestrantes**: Cadastre os palestrantes que conduzirão as oficinas (Nome, Foto, Biografia/Cargo).
2. **Oficinas**: Cadastre cada oficina preenchendo:
   * **Título** e **Descrição** da oficina.
   * **Capacidade de Vagas** (o limite rígido do espaço físico/virtual).
   * **Data e Horário (Início e Fim)**: O período exato de realização.
   * **Palestrantes**: Associe os palestrantes cadastrados anteriormente.

### 5.3. Validações e Prevenção de Conflitos (Público)
No momento em que o participante preenche a inscrição do evento:
* **Limite Máximo**: O participante só pode marcar até o número de oficinas definido em `maxWorkshops`.
* **Conflito de Horário**: O formulário impede a seleção de oficinas que aconteçam simultaneamente (sobreposição de horário no mesmo dia).
* **Bloqueio de Overbooking**: O sistema realiza transações com travas pessimistas (*Pessimistic Locking*). Se duas pessoas tentarem se inscrever na última vaga da mesma oficina ao mesmo tempo, apenas a primeira a concluir terá a vaga confirmada; a segunda receberá um aviso amigável de "Vagas Esgotadas".

### 5.4. Gestão Administrativa de Inscritos
Na área de administração do evento, em **Oficinas**:
* É possível listar todos os participantes inscritos em cada oficina específica.
* O organizador pode remover/cancelar administrativamente a inscrição de um participante em uma oficina individual, liberando a vaga instantaneamente para novos cadastros.

---

## 6. Comunicação e E-mails (Configuração do SMTP)

Para que a plataforma realize o envio automático de confirmações de inscrição, QR Codes e lembretes pré-evento:

1. **E-mail Oficial**: O sistema utiliza o e-mail institucional **`eventos@educacao.luziania.go.gov.br`** integrado via SMTP seguro (porta `587` TLS).
2. **Resiliência da Fila**: Os envios são orquestrados por uma fila assíncrona (BullMQ). Se houver instabilidade no servidor de correio da Prefeitura, o sistema tenta reenviar o e-mail de forma inteligente 3 vezes com atraso progressivo. Se falhar em todas, o e-mail vai para a fila de mortos (DLQ) para conferência no painel administrativo de e-mails.
3. **Roteamento Interno na VPS**: Devido ao fato da VPS e do servidor de e-mail estarem no mesmo range de sub-rede interna da Prefeitura (com isolamento de rede local ativo), a VPS foi configurada para rotear o tráfego de e-mail explicitamente através do gateway público (`190.2.72.65`) de forma persistente.

---

## 7. Manual do Sistema Interativo (/manual)

O sistema conta com um **Manual Interativo** integrado diretamente na interface administrativa. A visibilidade das abas e orientações é filtrada dinamicamente de acordo com o nível de acesso do usuário logado:

* **Membro**: Visualiza instruções sobre inscrições em eventos, fila de espera automática, uso de ingresso digital, download de certificados, bem como o funcionamento da validação obrigatória de CPF e o limite de inscrição única por evento.
* **Checker**: Acesso às orientações para operação do scanner de QR Codes na portaria, buscas manuais de inscritos por CPF/Nome, download offline de dados, sincronização pós-evento, além de usufruir da segurança de dados limpos e higienizados na lista de presença.
* **Organizador**: Acesso aos guias para edição operacional de eventos exigindo justificativa obrigatória registrada na auditoria, restrições do cargo e a regra de unicidade de CPF por participante em cada evento.
* **Administrador**: Manual completo de controle da organização (gestão de membros, exclusão de eventos/categorias, LGPD, monitor de e-mails) e os controles de blindagem por *blind index* para deduplicação de CPFs em conformidade com a LGPD.
* **Superadmin**: Acesso irrestrito a todas as abas, somando-se as instruções de ativação/desativação de organizações, envio de convites, exclusão definitiva de usuários e os mecanismos técnicos globais de criptografia e migração de hash de CPF (script de rotação).

---

## 8. Recursos de Segurança e Usabilidade no Acesso

### 8.1. Proteção de Sessão por Aba (sessionStorage)
Para evitar o restabelecimento automático de sessões antigas quando o usuário apenas digita a URL do sistema em uma nova aba do navegador, a plataforma armazena uma chave temporária no `sessionStorage`. 
* **Como funciona:** O auto-login (renovação do cookie HttpOnly) só é executado se a aba atual possuir o registro ativo de sessão. Caso a aba/janela seja nova, o usuário será direcionado com segurança para a tela de login. O botão de "Sair" ou falhas críticas de conexão limpam imediatamente essa chave para garantir a segurança.

### 8.2. Botão de Revelar Senha (Olho)
Para melhorar a experiência do usuário e evitar digitação incorreta em telas sensíveis, foi adicionada a funcionalidade de revelador de senha:
* **Onde encontrar:** Disponível no canto direito do campo de senha nas páginas de **Login**, **Cadastro** e **Redefinição de Senha**.
* **Como funciona:** O ícone alterna visualmente (exibindo um olho aberto ou fechado com uma barra) e altera o tipo do campo entre texto oculto e texto visível.

### 8.3. Estabilidade de Formulários e Otimizações de Carregamento
Para evitar piscadas de tela, perda de foco ao digitar e fechamento indesejado de modais:
* **Memoização de Permissões**: A verificação de permissões do usuário logado é feita de forma otimizada em memória. Digitar caracteres em qualquer formulário de criação/edição não aciona recriações de componentes ou novos ciclos de busca ao backend.
* **Carregamento Otimizado de Categorias**: A tela de categorias possui carregamento síncrono inicial com indicador de processamento visual (loader). Atualizações subsequentes de criação, edição ou deleção ocorrem de forma assíncrona em segundo plano, sem travar ou piscar a interface.

---

## 9. Especificações de Mídia (Banners de Eventos)

Para garantir a melhor exibição e evitar erros de carregamento ao criar ou editar eventos:

* **Tamanho Limite**: O arquivo de imagem do banner deve possuir no máximo **5 MB**.
* **Formatos Aceitos**: `.png`, `.jpg`, `.jpeg` e `.webp`.
* **Proporções e Dimensões Recomendadas**:
  * Como a imagem é adaptada e cortada para preencher retângulos horizontais nas listagens e na página do evento (usando a propriedade CSS `object-cover`), utilize imagens em formato **paisagem (horizontal)**.
  * **Proporção recomendada**: **16:9** (Exemplo: `1200x675 px`) ou proporções mais largas como **3:1** (Exemplo: `1200x400 px`).
  * **Dica de Layout**: Mantenha os textos e elementos visuais importantes centralizados na imagem. Evite colocá-los muito próximos das bordas superiores ou inferiores, pois eles podem sofrer pequenos cortes dependendo do tamanho da tela do dispositivo do participante (computador ou celular).

---

## 10. Padronização de Cadastro e Campos Obrigatórios

Para manter a base de dados consistente, livre de erros cadastrais e otimizada para listagens de presença:

### 10.1. Nome em Caixa Alta (UPPERCASE)
* Toda inscrição ou transferência de inscrição registrada na plataforma é salva com o nome do participante em letras **maiúsculas**.
* **Frontend**: Os inputs de nome convertem automaticamente o texto digitado à medida que o usuário escreve. Ao submeter, o payload é higienizado em caixa alta.
* **Backend**: Caso a API receba uma chamada externa, existe um interceptador/validador de integridade que força a conversão do nome para maiúsculo antes da escrita no banco de dados.

### 10.2. Obrigatoriedade de Campos
Todos os campos cadastrais do formulário de inscrição são obrigatórios:
* **Nome Completo**
* **E-mail** (formato válido de correio eletrônico)
* **CPF** (validação matemática dos dígitos verificadores)
* **Celular/Telefone**: O campo passou a ser obrigatório em todas as instâncias (inscrição inicial e transferência). O número deve conter o DDD e pelo menos 10 dígitos numéricos válidos.

---

## 11. Localização Geográfica dos Eventos (Mapas)

Os eventos contam com a integração de localização geográfica para facilitar o trajeto do participante:
* **Administração**: Ao criar ou editar um evento, o organizador pode especificar o endereço textual completo e inserir o link direto de mapas (Google Maps, Waze ou similar).
* **Página do Evento (Participante)**: A página do evento exibe um card interativo com o endereço configurado. O participante pode clicar no botão de mapa para abrir diretamente a navegação GPS em seu celular ou computador.





