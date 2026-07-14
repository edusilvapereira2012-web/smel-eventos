# SMEL - Plataforma de Eventos
## Manual e Perguntas Frequentes do Sistema

Este documento serve como referência rápida para consulta sobre as regras de negócio, permissões e funcionamento geral da **SMEL-Plataforma de Eventos**.

---

## 1. Controle de Cargos e Permissões (RBAC)

A plataforma utiliza um controle de acesso baseado em funções (RBAC - Role-Based Access Control) que divide os usuários da equipe organizadora em cinco níveis de permissão dentro de cada inquilino (organização):

| Cargo | Descrição Geral | Principais Ações Permitidas | Ações Restritas |
| :--- | :--- | :--- | :--- |
| **Proprietário (Owner)** | Controle total e irrestrito sobre a organização no sistema. | - Modificar dados cadastrais da organização.<br>- Gerenciar membros (adicionar/remover/mudar cargos).<br>- Gerenciar eventos (criar/editar/deletar).<br>- Visualizar logs de auditoria e segurança.<br>- Ações de manutenção avançada (ex: reprocessar e-mails). | Nenhuma (permissão máxima). |
| **Administrador (Admin)** | Alta gerência operacional e administrativa da organização. | - Modificar dados cadastrais da organização.<br>- Gerenciar membros (adicionar/remover/mudar cargos).<br>- Gerenciar eventos (criar/editar/deletar). | - Visualizar logs de auditoria e segurança (`audit-logs.view`).<br>- Demitir ou alterar permissões de Proprietários. |
| **Organizador** | Gestão direta e operacional dos eventos. | - Criar, atualizar, visualizar e excluir eventos.<br>- Controlar e monitorar check-ins de participantes. | - Alterar dados da organização (nome, logo, etc.).<br>- Gerenciar membros da equipe.<br>- Visualizar logs de segurança ou dados sensíveis de inscritos (ex: CPF completo). |
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
    *   **Ativar/Desativar Organização**: O Superadmin pode desativar qualquer organização.
3.  **Gestão de Usuários**:
    *   Listar todos os usuários da plataforma com estatísticas de participação e verificação de e-mail.
    *   **Bloquear/Desbloquear Conta**: O Superadmin pode desativar o acesso de qualquer usuário ao sistema.

### Segurança e Criação de Contas (Hardening)
*   **Auto-cadastro desativado**: Para evitar a criação indiscriminada de novas contas organizadoras sem validação prévia, o link de auto-cadastro na tela de login foi removido. Novos organizadores devem ter suas contas criadas diretamente pelo Superadmin ou por um proprietário (Owner) através de convites internos.
*   **Interface de Produção Limpa**: O sistema está 100% livre de referências internas de desenvolvimento, como tags de levas ou badges de depuração, garantindo uma identidade visual limpa e profissional para a prefeitura e parceiros.

### Regra de Negócio: Bloqueio de Organizações (isActive)
*   **Os dados são excluídos?** Não. A exclusão de uma organização não ocorre fisicamente do banco de dados para fins de segurança jurídica e auditoria. Todos os eventos, inscrições de participantes, certificados emitidos e logs de auditoria permanecem **100% intactos**.
*   **O que acontece quando é Desativada?** O middleware de validação (`TenantInterceptor`) bloqueia imediatamente qualquer operação ou rota associada a esta organização, retornando um erro `403 Forbidden` aos usuários.
*   **Como reativar?** Se o Superadmin clicar em **Ativar** novamente no painel, o acesso é restabelecido na mesma hora e todos os dados voltam a ser exibidos perfeitamente.

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
