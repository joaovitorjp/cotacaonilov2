import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package, Clock, CheckCircle2, Users } from 'lucide-react';

interface DashboardStats {
  abertas: number;
  finalizadas: number;
  totalProdutos: number;
  totalRespostas: number;
}

interface DashboardProps {
  onNavigate: (view: 'importar' | 'carregar' | 'finalizadas') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats>({ abertas: 0, finalizadas: 0, totalProdutos: 0, totalRespostas: 0 });
  const [recentes, setRecentes] = useState<{ id: string; nome: string; status: string; created_at: string; produtos: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [listasRes, respostasRes] = await Promise.all([
      supabase.from('listas').select('id, nome, status, created_at, produtos').order('created_at', { ascending: false }).limit(5),
      supabase.from('respostas').select('id', { count: 'exact', head: true }),
    ]);

    const listas = (listasRes.data ?? []) as any[];

    const abertas = listas.filter(l => l.status === 'aberta').length;
    const finalizadas = listas.filter(l => l.status === 'finalizada').length;

    setStats({
      abertas,
      finalizadas,
      totalProdutos: listas.reduce((sum, l) => sum + (Array.isArray(l.produtos) ? l.produtos.length : 0), 0),
      totalRespostas: respostasRes.count ?? 0,
    });
    setRecentes(listas.slice(0, 5));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <button
          onClick={() => onNavigate('carregar')}
          className="bg-card border border-border rounded-lg p-4 sm:p-5 text-left hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Clock className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{stats.abertas}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Cotações abertas</p>
        </button>

        <button
          onClick={() => onNavigate('finalizadas')}
          className="bg-card border border-border rounded-lg p-4 sm:p-5 text-left hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{stats.finalizadas}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Finalizadas</p>
        </button>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{stats.totalProdutos}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Produtos cadastrados</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{stats.totalRespostas}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Respostas recebidas</p>
        </div>
      </div>

      {/* Recent quotations */}
      <div>
        <h2 className="text-lg font-display font-bold text-foreground mb-3">Cotações recentes</h2>
        {recentes.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground text-sm">Nenhuma cotação ainda.</p>
            <button
              onClick={() => onNavigate('importar')}
              className="mt-2 text-sm text-primary hover:underline font-display font-bold"
            >
              Importar primeira lista
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentes.map(lista => (
              <div
                key={lista.id}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-foreground truncate">{lista.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {Array.isArray(lista.produtos) ? lista.produtos.length : 0} produtos · {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span
                  className={`text-xs font-display font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    lista.status === 'finalizada'
                      ? 'bg-success/10 text-success'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {lista.status === 'finalizada' ? 'Finalizada' : 'Aberta'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
