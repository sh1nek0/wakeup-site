import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom'; 
import styles from './GamePage.module.css';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';  // Импорт контекста

// --- Компоненты (добавлены или исправлены) ---

const GameInfo = ({ votingResults, shootingResults, donResults, sheriffResults }) => {
  const days = ['Д.1', 'Д.2', 'Д.3', 'Д.4', 'Д.5'];

  return (
    <div className={styles.gameInfoWrapper}>
      <table className={styles.gameInfoTable} aria-label="Информация по игре">
        <thead>
          <tr>
            <th></th>
            {days.map((day, i) => (
              <th key={i}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Заголосовали</td>
            {days.map((day, i) => (
              <td key={i}>{votingResults[day]?.votes || ''}</td>
            ))}
          </tr>
          <tr>
            <td>Стрельба</td>
            {days.map((day, i) => (
              <td key={i}>{shootingResults[day]?.result || ''}</td>
            ))}
          </tr>
          <tr>
            <td>Дон</td>
            {days.map((day, i) => (
              <td key={i}>{donResults[day]?.result || ''}</td>
            ))}
          </tr>
          <tr>
            <td>Шериф</td>
            {days.map((day, i) => (
              <td key={i}>{sheriffResults[day]?.result || ''}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const FoulsComponent = ({ players, onIncrementFoul }) => {
  return (
    <div className={styles.foulsWrapper}>
      <div className={styles.foulsGrid}>
        {players.map((player) => (
          <div key={player.id} className={styles.foulCard}>
            <div className={styles.playerNumber}>{player.id}</div>
            <div className={styles.foulCircles}>
              {[1, 2, 3].map((foulIndex) => (
                <button
                  key={foulIndex}
                  type="button"
                  onClick={() => onIncrementFoul(player.id)}
                  disabled={player.fouls >= foulIndex}
                  className={`${styles.foulCircle} ${player.fouls >= foulIndex ? styles.foulActive : styles.foulInactive}`}
                  aria-label={`Добавить фол игроку ${player.id}, фол ${foulIndex}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RoleDropdown = ({ value, onChange, roles }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (role) => {
    onChange(role);
    setIsOpen(false);
  };

  return (
    <div className={styles.roleDropdown}>
      <div
        className={styles.roleDisplay}
        onClick={() => setIsOpen(!isOpen)}
        style={{ userSelect: 'none', cursor: 'pointer' }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Выбор роли"
      >
        {value}
        <span className={styles.dropdownArrow}>▼</span>
      </div>

      {isOpen && (
        <div className={styles.roleOptions} role="listbox" tabIndex={-1}>
          {roles.map((role) => (
            <div
              key={role}
              className={styles.roleOption}
              onClick={() => handleSelect(role)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(role);
                }
              }}
              tabIndex={0}
              role="option"
              aria-selected={value === role}
            >
              {role}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Переписанный компонент BadgeDropdown (выпадающее меню) ---
const BadgeDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Опции для выбора
  const options = [
    { label: 'Красные', value: 'red' },
    { label: 'Черные', value: 'black' },
    { label: 'Ничья', value: 'drow' }
  ];

  // Текущее отображаемое значение
  const currentLabel = options.find((opt) => opt.value === value)?.label || 'Красные';

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  return (
    <div className={styles.roleDropdown}> {/* Используем существующие стили для консистентности */}
      <div
        className={styles.roleDisplay}
        onClick={() => setIsOpen(!isOpen)}
        style={{ userSelect: 'none', cursor: 'pointer' }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Выбор цвета бейджа"
      >
        {currentLabel}
        <span className={styles.dropdownArrow}>▼</span>
      </div>

      {isOpen && (
        <div className={styles.roleOptions} role="listbox" tabIndex={-1}>
          {options.map((option) => (
            <div
              key={option.value}
              className={styles.roleOption}
              onClick={() => handleSelect(option.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(option.value);
                }
              }}
              tabIndex={0}
              role="option"
              aria-selected={value === option.value}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Game = () => {
  const { gameId } = useParams();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [maxTime, setMaxTime] = useState(null);
  // Получаем данные из AuthContext
  const { user, isAuthenticated } = useContext(AuthContext);
  // Вычисляем isAdmin на основе user.role
  const isAdmin = user && user.role === 'admin';

  const handleStartVoting = () => {
    // Очистим голосование, сбросим состояния
    setSelectedPlayerId(null);
    setIsCounting(false);
    setRound(1);
    setFirstRoundCandidates([]);
    setCurrentPhase('voting');
  };

  const [players, setPlayers] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Игрок ${i + 1}`,
      fouls: 0,
      lx: "",
      role: '-',
      plus: 2.5,
      sk: 0,
      jk: 0,
    }))
  );

  const roles = ['мирный', 'мафия', 'дон', 'шериф'];

  // --- Добавлено для голосования ---
  const [votes, setVotes] = useState([]); // массив объектов { playerId, votesCount }
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [isCounting, setIsCounting] = useState(false); // новое состояние для режима подсчета
  const [round, setRound] = useState(1); // раунд голосования: 1, 2 или 3

  // --- Новое состояние для отслеживания кандидатов первого раунда ---
  const [firstRoundCandidates, setFirstRoundCandidates] = useState([]);

  // --- Добавлено для сохранения голосования ---
  const [currentDay, setCurrentDay] = useState('Д.1');
  const [votingResults, setVotingResults] = useState({});

  // --- Новые состояния для фаз ---
  const [currentPhase, setCurrentPhase] = useState('nominating'); //  'nominating', 'voting', 'shooting', 'don', 'sheriff'
  const [shootingResults, setShootingResults] = useState({});
  const [donResults, setDonResults] = useState({});
  const [sheriffResults, setSheriffResults] = useState({});

  // --- Новое состояние для вкладок ---
  const [activeTab, setActiveTab] = useState('gameInfo'); // 'gameInfo' или 'fouls'

  // --- Новое состояние для BadgeDropdown ---
  const [badgeColor, setBadgeColor] = useState('red'); // 'red' или 'black'

  // --- Новые состояния для загрузки и ошибок ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Новые состояния для модала и аутентификации (добавлено) ---
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [adminNickname, setAdminNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- Функция для показа уведомлений (добавлено) ---
  const showMessage = (message, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setSuccessMessage('');
    } else {
      setSuccessMessage(message);
      setErrorMessage('');
    }
    setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 5000);
  };

  // --- Функция для открытия модала (добавлено) ---
  const openSaveModal = () => {
    setShowSaveModal(true);
  };

  // --- Таймер ---
  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTime((prev) => {
          if (maxTime !== null && prev >= maxTime) {
            setIsRunning(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, maxTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTime(0);
    setMaxTime(null);
  };

  const startTimerLimited = (seconds) => {
    setTime(0);
    setMaxTime(seconds);
    setIsRunning(true);
  };

  // --- Управление игроками ---
  const handleNameChange = (id, value) => {
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, name: value } : player))
    );
  };

  const handleFoulsChange = (id, value) => {
    const numValue = Math.max(0, Math.min(3, parseInt(value) || 0)); // Ограничить до 3
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, fouls: numValue } : player))
    );
  };

  const incrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((player) => {
        if (player.id === id && player.fouls < 3) {
          return { ...player, fouls: player.fouls + 1 };
        }
        return player;
      })
    );
  };

  const decrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id ? { ...player, fouls: Math.max(0, player.fouls - 1)} : player
      )
    );
  };

  const handleRoleChange = (id, role) => {
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, role } : player))
    );
  };

  const handleLxChange = (id, value) => {
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, lx: value } : player))
    );
  };

  const handlePlusChange = (id, value) => {
    const numValue = parseFloat(value) || 0;
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, plus: numValue } : player))
    );
  };

  const handleSkChange = (id, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, sk: numValue } : player))
    );
  };

  const handleJkChange = (id, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, jk: numValue } : player))
    );
  };

  // --- Новое: обработчик клика по номеру для выставления на голосование ---
  const handlePlayerNumberClick = (playerId) => {
    if (!votes.some((v) => v.playerId === playerId)) {
      setVotes((prev) => [...prev, { playerId, votesCount: 0 }]);
      // Если еще никто не выбран, выбрать нового игрока
      if (selectedPlayerId === null) {
        setSelectedPlayerId(playerId);
      }
      // Иначе оставить текущий выбор
    }
  };

  // --- Выбор игрока для изменения голосов ---
  const handleSelectPlayer = (playerId) => {
    setSelectedPlayerId(playerId);
  };

  // --- Управление голосами ---
  const handleVoteChange = (playerId, increment) => {
    setVotes((prev) =>
      prev.map((v) => (v.playerId === playerId ? { ...v, votesCount: v.votesCount + increment } : v))
    );
  };

  const handleVoteButtonClick = (increment) => {
    if (selectedPlayerId === null) return;
    handleVoteChange(selectedPlayerId, increment);
    // После добавления голосов автоматически перейти к следующему игроку
    const currentIndex = votes.findIndex((v) => v.playerId === selectedPlayerId);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % votes.length;
      setSelectedPlayerId(votes[nextIndex].playerId);
    }
  };

  const handleBackspace = () => {
    if (selectedPlayerId === null) return;
    setVotes((prev) => prev.filter((v) => v.playerId !== selectedPlayerId));
    // После удаления выбрать первого оставшегося, если есть
    const remainingVotes = votes.filter((v) => v.playerId !== selectedPlayerId);
    if (remainingVotes.length > 0) {
      setSelectedPlayerId(remainingVotes[0].playerId);
    } else {
      setSelectedPlayerId(null);
    }
  };

  // --- Модифицированная логика подсчета с условным третьим раундом ---
  const handleCount = () => {
    const voted = votes.filter((v) => v.votesCount > 0);
    if (voted.length === 0) {
      setIsCounting(false);
      return;
    }
    const maxVotes = Math.max(...voted.map((v) => v.votesCount));
    const candidates = voted.filter((v) => v.votesCount === maxVotes);
    if (candidates.length === 1) {
      // Есть большинство, записать его
      saveResult([candidates[0].playerId]);
    } else {
      // Равное количество голосов
      if (round === 1) {
        // Первый раунд: сохранить кандидатов, перейти ко второму
        setFirstRoundCandidates(candidates.map(c => c.playerId));
        const resetVotes = candidates.map((v) => ({ playerId: v.playerId, votesCount: 0 }));
        setVotes(resetVotes);
        setRound(2);
        setIsCounting(false); // Продолжить голосование
      } else if (round === 2) {
        // Второй раунд: проверить, изменился ли список кандидатов
        const currentCandidatesIds = candidates.map(c => c.playerId);
        const isSameCandidates = firstRoundCandidates.length === currentCandidatesIds.length &&
          firstRoundCandidates.every(id => currentCandidatesIds.includes(id));
        if (isSameCandidates) {
          // Список кандидатов не изменился: пропустить третий раунд, обработать как в третьем
          if (voted.length === votes.length) {
            // Все выставленные кандидаты получили голоса: показать кнопки "Оставили" / "Подняли"
            setIsCounting(true);
          } else {
            // Не все: выгнать кандидатов
            saveResult(currentCandidatesIds);
          }
        } else {
          // Список кандидатов изменился: перейти к третьему раунду
          const resetVotes = candidates.map((v) => ({ playerId: v.playerId, votesCount: 0 }));
          setVotes(resetVotes);
          setRound(3);
          setIsCounting(false); // Продолжить голосование
        }
      } else if (round === 3) {
        // Третий раунд: последний шанс
        if (voted.length === votes.length) {
          // Все выставленные кандидаты получили голоса: показать кнопки "Оставили" / "Подняли"
          setIsCounting(true);
        } else {
          // Не все: выгнать кандидатов
          saveResult(candidates.map((c) => c.playerId));
        }
      }
    }
  };

  const handleLeft = () => {
    // "Оставили" - поставить прочерк
    saveResult([]);
  };

  const handleRaised = () => {
    // "Подняли" - сохранить всех оставшихся кандидатов
    const voted = votes.filter((v) => v.votesCount > 0);
    const playerIds = voted.map((v) => v.playerId);
    saveResult(playerIds);
  };

  const saveResult = (playerIds) => {
    const voteSummary = playerIds.length > 0 ? playerIds.join(', ') : '-';
    setVotingResults((prev) => ({
      ...prev,
      [currentDay]: { votes: voteSummary },
    }));
    // Очистить голоса после сохранения
    setVotes([]);
    setSelectedPlayerId(null);
    setIsCounting(false);
    setRound(1); // Сбросить раунд
    setFirstRoundCandidates([]); // Сбросить кандидатов первого раунда
    // Перейти к следующему этапу: Стрельба
    setCurrentPhase('shooting');
  };

  // --- Новые функции для других фаз ---
  const handlePhaseButtonClick = (value, phase) => {
    const result = value === 'miss' ? '-' : value.toString();
    const days = ['Д.1', 'Д.2', 'Д.3', 'Д.4', 'Д.5']; // Исправлено на 5 дней
    if (phase === 'shooting') {
      setShootingResults((prev) => ({
        ...prev,
        [currentDay]: { result },
      }));
      setCurrentPhase('don');
    } else if (phase === 'don') {
      setDonResults((prev) => ({
        ...prev,
        [currentDay]: { result },
      }));
      setCurrentPhase('sheriff');
    } else if (phase === 'sheriff') {
      setSheriffResults((prev) => ({
        ...prev,
        [currentDay]: { result },
      }));
      // После шерифа перейти к следующему дню и обратно к голосованию
      const nextIndex = days.indexOf(currentDay) + 1;
      if (nextIndex < days.length) {
        setCurrentDay(days[nextIndex]);
      }
      setCurrentPhase('nominating');
    }
  };

  // Функция для получения данных игры
  const fetchGameData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/getGameData/${gameId}`);
      if (response.status === 404) {
        // Игра не найдена, инициализируем по умолчанию (уже сделано в useState)
        setLoading(false);
        return;
      }
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const data = await response.json();
      // Распарсить данные и заполнить состояния
      if (data.players) {
        setPlayers(data.players);
      }
      if (data.gameInfo) {
        setVotingResults(data.gameInfo.votingResults || {});
        setShootingResults(data.gameInfo.shootingResults || {});
        setDonResults(data.gameInfo.donResults || {});
        setSheriffResults(data.gameInfo.sheriffResults || {});
      }
      if (data.currentDay) {
        setCurrentDay(data.currentDay);
      }
      if (data.currentPhase) {
        setCurrentPhase(data.currentPhase);
      }
      if (data.badgeColor) {
        setBadgeColor(data.badgeColor);
      }
      // Другие поля, если есть
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // useEffect для загрузки данных при монтировании
  useEffect(() => {
    fetchGameData();
  }, [gameId]); // Зависит от gameId, чтобы перезагружать при изменении

  // --- Обновленная функция для сохранения данных на сервер (добавлено) ---
  const handleSave = async () => {
    if (!adminNickname || !adminPassword) {
      showMessage('Пожалуйста, заполните все поля для аутентификации.', true);
      return;
    }

    // Валидация ролей (из вашего кода)
    const errors = [];
    players.forEach((player) => {
      if (player.role === '-' || player.role.trim() === '') {
        errors.push(`Игрок ${player.id} (${player.name}): роль не заполнена.`);
      }
    });
    if (errors.length > 0) {
      showMessage(`Ошибки валидации: ${errors.join('; ')} Пожалуйста, заполните все роли перед сохранением.`, true);
      return;
    }

    setIsSaving(true);
    const dataToSave = {
      admin_nickname: adminNickname,  // Добавлено для соответствия бэкенду
      admin_password: adminPassword,  // Добавлено для соответствия бэкенду
      gameId,
      eventId,
      players,
      fouls: players.map(({ id, fouls }) => ({ playerId: id, fouls })),
      gameInfo: {
        votingResults,
        shootingResults,
        donResults,
        sheriffResults,
      },
      currentDay,
      currentPhase,
      badgeColor,
    };

    try {
      const response = await fetch('/api/saveGameData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        const result = await response.json();
        showMessage(result.message);  // Успех
        setShowSaveModal(false);
        setAdminNickname('');
        setAdminPassword('');
        setTimeout(() => navigate('/'), 500);  // Переход после успеха
      } else {
        let errorMsg = 'Неизвестная ошибка';
        if (response.status === 400) {
          const errorData = await response.json();
          errorMsg = errorData.detail || 'Некорректные данные админа.';
        } else if (response.status === 403) {
          errorMsg = 'У вас нет прав для сохранения (требуется роль admin).';
        } else if (response.status === 404) {
          errorMsg = 'Игра не найдена.';
        } else {
          const errorData = await response.json();
          errorMsg = errorData.detail || response.statusText;
        }
        showMessage(errorMsg, true);
      }
    } catch (error) {
      showMessage('Ошибка сети: ' + error.message, true);
    } finally {
      setIsSaving(false);
    }
  };

  // Если загрузка, показать индикатор
  if (loading) {
    return <div>Загрузка данных игры...</div>;
  }

  // Если ошибка, показать ошибку
  if (error) {
    return <div>Ошибка загрузки: {error}</div>;
  }

  return (
    <>
      {/* Уведомления (добавлено) */}
      {successMessage && (
        <div className={styles.notification} style={{ backgroundColor: 'green', color: 'white', padding: '10px', marginBottom: '10px' }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className={styles.notification} style={{ backgroundColor: 'red', color: 'white', padding: '10px', marginBottom: '10px' }}>
          {errorMessage}
        </div>
      )}

      <div className={styles.gameWrapper}>
        {/* Список игроков (замена таблицы) */}
        <table className={styles.playersTable} aria-label="Таблица игроков">
          <thead>
            <tr>
              <th>№</th>
              <th>Имя</th>
              <th>Роль</th>
              <th>ЛХ</th>
              <th>Допы</th>
              <th>СК</th>
              <th>ЖК</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td
                  className={styles.numberCell}
                  onClick={() => handlePlayerNumberClick(player.id)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePlayerNumberClick(player.id);
                    }
                  }}
                  aria-label={`Выставить игрока ${player.id} на голосование`}
                >
                  {player.id}
                </td>

                <td>
                  <input
                    type="text"
                    className={styles.nameInput}
                    value={player.name}
                    onChange={(e) => handleNameChange(player.id, e.target.value)}
                    aria-label={`Имя игрока ${player.id}`}
                  />
                </td>

                <td>
                  <RoleDropdown
                    value={player.role}
                    onChange={(role) => handleRoleChange(player.id, role)}
                    roles={roles}
                  />
                </td>

                <td>
                  <input
                    type="text"
                    className={styles.lxInput}
                    value={player.lx}
                    onChange={(e) => handleLxChange(player.id, e.target.value)}
                    aria-label={`ЛХ игрока ${player.id}`}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    className={styles.dopsInput}
                    value={player.plus}
                    onChange={(e) => handlePlusChange(player.id, e.target.value)}
                    aria-label={`Допы игрока ${player.id}`}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={styles.numberInput}
                    value={player.sk}
                    onChange={(e) => handleSkChange(player.id, e.target.value)}
                    aria-label={`СК игрока ${player.id}`}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={styles.numberInput}
                    value={player.jk}
                    onChange={(e) => handleJkChange(player.id, e.target.value)}
                    aria-label={`ЖК игрока ${player.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Правый столбец */}
        <div className={styles.rightColumn}>
          <div className={styles.contentContainer}>
            {/* Таймер */}
            <div className={styles.timerBlock}>
              <div className={styles.timerContainer}>
                <div
                  className={isRunning ? styles.timerTimeRunning : styles.timerTimePaused}
                  onClick={toggleTimer}
                  style={{ cursor: 'pointer' }}
                  aria-label="Таймер, нажмите для запуска/паузы"
                  role="timer"
                >
                  {formatTime(time)}
                </div>
                <button className={styles.resetBtn} onClick={resetTimer} type="button">
                  Сброс
                </button>
                <div className={styles.timerButtons}>
                  <button className={styles.timerBtn} onClick={() => startTimerLimited(20)} type="button">
                    20 сек
                  </button>
                  <button className={styles.timerBtn} onClick={() => startTimerLimited(30)} type="button">
                    30 сек
                  </button>
                  <button className={styles.timerBtn} onClick={() => startTimerLimited(60)} type="button">
                    60 сек
                  </button>
                </div>
              </div>
            </div>

            {/* Голосование или другие фазы */}
            {/* Фаза выставления */}
            {currentPhase === 'nominating' && (
              <div className={styles.votingContainer}>
                <nav aria-label="Список игроков для выставления" className={styles.votingNav}>
                  {votes.length === 0 && (
                    <p className={styles.noVotesText}>Нет выбранных игроков для выставления.</p>
                  )}
                  {votes.map(({ playerId, votesCount }) => (
                    <div key={playerId} className={styles.playerVoteItem}>
                      <button
                        type="button"
                        onClick={() => handleSelectPlayer(playerId)}
                        className={playerId === selectedPlayerId ? styles.selectedPlayerBtn : styles.playerBtn}
                        aria-current={playerId === selectedPlayerId ? 'true' : undefined}
                        aria-label={`Выбрать игрока ${playerId} для выставления`}
                      >
                        {playerId}
                      </button>
                      <span className={styles.votesCount}>{votesCount}</span>
                    </div>
                  ))}
                </nav>

                <div
                  role="grid"
                  aria-label="Цифровая клавиатура для выставления"
                  className={styles.keyboardGrid}
                >
                  {[1,2,3,4,5,6,7,8,9,10,0].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePlayerNumberClick(num)}
                      className={styles.keyboardBtn}
                      aria-label={`Добавить ${num} голосов для игрока ${selectedPlayerId ?? 'не выбран'}`}
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleBackspace}
                    className={styles.keyboardBtn}
                    aria-label="Удалить игрока из выставления"
                  >
                    ⮾
                  </button>
                </div>

                {/* Кнопка перехода к голосованию */}
                <button
                  type="button"
                  onClick={handleStartVoting}
                  className={styles.saveVotingBtn}
                  aria-label="Перейти к голосованию"
                  disabled={votes.length === 0}
                >
                  Голосование
                </button>
              </div>
            )}
            {currentPhase === 'voting' && (
              <div className={styles.votingContainer}>
                <nav aria-label="Список игроков для голосования" className={styles.votingNav}>
                  {votes.length === 0 && (
                    <p className={styles.noVotesText}>Нет выбранных игроков для голосования.</p>
                  )}
                  {votes.map(({ playerId, votesCount }) => {
                    const isSelected = playerId === selectedPlayerId;
                    return (
                      <div key={playerId} className={styles.playerVoteItem}>
                        <button
                          type="button"
                          onClick={() => handleSelectPlayer(playerId)}
                          className={isSelected ? styles.selectedPlayerBtn : styles.playerBtn}
                          aria-current={isSelected ? 'true' : undefined}
                          aria-label={`Выбрать игрока ${playerId} для голосования`}
                        >
                          {playerId}
                        </button>
                        <span className={styles.votesCount}>{votesCount}</span>
                      </div>
                    );
                  })}
                </nav>

                <div
                  role="grid"
                  aria-label="Цифровая клавиатура для голосования"
                  className={styles.keyboardGrid}
                >
                  {[1,2,3,4,5,6,7,8,9,10,0].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleVoteButtonClick(num)}
                      className={styles.keyboardBtn}
                      disabled={selectedPlayerId === null}
                      aria-label={`Добавить ${num} голосов для игрока ${selectedPlayerId ?? 'не выбран'}`}
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={selectedPlayerId === null}
                    className={styles.keyboardBtn}
                    aria-label={`Удалить игрока из голосования`}
                  >
                    ⮾
                  </button>
                </div>

                {/* Кнопки подсчета */}
                {!isCounting ? (
                  <button
                    type="button"
                    onClick={handleCount}
                    className={styles.saveVotingBtn}
                    disabled={votes.length === 0}
                    aria-label="Посчитать голосование"
                  >
                    Посчитать
                  </button>
                ) : (
                  <div className={styles.countButtons}>
                    <button
                      type="button"
                      onClick={handleLeft}
                      className={styles.countBtn}
                      aria-label="Оставили - поставить прочерк"
                    >
                      Оставили
                    </button>
                    <button
                      type="button"
                      onClick={handleRaised}
                      className={styles.countBtn}
                      aria-label="Подняли - сохранить всех оставшихся игроков"
                    >
                      Подняли
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentPhase === 'shooting' && (
              <div className={styles.phaseContainer}>
                <h3>Стрельба</h3>
                <div className={styles.keyboardGrid}>
                  {[1,2,3,4,5,6,7,8,9,10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePhaseButtonClick(num, 'shooting')}
                      className={styles.keyboardBtn}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handlePhaseButtonClick('miss', 'shooting')}
                    className={styles.keyboardBtn}
                  >
                    Промах
                  </button>
                </div>
              </div>
            )}

            {currentPhase === 'don' && (
              <div className={styles.phaseContainer}>
                <h3>Дон</h3>
                <div className={styles.keyboardGrid}>
                  {[1,2,3,4,5,6,7,8,9,10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePhaseButtonClick(num, 'don')}
                      className={styles.keyboardBtn}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentPhase === 'sheriff' && (
              <div className={styles.phaseContainer}>
                <h3>Шериф</h3>
                <div className={styles.keyboardGrid}>
                  {[1,2,3,4,5,6,7,8,9,10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePhaseButtonClick(num, 'sheriff')}
                      className={styles.keyboardBtn}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.tabs}>
              <button
                type="button"
                onClick={() => setActiveTab('gameInfo')}
                className={activeTab === 'gameInfo' ? styles.activeTab : styles.tab}
                aria-selected={activeTab === 'gameInfo'}
              >
                Виджет
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fouls')}
                className={activeTab === 'fouls' ? styles.activeTab : styles.tab}
                aria-selected={activeTab === 'fouls'}
              >
                Фолы
              </button>
            </div>

            {/* Условное отображение GameInfo или FoulsComponent */}
            {activeTab === 'gameInfo' && (
              <GameInfo votingResults={votingResults} shootingResults={shootingResults} donResults={donResults} sheriffResults={sheriffResults} />
            )}
            {activeTab === 'fouls' && (
              <FoulsComponent players={players} onIncrementFoul={incrementFouls} />
            )}
          </div>
        </div>
      </div>

      {/* Кнопка сохранения под таблицей игроков и правой колонкой */}
      <div className={styles.saveButtonContainer}>
        <BadgeDropdown value={badgeColor} onChange={setBadgeColor} />
        <button
          type="button"
          onClick={openSaveModal}  // Открываем модал вместо прямого сохранения
          className={styles.saveBtn}
          aria-label="Сохранить данные игры"
          disabled={!isAdmin}  // Кнопка выключена для не-админов
          title={!isAdmin ? 'Только администратор может сохранять данные' : undefined}
        >
          Сохранить
        </button>
      </div>

      {/* Модальное окно для аутентификации (добавлено) */}
      {showSaveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>Сохранить игру</h2>
            <p>Введите credentials админа для подтверждения:</p>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className={styles.formGroup}>
                <label htmlFor="adminNickname">Nickname админа:</label>
                <input
                  id="adminNickname"
                  type="text"
                  value={adminNickname}
                  onChange={(e) => setAdminNickname(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="adminPassword">Пароль админа:</label>
                <input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowSaveModal(false)} disabled={isSaving}>
                  Отмена
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Game;
