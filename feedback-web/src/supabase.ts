import { createClient } from '@supabase/supabase-js';

// Projeto Supabase "IA Nutri". A anon key e publica por design (vai no bundle
// do browser); a protecao de dados e via RLS. Fallback garante o build em
// qualquer host mesmo sem as VITE_* configuradas.
const FALLBACK_URL = 'https://ewshcwcpfvmujkuqinhk.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2hjd2NwZnZtdWprdXFpbmhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MzA1NDksImV4cCI6MjA1NDAwNjU0OX0.w-MqDsQBEpIDsC4rK_jPWMIfHP5Du-fxHs-G1Nvs1hM';

const url = (import.meta.env.VITE_SUPABASE_URL as string) || FALLBACK_URL;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || FALLBACK_ANON;

export const supabase = createClient(url, key);
