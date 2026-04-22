CREATE TABLE IF NOT EXISTS case_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size_bytes INT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view docs for their cases" ON case_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM cases c JOIN pets p ON c.pet_id = p.id WHERE c.id = case_documents.case_id AND (p.owner_id = auth.uid() OR c.assigned_buddy_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin','vet_buddy','external_vet'))))
);
CREATE POLICY "Authenticated users can insert docs" ON case_documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins and buddies can delete docs" ON case_documents FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin','vet_buddy'))
);
