import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Route, Routes } from 'react-router-dom'
import Login from './AdminPages/Login'
import Dashboard from './AdminPages/Dashboard'
import Users from './AdminPages/Users'
import Settings from './AdminPages/Settings'
import WebsiteSettings from './AdminPages/WebsiteSettings'
import LootboxRewards from './AdminPages/LootboxRewards'
import JackpotSettings from './AdminPages/JackpotSettings'
import TokenManagement from './AdminPages/TokenManagement'
import ProjectManagement from './AdminPages/ProjectManagement'
import Layout from './components/Layout'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
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
  )
}

export default App
