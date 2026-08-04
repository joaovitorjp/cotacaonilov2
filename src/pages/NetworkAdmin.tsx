import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, UserPlus, Shield, ArrowLeft, Loader2, Trash2 } from "lucide-react";

const NetworkAdminPanel = () => {
  const { networkId } = useParams();
  const navigate = useNavigate();
  const [network, setNetwork] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'user' });

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
        .from('networks')
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
        .eq('network_id', networkId);

      if (usersError) throw usersError;
      setUsers(usersData || []);
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newUser.email)
        .single();

      if (profileError) {
        toast.error("Usuário não encontrado. O usuário deve se cadastrar primeiro.");
      } else {
        // @ts-ignore
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ network_id: networkId })
          .eq('id', profile.id);

        if (updateError) throw updateError;
        
        toast.success("Usuário vinculado à rede com sucesso!");
        fetchNetworkData();
      }
    } catch (error: any) {
      toast.error("Erro ao adicionar usuário: " + error.message);
    } finally {
      setIsAdding(false);
      setNewUser({ email: '', role: 'user' });
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

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Adicionar Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail do Usuário</label>
              <Input 
                placeholder="email@exemplo.com" 
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nível de Acesso</label>
              <select 
                className="w-full h-10 px-3 py-2 bg-white border border-input rounded-md text-sm"
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="user">Usuário Comum</option>
                <option value="admin">Administrador da Rede</option>
              </select>
            </div>
            <Button 
              className="w-full bg-sky-600 hover:bg-sky-700" 
              onClick={handleAddUser}
              disabled={isAdding}
            >
              {isAdding ? "Adicionando..." : "Vincular à Rede"}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Membros da Rede
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                      Nenhum usuário vinculado a esta rede.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.nome || 'Sem nome'}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{user.cargo || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.user_roles?.[0]?.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.user_roles?.[0]?.role === 'admin' ? 'Admin' : 'Usuário'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NetworkAdminPanel;