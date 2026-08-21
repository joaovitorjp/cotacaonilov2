# Revisão de fluxos — diagnóstico e plano de ajuste

O "erro" reportado não é um erro real do app: o app carrega normalmente, a rota `/` redireciona para `/login` e a tela renderiza sem falhas (verificado no navegador, sem erros de console ou de compilação). O registro veio do próprio texto enviado.

Abaixo, o mapeamento dos problemas reais encontrados na auditoria dos fluxos e o plano de correção.

## O que está quebrado hoje

**1. Ferramentas de integração (MCP) consultando campos que não existem**
- Listagem de fornecedores busca um campo `estado` que nunca existiu (o correto é `codigo_estado`).
- Listagem de respostas busca `fornecedor`, `precos` e `observacoes`; a tabela guarda `empresa` e um bloco `resposta`.
- Efeito: essas duas consultas sempre falham.

**2. Resíduo do modelo "multi-empresa" abandonado**
- Colunas e funções de empresa continuam ativas como valor padrão, com um fallback que aponta para "a primeira empresa cadastrada" quando o perfil não tem empresa.
- Hoje o isolamento real é por usuário e funciona, mas esse resíduo é risco de mistura de dados se alguma regra futura voltar a usá-lo.

**3. Resposta do fornecedor sem validação no servidor**
- O envio grava os preços exatamente como vêm da tela; nada impede um envio fora da tela gravar preços de um estado que aquele link não autoriza (MT/GO).

**4. Consultas disparadas antes do login carregar**
- Vários painéis consultam com usuário vazio na primeira renderização, resultando em listas vazias momentâneas (fornecedores, links, planilha).

**5. Redirecionamento de login preso a um domínio fixo**
- O login com Google só aceita um domínio de produção fixo no código; qualquer domínio novo é recusado com "destino não permitido".

**6. Painel admin sem paginação**
- Carrega todas as cotações de todos os usuários de uma vez; degrada conforme a base cresce.

## Plano de ajuste (ordem sugerida)

**Fase 1 — Correções diretas**
1. Corrigir os campos das ferramentas de integração (fornecedores e respostas) para o esquema real.
2. Adicionar validação no servidor no envio da resposta: só aceitar preços dos estados autorizados pelo link, e recusar valores não numéricos.
3. Aguardar o carregamento da sessão antes de disparar consultas nos painéis (fornecedores, links, planilha).

**Fase 2 — Robustez**
4. Aceitar automaticamente o domínio atual no retorno do login com Google, mantendo a lista de domínios confiáveis.
5. Paginar a lista de cotações do painel admin (carregar por página / filtro por período).

**Fase 3 — Limpeza de esquema (opcional, requer sua confirmação)**
6. Remover as colunas/funções de "empresa" não utilizadas ou concluir o modelo multi-empresa com atribuição explícita. Como mexe em estrutura de banco, faço só com seu aval.

## Detalhes técnicos
- Arquivos: `src/lib/mcp/tools/list-fornecedores.ts`, `src/lib/mcp/tools/list-respostas.ts`, `src/components/GerarLinkPanel.tsx`, `src/components/SpreadsheetTable.tsx`, `src/lib/oauth.ts`, `src/pages/AdminPanel.tsx`.
- Backend: migração ajustando `enviar_resposta_cotacao` para validar `estados` e formato numérico; eventual remoção de `empresa_id`/`default_empresa_id()`/`current_empresa_id()` na Fase 3.
- Sem alteração de layout ou de fluxo de uso; apenas correção e proteção.
