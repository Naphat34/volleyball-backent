import PageBoundary from './components/PageBoundary';
import React, { lazy, Suspense } from 'react';
import { Feedback } from './components/ui/SystemUI';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CreateTeam = lazy(() => import('./pages/CreateTeam'));
const TeamDashboard = lazy(() => import('./pages/TeamDashboard'));
const LandingPage = lazy(() => import('./pages/guest/LandingPage'));
const PublicStatistics = lazy(() => import('./pages/guest/PublicStatistics'));
const PublicStandings = lazy(() => import('./pages/guest/PublicStandings'));
const PublicTeams = lazy(() => import('./pages/guest/PublicTeams'));
const PublicMatches = lazy(() => import('./pages/guest/PublicMatches'));
const MatchCentrePage = lazy(() => import('./pages/guest/MatchCentrePage'));
const ScorerConsole = lazy(() => import('./components/scorer/ScorerConsole'));
const TeamStaffConsole = lazy(() => import('./components/scorer/TeamStaffConsole'));
const AdminScorer = lazy(() => import('./components/scorer/AdminScorer'));
const ScoreViewReferee = lazy(() => import('./components/viewer/ScoreViewReferee'));
const ScoreViewSpectator = lazy(() => import('./components/viewer/ScoreViewSpectator'));
const ScoreSheet = lazy(() => import('./pages/ScoreSheet'));
const RosterVerification = lazy(() => import('./pages/RosterVerification'));
const MatchDetail = lazy(() => import('./components/MatchDetail'));
import { getAuthToken, getStoredUser } from './authStorage';

// import App (หน้าเดิมที่เป็น Scoreboard) ไว้ใช้ทีหลัง
// import ScoreboardApp from './App_Original'; 

// Component ช่วยเช็คว่า Login หรือยัง (Private Route)
const PrivateRoute = ({ children, roleRequired }) => {
  const token = getAuthToken();
  const user = getStoredUser();
  const role = user?.role || null;

  // ถ้าไม่มี Token หรือ Role ให้ถือว่ายังไม่ Login
  if (!token || !role) return <Navigate to="/login" />;

  // ถ้าไม่ใช่ Role ที่ต้องการ (เช่น Admin) ให้เด้งไป Login
  if (roleRequired && role !== roleRequired) return <Navigate to="/login" />;

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <PageBoundary>
      <Suspense fallback={<div className="app-page flex min-h-screen items-center justify-center p-6"><Feedback title="กำลังเปิดหน้า / Loading page…" /></div>}>
      <Routes>
        {/* หน้า AdminScorer สำหรับ role score */}
        <Route
          path="/adminscorer"
          element={
            <PrivateRoute roleRequired="score">
              <AdminScorer />
            </PrivateRoute>
          }
        />
        {/* เพิ่ม Route สำหรับจัดการ Champion (ป้องกันการเด้งไป Login) */}
        <Route
          path="/admin/champion/:competitionId"
          element={
            <PrivateRoute roleRequired="score">
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
            <PrivateRoute>
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

        {/* ✅ ย้ายมาไว้ตรงนี้ครับ (ต้องอยู่ก่อนตัว * เสมอ) */}
        <Route path="/stats" element={<PublicStatistics />} />
        <Route path="/standings" element={<PublicStandings />} /> {/* ✅ เพิ่ม Route นี้ */}
        <Route path="/teams" element={<PublicTeams />} /> {/* ✅ เพิ่ม Route นี้ */}
        <Route path="/matches" element={<PublicMatches />} />
        <Route path="/match-centre/:matchId" element={<MatchCentrePage />} />

        {/* ⛔️ ตัวดักจับ URL ผิด (Catch-all) ต้องเอาไว้ล่างสุดเสมอ! */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
      </Suspense>
      </PageBoundary>
    </BrowserRouter>
  );
}

export default App;
