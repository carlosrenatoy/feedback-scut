import { openDB } from 'idb';

const DB_NAME = 'feedback-scut';
const DB_VERSION = 1;

export interface FeedbackLocal {
  id: string;
  audioBlob?: Blob;
  audioUri?: string;
  status: string;
  data_evento: string;
  duracao_segundos?: number;
  ia_pessoa_sugerida?: string;
  ia_pessoa_confianca?: number;
  campos_ia?: string;
  campos_incertos?: string[];
  transcricao?: string;
  relatorio?: string;
  local_inferido?: string;
  tipo_feedback_inferido?: string;
  tema_especifico_inferido?: string;
  perfil_no_momento?: string;
  passagem?: string;
  autonomia_sugerida?: string;
  nota_sugerida?: number;
  campos_revisados?: string;
  sincronizado?: boolean;
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('feedbacks')) {
        db.createObjectStore('feedbacks', { keyPath: 'id' });
      }
    },
  });
}

export async function saveFeedbackLocal(fb: FeedbackLocal) {
  const db = await getDB();
  await db.put('feedbacks', fb);
}

export async function getFeedbacksLocal(): Promise<FeedbackLocal[]> {
  const db = await getDB();
  const all = await db.getAll('feedbacks');
  return all.sort((a, b) => b.data_evento.localeCompare(a.data_evento));
}

export async function getFeedbackLocal(id: string): Promise<FeedbackLocal | undefined> {
  const db = await getDB();
  return db.get('feedbacks', id);
}

export async function updateFeedbackLocal(id: string, updates: Partial<FeedbackLocal>) {
  const db = await getDB();
  const existing = await db.get('feedbacks', id);
  if (existing) {
    await db.put('feedbacks', { ...existing, ...updates });
  }
}

export async function deleteFeedbackLocal(id: string) {
  const db = await getDB();
  await db.delete('feedbacks', id);
}

export async function getPendingSync(): Promise<FeedbackLocal[]> {
  const db = await getDB();
  const all = await db.getAll('feedbacks');
  return all.filter(fb => !fb.sincronizado && fb.audioBlob && fb.status === 'salvo_local');
}
