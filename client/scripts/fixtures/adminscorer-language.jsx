import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { setAuthSession } from '../../src/auth/authStorage';
import { writeDashboardCache } from '../../src/offline/scorerDashboardCache';
import AdminScorer from '../../src/pages/scorer/AdminScorer';
import VisTheme from '../../src/components/vis/VisTheme';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';

Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
setAuthSession({ token: 'fixture-token', user: { id: 7, username: 'Fixture scorer', role: 'scorer' } });
async function start() {
    if (!localStorage.getItem('adminscorer-fixture-seeded')) {
        localStorage.setItem('language', 'ENG');
        await writeDashboardCache(7, 'scorer', 'server', {
            competitions: [{ id: 7, title: 'รายการภาษาไทย', title_th: 'รายการภาษาไทย', title_en: 'English Championship', status: 'open' }],
            matches: [{ id: 42, competition_id: 7, competition_name: 'รายการภาษาไทย', match_number: 1, home_team: 'Alpha', away_team: 'Beta', age_group_name: 'U18', gender: 'Male', status: 'scheduled', location: 'Fixture venue' }],
        });
        localStorage.setItem('adminscorer-fixture-seeded', 'true');
    }
    createRoot(document.getElementById('root')).render(<LanguageProvider><VisTheme><BrowserRouter><AdminScorer/></BrowserRouter></VisTheme></LanguageProvider>);
}
void start();
