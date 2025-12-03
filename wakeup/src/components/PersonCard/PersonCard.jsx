import React, { useState, useEffect } from 'react';
import styles from './PersonCard.module.css'; // Ваш файл стилей

const PersonCard = ({ user, isEdit, onChange, token, defaultRole = '' }) => {
  const [users, setUsers] = useState([]);
  const [roleInput, setRoleInput] = useState(user?.role || defaultRole);
  const [loading, setLoading] = useState(false);

  const stubAvatar = "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
       <rect fill='#303030' width='100%' height='100%'/>
       <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle'
             fill='#ff6f00' font-family='Arial' font-size='42'>😼</text>
     </svg>`
  );

  // Загрузка списка пользователей для dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const headers = { 'Cache-Control': 'no-cache' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/getPlayersList', { headers });
        if (!res.ok) throw new Error('Ошибка загрузки списка игроков');
        const data = await res.json();
        setUsers(data.players || []);
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      } finally {
        setLoading(false);
      }
    };
    if (isEdit) fetchUsers();
  }, [isEdit, token]);

  // Обработка выбора в dropdown
  const handleUserSelect = async (selectedId) => {
    if (!selectedId) {
      onChange(null, roleInput);
      return;
    }
    try {
      const headers = { 'Cache-Control': 'no-cache' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/getUser/${selectedId}`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки пользователя');
      const data = await res.json();
      const selectedUser = data.user;
      onChange(selectedUser, roleInput);
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
    }
  };

  // Обработка изменения input
  const handleRoleInputChange = (value) => {
    setRoleInput(value);
    onChange(user, value);
  };

  if (isEdit) {
    return (
      <div className={styles.editContainer}>
        {/* Выпадающее меню с игроками */}
        <select
          value={user?.id || ''}
          onChange={(e) => handleUserSelect(e.target.value)}
          disabled={loading}
          className={styles.dropdown}
        >
          <option value="">Выберите игрока</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nickname || u.name} ({u.club || 'Без клуба'}) - Игр: {u.game_count || 0}
            </option>
          ))}
        </select>
        {/* Input поле ниже */}
        <input
          type="text"
          value={roleInput}
          onChange={(e) => handleRoleInputChange(e.target.value)}
          placeholder={`Введите роль (например, ${defaultRole})`}
          className={styles.inputField}
        />
        {loading && <p>Загрузка...</p>}
      </div>
    );
  }

  // View mode: Отображение как в вашем коде
  return (
    <div className={styles.personCard}>
      <img
        src={user?.photoUrl || user?.avatar || stubAvatar} // stubAvatar из вашего кода
        alt={user?.name || user?.nickname}
        className={styles.avatar}
      />
      <div className={styles.personMeta}>
        <div className={styles.personName}>{user?.name || user?.nickname}</div>
        <div className={styles.personRole}>{roleInput || user?.role || 'Без роли'}</div>
      </div>
    </div>
  );
};

export default PersonCard;
