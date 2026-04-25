import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill for older Android WebViews (Head Units)
if (typeof window.queueMicrotask !== 'function') {
  window.queueMicrotask = function (callback) {
    Promise.resolve()
      .then(callback)
      .catch(e => setTimeout(() => { throw e; }));
  };
}

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  console.error("Root Render Error:", e);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="background:#000;color:#f44;padding:40px;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:sans-serif;">' +
      '<h1 style="font-size:24px;margin-bottom:10px;">Erro Crítico de Inicialização</h1>' +
      '<p style="color:#888;font-size:14px;max-width:300px;">Houve uma falha ao carregar o DragFire. Pode ser uma incompatibilidade do navegador da sua multimídia.</p>' +
      '<pre style="background:#111;padding:15px;border-radius:10px;margin-top:20px;font-size:10px;color:#aaa;text-align:left;max-width:90vw;overflow:auto;">' + e + '</pre>' +
      '<button onclick="location.reload()" style="margin-top:30px;padding:15px 30px;background:#f44;color:white;border:none;border-radius:15px;font-weight:bold;">Tentar Novamente</button>' +
      '</div>';
  }
}
