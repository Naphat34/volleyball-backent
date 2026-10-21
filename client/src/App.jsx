import PageBoundary from './components/layout/PageBoundary';
import React, { lazy, Suspense } from 'react';
import { Feedback } from './components/ui/SystemUI';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const CreateTeam = lazy(() => import('./pages/team/CreateTeam'));
const TeamDashboard = lazy(() => import('./pages/team/TeamDashboard'));
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const PublicStatistics = lazy(() => import('./pages/public/PublicStatistics'));
const PublicStandings = lazy(() => import('./pages/public/PublicStandings'));
const PublicTeams = lazy(() => import('./pages/public/PublicTeams'));
const PublicMatches = lazy(() => import('./pages/public/PublicMatches'));
const MatchCentrePage = lazy(() => import('./pages/public/MatchCentrePage'));
const PublicVisMatch = lazy(() => import('./pages/public/PublicVisMatch'));
const ScorerConsole = lazy(() => import('./pages/scorer/ScorerConsole'));
const TeamStaffConsole = lazy(() => import('./pages/scorer/TeamStaffConsole'));
const AdminScorer = lazy(() => import('./pages/scorer/AdminScorer'));
const AdminVis = lazy(() => import('./pages/vis/AdminVis'));
const ScorerOfflineHome = lazy(() => import('./pages/scorer/ScorerOfflineHome'));
const ScoreViewReferee = lazy(() => import('./components/viewer/ScoreViewReferee'));
const ScoreViewSpectator = lazy(() => import('./components/viewer/ScoreViewSpectator'));
const ScoreSheet = lazy(() => import('./pages/reports/ScoreSheet'));
const RosterVerification = lazy(() => import('./pages/reports/RosterVerification'));
const MatchDetail = lazy(() => import('./pages/matches/MatchDetail'));
import useAccessSession from './hooks/useAccessSession';
import OfflineMatchGate from './components/auth/OfflineMatchGate';

// import App (หน้าเดิมที่เป็น Scoreboard) ไว้ใช้ทีหลัง
// import ScoreboardApp from './App_Original';

// Component ช่วยเช็คว่า Login หรือยัง (Private Route)
const PrivateRoute = ({ children, roleRequired }) => {
  const session = useAccessSession();
  const user = session.user;
  const role = user?.role || null;

  // ถ้าไม่มี Token หรือ Role ให้ถือว่ายังไม่ Login
  const offlineAllowed = session.kind === 'offline' && /^\/(?:adminvis(?:\/|$)|adminscorer(?:\/|$)|scorer\/\d+(?:\/|$)|scorer-offline(?:\/|$))/.test(window.location.pathname);
  if ((session.kind !== 'online' && !offlineAllowed) || !role) return <Navigate to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`} />;

  // ถ้าไม่ใช่ Role ที่ต้องการ (เช่น Admin) ให้เด้งไป Login
  const allowedRoles = Array.isArray(roleRequired) ? roleRequired : roleRequired ? [roleRequired] : [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) return <Navigate to="/login" />;

  return <OfflineMatchGate session={session}>{children}</OfflineMatchGate>;
};

function App() {
  return (
    <BrowserRouter>
      <PageBoundary>
      <Suspense fallback={<div className="app-page flex min-h-screen items-center justify-center p-6"><Feedback title="กำลังเปิดหน้า / Loading page…" /></div>}>
      <Routes>
        <Route path="/scorer-offline" element={<PrivateRoute roleRequired={['admin','score','scorer','statistician']}><ScorerOfflineHome /></PrivateRoute>} />
        <Route path="/adminvis" element={<PrivateRoute roleRequired={['admin', 'statistician']}><AdminVis /></PrivateRoute>} />
        <Route path="/adminvis/match/:matchId" element={<PrivateRoute roleRequired={['admin', 'statistician']}><AdminVis /></PrivateRoute>} />
        {/* หน้า AdminScorer สำหรับ role score */}
        <Route
          path="/adminscorer"
          element={
            <PrivateRoute roleRequired={['admin', 'score', 'scorer', 'statistician', 'referee']}>
              <AdminScorer />
            </PrivateRoute>
          }
        />
        {/* เพิ่ม Route สำหรับจัดการ Champion (ป้องกันการเด้งไป Login) */}
        <Route
          path="/admin/champion/:competitionId"
          element={
            <PrivateRoute roleRequired={['score', 'scorer', 'statistician']}>
              <MatchDetail />
            </PrivateRoute>
          }
        />
        {/* หน้าแรกให้เป็น Guest Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* หน้า Login/Register */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* หน้า Admin (ต้องเป็น admin เท่านั้น) */}
        <Route
          path="/admin"
          element={
            <PrivateRoute roleRequired="admin">
              <AdminDashboard />
            </PrivateRoute>
          }
        />

        {/* หน้าสร้างทีม */}
        <Route
          path="/create-team"
          element={
            <PrivateRoute>
              <CreateTeam />
            </PrivateRoute>
          }
        />

        {/* หน้าจัดการทีม (Dashboard) */}
        <Route
          path="/team-dashboard"
          element={
            <PrivateRoute>
              <TeamDashboard />
            </PrivateRoute>
          }
        />

        {/* หน้า Scorer Console (สำหรับ Admin/Staff) */}
        <Route
          path="/scorer/:matchId"
          element={
            <PrivateRoute roleRequired={['admin', 'score', 'scorer', 'statistician']}>
              <ScorerConsole />
            </PrivateRoute>
          }
        />
        {/* หน้าสำหรับเจ้าหน้าที่ทีม (Staff) */}
        <Route
          path="/staff/:matchId"
          element={
            <PrivateRoute>
              <TeamStaffConsole />
            </PrivateRoute>
          }
        />
        <Route path="/match/:matchId/referee" element={<ScoreViewReferee />} />
        <Route path="/match/:matchId/viewer" element={<ScoreViewSpectator />} />
        <Route path="/scorer/:matchId/viewer" element={<ScoreViewSpectator />} />
        <Route path="/scoresheet/:matchId" element={<ScoreSheet />} />
        <Route path="/roster-verification/:matchId" element={<RosterVerification />} />
        <Route path="/match/:matchId" element={<MatchDetail />} />

        {/* ย้ายมาไว้ตรงนี้ครับ (ต้องอยู่ก่อนตัว * เสมอ) */}
        <Route path="/stats" element={<PublicStatistics />} />
        <Route path="/standings" element={<PublicStandings />} />
        <Route path="/teams" element={<PublicTeams />} />
        <Route path="/matches" element={<PublicMatches />} />
        <Route path="/match-centre/:matchId" element={<MatchCentrePage />} />
        <Route path="/vis-live/:token" element={<PublicVisMatch />} />

        {/* ตัวดักจับ URL ผิด (Catch-all) ต้องเอาไว้ล่างสุดเสมอ! */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
      </Suspense>
      </PageBoundary>
    </BrowserRouter>
  );
}

export default App;
