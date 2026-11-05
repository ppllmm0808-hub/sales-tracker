-- 클레임 공유 토큰 컬럼 추가
ALTER TABLE claims ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
