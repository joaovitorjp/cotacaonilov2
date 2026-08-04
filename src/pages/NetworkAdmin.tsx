import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, UserPlus, Shield, ArrowLeft, Loader2, Trash2, Folder, FileText, Package, ChevronRight, LayoutGrid } from "lucide-react";

const NetworkAdminPanel = () => {
  const { networkId } = useParams();
  const navigate = useNavigate();
  const [network, setNetwork] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'user' });
  const [activeTab, setActiveTab] = useState<'users' | 'quotations' | 'suppliers' | 'explorer'>('explorer');
  const [quotations, setQuotations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['root']);

  useEffect(() => {
    if (networkId) {
      fetchNetworkData();
    }
  }, [networkId]);

  const fetchNetworkData = async () => {
    setIsLoading(true);
    try {
      // @ts-ignore
      const { data: netData, error: netError } = await supabase
        .from('networks' as any)
        .select('*')
        .eq('id', networkId)
        .single();

      if (netError) throw netError;
      setNetwork(netData);

      // Fetch users for this network
      // @ts-ignore
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .eq('network_id' as any, networkId);

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch quotations for this network
      const { data: qData } = await supabase
        .from('listas')
        .select('*')
        .eq('network_id' as any, networkId);
      setQuotations(qData || []);

      // Fetch suppliers for this network
      const { data: sData } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('network_id' as any, networkId);
      setSuppliers(sData || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
      navigate('/master');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email) return;
    setIsAdding(true);
    try {
      // 1. Encontrar o usuário pelo email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newUser.email)
        .single();

      if (profileError) {
        toast.error("Usuário não encontrado. O usuário deve se cadastrar primeiro no sistema.");
      } else {
        // 2. Atualizar o network_id do perfil
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ network_id: networkId } as any)
          .eq('id', profile.id);

        if (updateError) throw updateError;
        
        // 3. Gerenciar o papel do usuário (user_roles)
        // Primeiro, removemos papéis existentes para evitar conflitos de Unique Constraint
        await supabase.from('user_roles').delete().eq('user_id', profile.id);
        
        // Inserimos o novo papel
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: profile.id, role: newUser.role as any }]);

        if (roleError) throw roleError;

        toast.success("Usuário configurado na rede com sucesso!");
        fetchNetworkData();
        setNewUser({ email: '', role: 'user' });
      }
    } catch (error: any) {
      toast.error("Erro ao processar usuário: " + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Remover este usuário desta rede?")) return;
    
    try {
      // Desvincular da rede
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ network_id: null } as any)
        .eq('id', userId);

      if (updateError) throw updateError;
      
      toast.success("Usuário removido da rede");
      fetchNetworkData();
    } catch (error: any) {
      toast.error("Erro ao remover usuário: " + error.message);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole as any }]);
      
      if (error) throw error;
      toast.success("Permissão atualizada");
      fetchNetworkData();
    } catch (error: any) {
      toast.error("Erro ao atualizar permissão: " + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/master')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin: {network?.name}</h1>
          <p className="text-slate-500">Gerenciar usuários e permissões da rede</p>
        </div>
        <Shield className="h-10 w-10 text-sky-600" />
      </div>

      <div className="flex gap-4 mb-6">
        <Button 
          variant={activeTab === 'explorer' ? 'default' : 'outline'} 
          className="flex items-center gap-2"
          onClick={() => setActiveTab('explorer')}
        >
          <LayoutGrid className="h-4 w-4" /> Explorador de Arquivos
        </Button>
        <Button 
          variant={activeTab === 'users' ? 'default' : 'outline'} 
          className="flex items-center gap-2"
          onClick={() => setActiveTab('users')}
        >
          <Users className="h-4 w-4" /> Gestão de Usuários
        </Button>
      </div>

      {activeTab === 'explorer' ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="h-5 w-5 text-sky-600" /> 
              Diretório da Rede: {network?.slug}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {/* Root Folder */}
              <div 
                className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
                onClick={() => setExpandedFolders(prev => prev.includes('root') ? prev.filter(f => f !== 'root') : [...prev, 'root'])}
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${expandedFolders.includes('root') ? 'rotate-90' : ''}`} />
                <Folder className="h-5 w-5 text-amber-500 fill-amber-500" />
                <span className="font-semibold text-slate-700">{network?.name}</span>
              </div>

              {expandedFolders.includes('root') && (
                <div className="ml-6 border-l border-slate-200">
                  {/* Users Folder */}
                  <div className="flex flex-col">
                    <div 
                      className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
                      onClick={() => setExpandedFolders(prev => prev.includes('users') ? prev.filter(f => f !== 'users') : [...prev, 'users'])}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedFolders.includes('users') ? 'rotate-90' : ''}`} />
                      <Folder className="h-5 w-5 text-sky-400 fill-sky-400" />
                      <span className="text-slate-600">Usuários ({users.length})</span>
                    </div>
                    {expandedFolders.includes('users') && (
                      <div className="ml-9 border-l border-slate-100">
                        {users.map(u => (
                          <div key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 text-sm text-slate-500">
                            <Shield className="h-3 w-3 text-slate-400" />
                            <span>{u.nome || u.email}</span>
                            <span className="text-[10px] bg-slate-100 px-1 rounded uppercase">{u.user_roles?.[0]?.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quotations Folder */}
                  <div className="flex flex-col">
                    <div 
                      className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
                      onClick={() => setExpandedFolders(prev => prev.includes('quotations') ? prev.filter(f => f !== 'quotations') : [...prev, 'quotations'])}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedFolders.includes('quotations') ? 'rotate-90' : ''}`} />
                      <Folder className="h-5 w-5 text-sky-400 fill-sky-400" />
                      <span className="text-slate-600">Cotações ({quotations.length})</span>
                    </div>
                    {expandedFolders.includes('quotations') && (
                      <div className="ml-9 border-l border-slate-100">
                        {quotations.length === 0 ? (
                          <div className="p-2 text-xs text-slate-400 italic">Pasta vazia</div>
                        ) : (
                          quotations.map(q => (
                            <div key={q.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 text-sm text-slate-500">
                              <FileText className="h-3 w-3 text-slate-400" />
                              <span>{q.nome}</span>
                              <span className="text-[10px] text-slate-400">{new Date(q.created_at).toLocaleDateString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Suppliers Folder */}
                  <div className="flex flex-col">
                    <div 
                      className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedFolders(prev => prev.includes('suppliers') ? prev.filter(f => f !== 'suppliers') : [...prev, 'suppliers'])}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedFolders.includes('suppliers') ? 'rotate-90' : ''}`} />
                      <Folder className="h-5 w-5 text-sky-400 fill-sky-400" />
                      <span className="text-slate-600">Fornecedores ({suppliers.length})</span>
                    </div>
                    {expandedFolders.includes('suppliers') && (
                      <div className="ml-9 border-l border-slate-100">
                        {suppliers.length === 0 ? (
                          <div className="p-2 text-xs text-slate-400 italic">Pasta vazia</div>
                        ) : (
                          suppliers.map(s => (
                            <div key={s.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 text-sm text-slate-500">
                              <Package className="h-3 w-3 text-slate-400" />
                              <span>{s.nome}</span>
                              <span className="text-[10px] text-slate-400">{s.estado}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-sky-600" /> Adicionar Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">E-mail do Usuário</label>
                <Input 
                  placeholder="email@exemplo.com" 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Nível de Acesso</label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">Usuário Comum</option>
                  <option value="admin">Administrador da Rede</option>
                </select>
              </div>
              <Button 
                className="w-full bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all" 
                onClick={handleAddUser}
                disabled={isAdding}
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                {isAdding ? "Processando..." : "Configurar Usuário"}
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-600" /> Membros da Rede
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-slate-600 font-semibold">Usuário</TableHead>
                      <TableHead className="text-slate-600 font-semibold">Cargo</TableHead>
                      <TableHead className="text-slate-600 font-semibold">Permissão</TableHead>
                      <TableHead className="text-right text-slate-600 font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic">
                          Nenhum usuário vinculado a esta rede.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell>
                            <div className="font-semibold text-slate-700">{user.nome || 'Sem nome'}</div>
                            <div className="text-xs text-slate-400">{user.email}</div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{user.cargo || '-'}</TableCell>
                          <TableCell>
                            <select 
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border-none cursor-pointer shadow-sm transition-all ${
                                user.user_roles?.[0]?.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                                  : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                              }`}
                              value={user.user_roles?.[0]?.role || 'user'}
                              onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                            >
                              <option value="user">USUÁRIO</option>
                              <option value="admin">ADMIN</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              onClick={() => handleRemoveUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </div>
  );
};

export default NetworkAdminPanel;