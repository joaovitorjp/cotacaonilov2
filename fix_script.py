import sys
path = 'src/components/SpreadsheetTable.tsx'
with open(path, 'r') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if '802: 802:     else if (type === "row" && rowIdx !== undefined)' in line:
        start_idx = i
        break

if start_idx != -1:
    copy_idx = -1
    for i in range(start_idx, len(lines)):
        if 'const handleCopyFromMenu' in lines[i]:
            copy_idx = i
            break
    
    if copy_idx != -1:
        new_block = [
            '    else if (type === \'row\' && rowIdx !== undefined) setRowBgColor(prev => ({ ...prev, [rowIdx]: color }));\n',
            '    setContextMenu(null);\n',
            '  };\n',
            '\n',
            '  const deleteRow = (rowIdx: number) => {\n',
            '    if (readOnly || rowIdx >= produtos.length) return;\n',
            '    const updated = produtos.filter((_, i) => i !== rowIdx);\n',
            '    if (onSave) onSave(updated);\n',
            '    setContextMenu(null);\n',
            '  };\n',
            '\n',
            '  const addRow = () => {\n',
            '    if (readOnly) return;\n',
            '    const newProd: Produto = {\n',
            '      codigo_interno: `NOVO-${Date.now().toString().slice(-4)}`,\n',
            '      descricao: \'Novo Produto\',\n',
            '      codigo_barras: \'\',\n',
            '    };\n',
            '    const updated = [...produtos, newProd];\n',
            '    if (onSave) onSave(updated);\n',
            '  };\n',
            '\n'
        ]
        lines[start_idx : copy_idx] = new_block
        with open(path, 'w') as f:
            f.writelines(lines)
        print('Fixed logic block')
