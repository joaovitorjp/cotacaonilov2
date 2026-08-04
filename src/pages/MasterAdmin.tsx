import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, UserPlus, Globe, Plus, Trash2, History } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MasterAdminPanel = () => {
  const [networks, setNetworks] = useState<any[]>([]);
  const [newNetwork, setNewNetwork] = useState({ name: '', slug: '' });
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    const { data, error } = await (supabase as any).from('networks').select('*');
    if (error) toast.error("Erro ao carregar redes");
    else setNetworks(data || []);
  };

  const handleCreateNetwork = async () => {
    if (!newNetwork.name || !newNetwork.slug) return;
    setIsLoading(true);
    const { error } = await (supabase as any).from('networks').insert([newNetwork]);
    if (error) {
      toast.error("Erro ao criar rede: " + error.message);
    } else {
      toast.success("Nova rede criada com sucesso!");
      setNewNetwork({ name: '', slug: '' });
      fetchNetworks();
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Barra de Menus Superior */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/master')}>
            <Building2 className="h-6 w-6 text-sky-600" />
            <span className="font-bold text-lg text-slate-800 tracking-tight">Master Admin</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200" />
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-sky-600 font-medium" onClick={() => navigate('/master')}>
              Redes
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-sky-600 font-medium" onClick={() => navigate('/master/logs')}>
              Audit Log
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2 border-slate-200 text-slate-600"
            onClick={() => navigate('/')}
          >
            Sair do Master
          </Button>
          <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-xs border border-sky-200">
            MA
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gerenciamento de Redes</h1>
            <p className="text-slate-500">Ecossistemas ativos no sistema Nilo Atacadista</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" /> Nova Rede
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Empresa</label>
              <Input 
                placeholder="Ex: Rede Preço Baixo" 
                value={newNetwork.name}
                onChange={(e) => setNewNetwork({...newNetwork, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug (URL)</label>
              <Input 
                placeholder="ex: preco-baixo" 
                value={newNetwork.slug}
                onChange={(e) => setNewNetwork({...newNetwork, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
              />
            </div>
            <Button 
              className="w-full bg-sky-600 hover:bg-sky-700" 
              onClick={handleCreateNetwork}
              disabled={isLoading}
            >
              Criar Ecossistema
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" /> Redes Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Slug / Link</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networks.map((network) => (
                  <React.Fragment key={network.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {network.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sky-600 text-sm">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">/{network.slug}</span>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex items-center gap-1 hover:bg-sky-50" 
                          onClick={() => navigate(`/master/network/${network.id}`)}
                        >
                          <UserPlus className="h-4 w-4" /> Gerenciar Usuários
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-red-500"
                            onClick={async () => {
                              if (confirm(`Deseja realmente excluir a rede ${network.name}? Esta ação é irreversível.`)) {
                                const { error } = await (supabase as any).from('networks').delete().eq('id', network.id);
                                if (error) toast.error("Erro ao excluir: " + error.message);
                                else {
                                  toast.success("Rede excluída");
                                  fetchNetworks();
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Resumo do Ecossistema</h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          Este painel permite que você, como criador do sistema, escale a plataforma para outras redes de supermercados ou atacados. 
          Cada rede adicionada terá seu próprio isolamento de dados, personalização visual e gerenciamento independente de usuários 
          (comuns e administradores da própria rede).
        </p>
      </div>
    </div>
  );
};

export default MasterAdminPanel;

export default MasterAdminPanel;
