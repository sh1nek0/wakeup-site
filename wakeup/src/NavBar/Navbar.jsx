import React, { useContext } from 'react';
import styles from './NavBar.module.css';
import { NavLink } from "react-router-dom";
import { AuthContext } from '../AuthContext';
import defaultAvatar from "./avatar.png"; // Исправлено: defaultAvatar

const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useContext(AuthContext); // Добавлено isAdmin
  console.log('Navbar render: isAuthenticated =', isAuthenticated, 'user =', user, 'isAdmin =', isAdmin);

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContainer}>
        <div className={styles.navbarLogo}>
          <NavLink to="/"><span className={styles.logoHighlight}>WakeUp</span> Mafia </NavLink> 
        </div>
        <ul className={styles.navbarMenu}>
          <li className={styles.navbarItem}>
            <NavLink 
              to="/events"
              className={({ isActive }) => isActive ? styles.active : undefined}
              >
                Мероприятия
              </NavLink>
          </li>
          <li className={styles.navbarItem}>
            <NavLink 
              to="/Rating/1" 
              className={({ isActive }) => isActive ? styles.active : undefined}
            >
              Рейтинг
            </NavLink>
          </li>
          {isAuthenticated && ( // Изменено: boolean вместо === 1
            <li className={styles.navbarItem}>
              <NavLink to="/profile">Профиль</NavLink>
            </li>
          )}
          <li className={styles.navbarItem}>BTS</li>
        </ul>

        {user ? (
          <div className={styles.userInfo}>
            <img 
              src={user.avatarUrl ? user.avatarUrl : defaultAvatar} // Исправлено
              alt="avatar" 
              className={styles.userAvatar} 
            />
            <span className={styles.userName}>{user.nickname}</span>
            <button onClick={logout} className={styles.logoutBtn}>Выйти</button>
          </div>
        ) : (
          <NavLink to="/login" className={styles.navbarLoginBtn}>
            Войти
          </NavLink>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
