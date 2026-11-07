import {StrictMode, useEffect, useState, FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const TOKEN_KEY = 'girofy_painel_token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // navegador sem storage: a sessão dura só a aba
  }
}

// Todo fetch para /api leva o token. Se o servidor responder 401, o painel volta para o login.
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : (input as Request).url;
  if (url.startsWith('/api/') || url.startsWith('/api?')) {
    const token = readToken();
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return originalFetch(input, {...init, headers}).then(res => {
      if (res.status === 401 && !url.startsWith('/api/login')) {
        saveToken(null);
        window.dispatchEvent(new Event('painel:logout'));
      }
      return res;
    });
  }
  return originalFetch(input, init);
};

function LoginGate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const check = async () => {
      const token = readToken();
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const res = await window.fetch('/api/login', {method: 'GET'});
        setAuthed(res.ok);
      } catch {
        setAuthed(false);
      }
      setReady(true);
    };
    check();
    const onLogout = () => setAuthed(false);
    window.addEventListener('painel:logout', onLogout);
    return () => window.removeEventListener('painel:logout', onLogout);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await window.fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        saveToken(data.token);
        setAuthed(true);
        setPassword('');
      } else {
        setError(data.error || 'Não foi possível entrar.');
      }
    } catch {
      setError('Sem conexão com o servidor.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;
  if (authed) return <App />;

  return (
    <div style={{minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f7fb', fontFamily: 'system-ui, sans-serif'}}>
      <form onSubmit={submit} style={{width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,.08)'}}>
        <h1 style={{fontSize: 20, margin: '0 0 4px'}}>Painel Girofy</h1>
        <p style={{margin: '0 0 16px', color: '#667', fontSize: 14}}>Digite a senha do painel.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Senha"
          style={{width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1px solid #ccd', fontSize: 16}}
        />
        {error && <p style={{color: '#c33', fontSize: 14, margin: '10px 0 0'}}>{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          style={{marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: 0, background: '#0b5cad', color: '#fff', fontSize: 16, fontWeight: 600}}
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

// Instalar no celular: Android/Chrome usa o evento; iPhone instala pelo menu Compartilhar.
function InstallButton() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) setInstalled(true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!deferred && !ios)) return null;

  return (
    <div style={{position: 'fixed', right: 12, bottom: 12, zIndex: 50}}>
      {ios && !deferred ? (
        <button
          onClick={() => setShowIosHelp(v => !v)}
          style={{padding: '10px 14px', borderRadius: 999, border: 0, background: '#0b5cad', color: '#fff', fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,.2)'}}
        >
          Instalar app
        </button>
      ) : (
        <button
          onClick={async () => {
            deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
          style={{padding: '10px 14px', borderRadius: 999, border: 0, background: '#0b5cad', color: '#fff', fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,.2)'}}
        >
          Instalar app
        </button>
      )}
      {showIosHelp && (
        <div style={{marginTop: 8, maxWidth: 240, background: '#fff', borderRadius: 12, padding: 12, fontSize: 13, boxShadow: '0 4px 14px rgba(0,0,0,.15)'}}>
          No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginGate />
    <InstallButton />
  </StrictMode>,
);
