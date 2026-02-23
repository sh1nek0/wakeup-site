import React, { useState, useEffect, useRef } from 'react';
import styles from './PersonCard.module.css';

const PersonCard = ({ user, isEdit, onChange, token, defaultRole = '' }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [roleInput, setRoleInput] = useState(user?.role || defaultRole);
  const [selectedUser, setSelectedUser] = useState(user || null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef(null);

  const stubAvatar =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
        <rect fill='#303030' width='100%' height='100%'/>
        <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle'
              fill='#ff6f00' font-family='Arial' font-size='42'>😼</text>
      </svg>`
    );

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Синхронизация
  useEffect(() => {
    setSelectedUser(user || null);
    setRoleInput(user?.role || defaultRole);
  }, [user, defaultRole]);

  // Загрузка игроков
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const headers = { 'Cache-Control': 'no-cache' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/getPlayersList', { headers });
        if (!res.ok) throw new Error('Ошибка загрузки');

        const data = await res.json();
        setUsers(data.players || []);
        setFilteredUsers(data.players || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (isEdit) fetchUsers();
  }, [isEdit, token]);

  // Поиск только по имени
  useEffect(() => {
    const lower = search.toLowerCase();
    const filtered = users.filter((u) =>
      `${u.nickname || u.name}`
        .toLowerCase()
        .includes(lower)
    );
    setFilteredUsers(filtered);
  }, [search, users]);

  const handleSelect = async (u) => {
    setSelectedUser(u);
    setSearch('');
    setOpen(false);

    try {
      const headers = { 'Cache-Control': 'no-cache' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/getUser/${u.id}`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки пользователя');

      const data = await res.json();
      onChange(data.user, roleInput);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleInputChange = (value) => {
    setRoleInput(value);
    onChange(selectedUser, value);
  };

  // ================= EDIT MODE =================
  if (isEdit) {
    return (
      <div className={styles.editContainer}>
        <div className={styles.dropdownWrapper} ref={dropdownRef}>
          <div
            className={styles.dropdownHeader}
            onClick={() => setOpen(!open)}
          >
            {selectedUser
              ? `${selectedUser.nickname || selectedUser.name}`
              : 'Выберите игрока'}
          </div>

          {open && (
            <div className={styles.dropdownList}>
              <input
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />

              {loading && (
                <div className={styles.loading}>Загрузка...</div>
              )}

              {!loading &&
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className={styles.dropdownItem}
                    onClick={() => handleSelect(u)}
                  >
                    {u.nickname || u.name}
                  </div>
                ))}

              {!loading && filteredUsers.length === 0 && (
                <div className={styles.noResults}>
                  Ничего не найдено
                </div>
              )}
            </div>
          )}
        </div>

        <input
          type="text"
          value={roleInput}
          onChange={(e) => handleRoleInputChange(e.target.value)}
          placeholder={`Введите роль (например, ${defaultRole})`}
          className={styles.inputField}
        />
      </div>
    );
  }

  // ================= VIEW MODE =================
  return (
    <div className={styles.personCard}>
      <img
        src={user?.photoUrl || user?.avatar || stubAvatar}
        alt={user?.name || user?.nickname}
        className={styles.avatar}
      />
      <div className={styles.personMeta}>
        <div className={styles.personName}>
          {user?.name || user?.nickname}
        </div>
        <div className={styles.personRole}>
          {roleInput || user?.role || 'Без роли'}
        </div>
      </div>
    </div>
  );
};

export default PersonCard;