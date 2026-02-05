import { useState } from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navLinks = [
  { name: 'Dashboard', path: '/' },
  { name: 'Users', path: '/users' },
  {
    name: 'Settings',
    subItems: [
      { name: 'Lootbox Settings', path: '/settings' },
      { name: 'Jackpot Settings', path: '/jackpot-settings' },
      { name: 'Website Settings', path: '/website-settings' },
      { name: 'Token Management', path: '/token-management' },
    ],
  },
];

function getPageTitle(pathname) {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/users')) return 'Users';
  if (pathname.startsWith('/settings') && pathname !== '/website-settings' && pathname !== '/token-management') return 'Lootbox Settings';
  if (pathname.startsWith('/jackpot-settings')) return 'Jackpot Settings';
  if (pathname.startsWith('/website-settings')) return 'Website Settings';
  if (pathname.startsWith('/token-management')) return 'Token Management';
  if (pathname.startsWith('/lootbox/')) return 'Lootbox Rewards';
  return '';
}

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const pageTitle = getPageTitle(location.pathname);
  const [openSettings, setOpenSettings] = useState(location.pathname.startsWith('/settings') || location.pathname.startsWith('/jackpot-settings') || location.pathname.startsWith('/website-settings') || location.pathname.startsWith('/token-management'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col h-full z-30 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-center border-b border-gray-100">
          <span className="text-xl font-bold text-orange-500">Lootbox Admin</span>
        </div>
        <nav className="flex-1 py-6 px-4">
          <ul className="space-y-2">
            {navLinks.map(link => (
              <li key={link.name}>
                {link.subItems ? (
                  <div>
                    <button
                      onClick={() => setOpenSettings(!openSettings)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                    >
                      <span>{link.name}</span>
                      <svg className={`w-4 h-4 transition-transform ${openSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {openSettings && (
                      <ul className="pl-4 pt-2 space-y-1">
                        {link.subItems.map(subLink => (
                          <li key={subLink.name}>
                            <NavLink
                              to={subLink.path}
                              onClick={() => setSidebarOpen(false)}
                              className={({ isActive }) =>
                                `flex items-center px-4 py-2 rounded-lg transition-colors text-sm font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-600 ${
                                  isActive ? 'bg-orange-100 text-orange-600' : ''
                                }`
                              }
                            >
                              {subLink.name}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={link.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 rounded-lg transition-colors font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 ${
                        isActive ? 'bg-orange-100 text-orange-600' : ''
                      }`
                    }
                    end={link.path === '/'}
                  >
                    {link.name}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-6 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 font-semibold">
                  {user?.username?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.username || 'Admin'}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white flex items-center justify-between px-4 md:px-8 border-b border-gray-100 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
          <div className="w-6 h-6 md:hidden"></div> {/* Spacer for mobile title centering */}
        </header>
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;