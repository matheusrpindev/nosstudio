# Contas e serviços — o que precisa existir para o site ficar no ar

Este documento responde a uma pergunta simples: **o que precisa existir, em nome de quem, e quem cuida de cada coisa** para o site e o painel da NÓS Studio funcionarem. Ele atende ao pedido do briefing de que contas, licenças, cobranças mensais e eventual suporte pós-entrega fiquem documentados por escrito.

Regra de ouro: **tudo fica em nome da NÓS Studio** (dos sócios, Pedro Henrique e Laura Nepomuceno), nunca em nome do desenvolvedor. O desenvolvedor recebe acesso para trabalhar e pode perdê-lo quando o trabalho acabar. A conta continua com vocês.

Regras deste documento:

- Nenhum preço, fornecedor ou prazo foi definido aqui. Onde houver valor, está escrito **a definir com o desenvolvedor**.
- "Custa" diz se o item costuma ser pago ou gratuito. É uma orientação geral, não uma cotação.
- Os comandos técnicos citados estão no arquivo README do projeto.

## Resumo rápido

- **Domínio**: o endereço do site. Costuma ser pago, com renovação periódica. Titular: os sócios.
- **Hospedagem (servidor)**: onde o site e o painel rodam. Costuma ser paga. Titular: os sócios.
- **E-mail de envio (SMTP)**: manda os avisos de novo lead e a recuperação de senha. Costuma estar incluso no e-mail do domínio ou em um serviço de envio. Titular: os sócios.
- **Backups**: cópias de segurança guardadas fora do servidor. Pode ser gratuito ou pago, conforme o local escolhido. Titular: os sócios.
- **Contas do painel**: os logins de Pedro, Laura e, se necessário, do desenvolvedor. Gratuitas. Titular: os sócios.

## Domínio

**Para que serve:** é o endereço que o público digita (por exemplo, seudominio.com.br; o domínio escolhido ainda é **a definir**). Também define o endereço do painel (o domínio seguido de /login) e o remetente dos e-mails.

**Custa:** costuma ser pago, com renovação periódica (geralmente anual). Valor: **a definir com o desenvolvedor**.

**Titular:** os sócios. O cadastro do domínio deve estar com o CPF ou CNPJ da NÓS Studio, com o e-mail de um dos sócios.

**Quem cuida:** os sócios cuidam da conta e da renovação. O desenvolvedor aponta o domínio para o servidor (configuração de DNS).

**Se faltar ou vencer:** o site e os e-mails do domínio saem do ar. Se a conta estiver em nome de outra pessoa, recuperar o domínio pode ser difícil. Ative a renovação automática ou um lembrete no calendário.

## Hospedagem

**Para que serve:** é o computador na internet onde o site e o painel ficam ligados 24 horas. O projeto foi feito para rodar em **Docker numa VPS** (um servidor virtual pequeno). O banco de dados e os arquivos enviados (fotos, contratos, comprovantes) ficam no próprio servidor, em uma pasta que precisa ser **persistente**.

O README explica as alternativas. Serviços que oferecem disco persistente também funcionam. Hospedagens sem disco **não servem para este projeto hoje**, porque os arquivos enviados precisam de um disco que não se apague.

**Custa:** costuma ser pago, mensal ou anual. Valor: **a definir com o desenvolvedor**. Não há serviço pago obrigatório além da hospedagem e do domínio.

**Titular:** os sócios. A conta do provedor (e o acesso ao servidor) deve ser da NÓS Studio. O desenvolvedor entra como usuário convidado, quando o provedor permitir.

**Quem cuida:** o responsável técnico (desenvolvedor) mantém o servidor, as atualizações de segurança e o certificado HTTPS. Os sócios cuidam do pagamento. Quem fará essa manutenção e com que frequência: **a definir com o desenvolvedor** (veja "Suporte depois da entrega").

