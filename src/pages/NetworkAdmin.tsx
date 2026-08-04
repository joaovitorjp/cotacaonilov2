import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, UserPlus, Shield, ArrowLeft, Loader2, Trash2, Folder, FileText, Package, ChevronRight, LayoutGrid, Edit, Eye, Save, ToggleLeft, ToggleRight, Building2, History } from "lucide-react";

const NetworkAdminPanel = () => {
  const { networkId } = useParams();
  const navigate = useNavigate();
  const [network, setNetwork] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'user' });
  const [activeTab, setActiveTab] = useState<'users' | 'quotations' | 'suppliers' | 'explorer' | 'audit'>('explorer');
  const [quotations, setQuotations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['root']);
  const [editingItem, setEditingItem] = useState<{ type: 'user' | 'quotation' | 'supplier', id: string, data: any } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (networkId) {
      fetchNetworkData();
    }
  }, [networkId]);

  const fetchNetworkData = async () => {
    setIsLoading(true);
    try {
      const { data: netData, error: netError } = await (supabase as any)
        .from('networks')
        .select('*')
        .eq('id', networkId)
        .single();

      if (netError) throw netError;
      setNetwork(netData);

      const { data: usersData, error: usersError } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('network_id', networkId);

      if (usersError) throw usersError;
      
      const { data: rolesData } = await (supabase as any)
        .from('user_roles')
        .select('*');

      const profilesWithRoles = (usersData || []).map(profile => ({
        ...profile,
        user_roles: (rolesData || []).filter(r => r.user_id === profile.id)
      }));

      setUsers(profilesWithRoles);

      const { data: qData } = await (supabase as any)
        .from('listas')
        .select('*')
        .eq('network_id', networkId);
      setQuotations(qData || []);

      const { data: sData } = await (supabase as any)
        .from('fornecedores')
        .select('*')
        .eq('network_id', networkId);
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
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('email', newUser.email)
        .single();

      if (profileError) {
        toast.error("Usuário não encontrado. O usuário deve se cadastrar primeiro no sistema.");
      } else {
        const { error: updateError } = await (supabase as any)
          .from('profiles')
          .update({ network_id: networkId })
          .eq('id', profile.id);

        if (updateError) throw updateError;
        
        await (supabase as any).from('user_roles').delete().eq('user_id', profile.id);
        
        const { error: roleError } = await (supabase as any)
          .from('user_roles')
          .insert([{ user_id: profile.id, role: newUser.role }]);

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
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ network_id: null })
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
      await (supabase as any).from('user_roles').delete().eq('user_id', userId);
      const { error } = await (supabase as any)
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole }]);
      
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
          <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => navigate('/master')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-xs border border-sky-200">
            MA
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin: {network?.name}</h1>
            <p className="text-slate-500">Gestão profunda de dados e ecossistema</p>
          </div>
          <Shield className="h-10 w-10 text-sky-600" />
        </div>

        <div className="flex gap-4 mb-6">
          <Button 
            variant={activeTab === 'explorer' ? 'default' : 'outline'} 
            className="flex items-center gap-2"
            onClick={() => setActiveTab('explorer')}
          >
            <LayoutGrid className="h-4 w-4" /> Explorador de Dados
          </Button>
          <Button 
            variant={activeTab === 'users' ? 'default' : 'outline'} 
            className="flex items-center gap-2"
            onClick={() => setActiveTab('users')}
          >
            <Users className="h-4 w-4" /> Painel de Gestão
          </Button>
        </div>

        {activeTab === 'explorer' ? (
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Folder className="h-4 w-4 text-sky-600" /> 
                Navegação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              <div className="flex flex-col">
                <div 
                  className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
                  onClick={() => setExpandedFolders(prev => prev.includes('root') ? prev.filter(f => f !== 'root') : [...prev, 'root'])}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedFolders.includes('root') ? 'rotate-90' : ''}`} />
                  <Folder className="h-5 w-5 text-amber-500 fill-amber-500" />
                  <span className="font-semibold text-slate-700 truncate">{network?.name}</span>
                </div>

                {expandedFolders.includes('root') && (
                  <div className="ml-4 border-l border-slate-200">
                    <div className="flex flex-col">
                      <div 
                        className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer text-sm"
                        onClick={() => setExpandedFolders(prev => prev.includes('users') ? prev.filter(f => f !== 'users') : [...prev, 'users'])}
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform ${expandedFolders.includes('users') ? 'rotate-90' : ''}`} />
                        <Folder className="h-4 w-4 text-sky-400 fill-sky-400" />
                        <span className="text-slate-600 font-medium">Usuários ({users.length})</span>
                      </div>
                      {expandedFolders.includes('users') && (
                        <div className="ml-6 border-l border-slate-100">
                          {users.map(u => (
                            <div 
                              key={u.id} 
                              className="flex items-center justify-between p-2 hover:bg-sky-50 text-xs text-slate-500 cursor-pointer group"
                              onClick={() => setEditingItem({ type: 'user', id: u.id, data: u })}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Shield className="h-3 w-3 text-slate-400" />
                                <span className="truncate">{u.nome || u.email}</span>
                              </div>
                              <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 text-sky-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div 
                        className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer text-sm"
                        onClick={() => setExpandedFolders(prev => prev.includes('quotations') ? prev.filter(f => f !== 'quotations') : [...prev, 'quotations'])}
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform ${expandedFolders.includes('quotations') ? 'rotate-90' : ''}`} />
                        <Folder className="h-4 w-4 text-sky-400 fill-sky-400" />
                        <span className="text-slate-600 font-medium">Cotações ({quotations.length})</span>
                      </div>
                      {expandedFolders.includes('quotations') && (
                        <div className="ml-6 border-l border-slate-100">
                          {quotations.map(q => (
                            <div 
                              key={q.id} 
                              className="flex items-center justify-between p-2 hover:bg-sky-50 text-xs text-slate-500 cursor-pointer group"
                              onClick={() => setEditingItem({ type: 'quotation', id: q.id, data: q })}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="h-3 w-3 text-slate-400" />
                                <span className="truncate">{q.nome}</span>
                              </div>
                              <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 text-sky-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div 
                        className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer text-sm"
                        onClick={() => setExpandedFolders(prev => prev.includes('suppliers') ? prev.filter(f => f !== 'suppliers') : [...prev, 'suppliers'])}
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform ${expandedFolders.includes('suppliers') ? 'rotate-90' : ''}`} />
                        <Folder className="h-4 w-4 text-sky-400 fill-sky-400" />
                        <span className="text-slate-600 font-medium">Fornecedores ({suppliers.length})</span>
                      </div>
                      {expandedFolders.includes('suppliers') && (
                        <div className="ml-6 border-l border-slate-100">
                          {suppliers.map(s => (
                            <div 
                              key={s.id} 
                              className="flex items-center justify-between p-2 hover:bg-sky-50 text-xs text-slate-500 cursor-pointer group"
                              onClick={() => setEditingItem({ type: 'supplier', id: s.id, data: s })}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Package className="h-3 w-3 text-slate-400" />
                                <span className="truncate">{s.nome}</span>
                              </div>
                              <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 text-sky-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  {isEditMode ? <Edit className="h-4 w-4 text-sky-600" /> : <Eye className="h-4 w-4 text-sky-600" />}
                  {isEditMode ? 'Modo Edição' : 'Modo Visualização'}
                </CardTitle>
                {editingItem && (
                  <div 
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => setIsEditMode(!isEditMode)}
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Alternar Modo</span>
                    {isEditMode ? (
                      <ToggleRight className="h-6 w-6 text-sky-600" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {!editingItem ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Eye className="h-12 w-12 mb-4 opacity-20" />
                  <p>Selecione um item no explorador para visualizar ou editar</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{editingItem.data.nome || editingItem.data.email}</h3>
                      <p className="text-sm text-slate-500 uppercase font-semibold mt-1">
                        ID: {editingItem.id} | Tipo: {editingItem.type}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>Fechar</Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    {editingItem.type === 'user' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail</label>
                          {isEditMode ? (
                            <Input 
                              value={editingItem.data.email} 
                              className="h-8 text-sm" 
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, email: e.target.value}})}
                            />
                          ) : (
                            <p className="text-sm font-medium">{editingItem.data.email}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Cargo</label>
                          {isEditMode ? (
                            <Input 
                              value={editingItem.data.cargo || ''} 
                              className="h-8 text-sm" 
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, cargo: e.target.value}})}
                            />
                          ) : (
                            <p className="text-sm font-medium">{editingItem.data.cargo || '-'}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Permissão Atual</label>
                          <p className="text-sm font-medium uppercase text-sky-600">{editingItem.data.user_roles?.[0]?.role || 'user'}</p>
                        </div>
                      </>
                    )}
                    {editingItem.type === 'quotation' && (
                      <>
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                          {isEditMode ? (
                            <Input 
                              value={editingItem.data.nome} 
                              className="h-8 text-sm" 
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, nome: e.target.value}})}
                            />
                          ) : (
                            <p className="text-sm font-medium">{editingItem.data.nome}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Criado em</label>
                          <p className="text-sm font-medium">{new Date(editingItem.data.created_at).toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                          {isEditMode ? (
                            <select 
                              className="w-full h-8 px-2 py-0 bg-white border border-slate-200 rounded text-xs"
                              value={editingItem.data.finalizada ? 'true' : 'false'}
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, finalizada: e.target.value === 'true'}})}
                            >
                              <option value="false">Aberta</option>
                              <option value="true">Finalizada</option>
                            </select>
                          ) : (
                            <p className="text-sm font-medium uppercase">{editingItem.data.finalizada ? 'Finalizada' : 'Aberta'}</p>
                          )}
                        </div>
                      </>
                    )}
                    {editingItem.type === 'supplier' && (
                      <>
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                          {isEditMode ? (
                            <Input 
                              value={editingItem.data.nome} 
                              className="h-8 text-sm" 
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, nome: e.target.value}})}
                            />
                          ) : (
                            <p className="text-sm font-medium">{editingItem.data.nome}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Estado</label>
                          {isEditMode ? (
                            <select 
                              className="w-full h-8 px-2 py-0 bg-white border border-slate-200 rounded text-xs"
                              value={editingItem.data.estado}
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, estado: e.target.value}})}
                            >
                              <option value="MT">MT</option>
                              <option value="GO">GO</option>
                            </select>
                          ) : (
                            <p className="text-sm font-medium">{editingItem.data.estado}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Representante</label>
                          {isEditMode ? (
                            <Input 
                              value={editingItem.data.nome_representante || ''} 
                              className="h-8 text-sm" 
                              onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, nome_representante: e.target.value}})}
                            />
                          ) : (
                            <p className="text-sm font-medium">{editingItem.data.nome_representante || '-'}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={async () => {
                        if (confirm(`Excluir este(a) ${editingItem.type}?`)) {
                          let table = editingItem.type === 'user' ? 'profiles' : 
                                     editingItem.type === 'quotation' ? 'listas' : 'fornecedores';
                          
                          // Custom logic for user removal (unlinking)
                          if (editingItem.type === 'user') {
                            await handleRemoveUser(editingItem.id);
                          } else {
                            const { error } = await (supabase as any).from(table).delete().eq('id', editingItem.id);
                            if (error) toast.error("Erro ao excluir: " + error.message);
                            else {
                              toast.success("Item excluído");
                              fetchNetworkData();
                            }
                          }
                          setEditingItem(null);
                        }
                      }}
                    >
                      Excluir Registro
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="bg-sky-600"
                      disabled={!isEditMode}
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          const table = editingItem.type === 'user' ? 'profiles' : 
                                       editingItem.type === 'quotation' ? 'listas' : 'fornecedores';
                          
                          // Clone the data to remove non-table fields like user_roles
                          const updateData = { ...editingItem.data };
                          delete updateData.user_roles;
                          
                          const { error } = await (supabase as any)
                            .from(table)
                            .update(updateData)
                            .eq('id', editingItem.id);
                          
                          if (error) throw error;
                          toast.success("Alterações salvas com sucesso!");
                          fetchNetworkData();
                          setIsEditMode(false);
                        } catch (err: any) {
                          toast.error("Erro ao salvar: " + err.message);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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