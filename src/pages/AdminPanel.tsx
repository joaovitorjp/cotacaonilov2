import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SpreadsheetTable from '@/components/SpreadsheetTable';
import MonthlyReportCard from '@/components/MonthlyReportCard';
import AnalisePrecosPanel from '@/components/AnalisePrecosPanel';
import { toast } from 'sonner';
import { LogOut, Search, Shield, ArrowLeft, FileText, Eye, Package, Users, Calendar, BarChart3, Table as TableIcon } from 'lucide-react';

interface Lista {
  id: string;
  nome: string;
  status: string;
  produtos: { codigo_interno: string; descricao: string; codigo_barras: string }[];
  created_at: string;
  user_id: string;
}

interface Profile {
  user_id: string;
  nome: string;
  email: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: any[];
}

const AdminPanel: React.FC = () => {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [listas, setListas] = useState<Lista[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'aberta' | 'finalizada'>('all');
  const [currentLista, setCurrentLista] = useState<Lista | null>(null);
  const [respostas, setRespostas] = useState<RespostaEmpresa[]>([]);
  const [activeTab, setActiveTab] = useState<'planilha' | 'analise'>('planilha');

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    void fetchAll();
  }, [isAdmin, roleLoading, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    const [listasRes, profilesRes] = await Promise.all([
      supabase.from('listas').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, nome, email'),
    ]);
    setListas((listasRes.data ?? []).map((l: any) => ({ ...l, produtos: l.produtos as any[] })));
    const map: Record<string, Profile> = {};
    (profilesRes.data ?? []).forEach((p: any) => { map[p.user_id] = p; });
    setProfiles(map);
    setLoading(false);
  };

  const openLista = async (lista: Lista) => {
    setCurrentLista(lista);
    setActiveTab('planilha');
    const { data } = await supabase
      .from('respostas')
      .select('empresa, resposta')
      .eq('lista_id', lista.id);
    setRespostas((data ?? []).map((d: any) => ({ empresa: d.empresa, resposta: d.resposta as any[] })));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listas.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      const owner = profiles[l.user_id];
      return (
        l.nome.toLowerCase().includes(q) ||
        owner?.nome?.toLowerCase().includes(q) ||
        owner?.email?.toLowerCase().includes(q)
      );
    });
  }, [listas, profiles, search, statusFilter]);

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  if (currentLista) {
    return (
      <div className="flex flex-col h-screen">
        <header className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentLista(null)} className="flex items-center gap-2 text-foreground hover:text-primary">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-display font-bold text-sm">Voltar</span>
            </button>
            <div className="w-px h-5 bg-border" />
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-display font-bold text-foreground">Modo Admin (somente leitura)</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <div className="shrink-0 border-b border-border">
          <div className="bg-muted/50 px-4 sm:px-6 py-2 text-sm text-foreground flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold">{currentLista.nome}</span>
            <span className="text-muted-foreground text-xs">
              {currentLista.produtos.length} produtos · {respostas.length} resposta(s)
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-display font-bold ${
              currentLista.status === 'finalizada' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
            }`}>
              {currentLista.status === 'finalizada' ? 'FINALIZADA' : 'ABERTA'}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              Dono: <strong>{profiles[currentLista.user_id]?.nome || 'Sem nome'}</strong> · {profiles[currentLista.user_id]?.email || '—'}
            </span>
          </div>
          <div className="flex px-4 sm:px-6 bg-card">
            <button
              onClick={() => setActiveTab('planilha')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-display font-bold border-b-2 transition-colors ${
                activeTab === 'planilha' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Planilha
            </button>
            <button
              onClick={() => setActiveTab('analise')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-display font-bold border-b-2 transition-colors ${
                activeTab === 'analise' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Análise & PDF
            </button>
          </div>
        </div>

        {activeTab === 'planilha' ? (
          <SpreadsheetTable
            produtos={currentLista.produtos}
            respostas={respostas}
            readOnly
            highlightLowest={respostas.length > 1}
            listaId={currentLista.id}
          />
        ) : (
          <AnalisePrecosPanel
            produtos={currentLista.produtos}
            respostas={respostas}
            listaNome={currentLista.nome}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-slate-900 tracking-tight">
              Painel Administrativo
            </h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Gestão Global de Cotações</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-xs font-bold text-slate-900">{user?.email?.split('@')[0]}</span>
            <span className="text-[10px] text-slate-500">{user?.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="hover:bg-red-50 hover:text-red-600 rounded-full transition-colors">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar / Stats / Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Filtros de Busca
              </h2>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Nome, usuário ou email..."
                    className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-xl"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                  {(['all', 'aberta', 'finalizada'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setStatusFilter(opt)}
                      className={`py-2 text-[10px] font-bold rounded-lg transition-all ${
                        statusFilter === opt 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt === 'all' ? 'Todas' : opt === 'aberta' ? 'Abertas' : 'Finais'}
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-500">Total Filtrado</span>
                    <span className="font-bold text-slate-900">{filtered.length} cotações</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-500" 
                      style={{ width: `${listas.length > 0 ? (filtered.length / listas.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main List */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Carregando dados globais...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-bold">Nenhuma cotação</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                  Não encontramos registros que correspondam aos seus critérios de busca.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filtered.map(lista => {
                  const owner = profiles[lista.user_id];
                  const isFinal = lista.status === 'finalizada';
                  
                  return (
                    <div
                      key={lista.id}
                      className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-display font-bold text-slate-900 text-base truncate">
                              {lista.nome}
                            </h3>
                            <span className={`shrink-0 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md ${
                              isFinal ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {lista.status}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                                {owner?.nome?.charAt(0) || '?'}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800 leading-none">{owner?.nome || 'Sem nome'}</span>
                                <span className="text-[10px] text-slate-500">{owner?.email}</span>
                              </div>
                            </div>

                            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                <Package className="w-3.5 h-3.5 text-slate-400" />
                                <strong>{lista.produtos.length}</strong> itens
                              </span>
                              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:self-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openLista(lista)}
                            className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            Visualizar
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              await openLista(lista);
                              setActiveTab('analise');
                              toast.info('Exportação disponível na aba Análise');
                            }}
                            className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
                          >
                            <FileText className="w-3.5 h-3.5 mr-2" />
                            Relatório
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
