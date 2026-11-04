-- 클레임 관리 테이블
CREATE TABLE IF NOT EXISTS claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  company text NOT NULL,
  contact text,
  phone text,
  category text NOT NULL DEFAULT '기타',  -- 불량/배송/AS/계약/기타
  content text NOT NULL,
  status text NOT NULL DEFAULT '접수',    -- 접수/처리중/완료
  action_taken text,
  photos text[] DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- 본인 클레임 조회
CREATE POLICY "own claims select" ON claims
  FOR SELECT USING (auth.uid() = user_id);

-- 관리자 전체 조회
CREATE POLICY "admin claims select" ON claims
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
  );

-- 본인 클레임 등록
CREATE POLICY "own claims insert" ON claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 클레임 수정
CREATE POLICY "own claims update" ON claims
  FOR UPDATE USING (auth.uid() = user_id);

-- 관리자 수정 (조치 내용, 상태 변경)
CREATE POLICY "admin claims update" ON claims
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
  );

-- 본인 클레임 삭제
CREATE POLICY "own claims delete" ON claims
  FOR DELETE USING (auth.uid() = user_id);

-- Storage 버킷은 Supabase 대시보드 → Storage → New bucket → "claim-photos" (Public) 으로 생성
