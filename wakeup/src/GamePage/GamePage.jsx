import React, { useState, useEffect, useContext, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './GamePage.module.css';
import { AuthContext } from '../AuthContext';

/* ==========================
   ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
   ========================== */

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
            <td>Ушел</td>
            {days.map((day, i) => (
              <td key={i}>{votingResults[day]?.votes || ''}</td>
            ))}
          </tr>
          <tr>
            <td>Умер</td>
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

const FoulsComponent = ({ players, onIncrementFoul, onIncrementDFouls, isPenaltyTime }) => {
  return (
    <div className={styles.foulsWrapper}>
      <div className={styles.foulsGrid}>
        {players.map((player) => {
          const atMax = player.fouls >= 3;
          return (
            <div
              key={player.id}
              className={styles.foulCard}
              role="button"
              tabIndex={0}
              aria-disabled={atMax}
              aria-label={`Добавить фол игроку ${player.id}`}
              onClick={() => !atMax && !isPenaltyTime ? onIncrementFoul(player.id) : onIncrementDFouls(player.id)}
              onKeyDown={(e) => {
                if (!atMax && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onIncrementFoul(player.id);
                }
              }}
              style={atMax ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <div className={styles.playerNumber}>{player.id}</div>
              <div className={styles.foulCircles}>
                {[1, 2, 3].map((foulIndex) => (
                  <span
                    key={foulIndex}
                    className={`${styles.foulCircle} ${
                      player.fouls >= foulIndex ? styles.foulActive : styles.foulInactive
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {isPenaltyTime && (
        <p style={{ color: 'orange', fontWeight: 'bold', textAlign: 'center', marginTop: '10px' }}>
          Выберите игрока для двойного фола
        </p>
      )}
    </div>
  );
};

const RoleDropdown = ({ value, onChange, roles, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (role) => {
    if (disabled) return;
    onChange(role);
    setIsOpen(false);
  };

  return (
    <div className={styles.roleDropdown}>
      <div
        className={styles.roleDisplay}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ userSelect: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        aria-label="Выбор роли"
      >
        {value}
        <span className={styles.dropdownArrow}>▼</span>
      </div>

      {isOpen && !disabled && (
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

const BadgeDropdown = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = [
    { label: 'Красные', value: 'red' },
    { label: 'Черные', value: 'black' },
    { label: 'Ничья', value: 'drow' },
  ];
  const currentLabel = options.find((opt) => opt.value === value)?.label || 'Красные';

  const handleSelect = (option) => {
    if (disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div className={styles.roleDropdown}>
      <div
        className={styles.roleDisplay}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ userSelect: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        aria-label="Выбор цвета бейджа"
      >
        {currentLabel}
        <span className={styles.dropdownArrow}>▼</span>
      </div>

      {isOpen && !disabled && (
        <div className={styles.roleOptions} role="listbox" tabIndex={-1}>
          {options.map((option) => (
            <div
              key={option.value}
              className={styles.roleOption}
              onClick={() => handleSelect(option)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(option);
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

/* ================
   ОСНОВНОЙ КОМПОНЕНТ
   ================ */

const Game = () => {
  const { gameId, eventId } = useParams();
  const navigate = useNavigate();

  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [maxTime, setMaxTime] = useState(null);
  const [isPenaltyTime, setIsPenaltyTime] = useState(false); // Новое состояние для штрафного времени

  const { user, token } = useContext(AuthContext) ?? { user: null, token: null };
  const isAdmin = user && user.role === 'admin';

  const [players, setPlayers] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: '',
      fouls: 0,
      best_move: '',
      role: 'мирный',
      plus: 2.5,
      sk: 0,
      jk: 0,
    }))
  );
  const roles = ['мирный', 'мафия', 'дон', 'шериф'];

  // Голосование
  const [votes, setVotes] = useState([]); // { playerId, votesCount }
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [round, setRound] = useState(1);
  const [firstRoundCandidates, setFirstRoundCandidates] = useState([]);

  // Итоги/фазы
  const [currentDay, setCurrentDay] = useState('Д.1');
  const [votingResults, setVotingResults] = useState({});
  const [currentPhase, setCurrentPhase] = useState('nominating'); // 'nominating' | 'voting' | 'shooting' | 'don' | 'sheriff'
  const [shootingResults, setShootingResults] = useState({});
  const [donResults, setDonResults] = useState({});
  const [sheriffResults, setSheriffResults] = useState({});
  const [activeTab, setActiveTab] = useState('fouls');
  const [badgeColor, setBadgeColor] = useState('red');

  // Загрузка/ошибки
  const [loading, setLoading] = useState(true);
  const [serverUnavailable, setServerUnavailable] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const firstVoteBtnRef = useRef(null);

  const tabPanelsRef = useRef(null);
  const gameInfoPanelRef = useRef(null);
  const foulsPanelRef = useRef(null);
  const [tabHeight, setTabHeight] = useState(0);

  const recalcTabHeight = () => {
    const h1 = gameInfoPanelRef.current?.offsetHeight || 0;
    const h2 = foulsPanelRef.current?.offsetHeight || 0;
    const maxH = Math.max(h1, h2);
    if (maxH && tabHeight !== maxH) setTabHeight(maxH);
  };

  useLayoutEffect(() => {
    recalcTabHeight();
    const onResize = () => recalcTabHeight();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    recalcTabHeight();
  }, [activeTab, players, votingResults, shootingResults, donResults, sheriffResults]);

  const getLocalStorageKey = () => `gameData-${eventId}-${gameId}`;

  useEffect(() => {
    if (loading) return;

    const dataToSave = {
      players,
      gameInfo: { votingResults, shootingResults, donResults, sheriffResults },
      currentDay,
      currentPhase,
      badgeColor,
    };

    try {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Ошибка сохранения данных в localStorage:", error);
    }
  }, [
    players,
    votingResults,
    shootingResults,
    donResults,
    sheriffResults,
    currentDay,
    currentPhase,
    badgeColor,
    loading,
  ]);
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

  /* ==========
     ТАЙМЕР
     ========== */
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
  const toggleTimer = () => setIsRunning(!isRunning);
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

  const updateTimer = (seconds) => {
    setTime(time);
    setMaxTime(maxTime + seconds);
    setIsRunning(true);
    setIsPenaltyTime(true); // Активируем штрафное время
  };

  /* =================
     УПРАВЛЕНИЕ ФОРМОЙ
     ================= */
  const handleNameChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name: value } : p)));
  const incrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id && p.fouls < 3 ? { ...p, fouls: Math.min(p.fouls + 1, 3) } : p)) // +2 фола, но не больше 3
    );
  };
  const incrementDFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id && p.fouls < 3 ? { ...p, fouls: Math.min(p.fouls + 2, 3) } : p)) // +2 фола, но не больше 3
    );
    setIsPenaltyTime(false); // Снимаем дизейбл
  };


  const handleRoleChange = (id, role) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  const handleBestMoveChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, best_move: value } : p)));
  const handlePlusChange = (id, value) => {
    const numValue = parseFloat(value) || 0;
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, plus: numValue } : p)));
  };
  const handleSkChange = (id, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, sk: numValue } : p)));
  };
  const handleJkChange = (id, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, jk: numValue } : p)));
  };

  /* ============================
     ВЫСТАВЛЕНИЕ/ГОЛОСОВАНИЕ
     ============================ */
  const handlePlayerNumberClick = (playerId) => {
    if (!votes.some((v) => v.playerId === playerId)) {
      setVotes((prev) => [...prev, { playerId, votesCount: 0 }]);
      if (selectedPlayerId === null) setSelectedPlayerId(playerId);
    }
  };
  const handleSelectPlayer = (playerId) => setSelectedPlayerId(playerId);
  const handleVoteChange = (playerId, increment) =>
    setVotes((prev) =>
      prev.map((v) => (v.playerId === playerId ? { ...v, votesCount: v.votesCount + increment } : v))
    );
  const handleVoteButtonClick = (increment) => {
    if (selectedPlayerId === null) return;
    handleVoteChange(selectedPlayerId, increment);
    const currentIndex = votes.findIndex((v) => v.playerId === selectedPlayerId);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % votes.length;
      setSelectedPlayerId(votes[nextIndex].playerId);
    }
  };
  const handleBackspace = () => {
    if (selectedPlayerId === null) return;
    setVotes((prev) => prev.filter((v) => v.playerId !== selectedPlayerId));
    const remaining = votes.filter((v) => v.playerId !== selectedPlayerId);
    setSelectedPlayerId(remaining[0]?.playerId ?? null);
  };

  const handleStartVoting = () => {
    setSelectedPlayerId(null);
    setIsCounting(false);
    setRound(1);
    setFirstRoundCandidates([]);
    setCurrentPhase('voting');
  };

  useEffect(() => {
    if (currentPhase === 'voting' && votes.length > 0) {
      setSelectedPlayerId((prev) => (prev === null ? votes[0].playerId : prev));
      const id = requestAnimationFrame(() => {
        firstVoteBtnRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [currentPhase, votes]);

  const handleCount = () => {
    const voted = votes.filter((v) => v.votesCount > 0);
    if (voted.length === 0) {
      setIsCounting(false);
      return;
    }
    const maxVotes = Math.max(...voted.map((v) => v.votesCount));
    const candidates = voted.filter((v) => v.votesCount === maxVotes);
    if (candidates.length === 1) {
      saveResult([candidates[0].playerId]);
    } else {
      if (round === 1) {
        setFirstRoundCandidates(candidates.map((c) => c.playerId));
        setVotes(candidates.map((v) => ({ playerId: v.playerId, votesCount: 0 })));
        setRound(2);
        setIsCounting(false);
      } else if (round === 2) {
        const currentIds = candidates.map((c) => c.playerId);
        const same =
          firstRoundCandidates.length === currentIds.length &&
          firstRoundCandidates.every((id) => currentIds.includes(id));
        if (same) {
          if (voted.length === votes.length) setIsCounting(true);
          else saveResult(currentIds);
        } else {
          setVotes(candidates.map((v) => ({ playerId: v.playerId, votesCount: 0 })));
          setRound(3);
          setIsCounting(false);
        }
      } else if (round === 3) {
        if (voted.length === votes.length) setIsCounting(true);
        else saveResult(candidates.map((c) => c.playerId));
      }
    }
  };

  const handleLeft = () => saveResult([]);
  const handleRaised = () => {
    const voted = votes.filter((v) => v.votesCount > 0);
    saveResult(voted.map((v) => v.playerId));
  };

  const saveResult = (playerIds) => {
    const voteSummary = playerIds.length > 0 ? playerIds.join(', ') : '-';
    setVotingResults((prev) => ({
      ...prev,
      [currentDay]: { votes: voteSummary },
    }));
    setVotes([]);
    setSelectedPlayerId(null);
    setIsCounting(false);
    setRound(1);
    setFirstRoundCandidates([]);
    setCurrentPhase('shooting');
  };

  /* =========
     ФАЗЫ НОЧИ
     ========= */
  const handlePhaseButtonClick = (value, phase) => {
    const result = value === 'miss' ? '-' : value.toString();
    const days = ['Д.1', 'Д.2', 'Д.3', 'Д.4', 'Д.5'];
    if (phase === 'shooting') {
      setShootingResults((prev) => ({ ...prev, [currentDay]: { result } }));
      setCurrentPhase('don');
    } else if (phase === 'don') {
      setDonResults((prev) => ({ ...prev, [currentDay]: { result } }));
      setCurrentPhase('sheriff');
    } else if (phase === 'sheriff') {
      setSheriffResults((prev) => ({ ...prev, [currentDay]: { result } }));
      const nextIndex = days.indexOf(currentDay) + 1;
      if (nextIndex < days.length) setCurrentDay(days[nextIndex]);
      setCurrentPhase('nominating');
    }
  };

  /* ==========================
     ЗАГРУЗКА ДАННЫХ ИЗ СЕРВЕРА
     ========================== */
  const bootstrapEmptyGame = () => {
    setVotingResults({});
    setShootingResults({});
    setDonResults({});
    setSheriffResults({});
    setCurrentDay('Д.1');
    setCurrentPhase('nominating');
    setBadgeColor('red');
  };

  const fetchGameData = async () => {
    setLoading(true);
    setServerUnavailable(false);

    const savedData = localStorage.getItem(getLocalStorageKey());
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setPlayers(data.players);
        setVotingResults(data.gameInfo.votingResults || {});
        setShootingResults(data.gameInfo.shootingResults || {});
        setDonResults(data.gameInfo.donResults || {});
        setSheriffResults(data.gameInfo.sheriffResults || {});
        setCurrentDay(data.currentDay || 'Д.1');
        setCurrentPhase(data.currentPhase || 'nominating');
        setBadgeColor(data.badgeColor || 'red');
        setLoading(false);
        console.log("Данные игры загружены из localStorage.");
        return;
      } catch (e) {
        console.error("Ошибка парсинга данных из localStorage", e);
        localStorage.removeItem(getLocalStorageKey());
      }
    }

    try {
      const response = await fetch(`/api/getGameData/${gameId}`);
      if (response.status === 404) {
        bootstrapEmptyGame();
        return;
      }
      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }
      const data = await response.json();
      if (data.players) setPlayers(data.players);
      if (data.gameInfo) {
        setVotingResults(data.gameInfo.votingResults || {});
        setShootingResults(data.gameInfo.shootingResults || {});
        setDonResults(data.gameInfo.donResults || {});
        setSheriffResults(data.gameInfo.sheriffResults || {});
      }
      if (data.currentDay) setCurrentDay(data.currentDay);
      if (data.currentPhase) setCurrentPhase(data.currentPhase);
      if (data.badgeColor) setBadgeColor(data.badgeColor);
    } catch (err) {
      console.error('Ошибка загрузки данных игры:', err);
      bootstrapEmptyGame();
      setServerUnavailable(true);
      showMessage('Не удалось загрузить данные игры. Открыта пустая игра.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const clearSavedData = () => {
    localStorage.removeItem(getLocalStorageKey());
    setPlayers(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: '',
        fouls: 0,
        best_move: '',
        role: 'мирный',
        plus: 2.5,
        sk: 0,
        jk: 0,
      }))
    );
    bootstrapEmptyGame();
    showMessage("Сохраненные данные для этой игры очищены.");
  };

  // ИЗМЕНЕНИЕ: Функция для очистки кэша списков на странице рейтинга
  const clearRatingPageCache = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('players_') || key.startsWith('games_') || key.startsWith('detailedStats_')) {
        localStorage.removeItem(key);
      }
    });
    console.log("Кэш страницы рейтинга очищен.");
  };

  /* =======================
     СОХРАНЕНИЕ НА СЕРВЕРЕ
     ======================= */
  const handleSave = async () => {
    if (!isAdmin) {
      showMessage('Только администратор может сохранять данные.', true);
      return;
    }

    setIsSaving(true);
    const dataToSave = {
      gameId,
      eventId,
      players,
      fouls: players.map(({ id, fouls }) => ({ playerId: id, fouls })),
      gameInfo: { votingResults, shootingResults, donResults, sheriffResults },
      currentDay,
      currentPhase,
      badgeColor,
    };

    try {
      const response = await fetch('/api/saveGameData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        const result = await response.json();
        showMessage(result.message);
        localStorage.removeItem(getLocalStorageKey());
        // ИЗМЕНЕНИЕ: Очищаем кэш списков после успешного сохранения
        clearRatingPageCache();
        // ИЗМЕНЕНИЕ: Перенаправляем на страницу рейтинга, на вкладку "Игры"
        setTimeout(() => navigate('/rating', { state: { defaultTab: 'Игры' } }), 500);
      } else {
        let errorMsg = 'Неизвестная ошибка';
        if (response.status === 403) {
          errorMsg = 'У вас нет прав для сохранения (требуется роль admin).';
        } else if (response.status === 404) {
          errorMsg = 'Игра не найдена.';
        } else {
          const errorData = await response.json().catch(() => ({}));
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

  /* =========
     РЕНДЕР
     ========= */
  if (loading) {
    return <div>Загрузка данных игры...</div>;
  }

  return (
    <>
      {serverUnavailable && (
        <div
          className={styles.notification}
          style={{ backgroundColor: '#333', color: 'white', padding: '10px', marginBottom: '10px' }}
        >
          Сервер недоступен. Открыта пустая игра. Сохранение может быть недоступно.
        </div>
      )}
      {successMessage && (
        <div
          className={styles.notification}
          style={{ backgroundColor: 'green', color: 'white', padding: '10px', marginBottom: '10px' }}
        >
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div
          className={styles.notification}
          style={{ backgroundColor: 'red', color: 'white', padding: '10px', marginBottom: '10px' }}
        >
          {errorMessage}
        </div>
      )}

      <div
        className={styles.gameWrapper}
        style={isPenaltyTime ? { border: '3px solid #030303', padding: '10px' } : undefined} // Визуальная индикация штрафного времени
      >
        <table className={styles.playersTable} aria-label="Таблица игроков">
          <thead>
            <tr>
              <th>№</th>
              <th>Имя</th>
              <th>Роль</th>
              <th>Лучший ход</th>
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
                  onClick={() => !isPenaltyTime && handlePlayerNumberClick(player.id)} // Дизейбл если штрафное время
                  style={{
                    cursor: isPenaltyTime ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    opacity: isPenaltyTime ? 0.5 : 1
                  }}
                  tabIndex={isPenaltyTime ? -1 : 0}
                  onKeyDown={(e) => {
                    if (isPenaltyTime) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePlayerNumberClick(player.id);
                    }
                  }}
                  aria-label={`Выставить игрока ${player.id} на голосование`}
                  aria-disabled={isPenaltyTime}
                >
                  {player.id}
                </td>

                <td>
                  <input
                    type="text"
                    className={styles.nameInput}
                    value={player.name}
                    placeholder={`Игрок ${player.id}`}
                    onChange={(e) => !isPenaltyTime && handleNameChange(player.id, e.target.value)} // Дизейбл
                    disabled={isPenaltyTime}
                    aria-label={`Имя игрока ${player.id}`}
                  />
                </td>

                <td>
                  <RoleDropdown
                    value={player.role}
                    onChange={(role) => handleRoleChange(player.id, role)}
                    roles={roles}
                    disabled={isPenaltyTime} // Дизейбл
                  />
                </td>

                <td>
                  <input
                    type="text"
                    className={styles.lxInput}
                    value={player.best_move}
                    onChange={(e) => !isPenaltyTime && handleBestMoveChange(player.id, e.target.value)} // Дизейбл
                    disabled={isPenaltyTime}
                    aria-label={`Лучший ход игрока ${player.id}`}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    className={styles.dopsInput}
                    value={player.plus}
                    onChange={(e) => !isPenaltyTime && handlePlusChange(player.id, e.target.value)} // Дизейбл
                    disabled={isPenaltyTime}
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
                    onChange={(e) => !isPenaltyTime && handleSkChange(player.id, e.target.value)} // Дизейбл
                    disabled={isPenaltyTime}
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
                    onChange={(e) => !isPenaltyTime && handleJkChange(player.id, e.target.value)} // Дизейбл
                    disabled={isPenaltyTime}
                    aria-label={`ЖК игрока ${player.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.rightColumn}>
          <div className={styles.contentContainer}>
            <div className={styles.timerBlock}>
              <div className={styles.timerContainer}>
                <div
                  className={isRunning ? styles.timerTimeRunning : styles.timerTimePaused}
                  onClick={() => !isPenaltyTime && toggleTimer()} // Дизейбл
                  style={{ cursor: isPenaltyTime ? 'not-allowed' : 'pointer', opacity: isPenaltyTime ? 0.5 : 1 }}
                  aria-label="Таймер, нажмите для запуска/паузы"
                  role="timer"
                  aria-disabled={isPenaltyTime}
                >
                  {formatTime(time)}
                </div>
                <button
                  className={styles.resetBtn}
                  onClick={() => !isPenaltyTime && resetTimer()} // Дизейбл
                  type="button"
                  disabled={isPenaltyTime}
                >
                  Сброс
                </button>
                <div className={styles.timerButtons}>
                  <button
                    className={styles.timerBtn}
                    onClick={() => !isPenaltyTime && startTimerLimited(20)} // Дизейбл
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    20
                  </button>
                  <button
                    className={styles.timerBtn}
                    onClick={() => !isPenaltyTime && startTimerLimited(30)} // Дизейбл
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    30
                  </button>
                  <button
                    className={styles.timerBtn}
                    onClick={() => !isPenaltyTime && startTimerLimited(60)} // Дизейбл
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    60
                  </button>
                  <button
                    className={styles.timerBtn}
                    onClick={() => updateTimer(30)}
                    type="button"
                  >
                    +30
                  </button>
                </div>
              </div>
            </div>

            {/* Дизейбл фаз, если штрафное время */}
            {currentPhase === 'nominating' && !isPenaltyTime && (
              <div className={styles.votingContainer}>
                <nav aria-label="Список игроков для выставления" className={styles.votingNav}>
                  {votes.length === 0 && <p className={styles.noVotesText}>Нет выбранных игроков для выставления.</p>}
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

                <div role="grid" aria-label="Цифровая клавиатура для выставления" className={styles.keyboardGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
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
                  <button type="button" onClick={handleBackspace} className={styles.keyboardBtn} aria-label="Удалить игрока из выставления">
                    ⮾
                  </button>
                </div>

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

            {currentPhase === 'voting' && !isPenaltyTime && (
              <div className={styles.votingContainer}>
                <nav aria-label="Список игроков для голосования" className={styles.votingNav}>
                  {votes.length === 0 && <p className={styles.noVotesText}>Нет выбранных игроков для голосования.</p>}
                  {votes.map(({ playerId, votesCount }, index) => {
                    const isSelected = playerId === selectedPlayerId;
                    return (
                      <div key={playerId} className={styles.playerVoteItem}>
                        <button
                          type="button"
                          ref={index === 0 ? firstVoteBtnRef : null}
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

                <div role="grid" aria-label="Цифровая клавиатура для голосования" className={styles.keyboardGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0].map((num) => (
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
                    aria-label="Удалить игрока из голосования"
                  >
                    ⮾
                  </button>
                </div>

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
                    <button type="button" onClick={handleLeft} className={styles.countBtn} aria-label="Оставили - поставить прочерк">
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

            {currentPhase === 'shooting' && !isPenaltyTime && (
              <div className={styles.phaseContainer}>
                <h3>Стрельба</h3>
                <div className={styles.keyboardGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button key={num} type="button" onClick={() => handlePhaseButtonClick(num, 'shooting')} className={styles.keyboardBtn}>
                      {num}
                    </button>
                  ))}
                  <button type="button" onClick={() => handlePhaseButtonClick('miss', 'shooting')} className={styles.keyboardBtn}>
                    Промах
                  </button>
                </div>
              </div>
            )}

            {currentPhase === 'don' && !isPenaltyTime && (
              <div className={styles.phaseContainer}>
                <h3>Дон</h3>
                <div className={styles.keyboardGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button key={num} type="button" onClick={() => handlePhaseButtonClick(num, 'don')} className={styles.keyboardBtn}>
                      {num}
                    </button>
                  ))}
                  <button type="button" onClick={() => handlePhaseButtonClick('miss', 'don')} className={styles.keyboardBtn}>
                    -
                  </button>
                </div>
              </div>
            )}

            {currentPhase === 'sheriff' && !isPenaltyTime && (
              <div className={styles.phaseContainer}>
                <h3>Шериф</h3>
                <div className={styles.keyboardGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button key={num} type="button" onClick={() => handlePhaseButtonClick(num, 'sheriff')} className={styles.keyboardBtn}>
                      {num}
                    </button>
                  ))}
                  <button type="button" onClick={() => handlePhaseButtonClick('miss', 'sheriff')} className={styles.keyboardBtn}>
                    -
                  </button>
                </div>
              </div>
            )}

            <div className={styles.tabs}>
              <button
                type="button"
                onClick={() => !isPenaltyTime && setActiveTab('gameInfo')} // Дизейбл вкладки "Ход игры"
                className={activeTab === 'gameInfo' ? styles.activeTab : styles.tab}
                aria-selected={activeTab === 'gameInfo'}
                disabled={isPenaltyTime}
                style={isPenaltyTime ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                Ход игры
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fouls')} // Вкладка "Фолы" всегда активна
                className={activeTab === 'fouls' ? styles.activeTab : styles.tab}
                aria-selected={activeTab === 'fouls'}
              >
                Фолы
              </button>
            </div>

            <div
              className={styles.tabPanels}
              ref={tabPanelsRef}
              style={{ height: tabHeight ? `${tabHeight}px` : 'auto' }}
            >
              <div
                ref={gameInfoPanelRef}
                className={`${styles.panel} ${activeTab === 'gameInfo' ? styles.visiblePanel : styles.hiddenPanel}`}
                style={isPenaltyTime ? { pointerEvents: 'none', opacity: 0.5 } : undefined} // Дизейбл панели
              >
                <GameInfo
                  votingResults={votingResults}
                  shootingResults={shootingResults}
                  donResults={donResults}
                  sheriffResults={sheriffResults}
                />
              </div>

              <div
                ref={foulsPanelRef}
                className={`${styles.panel} ${activeTab === 'fouls' ? styles.visiblePanel : styles.hiddenPanel}`}
              >
                <FoulsComponent
                  players={players}
                  onIncrementFoul={incrementFouls}
                  onIncrementDFouls={incrementDFouls}
                  isPenaltyTime={isPenaltyTime}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.saveButtonContainer}>
        <BadgeDropdown value={badgeColor} onChange={setBadgeColor} disabled={isPenaltyTime} /> 
        <button
          type="button"
          onClick={() => !isPenaltyTime && clearSavedData()} // Дизейбл
          className={styles.clearBtn}
          disabled={isPenaltyTime}
        >
          Очистить форму
        </button>
        <button
          type="button"
          onClick={() => !isPenaltyTime && handleSave()} // Дизейбл
          className={styles.saveBtn}
          aria-label="Сохранить данные игры"
          disabled={!isAdmin || isSaving || isPenaltyTime}
          title={!isAdmin ? 'Только администратор может сохранять данные' : isPenaltyTime ? 'Недоступно в штрафное время' : undefined}
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </>
  );
};

export default Game;