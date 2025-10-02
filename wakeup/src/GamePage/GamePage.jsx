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

const FoulsComponent = ({ players, onIncrementFoul }) => {
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
              onClick={() => !atMax && onIncrementFoul(player.id)}
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

// Выпадающий список для цвета бейджа
const BadgeDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = [
    { label: 'Красные', value: 'red' },
    { label: 'Черные', value: 'black' },
    { label: 'Ничья', value: 'drow' },
  ];
  const currentLabel = options.find((opt) => opt.value === value)?.label || 'Красные';

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
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
  const { gameId, eventId } = useParams(); // Исправлено: useParams возвращает объект
  const navigate = useNavigate();

  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [maxTime, setMaxTime] = useState(null);

  const { user, token } = useContext(AuthContext) ?? { user: null, token: null };
  const isAdmin = user && user.role === 'admin';

  const [players, setPlayers] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Игрок ${i + 1}`,
      fouls: 0,
      lx: '',
      role: '-',
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
  const [activeTab, setActiveTab] = useState('gameInfo');
  const [badgeColor, setBadgeColor] = useState('red');

  // Загрузка/ошибки
  const [loading, setLoading] = useState(true);
  const [serverUnavailable, setServerUnavailable] = useState(false);

  // Модал/уведомления удалены, так как аутентификация через JWT
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 🔎 refs для автофокуса и «антипрыга» вкладок
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

  /* =================
     УПРАВЛЕНИЕ ФОРМОЙ
     ================= */
  const handleNameChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name: value } : p)));
  const incrementFouls = (id) =>
    setPlayers((prev) =>
      prev.map((p) => (p.id === id && p.fouls < 3 ? { ...p, fouls: p.fouls + 1 } : p))
    );
  const handleRoleChange = (id, role) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  const handleLxChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, lx: value } : p)));
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

  // 🔥 Автофокус на первом кандидате после перехода в фазу голосования
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
  }, [gameId]);

  /* =======================
     СОХРАНЕНИЕ НА СЕРВЕРЕ
     ======================= */
  const handleSave = async () => {
    if (!isAdmin) {
      showMessage('Только администратор может сохранять данные.', true);
      return;
    }
    const errors = [];
    players.forEach((player) => {
      if (player.role === '-' || player.role.trim() === '') {
        errors.push(`Игрок ${player.id} (${player.name}): роль не заполнена.`);
      }
    });
    if (errors.length > 0) {
      showMessage(
        `Ошибки валидации: ${errors.join('; ')} Пожалуйста, заполните все роли перед сохранением.`,
        true
      );
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
      console.log('Token before fetch:', token);
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
        setTimeout(() => navigate('/'), 500);
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
      {/* уведомления */}
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

      <div className={styles.gameWrapper}>
        {/* Таблица игроков */}
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

        {/* Правая колонка */}
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

            {/* Фазы */}
            {currentPhase === 'nominating' && (
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
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0].map((num) => (
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

            {currentPhase === 'voting' && (
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

            {currentPhase === 'shooting' && (
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

            {currentPhase === 'don' && (
              <div className={styles.phaseContainer}>
                <h3>Дон</h3>
                <div className={styles.keyboardGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button key={num} type="button" onClick={() => handlePhaseButtonClick(num, 'don')} className={styles.keyboardBtn}>
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
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button key={num} type="button" onClick={() => handlePhaseButtonClick(num, 'sheriff')} className={styles.keyboardBtn}>
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Вкладки и содержимое */}
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

            {/* АНТИПРЫГ: обе панели всегда в DOM, одна видима */}
            <div
              className={styles.tabPanels}
              ref={tabPanelsRef}
              style={{ height: tabHeight ? `${tabHeight}px` : 'auto' }}
            >
              <div
                ref={gameInfoPanelRef}
                className={`${styles.panel} ${activeTab === 'gameInfo' ? styles.visiblePanel : styles.hiddenPanel}`}
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
                <FoulsComponent players={players} onIncrementFoul={incrementFouls} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка сохранения + выбор победителя */}
      <div className={styles.saveButtonContainer}>
        <BadgeDropdown value={badgeColor} onChange={setBadgeColor} />
        <button
          type="button"
          onClick={handleSave}
          className={styles.saveBtn}
          aria-label="Сохранить данные игры"
          disabled={!isAdmin || isSaving}
          title={!isAdmin ? 'Только администратор может сохранять данные' : undefined}
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </>
  );
};

export default Game;
