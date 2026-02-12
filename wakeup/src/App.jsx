import React, { useEffect, createContext, useState, useCallback, useContext } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import NavBar from "./NavBar/Navbar.jsx";
import HomePage from "./HomePage/HomePage.jsx";
import RatingPage from "./RaitingPage/RaitingPage.jsx";
import LoginPage from "./LoginPage/LoginPage.jsx";
import EventsPage from "./EventComponents/EventPage/EventPage.jsx";
import Footer from "./Footer/Footer.jsx";
import RoadToBreak from "./BTS/BTS.jsx";
import Game from "./EventComponents/Event/Event.jsx";
import ProfilePage from "./ProfilePage/ProfilePage.jsx";
import PlayersTable from "./GamePage/GamePage.jsx";
import PlayersListPage from "./PlayersListPage/PlayersListPage.jsx";
import GameWidget from "./Widget/gameWidget/gameWidget.jsx";
import NotificationsPage from "./NotificationsPage/NotificationsPage.jsx";
import GameResultsTable from "./Widget/resultWidget/resultWidget.jsx";
import SpeechRecognizer from "./speackDetacted/SpeechRecognizer.jsx";
import EventPlayerStatsTable from "./Widget/eventWidget/eventWidget.jsx";

// --- AuthContext ---
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = useCallback((userData, authToken) => {
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      try {
        jwtDecode(storedToken);
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (e) {
        console.error("Ошибка декодирования токена или пользователя", e);
        logout();
      }
    }
  }, [logout]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- ApiContext для глобального fetch ---
export const ApiContext = createContext(null);

export function ApiProvider({ children }) {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...options.headers };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        logout();
        navigate("/login");
        throw new Error("Unauthorized");
      }

      return response;
    },
    [token, logout, navigate]
  );

  return <ApiContext.Provider value={{ apiFetch }}>{children}</ApiContext.Provider>;
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

  // ✅ Скрываем NavBar/Footer по последнему сегменту пути (без startsWith/endsWith)
  // Работает и для:
  // /Event/123/eventWidget
  // /Event/123/eventWidget/
  // /Event/123/Game/456/gameWidget
  // /Event/123/Game/456/resultWidget
  const lastSegment = location.pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase();

  const hideNavbarAndFooter = ["gamewidget", "resultwidget", "eventwidget"].includes(lastSegment);

  return (
    <AuthProvider>
      <ApiProvider>
        {!hideNavbarAndFooter && <NavBar />}

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rating" element={<RatingPage />} />
          <Route path="/players" element={<PlayersListPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/BTS" element={<RoadToBreak />} />
          <Route path="/Event/:eventId" element={<Game />} />
          <Route path="/Event/:eventId/eventWidget" element={<EventPlayerStatsTable />} />
          <Route path="/Event/:eventId/Game/:gameId" element={<PlayersTable />} />
          <Route path="/Event/:eventId/Game/:gameId/gameWidget" element={<GameWidget />} />
          <Route path="/Event/:eventId/Game/:gameId/resultWidget" element={<GameResultsTable />} />
          <Route path="/TEST/" element={<SpeechRecognizer />} />
          <Route path="/profile/:profileId" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>

        {!hideNavbarAndFooter && <Footer data={footerData} />}
      </ApiProvider>
    </AuthProvider>
  );
}

export default App;
