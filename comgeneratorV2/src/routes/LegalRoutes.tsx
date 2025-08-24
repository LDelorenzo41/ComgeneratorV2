import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MentionsLegalesPage } from '../pages/legal/MentionsLegalesPage';
import { PolitiqueConfidentialitePage } from '../pages/legal/PolitiqueConfidentialitePage';
import { CguPage } from '../pages/legal/CguPage';
import { CgvPage } from '../pages/legal/CgvPage';

export function LegalRoutes() {
  return (
    <Routes>
      <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
      <Route path="/politique-confidentialite" element={<PolitiqueConfidentialitePage />} />
      <Route path="/cgu" element={<CguPage />} />
      <Route path="/cgv" element={<CgvPage />} />
    </Routes>
  );
}