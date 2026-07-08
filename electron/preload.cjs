const { contextBridge } = require('electron');

// Expor APIs seguras ao renderer quando necessário.
// Por enquanto, mantemos o contexto isolado sem APIs extras.
contextBridge.exposeInMainWorld('electronAPI', {});
