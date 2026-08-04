import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, History, ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const MasterAuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Erro ao carregar logs: " + error.message);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = ["Data", "Ação", "Status", "IP", "User ID", "Detalhes"];
    const csvData = logs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.action,
      log.status,
      log.ip_address,
      log.user_id || 'N/A',
      JSON.stringify(log.details)
    ]);

    const csvContent = [headers, ...csvData]
      .map(e => e.join(";"))
      .join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Logs exportados com sucesso!");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/master')} className="rounded-full h-10 w-10 p-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <History className="h-8 w-8 text-sky-600" /> Logs de Auditoria
            </h1>
            <p className="text-slate-500 text-sm">Monitoramento de acesso ao Painel Master</p>
          </div>
        </div>
        <Button 
          onClick={exportToCSV} 
          disabled={logs.length === 0}
          className="bg-sky-600 hover:bg-sky-700 flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-400" /> Registro de Tentativas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[200px]">Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400 italic">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400 italic">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-600">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase">
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          log.status === 'success' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        } uppercase`}>
                          {log.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {log.ip_address}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => console.log(log.details)}>
                          Ver Detalhes
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
  );
};

export default MasterAuditLogs;