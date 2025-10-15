import React, { useEffect, createContext, useState, useCallback } from 'react';
import { Route, Routes, useLocation } from "react-router-dom";
import { jwtDecode } from 'jwt-decode';

import NavBar from "./NavBar/Navbar.jsx";
import HomePage from "./HomePage/HomePage.jsx";
import RatingPage from "./RaitingPage/RaitingPage.jsx";
import LoginPage from "./LoginPage/LoginPage.jsx";
import EventsPage from "./EventPage/EventPage.jsx";
import Footer from "./Footer/Footer.jsx";
import RoadToBreak from "./BTS/BTS.jsx";
import Game from "./Event/Event.jsx";
import ProfilePage from "./ProfilePage/ProfilePage.jsx";
import PlayersTable from "./GamePage/GamePage.jsx";
import PlayersListPage from "./PlayersListPage/PlayersListPage.jsx";
import GameWidget from "./gameWidget/gameWidget.jsx";
import NotificationsPage from "./NotificationsPage/NotificationsPage.jsx";

// --- AuthContext ---
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = useCallback((token) => {
    localStorage.setItem("token", token);
    const decoded = jwtDecode(token);
    setUser(decoded);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
      } catch (e) {
        console.error("Ошибка декодирования токена", e);
        localStorage.removeItem("token");
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Footer Info ---
const footerData = {
  ownerName: "© 2025 Company",
  copyright: "Ростислав Долматович",
  adress: "г.Москва г.Зеленоград Юности 11",
  contacts: {
    telegram: "https://t.me/ret1w",
    vk: "https://vk.com/ret1w",
  },
};

// --- Main App ---
export function App() {
  const location = useLocation();

  // скрываем Navbar и Footer только на gameWidget
  const hideNavbarAndFooter =
    location.pathname.startsWith('/Event/') &&
    location.pathname.endsWith('/gameWidget');

  useEffect(() => {
    document.title = "WakeUp Mafia";
  }, []);

  return (
    <AuthProvider>
      {!hideNavbarAndFooter && <NavBar />}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rating" element={<RatingPage />} />
        <Route path="/players" element={<PlayersListPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/BTS" element={<RoadToBreak />} />
        <Route path="/Event/:eventId" element={<Game />} />
        <Route path="/Event/:eventId/Game/:gameId" element={<PlayersTable />} />
        <Route path="/Event/:eventId/Game/:gameId/gameWidget" element={<GameWidget />} />
        <Route path="/profile/:profileId" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Routes>

      {!hideNavbarAndFooter && <Footer data={footerData} />}
    </AuthProvider>
  );
}

export default App;
