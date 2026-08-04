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
    // @ts-ignore - networks table created via direct migration
    const { data, error } = await supabase.from('networks').select('*');
    if (error) toast.error("Erro ao carregar redes");
    else setNetworks(data || []);
  };

  const handleCreateNetwork = async () => {
    if (!newNetwork.name || !newNetwork.slug) return;
    setIsLoading(true);
    // @ts-ignore
    const { error } = await supabase.from('networks').insert([newNetwork]);
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
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Painel Master Admin</h1>
          <p className="text-slate-500">Gerenciamento de Redes e Ecossistemas</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => navigate('/master/logs')}
          >
            <History className="h-4 w-4" /> Logs de Auditoria
          </Button>
          <Building2 className="h-10 w-10 text-sky-600" />
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
                  <TableRow key={network.id}>
                    <TableCell className="font-medium">{network.name}</TableCell>
                    <TableCell className="text-sky-600 text-sm">
                      <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/master/network/${network.id}`)}>
                        /{network.slug}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={() => navigate(`/master/network/${network.id}`)}>
                        <UserPlus className="h-4 w-4" /> Gerenciar
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
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
