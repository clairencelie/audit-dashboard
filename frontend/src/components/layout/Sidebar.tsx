import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  Users,
  LogOut,
  ClipboardList,
  Building2,
  ChevronRight,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles?: string[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/audit-projects', icon: <FolderOpen className="w-5 h-5" />, label: 'Audit Projects' },
  { to: '/approvals', icon: <CheckSquare className="w-5 h-5" />, label: 'Approvals', roles: ['spv', 'dept_head', 'div_head'] },
  { to: '/master-data/users', icon: <Users className="w-5 h-5" />, label: 'Users', roles: ['admin', 'div_head', 'dept_head'] },
  { to: '/master-data/auditees', icon: <Building2 className="w-5 h-5" />, label: 'Auditees', roles: ['admin', 'div_head', 'dept_head', 'spv'] },
  { to: '/master-data', icon: <ClipboardList className="w-5 h-5" />, label: 'Master Data', roles: ['admin'] },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  )

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-white">Audit Dashboard</p>
            <p className="text-xs text-slate-400">Internal Audit System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
            {user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-900/30 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
