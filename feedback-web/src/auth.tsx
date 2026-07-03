import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const MODULO = 'feedback';
const PAPEIS_OK = ['admin', 'avaliador'];

type Perm = { modulo: string; papel: string; expira_em: string | null; ativo: boolean };

type AuthState = {
  session: Session | null;
  perms: Perm[];
  loading: boolean;
  temAcesso: boolean;
  papel: string | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}

function acessoValido(perms: Perm[]): { ok: boolean; papel: string | null } {
  const agora = Date.now();
  const p = perms.find(
    (x) =>
      x.modulo === MODULO &&
      PAPEIS_OK.includes(x.papel) &&
      x.ativo &&
      (!x.expira_em || new Date(x.expira_em).getTime() > agora)
  );
  return { ok: !!p, papel: p?.papel ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPerms(s: Session | null) {
    if (!s) { setPerms([]); return; }
    const { data } = await supabase
      .from('permissoes')
      .select('modulo, papel, expira_em, ativo');
    setPerms((data as Perm[]) ?? []);
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadPerms(data.session);
  }

  useEffect(() => {
    let mounted = true;
    // Rede do auth nunca deve travar a tela: garante que loading resolve sempre.
    const safety = setTimeout(() => { if (mounted) setLoading(false); }, 8000);
    // Carga inicial fora do callback de auth (evita deadlock do lock do supabase)
    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        try { await loadPerms(data.session); } catch { /* offline */ }
      })
      .catch(() => { /* supabase inacessível */ })
      .finally(() => { if (mounted) { clearTimeout(safety); setLoading(false); } });
    // No callback NÃO chamamos supabase de forma síncrona (deferimos com setTimeout)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => { loadPerms(s); }, 0);
    });
    return () => { mounted = false; clearTimeout(safety); sub.subscription.unsubscribe(); };
  }, []);

  const { ok, papel } = acessoValido(perms);

  const value: AuthState = {
    session,
    perms,
    loading,
    temAcesso: ok,
    papel,
    signOut: async () => { await supabase.auth.signOut(); },
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg('Conta criada. Confirme pelo e-mail enviado e depois entre.');
          setModo('entrar');
        }
      }
    } catch (err: any) {
      setMsg(err?.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : (err?.message ?? 'Erro ao entrar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">Feedback SCUT</div>
        <p className="login-sub">{modo === 'entrar' ? 'Entre para continuar' : 'Criar conta de avaliador'}</p>

        {modo === 'criar' && (
          <input className="login-input" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        )}
        <input className="login-input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input className="login-input" type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} required minLength={6} />

        {msg && <div className="login-msg">{msg}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>

        <button type="button" className="login-toggle" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setMsg(null); }}>
          {modo === 'entrar' ? 'Não tem conta? Criar' : 'Já tenho conta — entrar'}
        </button>
      </form>
    </div>
  );
}

export function SemAcesso() {
  const { session, signOut } = useAuth();
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">Feedback SCUT</div>
        <p className="login-sub">Acesso não autorizado</p>
        <div className="login-msg">
          A conta <strong>{session?.user?.email}</strong> ainda não tem permissão no módulo de feedback.
          Peça ao administrador para liberar seu e-mail.
        </div>
        <button className="btn btn-secondary" onClick={signOut}>Sair</button>
      </div>
    </div>
  );
}
