import React, { useState, useEffect, useContext, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './GamePage.module.css';
import { AuthContext } from '../AuthContext';
import OBSWebSocket from "obs-websocket-js";

// --- КОМПОНЕНТ ДЛЯ ИНПУТА С ПОДСКАЗКАМИ ---
const SuggestionInput = ({ value, onChange, placeholder, disabled, className }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isActive, setIsActive] = useState(false);
    const debounceTimeoutRef = useRef(null);

    const fetchSuggestions = (query) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(async () => {
            if (query.length < 1) {
                setSuggestions([]);
                return;
            }
            try {
                const response = await fetch(`/api/get_player_suggestions?query=${query}`);
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data);
                } else {
                    setSuggestions([]);
                }
            } catch (error) {
                console.error("Failed to fetch suggestions:", error);
                setSuggestions([]);
            }
        }, 300);
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);
        fetchSuggestions(newValue);
    };

    const handleSuggestionClick = (name) => {
        onChange(name);
        setSuggestions([]);
    };

    return (
        <div className={styles.nameInputContainer}>
            <input
                type="text"
                className={`${styles.nameInput} ${className || ''}`}
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                onFocus={() => setIsActive(true)}
                onBlur={() => setTimeout(() => setIsActive(false), 200)}
                disabled={disabled}
                autoComplete="off"
            />
            {isActive && suggestions.length > 0 && (
                <div className={styles.suggestionsList}>
                    {suggestions.map((name, index) => (
                        <div
                            key={index}
                            className={styles.suggestionItem}
                            onMouseDown={() => handleSuggestionClick(name)}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};



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

const FoulsComponent = ({ players, onIncrementFoul, onIncrementDFouls, onDecrementFoul, isPenaltyTime }) => {
  const holdDuration = 500; // Время удержания в мс
  const holdTimers = useRef({}); // Для хранения таймеров для каждого игрока

  const startHold = (playerId) => (event) => {
    event.preventDefault(); // Предотвращает обычный клик
    holdTimers.current[playerId] = setTimeout(() => {
      onDecrementFoul(playerId);
    }, holdDuration);
  };

  const endHold = (playerId) => () => {
    if (holdTimers.current[playerId]) {
      clearTimeout(holdTimers.current[playerId]);
      delete holdTimers.current[playerId];
    }
  };

return (
  <div className={styles.foulsWrapper}>
    <div className={styles.foulsGrid}>
      {players.map((player) => {
        const atMax = player.fouls >= 3;
        const atMin = player.fouls <= 0;
        const deadStyle = !player.alive ? { opacity: 0.4, filter: 'grayscale(100%)' } : {};

        return (
          <div
            key={player.id}
            className={styles.foulCard}
            role="button"
            tabIndex={0}
            aria-disabled={atMax || isPenaltyTime}
            aria-label={`Добавить фол игроку ${player.id}`}
            onClick={() => !atMax && !isPenaltyTime ? onIncrementFoul(player.id) : onIncrementDFouls(player.id)}
            onMouseDown={!atMin ? startHold(player.id) : undefined}
            onMouseUp={!atMin ? endHold(player.id) : undefined}
            onTouchStart={!atMin ? startHold(player.id) : undefined}
            onTouchEnd={!atMin ? endHold(player.id) : undefined}
            style={{ ...deadStyle }}
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
)
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
  const [selectedVoteValue, setSelectedVoteValue] = useState(null);
  const [firstVoteValue, setFirstVoteValue] = useState(null);


  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [maxTime, setMaxTime] = useState(null);
  const [isPenaltyTime, setIsPenaltyTime] = useState(false);

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
  const locations = ['МИЭТ', 'МФТИ'];
  // OBS
  const[obsAddress,setObsAddress ]=useState()
  const[obsPassword,setObsPassword ]=useState()

  // OBS WebSocket instance
  const obsRef = useRef(null);

  // Функция для подключения к OBS (с debounce для избежания частых вызовов)
  const connectToOBS = useRef(null);

 const attemptConnectOBS = async (address, password) => {
  if (!address || !password) {
    // Если поля пустые, отключаемся
    if (obsRef.current) {
      try {
        await obsRef.current.disconnect();
        console.log("🔌 Отключено от OBS");
      } catch (err) {
        console.error("Ошибка отключения от OBS:", err);
      }
      obsRef.current = null;
    }
    return;
  }

  // Отключаемся от предыдущего соединения, если оно существует
  if (obsRef.current) {
    try {
      await obsRef.current.disconnect();
    } catch (err) {
      // Игнорируем ошибки отключения
    }
  }

  // Убеждаемся, что адрес — полный WebSocket URL
  let fullAddress = address.trim();
  if (!fullAddress.startsWith('ws://') && !fullAddress.startsWith('wss://')) {
    fullAddress = 'ws://' + fullAddress;
  }

  const obs = new OBSWebSocket();
  obsRef.current = obs;

  try {
    await obs.connect(fullAddress, password);
    console.log("✅ Подключено к OBS:", fullAddress);
  } catch (err) {
    console.error("Ошибка подключения к OBS:", err);
    obsRef.current = null; // Сбрасываем ref при ошибке
  }
};

  const switchScene = async (sceneName) => {
  if (!obsRef.current) {
    console.warn('OBS не инициализирован, невозможно переключить сцену');
    return;
  }

  try {
    // Если не подключено, пытаемся подключиться на основе введенных данных
    if (!obsRef.current.identified) {
      const address = obsAddress;
      const password = obsPassword;
      if (!address || !password) {
        console.warn('Адрес или пароль OBS не указаны, невозможно подключиться');
        return;
      }

      let fullAddress = address.trim();
      if (!fullAddress.startsWith('ws://') && !fullAddress.startsWith('wss://')) {
        fullAddress = 'ws://' + fullAddress;
      }

      await obsRef.current.connect(fullAddress, password);
      console.log("✅ Подключено к OBS для переключения сцены:", fullAddress);
    }

    // Используем правильный метод и параметр для OBS Studio 31 (WebSocket 5.x)
    // Параметр должен быть 'sceneName', а не 'scene-name'
    await obsRef.current.call('SetCurrentProgramScene', { sceneName });
    console.log(`✅ Сцена переключена на "${sceneName}"`);
  } catch (err) {
    console.error(`❌ Ошибка переключения сцены на "${sceneName}":`, err);
  }
};

  // Debounced подключение (чтобы не подключаться при каждом нажатии клавиши)
  useEffect(() => {
    if (connectToOBS.current) {
      clearTimeout(connectToOBS.current);
    }

    connectToOBS.current = setTimeout(() => {
      attemptConnectOBS(obsAddress, obsPassword);
    }, 500); // Debounce на 500ms

    return () => {
      if (connectToOBS.current) {
        clearTimeout(connectToOBS.current);
      }
    };
  }, [obsAddress, obsPassword]);

  // Cleanup при размонтировании компонента
  useEffect(() => {
    return () => {
      if (obsRef.current) {
        obsRef.current.disconnect().catch(console.error);
      }
    };
  }, []);

  // Голосование
  const [votes, setVotes] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [round, setRound] = useState(1);
  const [firstRoundCandidates, setFirstRoundCandidates] = useState([]);

  // Итоги/фазы
  const [currentDay, setCurrentDay] = useState('Д.1');
  const [votingResults, setVotingResults] = useState({});
  const [currentPhase, setCurrentPhase] = useState('nominating');
  const [shootingResults, setShootingResults] = useState({});
  const [donResults, setDonResults] = useState({});
  const [sheriffResults, setSheriffResults] = useState({});
  const [activeTab, setActiveTab] = useState('fouls');
  const [badgeColor, setBadgeColor] = useState('red');
  
  const [judgeNickname, setJudgeNickname] = useState('');
  const [location, setLocation] = useState('');

  // показ ролей
  const [visibleRole, setVisibleRole] = useState(true)

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
  const [alivePlayers, setAlivePlayers] = useState([]);
  const aliveCount = alivePlayers.filter(p => p.alive).length;

  const handleNextPhase = () => {
  const days = ['Д.1', 'Д.2', 'Д.3', 'Д.4', 'Д.5'];
  const currentIndex = days.indexOf(currentDay);

  // Теперь подключение к OBS происходит автоматически при изменении полей, так что здесь не нужно

  if (currentPhase === 'nominating') {
    setCurrentPhase('voting');
  } else if (currentPhase === 'voting') {
    setCurrentPhase('shooting');
    switchScene('Ночь');
  } else if (currentPhase === 'shooting') {
    setCurrentPhase('don');
  } else if (currentPhase === 'don') {
    setCurrentPhase('sheriff');
  } else if (currentPhase === 'sheriff') {
    if (currentIndex < days.length - 1) {
      setCurrentDay(days[currentIndex + 1]);
      setCurrentPhase('nominating');
      switchScene('День');
    }
  }
};

const [showConfirmModal, setShowConfirmModal] = useState(false);


const handleClearFormClick = () => {
if (!isPenaltyTime) {
setShowConfirmModal(true);
}
};


const handleConfirmClear = () => {
clearSavedData();
setShowConfirmModal(false);
};


const handleCancelClear = () => {
setShowConfirmModal(false);
};

  // Определение живых игроков (не ушли и не умерли)
  const getAlivePlayers = () => {
    const deadNumbers = new Set();

    Object.values(votingResults).forEach((v) => {
      if (v.votes) {
        v.votes
          .split(',')
          .map((x) => parseInt(x.trim()))
          .filter((n) => !isNaN(n))
          .forEach((n) => deadNumbers.add(n));
      }
    });

    Object.values(shootingResults).forEach((v) => {
      const n = parseInt(v.result);
      if (!isNaN(n)) deadNumbers.add(n);
    });

    return players.map((p) => ({
      ...p,
      alive: !deadNumbers.has(p.id),
    }));
  };

  useEffect(() => {
  setAlivePlayers(getAlivePlayers());
}, [players, votingResults, shootingResults]);

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
      gameInfo: { votingResults, shootingResults, donResults, sheriffResults, judgeNickname },
      currentDay,
      currentPhase,
      badgeColor,
      location,
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
    judgeNickname,
    location,
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

  const startTimer = (seconds) => {
    setMaxTime(seconds);
    setIsRunning(true);
  };

  const updateTimer = (seconds) => {
    setTime(time);
    setMaxTime(maxTime + seconds);
    setIsRunning(true);
    setIsPenaltyTime(true);
  };

  const handlePreviousPhase = () => {
    const days = ['Д.1', 'Д.2', 'Д.3', 'Д.4', 'Д.5'];
    const currentIndex = days.indexOf(currentDay);

    if (currentPhase === 'don') {
      setCurrentPhase('shooting');
    } else if (currentPhase === 'sheriff') {
      setCurrentPhase('don');
    } else if (currentPhase === 'nominating' && currentIndex > 0) {
      setCurrentDay(days[currentIndex - 1]);
      setCurrentPhase('sheriff');
    } else if (currentPhase === 'shooting') {
      setCurrentPhase('voting');
      switchScene('День');
    } else if (currentPhase === 'voting') {
      setCurrentPhase('nominating');
      switchScene('Ночь');
    }
  };


  /* =================
     УПРАВЛЕНИЕ ФОРМОЙ
     ================= */
  const handleNameChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name: value } : p)));
  const incrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id && p.fouls < 3 ? { ...p, fouls: Math.min(p.fouls + 1, 3) } : p))
    );
  };
  const incrementDFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id && p.fouls < 3 ? { ...p, fouls: Math.min(p.fouls + 2, 3) } : p))
    );
    setIsPenaltyTime(false);
  };

  const decrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id && p.fouls > 0 ? { ...p, fouls: Math.max(p.fouls - 1, 0) } : p))
    );
  };

  const handleRoleChange = (id, role) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  const handleBestMoveChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, best_move: value } : p)));
  const handlePlusChange = (id, value) => {
    const numValue = parseFloat(value);
    const clampedValue = Math.max(-2.5, Math.min(numValue, 5.0));
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, plus: isNaN(clampedValue) ? 0 : clampedValue } : p)));
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

  if (firstVoteValue === null) {
    setFirstVoteValue(increment);
  }

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
  setFirstVoteValue(null);
};


  const handleStartVoting = () => {
    setSelectedPlayerId(null);
    setIsCounting(false);
    setRound(1);
    setFirstRoundCandidates([]);
    setCurrentPhase('voting');
  };



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
setSelectedPlayerId(candidates[0].playerId);
setTimeout(() => {
firstVoteBtnRef.current?.focus();
}, 0);
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
setSelectedPlayerId(candidates[0].playerId);
setTimeout(() => {
firstVoteBtnRef.current?.focus();
}, 0);
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
    setJudgeNickname(user?.nickname || '');
    if (user?.club === 'WakeUp | MIET') {
        setLocation('МИЭТ');
    } else if (user?.club === 'WakeUp | MIPT') {
        setLocation('МФТИ');
    } else {
        setLocation('');
    }
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
        setJudgeNickname(data.gameInfo.judgeNickname || user?.nickname || '');
        setLocation(data.location || '');
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
        setJudgeNickname(data.gameInfo.judgeNickname || user?.nickname || '');
      }
      if (data.currentDay) setCurrentDay(data.currentDay);
      if (data.currentPhase) setCurrentPhase(data.currentPhase);
      if (data.badgeColor) setBadgeColor(data.badgeColor);
      if (data.location) setLocation(data.location);
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
  }, [gameId, user]);

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
      gameInfo: { 
        votingResults, 
        shootingResults, 
        donResults, 
        sheriffResults,
        judgeNickname 
      },
      currentDay,
      currentPhase,
      badgeColor,
      location,
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
        clearRatingPageCache();
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
      <div className={styles.topControlsContainer}>
        <div className={styles.btnWrap}>
          <BadgeDropdown value={badgeColor} onChange={setBadgeColor} disabled={isPenaltyTime} />
          <button
            type="button"
            onClick={() => !isPenaltyTime && handleClearFormClick()}
            className={styles.clearBtn}
            disabled={isPenaltyTime}
          >
            Очистить форму
          </button>
          <button
            type="button"
            onClick={() => !isPenaltyTime && setVisibleRole(!visibleRole)}
            disabled={isPenaltyTime}
            className={styles.clearBtn}
          >
            {!visibleRole ? "Показать роли" : "Скрыть роль"}
          </button>
          <button
            type='button'
            className={styles.clearBtn}
            onClick={() => navigate(`/Event/${eventId}/Game/${gameId}/gameWidget`)}
            >
              Виджет
            </button>
        </div>
        {isAdmin && (
          <div className={styles.judgeAndLocationContainer}>
            <div className={styles.judgeInputContainer}>
              <SuggestionInput
                value={judgeNickname}
                onChange={setJudgeNickname}
                placeholder="Судья"
                disabled={isPenaltyTime}
                className={styles.judgeInput}
              />
            </div>
            <div className={styles.locationContainer}>
                <RoleDropdown
                    value={location || "Локация"}
                    onChange={setLocation}
                    roles={locations}
                    disabled={isPenaltyTime}
                />
            </div>
            <div className={styles.obsInputsContainer}>
              <input
                type="text"
                value={obsAddress}
                onChange={(e) => setObsAddress(e.target.value)}
                placeholder="Адрес OBS (например, ws://127.0.0.1:4455)"
                disabled={isPenaltyTime}
                className={styles.obsInput}
              />
              <input
                type="password"
                value={obsPassword}
                onChange={(e) => setObsPassword(e.target.value)}
                placeholder="Пароль OBS"
                disabled={isPenaltyTime}
                className={styles.obsInput}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={styles.gameWrapper}
        style={isPenaltyTime ? { border: '3px solid #030303', padding: '10px' } : undefined}
      >
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
                  onClick={() => !isPenaltyTime && handlePlayerNumberClick(player.id)}
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
                  <SuggestionInput
                    value={player.name}
                    onChange={(value) => handleNameChange(player.id, value)}
                    placeholder={`Игрок ${player.id}`}
                    disabled={isPenaltyTime}
                  />
                </td>

                <td>
                  {visibleRole && <RoleDropdown
                    value={player.role}
                    onChange={(role) => handleRoleChange(player.id, role)}
                    roles={roles}
                    disabled={isPenaltyTime}
                  />}
                </td>

                <td>
                  <input
                    type="text"
                    className={styles.lxInput}
                    value={player.best_move}
                    onChange={(e) => !isPenaltyTime && handleBestMoveChange(player.id, e.target.value)}
                    disabled={isPenaltyTime}
                    aria-label={`Лучший ход игрока ${player.id}`}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    step="0.25"
                    min="-2.5"
                    max="5.0"
                    className={styles.dopsInput}
                    value={player.plus}
                    onChange={(e) => !isPenaltyTime && handlePlusChange(player.id, e.target.value)}
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
                    onChange={(e) => !isPenaltyTime && handleSkChange(player.id, e.target.value)}
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
                    onChange={(e) => !isPenaltyTime && handleJkChange(player.id, e.target.value)}
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
                  onClick={() => !isPenaltyTime && toggleTimer()}
                  style={{ cursor: isPenaltyTime ? 'not-allowed' : 'pointer', opacity: isPenaltyTime ? 0.5 : 1 }}
                  aria-label="Таймер, нажмите для запуска/паузы"
                  role="timer"
                  aria-disabled={isPenaltyTime}
                >
                  {formatTime(time)}
                </div>

                <div className={styles.resetBynWrap}>
                  <button
                    className={styles.resetBtn}
                    onClick={() => !isPenaltyTime && startTimer(60 * 10)}
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    Cтарт
                  </button>
                  <button
                    className={styles.resetBtn}
                    onClick={() => !isPenaltyTime && toggleTimer()}
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    Стоп
                  </button>
                  <button
                    className={styles.resetBtn}
                    onClick={() => !isPenaltyTime && resetTimer()}
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    Сброс
                  </button>
                </div>

                <div className={styles.timerButtons}>
                  <button
                    className={styles.timerBtn}
                    onClick={() => !isPenaltyTime && startTimerLimited(20)}
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    20
                  </button>
                  <button
                    className={styles.timerBtn}
                    onClick={() => !isPenaltyTime && startTimerLimited(30)}
                    type="button"
                    disabled={isPenaltyTime}
                  >
                    30
                  </button>
                  <button
                    className={styles.timerBtn}
                    onClick={() => !isPenaltyTime && startTimerLimited(60)}
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


                  {showConfirmModal && (
      <div className={styles.modalOverlay}>
      <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="confirmClearTitle">
      <h2 id="confirmClearTitle">Подтверждение</h2>
      <p>Вы уверены, что хотите очистить форму?</p>
      <div className={styles.modalButtons}>
      <button onClick={handleConfirmClear} className={styles.confirmBtn}>Да</button>
      <button onClick={handleCancelClear} className={styles.cancelBtn}>Нет</button>
      </div>
      </div>
      </div>
      )}

            {currentPhase === 'nominating' && !isPenaltyTime && (
              <div className={styles.phaseContainer}>
                <div className={styles.votingContainer}>
                  <h3>Выставление</h3>
                <nav  className={styles.votingNav}>
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
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isAlive = alivePlayers.find((p) => p.id === num)?.alive;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePlayerNumberClick(num)}
                        className={styles.keyboardBtn}
                        disabled={!isAlive}
                        aria-label={`Добавить ${num} игрока на выставление`}
                      >
                        {num}
                      </button>
                    );
                  })}
                  <button type="button" onClick={handleBackspace} className={styles.keyboardBtn}>
                    ⮾
                  </button>
                </div>
                
               <div className={styles.phaseNavContainer}>
                  <button
                    className={styles.phaseNavBtn}
                    onClick={handlePreviousPhase}
                    disabled={isPenaltyTime}
                  >
                    ⬅ Назад
                  </button>

                  <button
                    className={styles.phaseNavBtn}
                    onClick={handleNextPhase}
                    disabled={isPenaltyTime}
                  >
                    Вперёд ➡
                  </button>
              </div>
                
                
                </div>
              </div>
            )}

            {currentPhase === 'voting' && !isPenaltyTime && (
            <div className={styles.phaseContainer}>
              <div className={styles.votingContainer}>
                <h3>Голосование</h3>

                <div className={styles.votingNavContainer}>
                  <nav className={styles.votingNav} aria-label="Выбор игрока для голосования">
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
                </div>
              </div>

<div role="grid" aria-label="Цифровая клавиатура для голосования" className={styles.keyboardGrid}>
  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0].map((num) => {
    const totalVotesCast = votes.reduce((sum, v) => sum + v.votesCount, 0);
    const maxAllowed = aliveCount - totalVotesCast;

    const isDisabled =
      selectedPlayerId === null || (num !== 0 && num > maxAllowed);

    return (
      <button
        key={num}
        type="button"
        onClick={() => handleVoteButtonClick(num)}
        className={styles.keyboardBtn}
        disabled={isDisabled}
        aria-label={`Добавить ${num} голосов для игрока ${selectedPlayerId ?? 'не выбран'}`}
      >
        {num}
      </button>
    );
  })}
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
                >
                  Посчитать
                </button>
              ) : (
                <div className={styles.countButtons}>
                  <button type="button" onClick={handleLeft} className={styles.countBtn}>
                    Оставили
                  </button>
                  <button type="button" onClick={handleRaised} className={styles.countBtn}>
                    Подняли
                  </button>
                </div>
              )}

              <div className={styles.phaseNavContainer}>
                <button className={styles.phaseNavBtn} onClick={handlePreviousPhase}>
                  ⬅ Назад
                </button>
                <button className={styles.phaseNavBtn} onClick={handleNextPhase}>
                  Вперёд ➡
                </button>
              </div>
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
                         <div className={styles.phaseNavContainer}>
                  <button
                    className={styles.phaseNavBtn}
                    onClick={handlePreviousPhase}
                    disabled={isPenaltyTime}
                  >
                    ⬅ Назад
                  </button>

                  <button
                    className={styles.phaseNavBtn}
                    onClick={handleNextPhase}
                    disabled={isPenaltyTime}
                  >
                    Вперёд ➡
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
                               <div className={styles.phaseNavContainer}>
                  <button
                    className={styles.phaseNavBtn}
                    onClick={handlePreviousPhase}
                    disabled={isPenaltyTime}
                  >
                    ⬅ Назад
                  </button>

                  <button
                    className={styles.phaseNavBtn}
                    onClick={handleNextPhase}
                    disabled={isPenaltyTime}
                  >
                    Вперёд ➡
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
                             <div className={styles.phaseNavContainer}>
                  <button
                    className={styles.phaseNavBtn}
                    onClick={handlePreviousPhase}
                    disabled={isPenaltyTime}
                  >
                    ⬅ Назад
                  </button>

                  <button
                    className={styles.phaseNavBtn}
                    onClick={handleNextPhase}
                    disabled={isPenaltyTime}
                  >
                    Вперёд ➡
                  </button>
              </div>
              </div>
            )}

            <div className={styles.tabs}>
              <button
                type="button"
                onClick={() => !isPenaltyTime && setActiveTab('gameInfo')}
                className={activeTab === 'gameInfo' ? styles.activeTab : styles.tab}
                aria-selected={activeTab === 'gameInfo'}
                disabled={isPenaltyTime}
                style={isPenaltyTime ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                Ход игры
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

            <div
              className={styles.tabPanels}
              ref={tabPanelsRef}
              style={{ height: tabHeight ? `${tabHeight}px` : 'auto' }}
            >
              <div
                ref={gameInfoPanelRef}
                className={`${styles.panel} ${activeTab === 'gameInfo' ? styles.visiblePanel : styles.hiddenPanel}`}
                style={isPenaltyTime ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
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
                  players={getAlivePlayers()}
                  onIncrementFoul={incrementFouls}
                  onIncrementDFouls={incrementDFouls}
                  onDecrementFoul={decrementFouls}
                  isPenaltyTime={isPenaltyTime}
                />
              </div>
            </div>
          </div>
          </div>
        </div>
      <div className={styles.saveButtonContainer}>
        <button
          type="button"
          onClick={() => !isPenaltyTime && handleSave()}
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
