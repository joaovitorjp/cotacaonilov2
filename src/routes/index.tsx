import React from 'react';

const SystemAudit = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-sky-900 mb-6 border-b pb-4">Plano de Melhorias - Nilo Atacadista</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-sky-700">1. Melhorias de Fluxo (UX)</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li><strong>Onboarding de Fornecedor:</strong> Adicionar uma tour guiada ou vídeo explicativo curto na página de resposta.</li>
          <li><strong>Validação de Preços:</strong> Alertas visuais quando um preço foge muito da média histórica durante o preenchimento.</li>
          <li><strong>Dashboard de Decisão:</strong> No painel de análise, adicionar um botão de "Aprovar Cotação" que já gera os pedidos/pedidos de compra automáticos.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-sky-700">2. Design & Layout (UI)</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li><strong>Micro-interações:</strong> Adicionar feedbacks táteis (vibrate em mobile) e animações suaves ao salvar células da planilha.</li>
          <li><strong>Dark Mode:</strong> Implementar suporte nativo ao tema escuro para reduzir fadiga visual dos compradores.</li>
          <li><strong>Densidade de Dados:</strong> Opção de alternar entre visualização "Compacta" e "Confortável" na planilha principal.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-sky-700">3. Backend & Performance</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li><strong>Otimização de Query:</strong> Implementar paginação real no banco para cotações antigas (evitar carregar centenas de uma vez).</li>
          <li><strong>Logs de Auditoria:</strong> Tabela para registrar QUEM alterou qual preço e quando (essencial para admin).</li>
          <li><strong>Notificações Push:</strong> Além do WhatsApp, notificações nativas no browser quando um fornecedor chave responde.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-sky-700">4. Próximos Passos Sugeridos</h2>
        <div className="bg-sky-50 p-4 rounded-lg border border-sky-100 italic text-sky-800">
          "Focar na automação da análise comparativa, permitindo que o sistema sugira a melhor compra baseada não só em preço, mas em histórico de entrega e prazos de pagamento informados."
        </div>
      </section>
    </div>
  );
};

export default SystemAudit;

