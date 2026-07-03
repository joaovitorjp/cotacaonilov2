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
import AvariasAdminPanel from '@/components/AvariasAdminPanel';
import { toast } from 'sonner';
import { LogOut, Search, Shield, ArrowLeft, FileText, Eye, Package, Users, Calendar, BarChart3, Table as TableIcon, AlertTriangle, ClipboardList } from 'lucide-react';

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
  const [view, setView] = useState<'cotacoes' | 'avarias'>('cotacoes');

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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg sm:text-xl font-display font-bold text-foreground tracking-tight">
            Painel do Administrador
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Visualize todas as cotações de todos os usuários. Você pode abrir a planilha e baixar o PDF, mas não editar.
          </p>
        </div>

        <MonthlyReportCard listas={listas} profiles={profiles} />


        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cotação, usuário ou email..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'aberta', 'finalizada'] as const).map(opt => (
              <Button
                key={opt}
                variant={statusFilter === opt ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(opt)}
              >
                {opt === 'all' ? 'Todas' : opt === 'aberta' ? 'Abertas' : 'Finalizadas'}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground text-sm">Nenhuma cotação encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lista => {
              const owner = profiles[lista.user_id];
              return (
                <div
                  key={lista.id}
                  className="border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all bg-card"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-foreground text-base">{lista.nome}</h3>
                        <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full ${
                          lista.status === 'finalizada' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                        }`}>
                          {lista.status === 'finalizada' ? 'FINALIZADA' : 'ABERTA'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <strong className="text-foreground">{owner?.nome || 'Sem nome'}</strong>
                          <span>· {owner?.email || '—'}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {lista.produtos.length} produtos
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openLista(lista)}>
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Abrir planilha
                      </Button>
                      <Button size="sm" onClick={async () => {
                        await openLista(lista);
                        setActiveTab('analise');
                        toast.info('Use o botão "Exportar PDF" na aba Análise.');
                      }}>
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        PDF
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
  );
};

export default AdminPanel;
