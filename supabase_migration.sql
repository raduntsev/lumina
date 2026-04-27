-- Добавление колонки target_user_id в таблицу checklists
ALTER TABLE checklists ADD COLUMN target_user_id UUID REFERENCES auth.users(id);

-- Создание индекса для производительности
CREATE INDEX idx_checklists_target_user_id ON checklists(target_user_id);

-- Таблица space_members не нужна, поскольку участники связаны через profiles.space_id

-- Обновить RLS политику для checklists insert, чтобы target_user_id был в том же space
DROP POLICY IF EXISTS "checklists: space members can insert" ON checklists;
CREATE POLICY "checklists: space members can insert"
  ON checklists FOR INSERT
  WITH CHECK (
    space_id = get_my_space_id()
    AND user_id = auth.uid()
    AND target_user_id IN (
      SELECT id FROM profiles WHERE space_id = get_my_space_id()
    )
  );