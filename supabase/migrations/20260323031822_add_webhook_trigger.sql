create extension if not exists pg_net with schema extensions;

CREATE OR REPLACE FUNCTION public.invoke_edge_function()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://kawbbdgeczsidrnrkjjg.supabase.co/functions/v1/process-feedback',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imthd2JiZGdlY3pzaWRybnJrampnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIzNDE3NSwiZXhwIjoyMDg5ODEwMTc1fQ.-3XOfq1JuIQZ7yeAtB8c5Svzf6AXbsmmp2-JZ_zpX7Y"}'::jsonb,
    body := json_build_object('type', TG_OP, 'record', row_to_json(NEW))::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_process_feedback ON public.feedbacks;
CREATE TRIGGER trigger_process_feedback
AFTER INSERT ON public.feedbacks
FOR EACH ROW
EXECUTE FUNCTION public.invoke_edge_function();
