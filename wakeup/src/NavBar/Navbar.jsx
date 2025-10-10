import React, { useContext, useEffect, useState } from "react";
import styles from "./NavBar.module.css";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import defaultAvatar from "./avatar.png";
import wh from "../images/WhiteHeart.png";

const Navbar = () => {
  const { user, isAuthenticated, token, isAdmin, logout } = useContext(AuthContext);
  const [profileAvatar, setProfileData] = useState(null);

  useEffect(() => {
    if (!user || !user.id) return; // не делаем запрос, пока нет данных пользователя

    let cancelled = false;

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/getUser/${encodeURIComponent(user.id)}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          let msg = `Ошибка загрузки профиля (${res.status})`;
          try {
            const j = await res.json();
            msg = j.detail || j.message || msg;
          } catch {}
          throw new Error(msg);
        }

        const data = await res.json();
        console.log(data)
        if (!cancelled) setProfileData(data);
      } catch (err) {
        if (!cancelled) console.error("Ошибка при загрузке профиля:", err);
      }
    };

    fetchUser();

    return () => {
      cancelled = true; // предотвращает setState после размонтирования
    };
  }, [user?.id, token]); 

  console.log(profileAvatar?.user?.photoUrl)
  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <div className={styles.navbarLeft}>
          <div className={styles.navbarLogo}>
            <NavLink to="/">
              <img src={wh} alt="" />
              <span className={styles.logoHighlight}>WakeUp</span> Mafia
            </NavLink>
          </div>
        </div>

        <div className={styles.navbarCenter}>
          <ul className={styles.navbarMenu}>
            <li className={styles.navbarItem}>
              <NavLink
                to="/events"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Мероприятия
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink
                to="/rating"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Рейтинг
              </NavLink>
            </li>
            <li className={styles.navbarItem}>
              <NavLink
                to="/players"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Игроки
              </NavLink>
            </li>
            {isAuthenticated && (
              <li className={styles.navbarItem}>
                <NavLink
                  to={`/profile/${user.id}`}
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                >
                  Профиль
                </NavLink>
              </li>
            )}
            <li className={styles.navbarItem}>
              <NavLink
                to="/BTS"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                BTS
              </NavLink>
            </li>
          </ul>
        </div>

        <div className={styles.navbarRight}>
          {isAuthenticated ? (
            <div className={styles.userInfo}>
              <img
                src={profileAvatar?.user?.photoUrl || user?.photoUrl || defaultAvatar}
                alt="Аватар пользователя"
                className={styles.userAvatar}
              />
              <span className={styles.userName}>{user.nickname}</span>
              <button
                onClick={logout}
                className={styles.logoutBtn}
                aria-label="Выйти из аккаунта"
              >
                Выйти
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className={styles.navbarLoginBtn}
              aria-label="Войти в аккаунт"
            >
              Войти
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
