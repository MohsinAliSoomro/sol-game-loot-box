import './App.css'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './Pages/Login'
import Dashboard from './Pages/Dashboard'
import Users from './Pages/Users'
import Settings from './Pages/Settings'
import WebsiteSettings from './Pages/WebsiteSettings'
import LootboxRewards from './Pages/LootboxRewards'
import JackpotSettings from './Pages/JackpotSettings'
import TokenManagement from './Pages/TokenManagement'
import ProjectManagement from './Pages/ProjectManagement'
import Layout from './components/Layout'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
          <Route path="website-settings" element={<WebsiteSettings />} />
          <Route path="token-management" element={<TokenManagement />} />
          <Route path="project-management" element={<ProjectManagement />} />
          <Route path="jackpot-settings" element={<JackpotSettings />} />
          <Route path="lootbox/:id/rewards" element={<LootboxRewards />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
