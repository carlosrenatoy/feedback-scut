-- 1. Popula o vocabulário inicial para a IA saber do que estamos falando
INSERT INTO public.domain_values (category, valor, sinonimos) VALUES
('perfil', 'R1', '{"primeiro ano", "r um", "r1"}'),
('perfil', 'R2', '{"segundo ano", "r dois", "r2"}'),
('perfil', 'R3', '{"terceiro ano", "r três", "r3"}'),
('perfil', 'residente externo', '{"externo", "residente de fora"}'),
('perfil', 'residente de emergência pediátrica', '{"res emerg ped", "emergência pediátrica"}'),
('perfil', 'residente de emergência geral', '{"res emerg geral", "emergência geral"}'),
('perfil', 'preceptor', '{"preceptora"}'),
('perfil', 'assistente', '{"médico assistente"}'),

('local_assistencial', 'porta', '{"triagem de porta", "porta da emergência"}'),
('local_assistencial', 'retaguarda', '{"reta", "retaguarda da emergência"}'),
('local_assistencial', 'sala de emergência', '{"salão", "sala vermelha", "sala de reanimação"}'),
('local_assistencial', 'triagem', '{"classificação de risco"}'),
('local_assistencial', 'passagem de plantão', '{"passagem", "troca de plantão"}'),
('local_assistencial', 'discussão de caso', '{"reunião clínica", "discussão clínica"}'),
('local_assistencial', 'telemedicina', '{"tele", "teleconsulta"}'),
('local_assistencial', 'transporte', '{"transporte inter-hospitalar", "UTI móvel"}'),

('tipo_feedback', 'procedimento', '{"proc", "procedimento técnico"}'),
('tipo_feedback', 'comportamento e postura profissional', '{"postura", "comportamento", "atitude"}'),
('tipo_feedback', 'comunicação', '{"comunicação médica", "comunicação com paciente", "comunicação com família"}'),
('tipo_feedback', 'discussão de caso', '{"discussão clínica", "raciocínio clínico"}'),
('tipo_feedback', 'evolução e condução clínica', '{"condução", "evolução"}'),
('tipo_feedback', 'passagem de plantão', '{"handover", "passagem"}'),
('tipo_feedback', 'supervisão e preceptoria', '{"supervisão", "preceptoria"}'),

('tema_especifico', 'intubação', '{"entubação", "intubou", "IOT"}'),
('tema_especifico', 'intraóssea', '{"IO", "punção intraóssea"}'),
('tema_especifico', 'coleta de sangue', '{"coleta venosa", "punção venosa"}'),
('tema_especifico', 'comunicação com paciente', '{"relação médico paciente"}'),
('tema_especifico', 'comunicação com família', '{"comunicação familiar", "notícia difícil"}'),
('tema_especifico', 'evolução da retaguarda', '{"evolução dos pacientes", "visita da reta"}'),
('tema_especifico', 'passagem de caso grave', '{"handover grave", "passagem de paciente crítico"}'),
('tema_especifico', 'atendimento inicial', '{"primeiro atendimento", "chegada do paciente"}');

