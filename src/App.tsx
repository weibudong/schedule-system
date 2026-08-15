import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import Login from './pages/Login';
import CurrentWork from './pages/CurrentWork';
import Performance from './pages/Performance';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUser();
  if (!currentUser) {
    return <Login />;
  }
  return <>{children}</>;
}

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><CurrentWork /></ProtectedRoute>} />
        <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}