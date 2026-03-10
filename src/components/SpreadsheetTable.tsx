import React from 'react';

interface Produto {
  codigo_interno: string;
  descricao: string;
  codigo_barras: string;
}

interface RespostaEmpresa {
  empresa: string;
  resposta: { codigo_interno: string; preco: number | string }[];
}

interface SpreadsheetTableProps {
  produtos: Produto[];
  respostas: RespostaEmpresa[];
  readOnly?: boolean;
  editableColumn?: string;
  onPriceChange?: (codigoInterno: string, preco: string) => void;
  editPrices?: Record<string, string>;
}

const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  produtos,
  respostas,
  readOnly = false,
  editableColumn,
  onPriceChange,
  editPrices = {},
}) => {
  const empresas = respostas.map(r => r.empresa);

  const getPreco = (empresa: string, codigoInterno: string) => {
    const resp = respostas.find(r => r.empresa === empresa);
    if (!resp) return '';
    const item = resp.resposta.find(i => i.codigo_interno === codigoInterno);
    return item ? item.preco : '';
  };

  return (
    <div className="flex-1 overflow-auto border border-border">
      <table className="w-full border-collapse font-body text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-card">
            <th className="border border-border px-3 py-2 text-left font-display font-bold text-foreground min-w-[60px]">#</th>
            <th className="border border-border px-3 py-2 text-left font-display font-bold text-foreground min-w-[120px] sticky left-0 bg-card z-20">Código Interno</th>
            <th className="border border-border px-3 py-2 text-left font-display font-bold text-foreground min-w-[300px]">Descrição</th>
            <th className="border border-border px-3 py-2 text-left font-display font-bold text-foreground min-w-[150px]">Código de Barras</th>
            {empresas.map(emp => (
              <th
                key={emp}
                className={`border border-border px-3 py-2 text-left font-display font-bold min-w-[140px] ${
                  editableColumn === emp ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}
              >
                Preço {emp}
              </th>
            ))}
            {editableColumn && !empresas.includes(editableColumn) && (
              <th className="border border-border px-3 py-2 text-left font-display font-bold min-w-[140px] bg-primary text-primary-foreground">
                Preço {editableColumn}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {produtos.length === 0 ? (
            <tr>
              <td colSpan={4 + empresas.length + (editableColumn && !empresas.includes(editableColumn) ? 1 : 0)} className="px-3 py-8 text-center text-muted-foreground">
                Nenhum produto carregado. Use "Importar Lista" ou "Carregar Lista" para começar.
              </td>
            </tr>
          ) : (
            produtos.map((prod, idx) => (
              <tr key={prod.codigo_interno + idx} className="hover:bg-muted/30">
                <td className="border border-border px-3 py-1.5 text-muted-foreground">{idx + 1}</td>
                <td className="border border-border px-3 py-1.5 sticky left-0 bg-background">{prod.codigo_interno}</td>
                <td className="border border-border px-3 py-1.5">{prod.descricao}</td>
                <td className="border border-border px-3 py-1.5">{prod.codigo_barras}</td>
                {empresas.map(emp => (
                  <td key={emp} className={`border border-border px-3 py-1.5 ${editableColumn === emp ? 'bg-primary/5' : ''}`}>
                    {editableColumn === emp && !readOnly ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
                        value={editPrices[prod.codigo_interno] ?? ''}
                        onChange={e => onPriceChange?.(prod.codigo_interno, e.target.value)}
                        placeholder="0,00"
                      />
                    ) : (
                      getPreco(emp, prod.codigo_interno)
                    )}
                  </td>
                ))}
                {editableColumn && !empresas.includes(editableColumn) && (
                  <td className="border border-border px-3 py-1.5 bg-primary/5">
                    {!readOnly ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
                        value={editPrices[prod.codigo_interno] ?? ''}
                        onChange={e => onPriceChange?.(prod.codigo_interno, e.target.value)}
                        placeholder="0,00"
                      />
                    ) : ''}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SpreadsheetTable;
