import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Route, Routes } from 'react-router-dom'
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
