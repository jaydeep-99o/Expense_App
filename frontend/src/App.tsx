// src/App.tsx
import { Routes, Route, Navigate, Outlet, Link } from 'react-router-dom'
import AuthLogin from './pages/AuthLogin'
import AuthSignup from './pages/AuthSignup'
import ChangePassword from './pages/ChangePassword'
import { GuestOnly, RequireAuth, RequireRole } from './components/Protected'
import { getUser } from './lib/auth'

// actual pages
import AdminHome from './pages/AdminHome'
import AdminUsers from './pages/AdminUsers'
import AdminFlows from './pages/AdminFlows'
import ApprovalsQueue from './pages/ApprovalsQueue'
import ExpenseList from './pages/ExpenseList'
import ExpenseNew from './pages/ExpenseNew'
import ExpenseDetail from './pages/ExpenseDetail'

// role landing
function RoleLanding() {
  const u = getUser()
  if (!u) return <Navigate to="/login" replace />
  if (u.role === 'admin') return <Navigate to="/admin" replace />
  if (u.role === 'manager') return <Navigate to="/approvals" replace />
  return <Navigate to="/expenses" replace />
}

// simple shells (optional nav)
function AdminShell() {
  return (
    <div>
      <Outlet />
    </div>
  )
}
function EmployeeShell() {
  return (
    <div className="p-6">
      <Outlet />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* guests */}
      <Route path="/login" element={<GuestOnly><AuthLogin/></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><AuthSignup/></GuestOnly>} />
      {/* logged in (may be forced to change password by guard) */}
      <Route path="/change-password" element={<RequireAuth><ChangePassword/></RequireAuth>} />

      {/* ADMIN */}
      <Route path="/admin" element={<RequireRole roles={['admin']}><AdminShell/></RequireRole>}>
        <Route index element={<AdminHome/>} />
        <Route path="users" element={<AdminUsers/>} />
        <Route path="flows" element={<AdminFlows/>} />
      </Route>

      {/* MANAGER */}
      <Route path="/approvals" element={<RequireRole roles={['manager']}><ApprovalsQueue/></RequireRole>} />

      {/* EMPLOYEE */}
      <Route path="/expenses" element={<RequireRole roles={['employee']}><EmployeeShell/></RequireRole>}>
        <Route index element={<ExpenseList/>} />
        <Route path="new" element={<ExpenseNew/>} />
      </Route>

      <Route path="/expense/:id" element={<RequireRole roles={['manager','employee']}><ExpenseDetail/></RequireRole>} />

      {/* default & 404 */}
      <Route path="/" element={<RoleLanding />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}