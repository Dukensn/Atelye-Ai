-- One model for the WhatsApp and team assistants: Gemini 4 Hydrogen (fast with thinking_level low, audio + tools).
alter table public.wa_konfig alter column gemini_model set default 'gemini-4-hydrogen';
update public.wa_konfig set gemini_model = 'gemini-4-hydrogen';
