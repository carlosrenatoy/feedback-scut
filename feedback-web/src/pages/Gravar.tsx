import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveFeedbackLocal, getFeedbacksLocal, updateFeedbackLocal, type FeedbackLocal } from '../db';
import { syncFeedback, checkRemoteStatus } from '../sync';

const STATUS_LABEL: Record<string, string> = {
  gravando: 'Gravando…',
  salvo_local: 'Salvo',
  enviando: 'Enviando…',
  aguardando_sincronizacao: 'Aguardando IA',
  processando_ia: 'Processando IA…',
  pronto_para_revisao: 'Pronto para revisão',
  revisado: 'Revisado',
  liberado_ao_residente: 'Liberado ao residente',
  erro_ia: 'Erro — formato inválido',
};

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;
  return d.toLocaleDateString('pt-BR') + `, ${hora}`;
}

function formatDuration(s?: number) {
  if (!s) return '';
  return ` · ${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}s`;
}

export default function Gravar() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedbacks, setFeedbacks] = useState<FeedbackLocal[]>([]);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadFeedbacks().then(async (fbs) => {
      const pending = fbs.filter(f =>
        f.status === 'aguardando_sincronizacao' || f.status === 'processando_ia'
      );
      for (const fb of pending) {
        const status = await checkRemoteStatus(fb.id);
        if (status === 'pronto_para_revisao') {
          await loadFeedbacks();
        } else if (status === 'aguardando_sincronizacao' || status === 'processando_ia') {
          startPolling(fb.id);
        }
      }
    });
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      pollingRef.current && clearInterval(pollingRef.current);
    };
  }, []);

  async function loadFeedbacks() {
    const all = await getFeedbacksLocal();
    setFeedbacks(all.slice(0, 20));
    return all.slice(0, 20);
  }

  async function doSync(id: string) {
    setSyncing(prev => new Set(prev).add(id));
    const ok = await syncFeedback(id);
    setSyncing(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (ok) {
      await loadFeedbacks();
      startPolling(id);
    }
  }

  function startPolling(id: string) {
    pollingRef.current && clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const status = await checkRemoteStatus(id);
      await loadFeedbacks();
      if (status === 'pronto_para_revisao' || !status) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
      }
    }, 5000);
  }

  // Chamado quando o arquivo vem do gravador nativo OU de um arquivo anexado
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = crypto.randomUUID();
    await saveFeedbackLocal({
      id,
      audioBlob: file,
      status: 'salvo_local',
      data_evento: new Date().toISOString(),
      sincronizado: false,
    });
    await loadFeedbacks();
    doSync(id);
    e.target.value = '';
  }

  // Gravador do navegador — fallback para desktop
  async function startBrowserRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {}
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRef.current = mr;
      const id = crypto.randomUUID();
      currentIdRef.current = id;
      await saveFeedbackLocal({ id, status: 'gravando', data_evento: new Date().toISOString() });
      await loadFeedbacks();
      setTimer(0);
      setRecording(true);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch {
      alert('Permita o acesso ao microfone para gravar.');
    }
  }

  async function stopBrowserRec() {
    if (!mediaRef.current || !currentIdRef.current) return;
    const id = currentIdRef.current;
    mediaRef.current.stop();
    mediaRef.current.stream.getTracks().forEach(t => t.stop());
    timerRef.current && clearInterval(timerRef.current);
    wakeLockRef.current?.release();
    await new Promise<void>(res => { mediaRef.current!.onstop = () => res(); });
    const blob = new Blob(chunksRef.current, { type: mediaRef.current.mimeType });
    await updateFeedbackLocal(id, { audioBlob: blob, status: 'salvo_local', duracao_segundos: timer, sincronizado: false });
    setRecording(false);
    setTimer(0);
    currentIdRef.current = null;
    mediaRef.current = null;
    await loadFeedbacks();
    doSync(id);
  }

  return (
    <div>
      <div className="topbar">
        <h1>🎙️ Feedback App</h1>
        <span className="topbar-badge">Avaliador</span>
      </div>

      <div className="screen">
        <div className="record-wrap">
          {/* Gravador embutido (mobile e desktop) — sem limite de tempo */}
          <button
            className={`btn-record ${recording ? 'recording' : ''}`}
            onClick={recording ? stopBrowserRec : startBrowserRec}
          >
            <span className="btn-icon">{recording ? '⏹' : '🎙️'}</span>
            <span>{recording ? 'PARAR' : 'GRAVAR NOVO'}</span>
            {recording && <span className="btn-timer">{formatTime(timer)}</span>}
          </button>
        </div>

        <p className="hint">
          {recording ? 'Gravando… fale livremente (sem limite de tempo)' : 'Toque para gravar · sem limite de tempo'}
        </p>

        <div className="attach-box">
          <p className="attach-label">Anexar arquivo de áudio já gravado:</p>
          <label className="btn-attach" style={{ display: 'inline-block', cursor: 'pointer', position: 'relative' }}>
            📎 Anexar arquivo
            <input
              type="file"
              onChange={handleFile}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
          </label>
        </div>

        {feedbacks.length > 0 && (
          <>
            <div className="section-title">Feedbacks Recentes</div>
            {feedbacks.map(fb => {
              const isSyncing = syncing.has(fb.id);
              const statusKey = isSyncing ? 'enviando' : fb.status;
              return (
                <div key={fb.id} className="card" onClick={() => {
                  if (fb.status === 'pronto_para_revisao') navigate(`/revisar/${fb.id}`);
                }}>
                  <div className="meta">
                    {formatDate(fb.data_evento)}{formatDuration(fb.duracao_segundos)}
                  </div>
                  <h3>
                    {fb.ia_pessoa_sugerida
                      ? `Feedback · ${fb.ia_pessoa_sugerida}${fb.autonomia_sugerida ? ` (${fb.autonomia_sugerida})` : ''}`
                      : 'Novo Feedback'}
                  </h3>
                  {fb.local_inferido && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--subtle)', marginBottom: 4 }}>
                      📍 {fb.local_inferido}{fb.tipo_feedback_inferido ? ` · ${fb.tipo_feedback_inferido}` : ''}
                    </div>
                  )}
                  <p style={{ marginTop: 6 }}>
                    <span className={`badge-status s-${statusKey}`}>
                      {STATUS_LABEL[statusKey] || statusKey}
                    </span>
                  </p>
                  {fb.status === 'pronto_para_revisao' && (
                    <button className="btn btn-primary" style={{ marginTop: 12 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/revisar/${fb.id}`); }}>
                      Revisar Feedback da IA →
                    </button>
                  )}
                  {fb.status === 'erro_ia' && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 6 }}>
                      Formato de áudio não suportado. Use o Gravador de Voz do iPhone.
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {feedbacks.length === 0 && !recording && (
          <div className="empty-state">
            <div className="empty-icon">🎙️</div>
            <h2>Nenhum feedback ainda</h2>
            <p>Toque no botão acima para gravar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
