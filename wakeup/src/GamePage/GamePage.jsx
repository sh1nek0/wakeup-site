import React, { useState, useEffect, useContext, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "./GamePage.module.css";
import { AuthContext } from "../AuthContext";
import SuggestionInput from "../components/SuggestionInput/SuggestionInput";

/* ==========================
   ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
   ========================== */

const GameInfo = ({
  votingResults,
  shootingResults,
  donResults,
  sheriffResults,
  onUpdateVotingResults,
  onUpdateShootingResults,
  isReadOnly,
}) => {
  const days = ["Д.1", "Д.2", "Д.3", "Д.4", "Д.5"];

  return (
    <div className={styles.gameInfoWrapper}>
      <table className={styles.gameInfoTable} aria-label="Информация по игре">
        <thead>
          <tr>
            <th></th>
            {days.map((day) => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ушел</td>
            {days.map((day) => (
              <td key={day}>
                <input
                  type="text"
                  value={votingResults[day]?.votes || ""}
                  onChange={(e) => onUpdateVotingResults(day, e.target.value)}
                  disabled={isReadOnly}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    outline: "none",
                  }}
                />
              </td>
            ))}
          </tr>

          <tr>
            <td>Умер</td>
            {days.map((day) => (
              <td key={day}>
                <input
                  type="text"
                  value={shootingResults[day]?.result || ""}
                  onChange={(e) => onUpdateShootingResults(day, e.target.value)}
                  disabled={isReadOnly}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    outline: "none",
                  }}
                />
              </td>
            ))}
          </tr>

          <tr>
            <td>Дон</td>
            {days.map((day) => (
              <td key={day}>{donResults[day]?.result || ""}</td>
            ))}
          </tr>

          <tr>
            <td>Шериф</td>
            {days.map((day) => (
              <td key={day}>{sheriffResults[day]?.result || ""}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const FoulsComponent = ({
  players,
  onIncrementFoul,
  onIncrementDFouls,
  onDecrementFoul,
  isPenaltyTime,
  isReadOnly,
}) => {
  const holdDuration = 500;
  const holdTimers = useRef({});

  const startHold = (playerId) => (event) => {
    if (isReadOnly) return;
    event.preventDefault();
    holdTimers.current[playerId] = setTimeout(() => {
      onDecrementFoul(playerId);
    }, holdDuration);
  };

  const endHold = (playerId) => () => {
    if (isReadOnly) return;
    if (holdTimers.current[playerId]) {
      clearTimeout(holdTimers.current[playerId]);
      delete holdTimers.current[playerId];
    }
  };

  const handleClick = (playerId, atMax) => {
    if (isReadOnly) return;
    if (atMax) return;

    if (!isPenaltyTime) onIncrementFoul(playerId);
    else onIncrementDFouls(playerId);
  };

  return (
    <div className={styles.foulsWrapper}>
      <div className={styles.foulsGrid}>
        {players.map((player) => {
          const atMax = player.fouls >= 3;
          const atMin = player.fouls <= 0;
          const deadStyle = !player.alive
            ? { opacity: 0.4, filter: "grayscale(100%)" }
            : {};

          return (
            <div
              key={player.id}
              className={styles.foulCard}
              role="button"
              tabIndex={isReadOnly ? -1 : 0}
              aria-disabled={atMax || isReadOnly}
              aria-label={`Добавить фол игроку ${player.id}`}
              onClick={() => handleClick(player.id, atMax)}
              onMouseDown={!atMin ? startHold(player.id) : undefined}
              onMouseUp={!atMin ? endHold(player.id) : undefined}
              onTouchStart={!atMin ? startHold(player.id) : undefined}
              onTouchEnd={!atMin ? endHold(player.id) : undefined}
              style={{ ...deadStyle, cursor: isReadOnly ? "default" : "pointer" }}
            >
              <div className={styles.playerNumber}>{player.id}</div>
              <div className={styles.foulCircles}>
                {[1, 2, 3].map((foulIndex) => (
                  <span
                    key={foulIndex}
                    className={`${styles.foulCircle} ${
                      player.fouls >= foulIndex
                        ? styles.foulActive
                        : styles.foulInactive
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
        onClick={() => !disabled && setIsOpen((v) => !v)}
        style={{
          userSelect: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((v) => !v);
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
                if (e.key === "Enter" || e.key === " ") {
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

const CustomDropdown = ({ value, onChange, options, disabled, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel =
    options.find((opt) => opt.value === value)?.label || options[0]?.label || "";

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={styles.roleDropdown}>
      <div
        className={styles.roleDisplay}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        style={{
          userSelect: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        aria-label={label}
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
              onClick={() => handleSelect(option.value)}
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

const BadgeDropdown = ({ value, onChange, disabled }) => {
  const options = [
    { label: "Красные", value: "red" },
    { label: "Черные", value: "black" },
    { label: "Ничья", value: "drow" },
  ];
  return (
    <CustomDropdown
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      label="Выбор цвета бейджа"
    />
  );
};

/* ==========================
   ОСНОВНОЙ КОМПОНЕНТ
   ========================== */

const Game = () => {
  const { gameId, eventId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();

  const { user, token } = useContext(AuthContext) ?? { user: null, token: null };
  const [eventData,setEventData] = useState({})
  const isJudge = eventData.judges?.some(j => j?.id === user?.id);
  const isAdmin = (!!user && user.role === "admin") || isJudge;


  const queryParams = new URLSearchParams(search);
  const mode = queryParams.get("mode");
  const isReadOnly = !isAdmin || mode === "view";

  const controlWsRef = useRef(null);
const [controlConnected, setControlConnected] = useState(false);
const [agents, setAgents] = useState([]);
const [selectedAgentId, setSelectedAgentId] = useState("");
const [obsHost, setObsHost] = useState("127.0.0.1");
const [obsPort, setObsPort] = useState("4455");
const [obsPass, setObsPass] = useState("R19022004r");
const [obsStatus, setObsStatus] = useState(""); // строка статуса для UI

const makeReqId = () =>
  (window.crypto?.randomUUID?.() || String(Date.now()) + "_" + Math.random());

const buildControlWsUrl = () => {
  // чтобы работало и на проде и локально:
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${proto}://${host}/ws/control?token=${encodeURIComponent(token || "")}`;
};

const getBaseUrl = () => {
  // текущий origin: https://site.com или http://localhost:3000
  const origin = window.location.origin;
  // путь до страницы игры (чтобы были eventId/gameId)
  // Пример: /Event/123/Game/456
  const basePath = `/Event/${eventId}/Game/${gameId}`;
  return origin + basePath;
};

const controlSend = (obj) => {
  const ws = controlWsRef.current;
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(obj));
};

const listAgents = () => {
  controlSend({ type: "list_agents", reqId: makeReqId() });
};

const sendToAgent = (clientId, payload) => {
  controlSend({ type: "send", reqId: makeReqId(), clientId, payload });
};

// Подключение к /ws/control
useEffect(() => {
  if (!isAdmin || !token) return;

  const wsUrl = buildControlWsUrl();
  const ws = new WebSocket(wsUrl);
  controlWsRef.current = ws;

  ws.onopen = () => {
    setControlConnected(true);
    setObsStatus("✅ CONTROL WS connected");
    // сразу загрузим агентов
    listAgents();
  };

  ws.onclose = () => {
    setControlConnected(false);
    setObsStatus("🔌 CONTROL WS disconnected");
  };

  ws.onerror = () => {
    setControlConnected(false);
    setObsStatus("❌ CONTROL WS error");
  };

  ws.onmessage = (e) => {
    let msg = null;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.type === "list_agents_ok") {
      setAgents(Array.isArray(msg.agents) ? msg.agents : []);
      // если агент ещё не выбран — выберем первого
      const first = msg.agents?.[0]?.clientId;
      if (!selectedAgentId && first) setSelectedAgentId(first);
      return;
    }

    // сюда прилетят ответы от агента, если ты на сервере их пробрасываешь в control
    if (msg.type === "agent_event") {
      // пример: {type:"agent_event", clientId:"pc-1", payload:{type:"connect_obs_ok"...}}
      const p = msg.payload || {};
      if (p.type === "connect_obs_ok") setObsStatus("✅ OBS connected on agent");
      if (p.type === "connect_obs_error") setObsStatus("❌ OBS connect error: " + (p.error || ""));
      if (p.type === "set_scene_ok") setObsStatus("✅ Scene switched");
      if (p.type === "set_scene_error") setObsStatus("❌ Scene error: " + (p.error || ""));
      return;
    }

    // fallback
    // console.log("CONTROL MSG", msg);
  };

  return () => {
    try { ws.close(); } catch {}
    controlWsRef.current = null;
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isAdmin, token]);

  const roles = ["мирный", "мафия", "дон", "шериф"];
  const locations = ["МИЭТ", "МФТИ", ""];

  // UI states
  const [showSecondRow, setShowSecondRow] = useState(false);
  const [visibleRole, setVisibleRole] = useState(true);

  const [loading, setLoading] = useState(true);
  const [serverUnavailable, setServerUnavailable] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [autosaveStatus, setAutosaveStatus] = useState(""); // "" | "saving" | "saved" | "error"

  const showMessage = (message, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setSuccessMessage("");
    } else {
      setSuccessMessage(message);
      setErrorMessage("");
    }
    setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 5000);
  };

  // Players
  const [players, setPlayers] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      userId: null,
      name: "",
      fouls: 0,
      best_move: "",
      role: "мирный",
      plus: 2.5,
      sk: 0,
      jk: 0,
    }))
  );

  // Voting + phases
  const [votes, setVotes] = useState([]); // [{playerId, votesCount}]
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [round, setRound] = useState(1);
  const [firstRoundCandidates, setFirstRoundCandidates] = useState([]);
  const [firstVoteValue, setFirstVoteValue] = useState(null);
  const firstVoteBtnRef = useRef(null);

  const [currentDay, setCurrentDay] = useState("Д.1");
  const [currentPhase, setCurrentPhase] = useState("nominating"); // nominating|voting|shooting|don|sheriff

  const [votingResults, setVotingResults] = useState({});
  const [shootingResults, setShootingResults] = useState({});
  const [donResults, setDonResults] = useState({});
  const [sheriffResults, setSheriffResults] = useState({});

  const [badgeColor, setBadgeColor] = useState("red");
  const [judgeNickname, setJudgeNickname] = useState("");
  const [location, setLocation] = useState("");
  const [tableNumber, setTableNumber] = useState("");

  const [breakdownSource, setBreakdownSource] = useState("none");
  const [breakdownPlayerNumber, setBreakdownPlayerNumber] = useState("");

  useEffect(() => {
    if (breakdownSource === "none") setBreakdownPlayerNumber("");
  }, [breakdownSource]);

  // Alive players calc
  const [alivePlayers, setAlivePlayers] = useState([]);
  const aliveCount = alivePlayers.filter((p) => p.alive).length;

  const getAlivePlayers = () => {
    const deadNumbers = new Set();

    Object.values(votingResults).forEach((v) => {
      if (v?.votes) {
        v.votes
          .split(",")
          .map((x) => parseInt(x.trim(), 10))
          .filter((n) => !Number.isNaN(n))
          .forEach((n) => deadNumbers.add(n));
      }
    });

    Object.values(shootingResults).forEach((v) => {
      const n = parseInt(v?.result, 10);
      if (!Number.isNaN(n)) deadNumbers.add(n);
    });

    return players.map((p) => ({ ...p, alive: !deadNumbers.has(p.id) }));
  };

  useEffect(() => {
    setAlivePlayers(getAlivePlayers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, votingResults, shootingResults]);

  // Tabs height fix
  const [activeTab, setActiveTab] = useState("fouls");
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
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const switchScene = async (sceneName) => {
  if (!isAdmin || isReadOnly) return;
  if (!selectedAgentId) {
    console.warn("Нет выбранного агента");
    return;
  }

  // отправляем команду агенту
  sendToAgent(selectedAgentId, {
    type: "set_scene",
    reqId: makeReqId(),
    payload: { sceneName },
  });
}

  useLayoutEffect(() => {
    recalcTabHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, players, votingResults, shootingResults, donResults, sheriffResults]);

  // Timer
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [maxTime, setMaxTime] = useState(null);
  const [isPenaltyTime, setIsPenaltyTime] = useState(false);
  

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
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, maxTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const toggleTimer = () => {
    if (isReadOnly) return;
    setIsRunning((v) => !v);
  };
  const resetTimer = () => {
    if (isReadOnly) return;
    setIsRunning(false);
    setTime(0);
    setMaxTime(null);
    setIsPenaltyTime(false);
  };
  const startTimerLimited = (seconds) => {
    if (isReadOnly) return;
    setTime(0);
    setMaxTime(seconds);
    setIsRunning(true);
  };
  const startTimer = (seconds) => {
    if (isReadOnly) return;
    setMaxTime(seconds);
    setIsRunning(true);
  };
  const updateTimer = (seconds) => {
    if (isReadOnly) return;
    setMaxTime((prev) => (prev ?? 0) + seconds);
    setIsRunning(true);
    setIsPenaltyTime(true);
  };

  // Confirm clear modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const handleClearFormClick = () => {
    if (!isPenaltyTime && !isReadOnly) setShowConfirmModal(true);
  };

  // LocalStorage helpers
  const getLocalStorageKey = () => `gameData-${eventId}-${gameId}`;

  const fetchEventData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const headers = { 'Cache-Control': 'no-cache' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/getEvent/${eventId}`, { headers });
      if (!res.ok) throw new Error("Ошибка загрузки данных ивента");
      const data = await res.json();
      
      setEventData(data);
    } catch (err) {
      console.error("Ошибка загрузки ивента:", err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
  fetchEventData();
}, []);
    


  // Speech recognition
  const [isDetecting, setIsDetecting] = useState(false);
  const recognitionRef = useRef(null);
  const [detectedText, setDetectedText] = useState("");

  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [nominatedInCurrentMinute, setNominatedInCurrentMinute] = useState([]);

  useEffect(() => {
    if (activeSpeaker !== null && detectedText.includes("выставляю")) {
      detectNominationFromSpeech(detectedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpeaker, detectedText]);

  const detectNominationFromSpeech = (text) => {
    if (activeSpeaker === null) {
      console.log("⚠ Сначала нужно указать, у кого минута");
      return;
    }

    const lowerText = String(text || "").toLowerCase();
    if (!lowerText.includes("выставляю")) return;

    const wordToDigit = {
      один: 1,
      два: 2,
      три: 3,
      четыре: 4,
      пять: 5,
      шесть: 6,
      семь: 7,
      восемь: 8,
      девять: 9,
      десять: 10,
    };

    let detectedNumbers = [];

    Object.entries(wordToDigit).forEach(([word, digit]) => {
      if (lowerText.includes(word)) detectedNumbers.push(digit);
    });

    const numberMatches = lowerText.match(/\b([1-9]|10)\b/g);
    if (numberMatches) {
      detectedNumbers = [
        ...new Set([
          ...detectedNumbers,
          ...numberMatches.map((n) => parseInt(n, 10)),
        ]),
      ];
    }

    const validPlayers = detectedNumbers.filter(
      (id) => id >= 1 && id <= 10 && !nominatedInCurrentMinute.includes(id)
    );

    if (validPlayers.length === 0) return;

    setNominatedInCurrentMinute((prev) => {
      const next = [...prev];
      validPlayers.forEach((playerId) => {
        if (!next.includes(playerId)) next.push(playerId);
      });
      return next;
    });

    setVotes((prevVotes) => {
      const nextVotes = [...prevVotes];
      validPlayers.forEach((playerId) => {
        if (!nextVotes.some((v) => v.playerId === playerId)) {
          nextVotes.push({ playerId, votesCount: 0 });
        }
      });
      return nextVotes;
    });

    console.log(`🎙️ Игроки ${validPlayers.join(", ")} выставлены на голосование`);
  };

  const toggleSpeechDetection = () => {
    if (isDetecting) {
      recognitionRef.current?.stop();
      setIsDetecting(false);
      setActiveSpeaker(null);
      return;
    }

    const SpeechRecognition =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Ваш браузер не поддерживает распознавание речи");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (!event.results[i].isFinal) continue;

        const transcript = event.results[i][0].transcript
          .trim()
          .toLowerCase();
        setDetectedText(transcript);
        console.log(`🎧 Распознано: "${transcript}"`);

        if (transcript.includes("спасибо") || transcript.includes("пас")) {
          console.log("🛑 Речь завершена по ключевому слову");
          setActiveSpeaker(null);
          setNominatedInCurrentMinute([]);
          return;
        }

        const matchDigit = transcript.match(
          /игрок номер (\d{1,2}|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять) ваша минута/
        );

        if (matchDigit) {
          let speakerId;
          if (/^\d+$/.test(matchDigit[1])) {
            speakerId = parseInt(matchDigit[1], 10);
          } else {
            const wordToDigit = {
              один: 1,
              два: 2,
              три: 3,
              четыре: 4,
              пять: 5,
              шесть: 6,
              семь: 7,
              восемь: 8,
              девять: 9,
              десять: 10,
            };
            speakerId = wordToDigit[matchDigit[1]];
          }

          if (speakerId) {
            setActiveSpeaker(speakerId);
            setNominatedInCurrentMinute([]);
            console.log(`🎙️ Минута игрока ${speakerId}`);
            return;
          }
        }

        detectNominationFromSpeech(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      setIsDetecting(false);
    };

    recognition.onend = () => {
      setIsDetecting(false);
      setActiveSpeaker(null);
      console.log("🛑 Детекция остановлена");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsDetecting(true);
    console.log("▶️ Детекция запущена");
  };




  const buildGamePayload = () => ({
    gameId,
    eventId,
    players: players.map((p) => ({ ...p, id: p.userId || p.id })),
    fouls: players.map(({ id, fouls }) => ({ playerId: id, fouls })),
    gameInfo: {
      votingResults,
      shootingResults,
      donResults,
      sheriffResults,
      judgeNickname,
      tableNumber: tableNumber ? parseInt(tableNumber, 10) : null,
      breakdownSource,
      breakdownPlayerNumber: breakdownPlayerNumber
        ? parseInt(breakdownPlayerNumber, 10)
        : null,
    },
    currentDay,
    currentPhase,
    badgeColor,
    location,
    tableNumber: tableNumber ? parseInt(tableNumber, 10) : null,
  });

  const postGameState = async (payload, { silent = true } = {}) => {
    const res = await fetch("/api/saveGameData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.detail || res.statusText || `HTTP ${res.status}`;
      if (!silent) throw new Error(msg);
      console.warn("save failed:", msg);
      return { ok: false, msg };
    }

    const data = await res.json().catch(() => ({}));
    console.log(JSON.stringify(payload))
    return { ok: true, msg: data?.message };
  };

  async function validatePlayersBeforeSave(payload) {
  const players = (payload?.players || payload?.gameData?.players || []).map((p) => ({
    name: p.name || p.nickname || p.fullName || "",
    userId: p.userId ?? null,
    id: p.id ?? null,
  }));

  const res = await fetch("/api/validatePlayers", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    body: JSON.stringify({ players }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`validate failed: ${res.status} ${txt}`);
  }
  return res.json(); // { ok, errors, details }
}

  const autosaveTimerRef = useRef(null);
  const autosaveAbortRef = useRef(null);
  const lastAutosavedHashRef = useRef("");

  useEffect(() => {
    console.log("[autosave effect]", {
      loading,
      isReadOnly,
      token: !!token,
      isAdmin,
    });

    if (loading || isReadOnly) return;
    if (!token) return;

    // draft -> localStorage
    const draft = {
      players,
      gameInfo: {
        votingResults,
        shootingResults,
        donResults,
        sheriffResults,
        judgeNickname,
        tableNumber,
        breakdownSource,
        breakdownPlayerNumber,
      },
      currentDay,
      currentPhase,
      badgeColor,
      location,
    };

    try {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(draft));
    } catch (e) {
      console.error("localStorage save error:", e);
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    console.log("[autosave] scheduled");
    autosaveTimerRef.current = setTimeout(async () => {
      const payload = buildGamePayload();
      const hash = JSON.stringify(payload);

      if (hash === lastAutosavedHashRef.current) {
        console.log("[autosave] skip same hash");
        return;
      }

      if (autosaveAbortRef.current) autosaveAbortRef.current.abort();
      const controller = new AbortController();
      autosaveAbortRef.current = controller;

      try {
        setAutosaveStatus("saving");
        console.log("[autosave] FIRE");

        const res = await fetch("/api/saveGameData", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Autosave": "1",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        console.log("[autosave] response", res.status);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn(
            "autosave failed:",
            err?.detail || res.statusText || res.status
          );
          setAutosaveStatus("error");
          return;
        }

        lastAutosavedHashRef.current = hash;
        setAutosaveStatus("saved");
        setTimeout(() => setAutosaveStatus(""), 1200);
      } catch (e) {
        if (e?.name === "AbortError") {
          console.log("[autosave] aborted");
          return;
        }
        console.warn("autosave network error:", e);
        setAutosaveStatus("error");
      }
    }, 800);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (autosaveAbortRef.current) autosaveAbortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    tableNumber,
    breakdownSource,
    breakdownPlayerNumber,
    loading,
    isReadOnly,
    token,
    isAdmin,
    gameId,
    eventId,
  ]);

  // Data load helpers
  const bootstrapEmptyGame = () => {
    setPlayers(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        userId: null,
        name: "",
        fouls: 0,
        best_move: "",
        role: "мирный",
        plus: 2.5,
        sk: 0,
        jk: 0,
      }))
    );
    setVotingResults({});
    setShootingResults({});
    setDonResults({});
    setSheriffResults({});
    setCurrentDay("Д.1");
    setCurrentPhase("nominating");
    setBadgeColor("red");
    setJudgeNickname(user?.nickname || "");
    setTableNumber("");
    setBreakdownSource("none");
    setBreakdownPlayerNumber("");
    if (user?.club === "WakeUp | MIET") setLocation("МИЭТ");
    else if (user?.club === "WakeUp | MIPT") setLocation("МФТИ");
    else setLocation("");
  };

  const processLoadedPlayers = (loadedPlayers) => {
    const base = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      userId: null,
      name: "",
      fouls: 0,
      best_move: "",
      role: "мирный",
      plus: 2.5,
      sk: 0,
      jk: 0,
    }));

    if (Array.isArray(loadedPlayers)) {
      loadedPlayers.forEach((p, i) => {
        if (i < 10) {
          base[i] = { ...base[i], ...p, id: i + 1, userId: p.id };
        }
      });
    }
    return base;
  };

  const fetchGameData = async () => {
    setLoading(true);
    setServerUnavailable(false);

    // draft first (only edit mode)
    const savedData = localStorage.getItem(getLocalStorageKey());
    if (savedData && !isReadOnly) {
      try {
        const data = JSON.parse(savedData);
        setPlayers(processLoadedPlayers(data.players));
        setVotingResults(data.gameInfo?.votingResults || {});
        setShootingResults(data.gameInfo?.shootingResults || {});
        setDonResults(data.gameInfo?.donResults || {});
        setSheriffResults(data.gameInfo?.sheriffResults || {});
        setCurrentDay(data.currentDay || "Д.1");
        setCurrentPhase(data.currentPhase || "nominating");
        setBadgeColor(data.badgeColor || "red");
        setJudgeNickname(data.gameInfo?.judgeNickname || user?.nickname || "");
        setLocation(data.location || "");
        setTableNumber(data.gameInfo?.tableNumber || "");
        setBreakdownSource(data.gameInfo?.breakdownSource || "none");
        setBreakdownPlayerNumber(data.gameInfo?.breakdownPlayerNumber || "");
        setLoading(false);
        console.log("Данные игры загружены из localStorage.");
        return;
      } catch (e) {
        console.error("Ошибка парсинга данных из localStorage", e);
        localStorage.removeItem(getLocalStorageKey());
      }
    }

    // server load
    try {
      const response = await fetch(`/api/getGameData/${gameId}`);
      if (response.status === 404) {
        bootstrapEmptyGame();
        return;
      }
      if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);

      const data = await response.json();

      if (data.players) setPlayers(processLoadedPlayers(data.players));
      if (data.gameInfo) {
        setVotingResults(data.gameInfo.votingResults || {});
        setShootingResults(data.gameInfo.shootingResults || {});
        setDonResults(data.gameInfo.donResults || {});
        setSheriffResults(data.gameInfo.sheriffResults || {});
        setJudgeNickname(data.gameInfo.judgeNickname || user?.nickname || "");
        setTableNumber(data.gameInfo.tableNumber || "");
        setBreakdownSource(data.gameInfo.breakdownSource || "none");
        setBreakdownPlayerNumber(data.gameInfo.breakdownPlayerNumber || "");
      }
      if (data.currentDay) setCurrentDay(data.currentDay);
      if (data.currentPhase) setCurrentPhase(data.currentPhase);
      if (data.badgeColor) setBadgeColor(data.badgeColor);
      if (data.location) setLocation(data.location);
    } catch (err) {
      console.error("Ошибка загрузки данных игры:", err);
      bootstrapEmptyGame();
      setServerUnavailable(true);
      showMessage("Не удалось загрузить данные игры. Открыта пустая игра.", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user, isReadOnly]);

  const clearSavedData = () => {
    localStorage.removeItem(getLocalStorageKey());
    bootstrapEmptyGame();
    showMessage("Сохраненные данные для этой игры очищены.");
  };

  const clearRatingPageCache = () => {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith("players_") ||
        key.startsWith("games_") ||
        key.startsWith("detailedStats_")
      ) {
        localStorage.removeItem(key);
      }
    });
  };

  // Update results from table inputs
  const handleUpdateVotingResults = (day, newVotes) => {
    setVotingResults((prev) => ({ ...prev, [day]: { ...prev[day], votes: newVotes } }));
    switchScene("Ночь")
  };
  const handleUpdateShootingResults = (day, newResult) => {
    setShootingResults((prev) => ({ ...prev, [day]: { ...prev[day], result: newResult } }));
  };

  // Phases navigation
  const handleNextPhase = () => {
    if (isReadOnly) return;
    const days = ["Д.1", "Д.2", "Д.3", "Д.4", "Д.5"];
    const currentIndex = days.indexOf(currentDay);

    if (currentPhase === "nominating") {
      setCurrentPhase("voting");

    } else if (currentPhase === "voting") {
      setCurrentPhase("shooting");
      switchScene("Ночь")
    } else if (currentPhase === "shooting") {
      setCurrentPhase("don");
    } else if (currentPhase === "don") {
      setCurrentPhase("sheriff");
    } else if (currentPhase === "sheriff") {
      if (currentIndex < days.length - 1) {
        setCurrentDay(days[currentIndex + 1]);
        setCurrentPhase("nominating");
        switchScene("День")
        
      }
    }
  };

  const handlePreviousPhase = () => {
    if (isReadOnly) return;
    const days = ["Д.1", "Д.2", "Д.3", "Д.4", "Д.5"];
    const currentIndex = days.indexOf(currentDay);

    if (currentPhase === "don") {
      setCurrentPhase("shooting");
    } else if (currentPhase === "sheriff") {
      setCurrentPhase("don");
    } else if (currentPhase === "nominating" && currentIndex > 0) {
      setCurrentDay(days[currentIndex - 1]);
      setCurrentPhase("sheriff");
    } else if (currentPhase === "shooting") {
      setCurrentPhase("voting");
      switchScene("День")
    } else if (currentPhase === "voting") {
      setCurrentPhase("nominating");
     
    }
  };

  // Player fields handlers
  const handleNameChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name: value } : p)));

  const handleRoleChange = (id, role) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));

  const handleBestMoveChange = (id, value) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, best_move: value } : p)));

  const handlePlusChange = (id, value) => {
    const numValue = parseFloat(value);
    const clampedValue = Math.max(-2.5, Math.min(numValue, 5.0));
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, plus: Number.isNaN(clampedValue) ? 0 : clampedValue } : p
      )
    );
  };

  const handleSkChange = (id, value) => {
    const numValue = Math.max(0, parseInt(value, 10) || 0);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, sk: numValue } : p)));
  };

  const handleJkChange = (id, value) => {
    const numValue = Math.max(0, parseInt(value, 10) || 0);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, jk: numValue } : p)));
  };

  // Fouls handlers
  const incrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === id && p.fouls < 3 ? { ...p, fouls: Math.min(p.fouls + 1, 3) } : p
      )
    );
  };

  const incrementDFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === id && p.fouls < 3 ? { ...p, fouls: Math.min(p.fouls + 2, 3) } : p
      )
    );
    setIsPenaltyTime(false);
  };

  const decrementFouls = (id) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === id && p.fouls > 0 ? { ...p, fouls: Math.max(p.fouls - 1, 0) } : p
      )
    );
  };

  // Voting nomination list
  const handlePlayerNumberClick = (playerId) => {
    if (isReadOnly) return;
    if (!votes.some((v) => v.playerId === playerId)) {
      setVotes((prev) => [...prev, { playerId, votesCount: 0 }]);
      setSelectedPlayerId((prevSelected) => (prevSelected === null ? playerId : prevSelected));
    }
  };

  const handleSelectPlayer = (playerId) => setSelectedPlayerId(playerId);

  const handleVoteChange = (playerId, increment) => {
    setVotes((prev) =>
      prev.map((v) =>
        v.playerId === playerId ? { ...v, votesCount: v.votesCount + increment } : v
      )
    );
  };


  const handleVoteButtonClick = (increment) => {
    if (isReadOnly || selectedPlayerId === null) return;

    if (firstVoteValue === null) setFirstVoteValue(increment);

    if (increment === 0) {
      setVotes((prev) =>
        prev.map((v) =>
          v.playerId === selectedPlayerId ? { ...v, votesCount: 0 } : v
        )
      );
    } else {
      handleVoteChange(selectedPlayerId, increment);
    }

    
    const currentIndex = votes.findIndex((v) => v.playerId === selectedPlayerId);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % votes.length;
      setSelectedPlayerId(votes[nextIndex]?.playerId ?? selectedPlayerId);
    }
  };

  const handleBackspace = () => {
    if (isReadOnly || selectedPlayerId === null) return;

    const remaining = votes.filter((v) => v.playerId !== selectedPlayerId);
    setVotes(remaining);
    setSelectedPlayerId(remaining[0]?.playerId ?? null);
    setFirstVoteValue(null);
  };

  const saveResult = (playerIds) => {
    if (isReadOnly) return;
    const voteSummary = playerIds.length > 0 ? playerIds.join(", ") : "-";
    setVotingResults((prev) => ({ ...prev, [currentDay]: { votes: voteSummary } }));
    setVotes([]);
    setSelectedPlayerId(null);
    setIsCounting(false);
    setRound(1);
    setFirstRoundCandidates([]);
    setCurrentPhase("shooting");
  };




  
const handleCount = () => {
  if (isReadOnly) return;
  const voted = votes.filter((v) => v.votesCount > 0);
  if (voted.length === 0) {
    setIsCounting(false);
    return;
  }
  const maxVotes = Math.max(...voted.map((v) => v.votesCount));
  const candidates = voted.filter((v) => v.votesCount === maxVotes);

  // 🔥 Финал: один кандидат
  if (candidates.length === 1) {
    saveResult([candidates[0].playerId]);
    switchScene("Ночь"); // ✅ ТОЛЬКО здесь!
    return;
  }

  if (round === 1) {
    setFirstRoundCandidates(candidates.map((c) => c.playerId));
    setVotes(candidates.map((v) => ({ playerId: v.playerId, votesCount: 0 })));
    setRound(2);
    setIsCounting(false);
    setSelectedPlayerId(candidates[0].playerId);
    setTimeout(() => firstVoteBtnRef.current?.focus(), 0);
    return;
  }

  if (round === 2) {
    const currentIds = candidates.map((c) => c.playerId);
    const same = firstRoundCandidates.length === currentIds.length && firstRoundCandidates.every((id) => currentIds.includes(id));
    if (same) {
      if (voted.length === votes.length) {
        setIsCounting(true);
      } else {
        saveResult(currentIds);
        switchScene("Ночь"); // ✅ ТОЛЬКО здесь!
      }
    } else {
      setVotes(candidates.map((v) => ({ playerId: v.playerId, votesCount: 0 })));
      setRound(3);
      setIsCounting(false);
      setSelectedPlayerId(candidates[0].playerId);
      setTimeout(() => firstVoteBtnRef.current?.focus(), 0);
    }
    return;
  }

  // round === 3
  if (voted.length === votes.length) {
    setIsCounting(true);
  } else {
    saveResult(candidates.map((c) => c.playerId));
    switchScene("Ночь"); // ✅ ТОЛЬКО здесь!
  }
};


const handleLeft = () => {
  saveResult([]);
};

const handleRaised = () => {
  const voted = votes.filter((v) => v.votesCount > 0);
  saveResult(voted.map((v) => v.playerId));
};

  const handlePhaseButtonClick = (value, phase) => {
    if (isReadOnly) return;

    const result = value === "miss" ? "-" : String(value);
    const days = ["Д.1", "Д.2", "Д.3", "Д.4", "Д.5"];

    if (phase === "shooting") {
      setShootingResults((prev) => ({ ...prev, [currentDay]: { result } }));
      setCurrentPhase("don");
    } else if (phase === "don") {
      setDonResults((prev) => ({ ...prev, [currentDay]: { result } }));
      setCurrentPhase("sheriff");
    } else if (phase === "sheriff") {
      setSheriffResults((prev) => ({ ...prev, [currentDay]: { result } }));
      const nextIndex = days.indexOf(currentDay) + 1;
      if (nextIndex < days.length) setCurrentDay(days[nextIndex]);
      setCurrentPhase("nominating");
      switchScene("День")

    }
  };

  const handleConfirmClear = () => {
    clearSavedData();
    setShowConfirmModal(false);
  };
  const handleCancelClear = () => setShowConfirmModal(false);

  const applyValidationFixesToPayload = (payload, validation) => {
  const players =
    Array.isArray(payload?.players) ? payload.players :
    Array.isArray(payload?.gameData?.players) ? payload.gameData.players :
    null;

  if (!Array.isArray(players)) return payload;

  // Ключ лучше делать (slot id + name), чтобы не промахнуться при одинаковых именах
  const fixes = new Map(
    (validation?.details || [])
      .filter((d) => d && (d.id != null || d.name))
      .map((d) => [`${d.id ?? ""}::${String(d.name ?? "").trim()}`, d])
  );

  const nextPlayers = players.map((p) => {
    const key = `${p?.id ?? ""}::${String(p?.name ?? "").trim()}`;
    const d = fixes.get(key);
    if (!d) return p;

    // Обновляем userId, если сервер подсказал правильный
    if (d.status === "bad" && d.suggestedUserId) {
      return { ...p, userId: d.suggestedUserId };
    }
    return p;
  });

  if (Array.isArray(payload.players)) {
    return { ...payload, players: nextPlayers };
  }
  return { ...payload, gameData: { ...payload.gameData, players: nextPlayers } };
};

const handleSave = async () => {
  if (isReadOnly) {
    showMessage("Нельзя сохранить изменения в режиме просмотра.", true);
    return;
  }

  setIsSaving(true);
  let payload = buildGamePayload();

  try {
    // 1) Первая проверка
    let validation = await validatePlayersBeforeSave(payload);

    // 2) Если есть bad, но сервер дал suggestedUserId — подставляем и проверяем ещё раз
    if (!validation.ok) {
      const canAutoFix = (validation.details || []).some(
        (d) => d?.status === "bad" && d?.suggestedUserId
      );

      if (canAutoFix) {
        payload = applyValidationFixesToPayload(payload, validation);
        validation = await validatePlayersBeforeSave(payload);
      }
    }

    // 3) Если всё ещё не ок — блокируем сохранение
    if (!validation.ok) {
      const preview = (validation.errors || []).slice(0, 5).join("\n");
      showMessage(`Не могу сохранить: проблемы с ID.\n${preview}`, true);
      return;
    }

    // 4) Сохраняем исправленный payload
    const { ok, msg } = await postGameState(payload, { silent: false });
    if (ok) {
      showMessage(msg || "Сохранено");
      localStorage.removeItem(getLocalStorageKey());
      clearRatingPageCache();
      const targetUrl = eventId && eventId !== "1" ? `/Event/${eventId}` : "/rating";
      setTimeout(() => navigate(targetUrl, { state: { defaultTab: "Игры" } }), 500);
    }
  } catch (e) {
    showMessage(String(e.message || e), true);
  } finally {
    setIsSaving(false);
  }
};


  if (loading) return <div>Загрузка данных игры...</div>;

  return (
    <>
      {serverUnavailable && (
        <div
          className={styles.notification}
          style={{
            backgroundColor: "#333",
            color: "white",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          Сервер недоступен. Открыта пустая игра. Сохранение может быть недоступно.
        </div>
      )}

      {autosaveStatus === "saving" && (
        <div
          className={styles.notification}
          style={{
            backgroundColor: "#444",
            color: "white",
            padding: "8px",
            marginBottom: "10px",
          }}
        >
          ⏳ Автосохранение...
        </div>
      )}
      {autosaveStatus === "saved" && (
        <div
          className={styles.notification}
          style={{
            backgroundColor: "#2b7",
            color: "white",
            padding: "8px",
            marginBottom: "10px",
          }}
        >
          ✅ Автосохранено
        </div>
      )}
      {autosaveStatus === "error" && (
        <div
          className={styles.notification}
          style={{
            backgroundColor: "#b22",
            color: "white",
            padding: "8px",
            marginBottom: "10px",
          }}
        >
          ⚠️ Ошибка автосохранения
        </div>
      )}

      {successMessage && (
        <div
          className={styles.notification}
          style={{
            backgroundColor: "green",
            color: "white",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          className={styles.notification}
          style={{
            backgroundColor: "red",
            color: "white",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          {errorMessage}
        </div>
      )}

      {isAdmin && (
        <div className={styles.topControlsContainer}>
          <div className={styles.btnWrap}>
            <BadgeDropdown
              value={badgeColor}
              onChange={setBadgeColor}
              disabled={isPenaltyTime || isReadOnly}
            />

            <button
              type="button"
              onClick={() => !isPenaltyTime && setVisibleRole((v) => !v)}
              disabled={isPenaltyTime || isReadOnly}
              className={styles.clearBtn}
            >
              {!visibleRole ? "Показать роли" : "Скрыть роль"}
            </button>

            <div className={styles.judgeInputContainer}>
              <SuggestionInput
                value={judgeNickname}
                onChange={setJudgeNickname}
                placeholder="Судья"
                disabled={isPenaltyTime || isReadOnly}
                className={styles.judgeInput}
              />
            </div>

            <div className={styles.locationContainer}>
              <RoleDropdown
                value={location || "Локация"}
                onChange={setLocation}
                roles={locations}
                disabled={isPenaltyTime || isReadOnly}
              />
            </div>

            <div className={styles.judgeInputContainer}>
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Стол №"
                disabled={isPenaltyTime || isReadOnly}
                className={styles.judgeInput}
              />
            </div>

            <button
              type="button"
              onClick={() => !isPenaltyTime && handleClearFormClick()}
              className={styles.clearBtn}
              disabled={isPenaltyTime || isReadOnly}
            >
              Очистить
            </button>

            <button
              type="button"
              onClick={() => setShowSecondRow((prev) => !prev)}
              className={styles.clearBtn}
            >
              {showSecondRow ? "Скрыть ряд" : "Показать ряд"}
            </button>

            {showSecondRow && (
              <>
                {false && (<button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => navigate(`/Event/${eventId}/Game/${gameId}/gameWidget`)}
                >
                  Виджет
                </button>)}

                <div className={styles.breakdownControl}>
                  <CustomDropdown
                    value={breakdownSource}
                    onChange={setBreakdownSource}
                    options={[
                      { label: "Нет слома", value: "none" },
                      { label: "От черных", value: "black" },
                      { label: "От красных", value: "red" },
                    ]}
                    disabled={isPenaltyTime || isReadOnly}
                    label="Источник слома"
                  />
                  <span className={styles.breakdownLabel}>в</span>
                  <input
                    type="number"
                    value={breakdownPlayerNumber}
                    onChange={(e) => setBreakdownPlayerNumber(e.target.value)}
                    placeholder="№"
                    disabled={isPenaltyTime || isReadOnly || breakdownSource === "none"}
                    className={styles.breakdownInput}
                  />
                </div>

                {false && (<button
                  type="button"
                  onClick={toggleSpeechDetection}
                  disabled={isPenaltyTime || isReadOnly}
                  className={styles.clearBtn}
                >
                  {isDetecting ? "🛑 Завершить детекцию" : "🎙 Начать детекцию"}
                </button>)}
                <div className={styles.obsInputsContainer}>
  
    <span style={{ fontSize: 12, opacity: 0.8 }}>
      Control: {controlConnected ? "online" : "offline"}
    </span>

    <button
      type="button"
      className={styles.clearBtn}
      onClick={listAgents}
      disabled={!controlConnected}
    >
      🔃 Агенты
    </button>

    <select
      value={selectedAgentId}
      onChange={(e) => setSelectedAgentId(e.target.value)}
      style={{ padding: 6, borderRadius: 6 }}
    >
      <option value="">— агент —</option>
      {agents.map((a) => (
        <option key={a.clientId} value={a.clientId}>
          {a.clientId} ({a.nickname})
        </option>
      ))}
    </select>
  </div>

  
    {false && (<input
      type="text"
      value={obsHost}
      onChange={(e) => setObsHost(e.target.value)}
      placeholder="OBS host (127.0.0.1)"
      className={styles.obsInput}
    />)}
    {false && (<input
      type="number"
      value={obsPort}
      onChange={(e) => setObsPort(e.target.value)}
      placeholder="4455"
      className={styles.obsInput}
    />)}
    {false && (<input
      type="password"
      value={obsPass}
      onChange={(e) => setObsPass(e.target.value)}
      placeholder="OBS password"
      className={styles.obsInput}
    />)}

    <button
      type="button"
      className={styles.clearBtn}
      onClick={() => {
        if (!selectedAgentId) {
          setObsStatus("⚠️ Выбери агента");
          return;
        }

        const baseUrl = getBaseUrl();

        sendToAgent(selectedAgentId, {
          type: "connect_obs",
          reqId: makeReqId(),
          payload: {
            host: obsHost,
            port: Number(obsPort || 4455),
            password: obsPass,

            DAY_BROWSER_URL: `${baseUrl}/gameWidget`,
            NIGHT_BROWSER_URL: `${baseUrl}/gameWidget`,
            SUMMARY_GAME_URL: `${baseUrl}/resultWidget`,
            SUMMARY_TOTAL_URL: `https://wakeupmafia.site/Event/${eventId}/eventWidget`,
          },
        });

        setObsStatus("⏳ connecting OBS...");
      }}
      disabled={!controlConnected}
    >
      Connect OBS
    </button>

    {false && (<button
      type="button"
      className={styles.clearBtn}
      onClick={() => {
        sendToAgent(selectedAgentId, { type: "disconnect_obs", reqId: makeReqId() });
        setObsStatus("🔌 disconnecting OBS...");
      }}
    >
      Disconnect OBS
    </button>)}
  

  {obsStatus && (
    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
      {obsStatus}
    </div>
  )}



                
              </>
            )}
          </div>
        </div>
      )}

      <div
        className={styles.gameWrapper}
        style={isPenaltyTime ? { border: "3px solid #030303", padding: "10px" } : undefined}
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
              {!isAdmin && <th>Фолы</th>}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td
                  className={styles.numberCell}
                  onClick={() => !isPenaltyTime && handlePlayerNumberClick(player.id)}
                  style={{
                    cursor: isPenaltyTime || isReadOnly ? "not-allowed" : "pointer",
                    userSelect: "none",
                    opacity: isPenaltyTime || isReadOnly ? 0.5 : 1,
                  }}
                  tabIndex={isPenaltyTime || isReadOnly ? -1 : 0}
                  onKeyDown={(e) => {
                    if (isPenaltyTime || isReadOnly) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handlePlayerNumberClick(player.id);
                    }
                  }}
                  aria-label={`Выставить игрока ${player.id} на голосование`}
                  aria-disabled={isPenaltyTime || isReadOnly}
                >
                  {player.id}
                </td>

                <td>
                  <SuggestionInput
                    value={player.name}
                    onChange={(value) => handleNameChange(player.id, value)}
                    placeholder={`Игрок ${player.id}`}
                    disabled={isPenaltyTime || isReadOnly}
                    className={styles.nameInput}
                  />
                </td>

                <td>
                  {visibleRole && (
                    <RoleDropdown
                      value={player.role}
                      onChange={(role) => handleRoleChange(player.id, role)}
                      roles={roles}
                      disabled={isPenaltyTime || isReadOnly}
                    />
                  )}
                </td>

                <td>
                  <input
                    type="text"
                    className={styles.lxInput}
                    value={player.best_move}
                    onChange={(e) => !isPenaltyTime && handleBestMoveChange(player.id, e.target.value)}
                    disabled={isPenaltyTime || isReadOnly}
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
                    disabled={isPenaltyTime || isReadOnly}
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
                    disabled={isPenaltyTime || isReadOnly}
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
                    disabled={isPenaltyTime || isReadOnly}
                    aria-label={`ЖК игрока ${player.id}`}
                  />
                </td>

                {!isAdmin && (
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="3"
                      step="1"
                      className={styles.numberInput}
                      value={player.fouls}
                      disabled={isPenaltyTime || isReadOnly}
                      aria-label={`Фолы игрока ${player.id}`}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {isAdmin && (
          <div className={styles.rightColumn}>
            <div className={styles.contentContainer}>
              <div className={styles.timerBlock}>
                <div className={styles.timerContainer}>
                  <div
                    className={isRunning ? styles.timerTimeRunning : styles.timerTimePaused}
                    onClick={() => !isPenaltyTime && toggleTimer()}
                    style={{
                      cursor: isPenaltyTime || isReadOnly ? "not-allowed" : "pointer",
                      opacity: isPenaltyTime || isReadOnly ? 0.5 : 1,
                    }}
                    aria-label="Таймер, нажмите для запуска/паузы"
                    role="timer"
                    aria-disabled={isPenaltyTime || isReadOnly}
                  >
                    {formatTime(time)}
                  </div>

                  <div className={styles.resetBynWrap}>
                    <button
                      className={styles.resetBtn}
                      onClick={() => !isPenaltyTime && startTimer(60 * 10)}
                      type="button"
                      disabled={isPenaltyTime || isReadOnly}
                    >
                      Cтарт
                    </button>
                    <button
                      className={styles.resetBtn}
                      onClick={() => !isPenaltyTime && toggleTimer()}
                      type="button"
                      disabled={isPenaltyTime || isReadOnly}
                    >
                      Стоп
                    </button>
                    <button
                      className={styles.resetBtn}
                      onClick={() => !isPenaltyTime && resetTimer()}
                      type="button"
                      disabled={isPenaltyTime || isReadOnly}
                    >
                      Сброс
                    </button>
                  </div>

                  <div className={styles.timerButtons}>
                    <button
                      className={styles.timerBtn}
                      onClick={() => !isPenaltyTime && startTimerLimited(20)}
                      type="button"
                      disabled={isPenaltyTime || isReadOnly}
                    >
                      20
                    </button>
                    <button
                      className={styles.timerBtn}
                      onClick={() => !isPenaltyTime && startTimerLimited(30)}
                      type="button"
                      disabled={isPenaltyTime || isReadOnly}
                    >
                      30
                    </button>
                    <button
                      className={styles.timerBtn}
                      onClick={() => !isPenaltyTime && startTimerLimited(60)}
                      type="button"
                      disabled={isPenaltyTime || isReadOnly}
                    >
                      60
                    </button>
                    <button
                      className={styles.timerBtn}
                      onClick={() => updateTimer(30)}
                      type="button"
                      disabled={isReadOnly}
                    >
                      +30
                    </button>
                  </div>
                </div>
              </div>

              {showConfirmModal && (
                <div className={styles.modalOverlay}>
                  <div
                    className={styles.modalContent}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirmClearTitle"
                  >
                    <h2 id="confirmClearTitle">Подтверждение</h2>
                    <p>Вы уверены, что хотите очистить форму?</p>
                    <div className={styles.modalButtons}>
                      <button onClick={handleConfirmClear} className={styles.confirmBtn}>
                        Да
                      </button>
                      <button onClick={handleCancelClear} className={styles.cancelBtn}>
                        Нет
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASES */}
              {currentPhase === "nominating" && !isPenaltyTime && (
                <div className={styles.phaseContainer}>
                  <div className={styles.votingContainer}>
                    <h3>Выставление</h3>

                    <nav className={styles.votingNav}>
                      {votes.map(({ playerId, votesCount }) => (
                        <div key={playerId} className={styles.playerVoteItem}>
                          <button
                            type="button"
                            onClick={() => handleSelectPlayer(playerId)}
                            className={
                              playerId === selectedPlayerId
                                ? styles.selectedPlayerBtn
                                : styles.playerBtn
                            }
                            aria-current={playerId === selectedPlayerId ? "true" : undefined}
                            aria-label={`Выбрать игрока ${playerId} для выставления`}
                            disabled={isReadOnly}
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
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                        const isAlive = alivePlayers.find((p) => p.id === num)?.alive;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handlePlayerNumberClick(num)}
                            className={styles.keyboardBtn}
                            disabled={!isAlive || isReadOnly}
                            aria-label={`Добавить ${num} игрока на выставление`}
                          >
                            {num}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={handleBackspace}
                        className={styles.keyboardBtn}
                        disabled={isReadOnly}
                      >
                        ⮾
                      </button>
                    </div>

                    <div className={styles.phaseNavContainer}>
                      <button
                        className={styles.phaseNavBtn}
                        onClick={handlePreviousPhase}
                        disabled={isPenaltyTime || isReadOnly}
                      >
                        ⬅ Назад
                      </button>

                      <button
                        className={styles.phaseNavBtn}
                        onClick={handleNextPhase}
                        disabled={isPenaltyTime || isReadOnly}
                      >
                        Вперёд ➡
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentPhase === "voting" && !isPenaltyTime && (
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
                                aria-current={isSelected ? "true" : undefined}
                                aria-label={`Выбрать игрока ${playerId} для голосования`}
                                disabled={isReadOnly}
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

                  <div
                    role="grid"
                    aria-label="Цифровая клавиатура для голосования"
                    className={styles.keyboardGrid}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0].map((num) => {
                      const totalVotesCast = votes.reduce((sum, v) => sum + v.votesCount, 0);
                      const maxAllowed = aliveCount - totalVotesCast;

                      const isDisabled =
                        selectedPlayerId === null ||
                        (num !== 0 && num > maxAllowed) ||
                        isReadOnly;

                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleVoteButtonClick(num)}
                          className={styles.keyboardBtn}
                          disabled={isDisabled}
                          aria-label={`Добавить ${num} голосов для игрока ${selectedPlayerId ?? "не выбран"}`}
                        >
                          {num}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleBackspace}
                      disabled={selectedPlayerId === null || isReadOnly}
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
                      disabled={votes.length === 0 || isReadOnly}
                    >
                      Посчитать
                    </button>
                  ) : (
                    <div className={styles.countButtons}>
                      <button type="button" onClick={handleLeft} className={styles.countBtn} disabled={isReadOnly}>
                        Оставили
                      </button>
                      <button type="button" onClick={handleRaised} className={styles.countBtn} disabled={isReadOnly}>
                        Подняли
                      </button>
                    </div>
                  )}

                  <div className={styles.phaseNavContainer}>
                    <button className={styles.phaseNavBtn} onClick={handlePreviousPhase} disabled={isReadOnly}>
                      ⬅ Назад
                    </button>
                    <button className={styles.phaseNavBtn} onClick={handleNextPhase} disabled={isReadOnly}>
                      Вперёд ➡
                    </button>
                  </div>
                </div>
              )}

              {currentPhase === "shooting" && !isPenaltyTime && (
                <div className={styles.phaseContainer}>
                  <h3>Стрельба</h3>
                  <div className={styles.keyboardGrid}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePhaseButtonClick(num, "shooting")}
                        className={styles.keyboardBtn}
                        disabled={isReadOnly}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handlePhaseButtonClick("miss", "shooting")}
                      className={styles.keyboardBtn}
                      disabled={isReadOnly}
                    >
                      Промах
                    </button>
                  </div>

                  <div className={styles.phaseNavContainer}>
                    <button className={styles.phaseNavBtn} onClick={handlePreviousPhase} disabled={isPenaltyTime || isReadOnly}>
                      ⬅ Назад
                    </button>
                    <button className={styles.phaseNavBtn} onClick={handleNextPhase} disabled={isPenaltyTime || isReadOnly}>
                      Вперёд ➡
                    </button>
                  </div>
                </div>
              )}

              {currentPhase === "don" && !isPenaltyTime && (
                <div className={styles.phaseContainer}>
                  <h3>Дон</h3>
                  <div className={styles.keyboardGrid}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePhaseButtonClick(num, "don")}
                        className={styles.keyboardBtn}
                        disabled={isReadOnly}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handlePhaseButtonClick("miss", "don")}
                      className={styles.keyboardBtn}
                      disabled={isReadOnly}
                    >
                      -
                    </button>
                  </div>

                  <div className={styles.phaseNavContainer}>
                    <button className={styles.phaseNavBtn} onClick={handlePreviousPhase} disabled={isPenaltyTime || isReadOnly}>
                      ⬅ Назад
                    </button>
                    <button className={styles.phaseNavBtn} onClick={handleNextPhase} disabled={isPenaltyTime || isReadOnly}>
                      Вперёд ➡
                    </button>
                  </div>
                </div>
              )}

              {currentPhase === "sheriff" && !isPenaltyTime && (
                <div className={styles.phaseContainer}>
                  <h3>Шериф</h3>
                  <div className={styles.keyboardGrid}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePhaseButtonClick(num, "sheriff")}
                        className={styles.keyboardBtn}
                        disabled={isReadOnly}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handlePhaseButtonClick("miss", "sheriff")}
                      className={styles.keyboardBtn}
                      disabled={isReadOnly}
                    >
                      -
                    </button>
                  </div>

                  <div className={styles.phaseNavContainer}>
                    <button className={styles.phaseNavBtn} onClick={handlePreviousPhase} disabled={isPenaltyTime || isReadOnly}>
                      ⬅ Назад
                    </button>
                    <button className={styles.phaseNavBtn} onClick={handleNextPhase} disabled={isPenaltyTime || isReadOnly}>
                      Вперёд ➡
                    </button>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className={styles.tabs}>
                <button
                  type="button"
                  onClick={() => !isPenaltyTime && setActiveTab("gameInfo")}
                  className={activeTab === "gameInfo" ? styles.activeTab : styles.tab}
                  aria-selected={activeTab === "gameInfo"}
                  disabled={isPenaltyTime || isReadOnly}
                  style={isPenaltyTime ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  Ход игры
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("fouls")}
                  className={activeTab === "fouls" ? styles.activeTab : styles.tab}
                  aria-selected={activeTab === "fouls"}
                  disabled={isReadOnly}
                >
                  Фолы
                </button>
              </div>

              <div
                className={styles.tabPanels}
                ref={tabPanelsRef}
                style={{ height: tabHeight ? `${tabHeight}px` : "auto" }}
              >
                <div
                  ref={gameInfoPanelRef}
                  className={`${styles.panel} ${activeTab === "gameInfo" ? styles.visiblePanel : styles.hiddenPanel}`}
                  style={isPenaltyTime ? { pointerEvents: "none", opacity: 0.5 } : undefined}
                >
                  <GameInfo
                    votingResults={votingResults}
                    shootingResults={shootingResults}
                    donResults={donResults}
                    sheriffResults={sheriffResults}
                    onUpdateVotingResults={handleUpdateVotingResults}
                    onUpdateShootingResults={handleUpdateShootingResults}
                    isReadOnly={isReadOnly}
                  />
                </div>

                <div
                  ref={foulsPanelRef}
                  className={`${styles.panel} ${activeTab === "fouls" ? styles.visiblePanel : styles.hiddenPanel}`}
                >
                  <FoulsComponent
                    players={getAlivePlayers()}
                    onIncrementFoul={incrementFouls}
                    onIncrementDFouls={incrementDFouls}
                    onDecrementFoul={decrementFouls}
                    isPenaltyTime={isPenaltyTime}
                    isReadOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.saveButtonContainer}>
        {!isReadOnly  && <button
            type="button"
            onClick={() => {
              switchScene("Перерыв")}}
            className={styles.timeOutBtn}
            >
              Перерыв
            </button>
        }
        {isReadOnly ? (
          <button type="button" onClick={() => navigate(-1)} className={styles.saveBtn}>
            Выйти
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              !isPenaltyTime && switchScene("Итоги игры")
              !isPenaltyTime && handleSave()}}
            className={styles.saveBtn}
            aria-label="Сохранить данные игры"
            disabled={!isAdmin || isSaving || isPenaltyTime}
            title={
              !isAdmin
                ? "Только администратор может сохранять данные"
                : isPenaltyTime
                ? "Недоступно в штрафное время"
                : undefined
            }
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        )}
      </div>
    </>
  );
};

export default Game;
