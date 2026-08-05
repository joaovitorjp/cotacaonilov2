import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Search, FileText, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NetworkAdmin = () => {
  const [networks, setNetworks] = useState<any[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [data, setData] = useState<any>({ cotações: [], fornecedores: [], usuários: [] });
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    const { data, error } = await supabase.from('networks').select('*').order('name');
    if (error) { toast.error('Erro ao buscar redes'); return; }
    setNetworks(data || []);
  };

  const fetchNetworkData = async (network: any) => {
    setLoading(true);
    setSelectedNetwork(network);
    
    try {
      const [listas, fornecedores, perfis] = await Promise.all([
        supabase.from('listas').select('*').eq('empresa_id', network.id || '29605804-0000-0000-0000-000000000000'),
        supabase.from('fornecedores').select('*').eq('empresa_id', network.id || '29605804-0000-0000-0000-000000000000'),
        supabase.from('profiles').select('*').eq('empresa_id', network.id || '29605804-0000-0000-0000-000000000000')
      ]);

      setData({
        cotações: listas.data || [],
        fornecedores: fornecedores.data || [],
        usuários: perfis.data || []
      });
    } catch (err) {
      toast.error('Erro ao carregar dados da rede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-800">Explorador de Dados</h1>
          <p className="text-slate-500">Gerenciamento multi-tenant de redes e ativos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditMode(!editMode)}>
            {editMode ? 'Modo Visualização' : 'Modo Edição'}
          </Button>
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList>
              <TabsTrigger value="grid"><LayoutGrid className="w-4 h-4" /></TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Redes Ativas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {networks.map(n => (
                <button
                  key={n.id}
                  onClick={() => fetchNetworkData(n)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group ${selectedNetwork?.id === n.id ? 'bg-primary/5 text-primary' : ''}`}
                >
                  <div className="truncate">
                    <p className="font-medium text-sm">{n.name}</p>
                    <p className="text-xs text-slate-400">{n.slug}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${selectedNetwork?.id === n.id ? 'opacity-100' : ''}`} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          {selectedNetwork ? (
            <>
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl">{selectedNetwork.name}</CardTitle>
                    <p className="text-sm text-slate-500">UUID: {selectedNetwork.id}</p>
                  </div>
                  <Badge variant="outline" className="bg-white">Rede Ativa</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="listas">
                  <TabsList className="mb-6">
                    <TabsTrigger value="listas">Cotações ({data.cotações.length})</TabsTrigger>
                    <TabsTrigger value="fornecedores">Fornecedores ({data.fornecedores.length})</TabsTrigger>
                    <TabsTrigger value="usuarios">Usuários ({data.usuários.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="listas">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          {editMode && <TableHead>Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.cotações.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">{l.nome}</TableCell>
                            <TableCell>
                              <Badge variant={l.status === 'finalizada' ? 'secondary' : 'default'}>
                                {l.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {new Date(l.created_at).toLocaleDateString()}
                            </TableCell>
                            {editMode && (
                              <TableCell>
                                <Button variant="ghost" size="sm">Editar</Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  {/* Other tabs follow same pattern */}
                </Tabs>
              </CardContent>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400 space-y-4">
              <Search className="w-12 h-12 opacity-20" />
              <p>Selecione uma rede para explorar seus dados</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default NetworkAdmin;
