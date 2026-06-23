import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import CreateTeam from './pages/CreateTeam';
import TeamDashboard from './pages/TeamDashboard';
import LandingPage from './pages/guest/LandingPage';
import PublicStatistics from './pages/guest/PublicStatistics';
import PublicStandings from './pages/guest/PublicStandings';
import PublicTeams from './pages/guest/PublicTeams';
import PublicMatches from './pages/guest/PublicMatches';
import MatchCentrePage from './pages/guest/MatchCentrePage';
import ScorerConsole from './components/scorer/ScorerConsole';
import TeamStaffConsole from './components/scorer/TeamStaffConsole';
import AdminScorer from './components/scorer/AdminScorer';
import ScoreViewReferee from './components/viewer/ScoreViewReferee';
import ScoreViewSpectator from './components/viewer/ScoreViewSpectator';
import ScoreSheet from './pages/ScoreSheet';
import RosterVerification from './pages/RosterVerification';
import MatchDetail from './components/MatchDetail';

// import App (หน้าเดิมที่เป็น Scoreboard) ไว้ใช้ทีหลัง
// import ScoreboardApp from './App_Original'; 

// Component ช่วยเช็คว่า Login หรือยัง (Private Route)
const PrivateRoute = ({ children, roleRequired }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  let role = null;

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      role = user.role;
    } catch (e) {
      console.error("Error parsing user data", e);
    }
  }

  // ถ้าไม่มี Token หรือ Role ให้ถือว่ายังไม่ Login
  if (!token || !role) return <Navigate to="/login" />;

  // ถ้าไม่ใช่ Role ที่ต้องการ (เช่น Admin) ให้เด้งไป Login
  if (roleRequired && role !== roleRequired) return <Navigate to="/login" />;

  return children;
};

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;