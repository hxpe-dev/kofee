-- Add a new valid language in an existing db

-- Either add through supabase dashboard (table editor -> select correct table -> click on the arrow in the specific column -> edit column -> edit check constraints at the bottom)

-- Or run the following SQL commands

alter table snippets
drop constraint snippets_lang_valid;

alter table snippets
add constraint snippets_lang_valid
check (lang in ('js','ts','py','rs','css','bash','sql','html','json','[NEW_LANGUAGE]','other'));


alter table shared_snippets
drop constraint shared_snippets_lang_valid;

alter table shared_snippets
add constraint shared_snippets_lang_valid
check (lang in ('js','ts','py','rs','css','bash','sql','html','json','[NEW_LANGUAGE]','other'));