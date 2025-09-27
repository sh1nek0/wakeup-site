import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Изменено на boolean
  const [isAdmin, setIsAdmin] = useState(false); // Новое состояние для проверки админа

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    console.log('AuthContext useEffect: storedToken:', storedToken, 'storedUser:', storedUser);
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setIsAuthenticated(true);
        setIsAdmin(parsedUser.role === 'admin'); // Проверка на админа по роли
        console.log('AuthContext: State restored from localStorage, isAdmin:', parsedUser.role === 'admin');
      } catch (error) {
        console.error('Error parsing stored user:', error);
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
    } else {
      setIsAuthenticated(false);
      setIsAdmin(false);
    }
  }, []);

  const login = (userData, token) => {
    console.log('AuthContext login called with:', userData, token);
    setUser(userData);
    setToken(token);
    setIsAuthenticated(true);
    setIsAdmin(userData.role === 'admin'); // Установка isAdmin при логине
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    console.log('AuthContext: isAuthenticated set to true, isAdmin:', userData.role === 'admin');
  };

  const logout = () => {
    console.log('AuthContext logout called');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // Новая функция для обновления пользователя (если нужно, например, после изменения профиля)
  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    setIsAdmin(updatedUserData.role === 'admin');
    localStorage.setItem('user', JSON.stringify(updatedUserData));
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isAdmin, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};