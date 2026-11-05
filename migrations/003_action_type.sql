-- 클레임 처리 유형 컬럼 추가
ALTER TABLE claims ADD COLUMN IF NOT EXISTS action_type text;
