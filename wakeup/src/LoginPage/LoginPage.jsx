import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import styles from './LoginPage.module.css';

const baseURL = "http://localhost:8000"


const LoginPage = () => {
  const { login } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    club: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Валидация...
    if (isLogin) {
      if (!formData.nickname || !formData.password) {
        setError('Заполните никнейм и пароль');
        return;
      }
    } else {
      if (!formData.email || !formData.nickname || !formData.password || !formData.confirmPassword || !formData.club) {
        setError('Заполните все поля');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Пароли не совпадают');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Введите корректный email');
        return;
      }
    }

    try {
      const endpoint = isLogin ?  baseURL+'/login' : baseURL+'/register';
      const payload = isLogin
        ? { nickname: formData.nickname, password: formData.password }
        : { email: formData.email, nickname: formData.nickname, password: formData.password, club: formData.club };

      // Добавлен timeout и abortController для предотвращения ошибок fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 сек

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Защита от не-JSON ответа
        setError(errorData.message || 'Ошибка при обработке запроса');
        return;
      }

      const data = await response.json();
      console.log('LoginPage: Server response data:', data);
      setSuccess(isLogin ? 'Вход выполнен успешно!' : 'Регистрация прошла успешно!');

      // Проверка на наличие token и user перед вызовом login
      if (data.token && data.user) {
        login(data.user, data.token);
        setTimeout(() => navigate('/'), 500);
      } else {
        setError('Сервер вернул неполные данные. Попробуйте снова.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Запрос отменен по таймауту. Проверьте соединение.');
      } else {
        setError('Ошибка сети. Проверьте соединение.');
      }
    }
  };

  const isSubmitDisabled = !isLogin && formData.confirmPassword && formData.password !== formData.confirmPassword;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>{isLogin ? 'Вход' : 'Регистрация'}</h1>
        
        <div className={styles.tabSwitcher}>
          <button
            className={`${styles.tabBtn} ${isLogin ? styles.tabActive : ''}`}
            onClick={() => setIsLogin(true)}
            type="button"
          >
            Вход
          </button>
          <button
            className={`${styles.tabBtn} ${!isLogin ? styles.tabActive : ''}`}
            onClick={() => setIsLogin(false)}
            type="button"
          >
            Регистрация
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {!isLogin && (
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Почта</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="example@mail.com"
              />
            </div>
          )}
          <div className={styles.inputGroup}>
            <label htmlFor="nickname" className={styles.label}>Никнейм</label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              value={formData.nickname}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Ваш никнейм"
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Ваш пароль"
            />
          </div>
          {!isLogin && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword" className={styles.label}>Подтвердите пароль</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="Повторите пароль"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="club" className={styles.label}>Клуб</label>
                <select
                  id="club"
                  name="club"
                  value={formData.club}
                  onChange={handleInputChange}
                  className={styles.input}
                >
                  <option value="">Выберите клуб</option>
                  <option value="WakeUp | MIET">WakeUp | MIET</option>
                  <option value="WakeUp | MIPT">WakeUp | MIPT</option>
                  <option value="Другой">Другой</option>
                </select>
              </div>
            </>
          )}
          
          <button type="submit" className={styles.submitBtn} disabled={isSubmitDisabled}>
            {isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </div>
    </div>
  );
};

export default LoginPage;
