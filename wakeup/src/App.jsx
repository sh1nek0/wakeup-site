import PlayersTable from "./GamePage/GamePage.jsx"
import { Route, Routes, useLocation } from "react-router-dom"; // добавлено useLocation
import NavBar from "./NavBar/Navbar.jsx"
import HomePage from "./HomePage/HomePage.jsx"
import RatingPage from "./RaitingPage/RaitingPage.jsx";
import LoginPage from "./LoginPage/LoginPage.jsx";
import EventsPage from "./EventPage/EventPage.jsx";
import Footer from "./Footer/Footer.jsx";
import RoadToBreak from "./BTS/BTS.jsx";
import Game from "./Event/Event.jsx";
import React, { useEffect, createContext, useState, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import ProfilePage from "./ProfilePage/ProfilePage.jsx";
import PlayersListPage from "./PlayersListPage/PlayersListPage.jsx"; // <-- ИМПОРТ НОВОГО КОМПОНЕНТА
import GameWidget from "./gameWidget/gameWidget.jsx";

// --- AuthContext Logic ---
export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        const decodedToken = jwtDecode(storedToken);
        if (decodedToken.exp * 1000 > Date.now()) {
          const userData = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
          setIsAdmin(userData.role === 'admin');
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      console.error("Failed to initialize auth state:", error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((userData, userToken) => {
    localStorage.setItem('token', userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(userToken);
    setUser(userData);
    setIsAuthenticated(true);
    setIsAdmin(userData.role === 'admin');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
  }, []);

  const authContextValue = { user, token, isAuthenticated, isAdmin, loading, login, logout };

  return (
    <AuthContext.Provider value={authContextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
// --- End AuthContext Logic ---

const footerData = {
  ownerName: "© 2025 Company",
  copyright: "Ростислав Долматович",
  adress: "г.Москва г.Зеленоград Юности 11",
  contacts: {
    telegram: "https://t.me/ret1w",
    vk: "https://vk.com/ret1w",
  }
};

export function App(props) {
  const location = useLocation(); // получаем текущий путь
  
  // проверяем, является ли текущая страница /Event/.../gameWidget
  const hideNavbarAndFooter = location.pathname.startsWith('/Event/') && location.pathname.endsWith('/gameWidget');

  useEffect(() => {
    document.title = "WakeUp Mafia";
  }, []);

  return (
    <AuthProvider>
      {!hideNavbarAndFooter && <NavBar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/Event/:eventId/Game/:gameId" element={<PlayersTable />} />
        <Route path="/rating" element={<RatingPage/>} />
        <Route path="/players" element={<PlayersListPage />} /> {/* Новый маршрут */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/BTS" element={<RoadToBreak />}/>
        <Route path="/Event/:evenId" element={<Game />} />
        <Route path="/profile/:profileId" element={<ProfilePage />} />
        {/* Обратите внимание — путь /Event/:eventId/Game/:gameId/gameWidget остается, и он не отображает Navbar и Footer */}
        <Route path="/Event/:eventId/Game/:gameId/gameWidget" element={<GameWidget />} />
      </Routes>
      {!hideNavbarAndFooter && <Footer data={footerData} />}
    </AuthProvider>
  );
}

export default App;