**HTTPS (cadeado do site):** o site precisa de certificado HTTPS. O README recomenda um proxy com certificado gratuito (Let's Encrypt), que o desenvolvedor configura e renova.

**Um cuidado de instalação (para o desenvolvedor):** o sistema nunca deve ficar acessível direto pela internet, só através desse proxy. O README, na seção "Publicação", traz a configuração: a porta do sistema fica aberta apenas dentro do servidor, o proxy informa ao sistema o endereço real de cada visitante e o número de proxies fica anotado na configuração (`TRUSTED_PROXIES`). Sem isso, as proteções contra tentativas repetidas de login e contra abuso do formulário deixam de funcionar direito. Peça ao desenvolvedor a confirmação de que esse item foi conferido depois da publicação.

**Se faltar:** sem hospedagem paga e ligada, site e painel ficam fora do ar. Se o disco não for persistente, o banco e os arquivos podem ser perdidos em uma reinicialização.

## E-mail de envio (SMTP)

**Para que serve:** o sistema usa um e-mail de envio para dois avisos importantes: **aviso de novo lead** (para vocês saberem na hora que chegou um pedido) e **recuperação de senha**. Para configurar, o desenvolvedor precisa de dados de um provedor de e-mail: servidor, porta, usuário, senha e o remetente. Tudo isso é preenchido no arquivo de configuração do servidor.

**Custa:** o e-mail do próprio domínio costuma ter um plano pago ou estar incluso na hospedagem do domínio. Alguns serviços de envio têm plano gratuito limitado. Valor: **a definir com o desenvolvedor**.

**Titular:** os sócios. A conta de e-mail e a senha de envio ficam com a NÓS Studio.

**Quem cuida:** o desenvolvedor configura no servidor; os sócios mantêm a conta ativa e paga.

**Se faltar:** o painel **continua funcionando**, mas os e-mails não saem. O registro (log) do servidor anota só que um e-mail deixou de ser enviado, sem o texto: o link de redefinição de senha e os dados dos leads não ficam gravados lá. Na prática:

- vocês **não recebem aviso** de novo lead por e-mail, mas o lead aparece normalmente em **Leads**;
- a recuperação de senha por e-mail **não funciona**. Para redefinir uma senha, outro administrador gera uma nova em **Configurações › Usuários › Nova senha**, ou o responsável técnico faz pelo servidor;
- se o login de uma conta ficar travado por excesso de tentativas, o caminho também é **Nova senha** (pelo sócio) ou o comando de desbloqueio (pelo responsável técnico; está no README).

O painel avisa essa falta na **Visão geral** e em **Configurações › Notificações**.

**E-mail de contato do site (diferente do SMTP):** o endereço que aparece no rodapé e na política de privacidade é outra coisa. É uma caixa de entrada que vocês leem, e fica cadastrada em **Editar site › Textos › Contato e redes**. Sem ele, a política de privacidade fica sem um canal para pedidos de titulares de dados.

## Backups

**Para que serve:** cópia de segurança do banco de dados e de todos os arquivos enviados, para recuperar o sistema se o servidor falhar, se algo for apagado sem querer ou se for preciso trocar de servidor.

**Como funciona:** o projeto traz um comando de backup e um de restauração (veja o README, seção "Backup e restauração"). O backup gera um arquivo compactado e mantém os mais recentes. O ideal é **agendar o backup** no servidor e **copiar os arquivos para fora do servidor** (outro disco ou um armazenamento na nuvem). Uma cópia que fica só no mesmo servidor não protege contra a perda dele.

**Onde guardar cópias:** pelo menos uma cópia fora do servidor, em uma conta em nome da NÓS Studio (por exemplo, um armazenamento em nuvem dos sócios ou um disco externo). Qual local será usado, com que frequência e por quanto tempo guardar: **a definir com o desenvolvedor**.

**Custa:** pode ser gratuito (disco externo, espaço pequeno em nuvem) ou pago, conforme o espaço. Valor: **a definir com o desenvolvedor**.

**Titular:** os sócios (a conta onde as cópias ficam).

**Quem cuida:** o responsável técnico agenda e confere os backups. Os sócios devem saber **onde estão as cópias** e ter acesso a elas.

**Cópia extra feita por vocês:** em **Configurações › Dados**, vocês podem baixar a qualquer momento uma cópia completa em JSON e planilhas (CSV). Ela serve para guardar ou levar para outro sistema, mas **não leva os arquivos enviados**. Não substitui o backup.

**Backups e pedidos de exclusão de dados (LGPD):** quando vocês excluem um cliente, um lead ou uma foto no painel, as cópias de segurança feitas antes ainda guardam esses dados até serem substituídas pelas novas (o padrão do sistema é manter as 14 mais recentes). Combinem com o desenvolvedor por quanto tempo as cópias ficam guardadas e levem esse prazo em conta ao responder a um pedido de exclusão.

**Se faltar:** se o servidor for perdido e não houver cópia, clientes, propostas, contratos e o conteúdo do site se perdem. Peça também um **teste de restauração** de tempos em tempos, para ter certeza de que a cópia funciona.

## Contas do próprio painel

**Para que serve:** cada pessoa que usa o painel tem um login individual (e-mail e senha). Não existe cadastro público.

**Custa:** não há cobrança por conta.

**Titular:** os sócios. Pedro e Laura têm perfil **Administrador(a)**, com acesso completo.

**Como são criadas:** em **Configurações › Usuários** (botão **Nova conta**) ou pelo desenvolvedor, na criação inicial. A senha provisória aparece uma única vez e a pessoa define a própria senha no primeiro acesso.

**Conta do desenvolvedor:** para dar suporte, o desenvolvedor usa uma conta com perfil **Acesso técnico (temporário)**. Ela usa o painel, mas não gerencia contas, não vê nem altera as Notificações, não vê a Auditoria e não exporta dados. Atenção: dentro do painel ela **vê** clientes, orçamentos, financeiro e contratos, como vocês. Por isso é temporária. **Quando o suporte acabar, os sócios usam Desativar:** o acesso é revogado na hora e o histórico fica guardado. Depois de desativar, confiram em **Configurações › Notificações** se algum e-mail do desenvolvedor ficou na lista de quem recebe os avisos de novo lead.

**Limites de segurança das contas:** cada conta fica conectada em no máximo 10 aparelhos (o mais antigo sai quando entra o décimo primeiro). Muitas tentativas erradas de senha travam a entrada por um tempo; o Manual do painel explica como destravar ("Bloqueio e desbloqueio do login").

**Se faltar:** sem ao menos uma conta de administrador ativa, ninguém entra no painel. Mantenha sempre **duas contas de administrador** (Pedro e Laura), para que um possa gerar nova senha para o outro. Se as duas senhas forem perdidas e o e-mail não estiver configurado, só o responsável técnico consegue redefinir.

## Outros acessos que os sócios devem guardar

Além dos itens acima, anote em um lugar seguro, em nome da NÓS Studio:

- **Painel de controle do provedor de hospedagem** e do domínio (login e e-mail de recuperação).
- **Segredo da aplicação e dados de configuração do servidor.** Fica no arquivo de configuração do servidor, que o desenvolvedor entrega a vocês de forma segura. Sem ele não é possível reconstruir o sistema em outro servidor.
- **WhatsApp comercial e Instagram da NÓS.** O número e o perfil que aparecem no site são cadastrados em **Editar site › Textos › Contato e redes**.
- **Pastas de arquivos dos clientes** (como Google Drive). O painel guarda só os **links**, não os vídeos.
- **Código do projeto e documentação.** O briefing pede que os acessos, a documentação e a exportação dos dados garantam que a NÓS possa levar o sistema para outro fornecedor. Como e quando isso será entregue: **a definir com o desenvolvedor**.

Não envie senhas por e-mail ou WhatsApp. Use um gerenciador de senhas ou entregue pessoalmente.

## Suporte depois da entrega

Estes pontos precisam ser **combinados por escrito** entre os sócios e o desenvolvedor. Nada abaixo está definido ainda.

- **Correções (garantia):** por quanto tempo o desenvolvedor corrige, sem custo, erros do que foi entregue, e como pedir. **A definir.**
- **Mudanças e novas funções:** como pedir, como é feito o orçamento e o prazo de pequenas mudanças (textos, telas, novos campos) e de módulos novos. **A definir.**
- **Atualizações de segurança:** quem atualiza o sistema, o servidor e as dependências, com que frequência, e o que acontece se uma falha de segurança for descoberta. **A definir.** Há uma melhoria de segurança já mapeada e ainda não feita (uma política mais rígida contra scripts dentro do painel, descrita no README como "CSP com nonce"): combinem quando ela entra.
- **Monitoramento e backups:** quem confere que o site está no ar e que os backups funcionam, e como os sócios são avisados se algo falhar. **A definir.**
- **Mensalidade:** se haverá cobrança mensal de manutenção e suporte, o que ela inclui e o valor. **A definir.**
- **Custos externos:** domínio, hospedagem, e-mail de envio e espaço de backup, e quem paga cada um (em geral, a NÓS diretamente ao provedor). Valores: **a definir.**
- **Horário e canal de atendimento:** por onde pedir ajuda (WhatsApp, e-mail) e em quanto tempo o desenvolvedor responde. **A definir.**
- **Fim do suporte:** como encerrar o acesso do desenvolvedor (**Desativar** a conta técnica e revisar os acessos ao servidor) e como o desenvolvedor entrega tudo para outra pessoa, se for preciso. **A definir.**
- **Treinamento:** se haverá uma sessão para Pedro e Laura usarem o painel, além do Manual do painel. **A definir.**

Antes de fechar cada item, vale perguntar: "se isso falhar às 18h de uma sexta, quem faz o quê?".
