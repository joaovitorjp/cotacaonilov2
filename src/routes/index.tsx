import React from 'react';
import { Link } from 'react-router-dom';

const SystemInfo = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 bg-white rounded-2xl shadow-sm border mt-10">
      <h1 className="text-3xl font-bold text-sky-900 mb-6 border-b pb-4">
        Ecossistema Nilo Atacadista & Multitenancy
      </h1>
      
      <div className="prose prose-sky max-w-none text-slate-700 leading-relaxed">
        <p className="text-lg">
          Ok.. temos agora então dois fluxos montados.. o painel do usuario comum onde solicita as cotações e temos o painel do admin aonde gerencia e visualiza as cotações que todos os usuarios comuns fizeram... esse ecossistema é de uma empresa/rede especifica chamada <strong>"Nilo Atacadista"</strong> que possui todos os seus dados salvos separadamente e vinculados a sua rede.
        </p>

        <div className="bg-sky-50 p-6 rounded-xl border border-sky-100 my-8">
          <h2 className="text-xl font-bold text-sky-800 mt-0">Nova Arquitetura Master Admin</h2>
          <p>
            O objetivo agora é criar um outro painel admin master que será um painel que o criador do sistema irá usar.. nele o admin poderá gerar/adicionar uma nova empresa/rede que irá usar o mesmo sistema que contará com o painel dos usuarios comuns e o painel dos admins.. será o mesmo template só que agora com opções de personalização para personalizar todo o ecossistema da nova rede com o nome da empresa e criando um ecosistema de banco de dados separados e vinculados aquela rede em questão..
          </p>
          <p>
            Ao adicionar a nova rede/empresa o painel irá gerar o link da área de login daquela empresa especifica já personalizado com o nome da empresa.. e através desse painel master poderá ser adicionado ou excluido os usuarios de cada rede especifica e selecionando se o usuario é comum ou admin ao incluilo.
          </p>
        </div>

        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 my-8 text-amber-900">
          <p className="font-medium">
            <strong>Acesso Master:</strong> Utilize o ícone de escudo (cadeado) no canto inferior direito do painel administrativo para acessar a tela de chave de acesso.
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 my-8 text-slate-600 text-sm italic">
          <p>
            Logs de auditoria habilitados: Registrar logs de auditoria com data, resultado (sucesso/erro) e IP das tentativas de acesso ao Painel Master.
          </p>
        </div>
        <div className="flex gap-4 mt-8">
          <Link to="/master">
            <button className="bg-sky-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-sky-700 transition-colors shadow-md">
              Acessar Painel Master Admin
            </button>
          </Link>
          <Link to="/">
            <button className="bg-white text-sky-600 border border-sky-200 px-6 py-3 rounded-lg font-semibold hover:bg-sky-50 transition-colors">
              Voltar ao Dashboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SystemInfo;
