import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit } from 'lucide-react';

const MasterAdmin = () => {
  const [networks, setNetworks] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newNetwork, setNewNetwork] = useState({ name: '', slug: '' });

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    const { data, error } = await supabase.from('networks').select('*').order('name');
    if (error) { toast.error('Erro ao buscar redes'); return; }
    setNetworks(data || []);
  };

  const handleAddNetwork = async () => {
    if (!newNetwork.name || !newNetwork.slug) return;
    const { error } = await supabase.from('networks').insert(newNetwork);
    if (error) { toast.error('Erro ao criar rede'); return; }
    toast.success('Rede criada!');
    setNewNetwork({ name: '', slug: '' });
    setIsAdding(false);
    fetchNetworks();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">Gestão de Redes</h1>
        <Button onClick={() => setIsAdding(!isAdding)}><Plus className="w-4 h-4 mr-2" /> Nova Rede</Button>
      </div>

      {isAdding && (
        <Card className="mb-8">
          <CardHeader><CardTitle>Nova Rede</CardTitle></CardHeader>
          <CardContent className="flex gap-4">
            <Input placeholder="Nome da Empresa" value={newNetwork.name} onChange={e => setNewNetwork({...newNetwork, name: e.target.value})} />
            <Input placeholder="Slug (url)" value={newNetwork.slug} onChange={e => setNewNetwork({...newNetwork, slug: e.target.value})} />
            <Button onClick={handleAddNetwork}>Salvar</Button>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {networks.map(n => (
            <TableRow key={n.id}>
              <TableCell>{n.name}</TableCell>
              <TableCell>{n.slug}</TableCell>
              <TableCell><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MasterAdmin;
