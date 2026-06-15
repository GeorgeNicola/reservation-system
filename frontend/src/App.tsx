import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar/Navbar';
import ToastContainer from './components/Toast/Toast';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import ClinicsList from './pages/ClinicsList/ClinicsList';
import ClinicDetail from './pages/ClinicDetail/ClinicDetail';
import CreateClinic from './pages/CreateClinic/CreateClinic';
import MyClinic from './pages/MyClinic/MyClinic';
import MyReservations from './pages/MyReservations/MyReservations';

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/clinics" element={<ClinicsList />} />
        <Route path="/clinics/:id" element={<ClinicDetail />} />
        <Route
          path="/create-clinic"
          element={<ProtectedRoute><CreateClinic /></ProtectedRoute>}
        />
        <Route
          path="/my-clinic"
          element={<ProtectedRoute><MyClinic /></ProtectedRoute>}
        />
        <Route
          path="/my-reservations"
          element={<ProtectedRoute><MyReservations /></ProtectedRoute>}
        />
      </Routes>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
