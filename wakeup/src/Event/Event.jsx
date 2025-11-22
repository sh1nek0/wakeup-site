import React, { useContext, useMemo, useState, useEffect } from "react";
import styles from "./Event.module.css";
import { AuthContext } from "../AuthContext";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import TournamentGames from "../components/TournamentGames/TournamentGames";
import { DetailedStatsTable } from "../RaitingPage/RaitingPage";

const stubAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
       <rect fill='#303030' width='100%' height='100%'/>
       <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle'
             fill='#ff6f00' font-family='Arial' font-size='42'>😼</text>
     </svg>`
  );

export default function Game() {
  const { user, token, isAuthenticated } = useContext(AuthContext) ?? {};
  const isAdmin = user?.role === 'admin';
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
    }, 4000);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // ------------------------------
  // Event data
  // ------------------------------
  const [eventData, setEventData] = useState({});
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [userRegistrationStatus, setUserRegistrationStatus] = useState('none');

  const [loading, setLoading] = useState(true);

  const [numRounds, setNumRounds] = useState(8);
  const [numTables, setNumTables] = useState(1);
  const [exclusionsText, setExclusionsText] = useState("");

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
      setParticipants(data.participants || []);
      setTeams(data.teams || []);
      setPendingRegistrations(data.pending_registrations || []);
      setUserRegistrationStatus(data.user_registration_status || 'none');
      setExclusionsText(data.seating_exclusions || "");
    } catch (err) {
      console.error("Ошибка:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [eventId, token]);

  const teamSize = useMemo(() => {
    if (eventData.type === "pair") return 2;
    if (eventData.type === "team") return 5;
    return 1;
  }, [eventData.type]);

  const assignedIds = new Set(teams.flatMap((t) => t.members.map(m => m.id)));
  const freeParticipants = participants.filter((p) => !assignedIds.has(p.id));

  const [teamName, setTeamName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleMember = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const canCreateTeam = teamName.trim().length > 0 && selectedIds.length > 0;

  const createTeam = async () => {
    if (!canCreateTeam || !user) return;
    if (!token) return showMessage("Токен авторизации отсутствует", true);
    const membersWithCreator = [...new Set([...selectedIds, user.id])];
    const requestBody = { event_id: eventId, name: teamName.trim(), members: membersWithCreator };
    try {
      const response = await fetch("/api/createTeam", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка создания команды");
      setTeamName("");
      setSelectedIds([]);
      showMessage(data.message);
      fetchEventData();
    } catch (error) {
      console.error("Ошибка создания команды:", error);
      showMessage(`Ошибка: ${error.message}`, true);
    }
  };

  const deleteTeam = async (id) => {
    if (!window.confirm("Вы уверены, что хотите покинуть/расформировать эту команду?")) return;
    try {
      const response = await fetch(`/api/deleteTeam/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка удаления");
      showMessage(data.message);
      fetchEventData();
    } catch (error) {
      showMessage(`Ошибка: ${error.message}`, true);
    }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка регистрации");
      showMessage(data.message);
      setUserRegistrationStatus('pending');
    } catch (error) {
      showMessage(`Ошибка: ${error.message}`, true);
    }
  };

  const handleManageRegistration = async (registrationId, action) => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`/api/registrations/${registrationId}/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка при обработке заявки");
      showMessage(data.message);
      fetchEventData();
    } catch (error) {
      showMessage(`Ошибка: ${error.message}`, true);
    }
  };

  const handleSetupGames = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`/api/events/${eventId}/setup_games`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ num_rounds: numRounds, num_tables: numTables }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка создания сетки");
      showMessage(data.message);
      fetchEventData();
    } catch (error) {
      showMessage(error.message, true);
    }
  };

  
  const handleGenerateSeating = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`/api/events/${eventId}/generate_seating`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ exclusions_text: exclusionsText }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка генерации рассадки");
      showMessage(data.message);
      fetchEventData();
    } catch (error) {
      showMessage(error.message, true);
    }
  };

  const handleToggleVisibility = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`/api/events/${eventId}/toggle_visibility`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Ошибка");
      showMessage(data.message);
      setEventData(prev => ({ ...prev, games_are_hidden: data.games_are_hidden }));
    } catch (error) {
      showMessage(error.message, true);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!isAdmin || !window.confirm(`Вы уверены, что хотите удалить игру ${gameId}?`)) return;
    try {
      const res = await fetch(`/api/deleteGame/${gameId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Ошибка удаления');
      }
      showMessage('Игра успешно удалена.');
      fetchEventData();
    } catch (err) {
      showMessage(err.message, true);
    }
  };

  const handleCreateSingleGame = async () => {
    if (!isAdmin) return;
    const round = prompt("Введите номер раунда:");
    const table = prompt("Введите номер стола:");
    if (!round || !table || isNaN(parseInt(round)) || isNaN(parseInt(table))) {
      showMessage("Некорректный номер раунда или стола.", true);
      return;
    }
    const gameId = `${eventId}_r${round}_t${table}`;
    navigate(`/Event/${eventId}/Game/${gameId}`);
  };

  // ------------------------------
  // TEST DATA for tables (personal)
  // ------------------------------
  const pageSize = 10;

  const personalData = useMemo(() => {
    const base = [
      {
        id: 101, nickname: 'Fox', totalPoints: 47.8,
        wins: { sheriff: 2, citizen: 3, mafia: 2, don: 1 },
        gamesPlayed: { sheriff: 4, citizen: 6, mafia: 3, don: 2 },
        total_sk_penalty: 1.2, total_jk_penalty: 0.5,
        total_best_move_bonus: 3.0, total_ci_bonus: 2.5, total_cb_bonus: 1.0, bonuses: 6.5,
        role_plus: { sheriff: [1.2, 0.8], citizen: [0.5, 0.5, 0.7], mafia: [1.0, 0.6], don: [1.5] }
      },
      {
        id: 102, nickname: 'Raven', totalPoints: 52.1,
        wins: { sheriff: 3, citizen: 2, mafia: 3, don: 0 },
        gamesPlayed: { sheriff: 4, citizen: 4, mafia: 5, don: 1 },
        total_sk_penalty: 0.8, total_jk_penalty: 0.4,
        total_best_move_bonus: 2.0, total_ci_bonus: 3.1, total_cb_bonus: 0.7, bonuses: 5.8,
        role_plus: { sheriff: [0.6, 0.9], citizen: [1.0], mafia: [0.5, 0.6, 0.4], don: [] }
      },
      {
        id: 103, nickname: 'Blizzard', totalPoints: 40.3,
        wins: { sheriff: 1, citizen: 2, mafia: 1, don: 1 },
        gamesPlayed: { sheriff: 3, citizen: 5, mafia: 3, don: 2 },
        total_sk_penalty: 0.0, total_jk_penalty: 1.0,
        total_best_move_bonus: 2.2, total_ci_bonus: 1.4, total_cb_bonus: 0.3, bonuses: 3.9,
        role_plus: { sheriff: [1.1], citizen: [0.5, 0.3], mafia: [0.4], don: [0.3] }
      },
    ];
    const more = Array.from({ length: 9 }, (_, i) => ({
      id: 200 + i,
      nickname: `Player_${i + 1}`,
      totalPoints: 30 + i,
      wins: { sheriff: i % 3, citizen: (i+1) % 4, mafia: (i+2) % 3, don: i % 2 },
      gamesPlayed: { sheriff: 2 + (i%3), citizen: 3 + (i%4), mafia: 2 + (i%3), don: 1 + (i%2) },
      total_sk_penalty: (i%3) * 0.3,
      total_jk_penalty: (i%2) * 0.2,
      total_best_move_bonus: (i%4) * 0.5,
      total_ci_bonus: (i%5) * 0.4,
      total_cb_bonus: (i%3) * 0.25,
      bonuses: Math.round((((i%4)*0.5 + (i%5)*0.4))*100)/100,
      role_plus: {
        sheriff: Array.from({ length: i%2 }, () => 0.5),
        citizen: Array.from({ length: i%3 }, () => 0.3),
        mafia: Array.from({ length: i%2 }, () => 0.4),
        don: Array.from({ length: i%2 }, () => 0.6),
      }
    }));
    return [...base, ...more];
  }, []);

  const personalTotalPages = Math.ceil(personalData.length / pageSize);
  const [personalPage, setPersonalPage] = useState(1);
  const personalPageData = useMemo(() => (
    personalData.slice((personalPage - 1) * pageSize, personalPage * pageSize)
  ), [personalData, personalPage]);

  // ------------------------------
  // TEAM AGGREGATION from personal stats
  // ------------------------------
  const aggregateMembersToTeam = (membersStats = [], teamName, teamId) => {
    const zeroWins = { sheriff: 0, citizen: 0, mafia: 0, don: 0 };

    const sumField = (field) => membersStats.reduce((s, p) => s + Number(p?.[field] || 0), 0);

    const sumDict = (key) => membersStats.reduce((acc, p) => {
      const src = p?.[key] || {};
      acc.sheriff += Number(src.sheriff || 0);
      acc.citizen += Number(src.citizen || 0);
      acc.mafia   += Number(src.mafia   || 0);
      acc.don     += Number(src.don     || 0);
      return acc;
    }, { ...zeroWins });

    const mergeRolePlus = () => {
      const out = { sheriff: [], citizen: [], mafia: [], don: [] };
      for (const p of membersStats) {
        const rp = p?.role_plus || {};
        out.sheriff.push(...(rp.sheriff || []));
        out.citizen.push(...(rp.citizen || []));
        out.mafia.push(...(rp.mafia || []));
        out.don.push(...(rp.don || []));
      }
      return out;
    };

    return {
      id: teamId ?? null,
      nickname: teamName, // show team name in the table instead of player nick
      totalPoints: sumField('totalPoints'),
      wins: sumDict('wins'),
      gamesPlayed: sumDict('gamesPlayed'),
      total_sk_penalty: sumField('total_sk_penalty'),
      total_jk_penalty: sumField('total_jk_penalty'),
      total_best_move_bonus: sumField('total_best_move_bonus'),
      total_ci_bonus: sumField('total_ci_bonus'),
      total_cb_bonus: sumField('total_cb_bonus'),
      bonuses: sumField('bonuses'),
      role_plus: mergeRolePlus(),
    };
  };

  // test team definitions mapping to personal ids
  const testTeamDefs = useMemo(() => ([
    { id: 501, name: 'FrostBite', memberIds: [101, 200, 201, 202] },
    { id: 502, name: 'NightOwls', memberIds: [102, 203, 204] },
    { id: 503, name: 'Aurora',    memberIds: [103, 205, 206, 207] },
    { id: 504, name: 'StormPeak', memberIds: [208, 209] },
  ]), []);

  const personalIndex = useMemo(() => new Map(personalData.map(p => [p.id, p])), [personalData]);

  const aggregatedTeamData = useMemo(() => {
    return testTeamDefs.map(t => {
      const membersStats = t.memberIds.map(id => personalIndex.get(id)).filter(Boolean);
      return aggregateMembersToTeam(membersStats, t.name, t.id);
    });
  }, [testTeamDefs, personalIndex]);

  const teamTotalPages = Math.ceil(aggregatedTeamData.length / pageSize);
  const [teamPage, setTeamPage] = useState(1);
  const teamPageData = useMemo(() => (
    aggregatedTeamData.slice((teamPage - 1) * pageSize, teamPage * pageSize)
  ), [aggregatedTeamData, teamPage]);

  // ------------------------------
  // Nominations (test)
  // ------------------------------
  const personalNominations = [
    {
      id: 'n1', title: 'Лучший ход (ЛХ)',
      winners: [{ id: 101, name: 'Fox', value: '+1.5' }],
      description: 'Самое сильное действие, приведшее к победе мирных.'
    },
    {
      id: 'n2', title: 'Лучший шериф',
      winners: [{ id: 102, name: 'Raven', value: 'ср. бонус 0.9' }],
      description: 'Стабильная реализация роли шерифа за ивент.'
    },
    {
      id: 'n3', title: 'MVP ивента',
      winners: [{ id: 103, name: 'Blizzard', value: 'Σ 40.3' }],
      description: 'Максимальный суммарный вклад в победы.'
    },
  ];

  const teamNominations = [
    {
      id: 'tn1', title: 'Лучшая командная игра',
      winners: [{ id: 501, name: 'FrostBite', value: 'Σ 123.4' }],
      description: 'Самая слаженная и результативная командная работа.'
    },
    {
      id: 'tn2', title: 'Самая дисциплинированная',
      winners: [{ id: 502, name: 'NightOwls', value: 'минимум штрафов' }],
      description: 'Минимум фолов и конфликтов, чёткая коммуникация.'
    },
  ];

  // ------------------------------
  // Tabs UI
  // ------------------------------
  const typeNormalized = String(eventData.type ?? '').toLowerCase().trim();
  const showTeamTabs = ['team', 'teams', 'pair', 'pairs'].includes(typeNormalized);
const [activeTab, setActiveTab] = useState('player');

  if (loading) return <div>Загрузка...</div>;

  const isEventFull = eventData.participantsCount >= eventData.participantsLimit;
  let regButtonText = "Зарегистрироваться";
  let isRegButtonDisabled = false;

  if (isEventFull) {
    regButtonText = "Регистрация закрыта";
    isRegButtonDisabled = true;
  } else if (!isAuthenticated) {
    regButtonText = "Войдите для регистрации";
    isRegButtonDisabled = false;
  } else if (userRegistrationStatus === 'pending') {
    regButtonText = "Заявка отправлена";
    isRegButtonDisabled = true;
  } else if (userRegistrationStatus === 'approved') {
    regButtonText = "Вы участник";
    isRegButtonDisabled = true;
  }

  const canManageTeam = (team) => {
    if (!user) return false;
    if (isAdmin) return true;
    return team.members.some(m => m.id === user.id);
  };

  return (
    <section className={styles.pageWrap}>
      {successMessage && <div className={styles.notificationSuccess}>{successMessage}</div>}
      {errorMessage && <div className={styles.notificationError}>{errorMessage}</div>}

      <header className={styles.header}>
        <h1 className={styles.title}>{eventData.title}</h1>
      </header>

      <div className={styles.topGrid}>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Даты проведения</div>
            <div className={styles.value}>{eventData.dates}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Место</div>
            <div className={styles.value}>{eventData.location}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Тип ивента</div>
            <div className={styles.value}>
              {typeNormalized === "solo" ? "Личный" : typeNormalized === "pair" ? "Парный" : "Командный"}
            </div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Участники</div>
            <div className={styles.value}>
              {eventData.participantsCount} из {eventData.participantsLimit}
            </div>
          </div>
          <button
            type="button"
            className={styles.discussBtn}
            onClick={() => showMessage("Обсуждение скоро появится")}
          >
            💬 Перейти к обсуждению
          </button>
        </div>

        <aside className={styles.rightCol}>
          <div className={styles.personCard}>
            <img src={eventData.gs?.avatar || stubAvatar} alt={eventData.gs?.name} className={styles.avatar} />
            <div className={styles.personMeta}>
              <div className={styles.personName}>{eventData.gs?.name}</div>
              <div className={styles.personRole}>{eventData.gs?.role}</div>
            </div>
          </div>
          <div className={styles.personCard}>
            <img src={eventData.org?.avatar || stubAvatar} alt={eventData.org?.name} className={styles.avatar} />
            <div className={styles.personMeta}>
              <div className={styles.personName}>{eventData.org?.name}</div>
              <div className={styles.personRole}>{eventData.org?.role}</div>
            </div>
          </div>
          <div className={styles.feeCard}>
            <div className={styles.caption}>Стоимость участия</div>
            <div className={styles.fee}>
              {eventData.fee?.toLocaleString()} {eventData.currency}
            </div>
            <button
              type="button"
              className={isRegButtonDisabled ? styles.primaryBtnDisabled : styles.primaryBtn}
              onClick={handleRegister}
              disabled={isRegButtonDisabled}
            >
              {regButtonText}
            </button>
          </div>
        </aside>
      </div>

      {isAdmin && (
        <section className={styles.adminPanel}>
          <h2 className={styles.h2}>Панель администратора</h2>
          <div className={styles.adminGrid}>
            <div className={styles.adminForm}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Количество раундов</label>
                <input type="number" className={styles.input} value={numRounds} onChange={e => setNumRounds(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Количество столов</label>
                <input type="number" className={styles.input} value={numTables} onChange={e => setNumTables(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Исключения рассадки (каждая пара с новой строки)</label>
                <textarea className={styles.textarea} value={exclusionsText} onChange={e => setExclusionsText(e.target.value)} placeholder="Player1, Player2&#10;Player3, Player4" />
              </div>
            </div>
            <div className={styles.adminActions}>
              <button onClick={handleSetupGames} className={styles.primaryBtn}>Создать сетку игр</button>
              <button onClick={handleGenerateSeating} className={styles.primaryBtn}>Сгенерировать рассадку</button>
              <button onClick={handleCreateSingleGame} className={styles.secondaryBtn}>Создать отдельную игру</button>
              <button onClick={handleToggleVisibility} className={styles.secondaryBtn}>
                {eventData.games_are_hidden ? "Показать игры" : "Скрыть игры"}
              </button>
            </div>
          </div>
        </section>
      )}



      {isAdmin && pendingRegistrations.length > 0 && (
        <section className={styles.adminSection}>
          <h2 className={styles.h2}>Заявки на участие ({pendingRegistrations.length})</h2>
          <div className={styles.pendingList}>
            {pendingRegistrations.map(reg => (
              <div key={reg.registration_id} className={styles.pendingItem}>
                <div className={styles.pendingUserInfo}>
                  <img src={reg.user.avatar || stubAvatar} alt={reg.user.nick} className={styles.memberAvatar} />
                  <span>{reg.user.nick} ({reg.user.club})</span>
                </div>
                <div className={styles.pendingActions}>
                  <button onClick={() => handleManageRegistration(reg.registration_id, 'approve')} className={styles.approveBtn}>Одобрить</button>
                  <button onClick={() => handleManageRegistration(reg.registration_id, 'reject')} className={styles.rejectBtn}>Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    

      {/* Tabs for standings & nominations */}
      <section className={styles.tabsWrap}>
        <nav className={styles.tabsNav} aria-label="Панель вкладок зачёта и номинаций">
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'player' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('player')}
            aria-selected={activeTab === 'player'}
            role="tab"
          >
            Участники
          </button>

          {(typeNormalized === "pair" || typeNormalized === "team") && (
            <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'team' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('team')}
            aria-selected={activeTab === 'team'}
            role="tab"
          >
            {typeNormalized === "pair" ? "Пары" : "Команды"}
          </button>
          )}



          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'games' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('games')}
            aria-selected={activeTab === 'games'}
            role="tab"
          >
            Игры
          </button>


          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'solo' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('solo')}
            aria-selected={activeTab === 'solo'}
            role="tab"
          >
            Личный зачёт
          </button>



          {showTeamTabs && (
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'teamStat' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('teamStat')}
              aria-selected={activeTab === 'teamStat'}
              role="tab"
            >
              Командный зачёт
            </button>
          )}

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'nomsSolo' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('nomsSolo')}
            aria-selected={activeTab === 'nomsSolo'}
            role="tab"
          >
            Номинации (личные)
          </button>

          {showTeamTabs && (
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'nomsTeam' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('nomsTeam')}
              aria-selected={activeTab === 'nomsTeam'}
              role="tab"
            >
              Номинации (командные)
            </button>
          )}
        </nav>



        {activeTab==="player" && (
          <section className={styles.qualifiedWrap}>
        <h2 className={styles.h2}>Участники</h2>
        {participants.length === 0 ? (
          <div className={styles.emptyHint}>Пока нет подтвержденных участников.</div>
        ) : (
          <div className={styles.qualifiedGrid}>
            {participants.map((p) => (
              <div className={styles.qualifiedCard} key={p.id}>
                <img src={p.avatar || stubAvatar} className={styles.qualifiedAvatar} alt={p.nick} />
                <div className={styles.qualifiedNick}>{p.nick}</div>
                <div className={styles.qualifiedFrom}>{p.club || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </section>
        )}


        {activeTab==="games" && (isAdmin || !eventData.games_are_hidden) && eventData.games && eventData.games.length > 0 && (
        <section className={styles.gamesSection}>
          <h2 className={styles.h2}>Игры ивента</h2>
          <TournamentGames
            games={eventData.games}
            isAdmin={isAdmin}
            onDelete={handleDeleteGame}
            onEdit={(gameId, eventId) => navigate(`/Event/${eventId}/Game/${gameId}`)}
            onPlayerClick={(playerId) => navigate(`/profile/${playerId}`)}
          />
        </section>
      )}

      {console.log(eventData.games)}

        {/* Panels */}
        {activeTab === 'solo' && (
          <div className={styles.tabPanel} role="tabpanel">
            <h2 className={styles.h2}>Личный зачёт</h2>
            <DetailedStatsTable
              data={personalPageData}
              currentPage={personalPage}
              totalPages={personalTotalPages}
              onPageChange={setPersonalPage}
              user={user}
            />
          </div>
        )}

        {activeTab === 'teamStat' && showTeamTabs && (
          <div className={styles.tabPanel} role="tabpanel">
            <h2 className={styles.h2}>Командный зачёт</h2>
            <DetailedStatsTable
              data={teamPageData}
              currentPage={teamPage}
              totalPages={teamTotalPages}
              onPageChange={setTeamPage}
              user={user}
            />
          </div>
        )}

        {activeTab === 'nomsSolo' && (
          <div className={styles.tabPanel} role="tabpanel">
            <h2 className={styles.h2}>Номинации — личные</h2>
            <div className={styles.nominationsGrid}>
              {personalNominations.map((n) => (
                <div key={n.id} className={styles.nominationCard}>
                  <div className={styles.nominationTitle}>{n.title}</div>
                  <div className={styles.nominationWinners}>
                    {n.winners.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={styles.winnerLink}
                        onClick={() => navigate(`/profile/${w.id}`)}
                        title={w.name}
                      >
                        {w.name} {w.value ? <span className={styles.winnerValue}>({w.value})</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className={styles.nominationDesc}>{n.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'nomsTeam' && showTeamTabs && (
          <div className={styles.tabPanel} role="tabpanel">
            <h2 className={styles.h2}>Номинации — командные</h2>
            <div className={styles.nominationsGrid}>
              {teamNominations.map((n) => (
                <div key={n.id} className={styles.nominationCard}>
                  <div className={styles.nominationTitle}>{n.title}</div>
                  <div className={styles.nominationWinners}>
                    {n.winners.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={styles.winnerLink}
                        onClick={() => navigate(`/team/${w.id}`)}
                        title={w.name}
                      >
                        {w.name} {w.value ? <span className={styles.winnerValue}>({w.value})</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className={styles.nominationDesc}>{n.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {activeTab === 'team' &&(typeNormalized === "pair" || typeNormalized === "team") && (userRegistrationStatus === 'approved' || isAdmin) && (
        <section className={styles.teamsWrap}>
          <h2 className={styles.h2}>
            {typeNormalized === "pair" ? "Пары" : "Команды"}
          </h2>
          <div className={styles.teamForm}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Название {typeNormalized === "pair" ? "пары" : "команды"}
              </label>
              <input
                className={styles.input}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Например: FrostBite"
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabel}>
                Пригласить участников ({selectedIds.length}
                {typeNormalized === "pair" ? "/1" : `/${teamSize - 1}`})
              </div>
              <div className={styles.membersPool}>
                {user && freeParticipants.filter(p => p.id !== user.id).length === 0 && (
                  <div className={styles.emptyHintSmall}>
                    Нет свободных участников для приглашения.
                  </div>
                )}
                {user && freeParticipants.filter(p => p.id !== user.id).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={selectedIds.includes(p.id) ? styles.memberBtnSelected : styles.memberBtn}
                    onClick={() => toggleMember(p.id)}
                  >
                    <img alt={p.nick} src={p.avatar || stubAvatar} className={styles.memberAvatar} />
                    <span>{p.nick}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={canCreateTeam ? styles.primaryBtn : styles.primaryBtnDisabled}
              disabled={!canCreateTeam}
              onClick={createTeam}
            >
              Создать {typeNormalized === "pair" ? "пару" : "команду"}
            </button>
          </div>
          <div className={styles.teamsList}>
            {teams.length === 0 ? (
              <div className={styles.emptyHint}>
                {typeNormalized === "pair" ? "Пока нет созданных пар." : "Пока нет созданных команд."}
              </div>
            ) : (
              teams.map((t) => (
                <div className={styles.teamCard} key={t.id}>
                  <div className={styles.teamHeader}>
                    <div className={styles.teamName}>{t.name} ({t.status})</div>
                    {canManageTeam(t) && (
                      <button type="button" className={styles.deleteBtn} onClick={() => deleteTeam(t.id)}>
                        {isAdmin ? "Удалить" : "Покинуть/Расформировать"}
                      </button>
                    )}
                  </div>
                  <div className={styles.teamMembers}>
                    {t.members.map((m) => (
                      <div className={`${styles.teamMember} ${styles[m.status]}`} key={m.id}>
                        <img src={participants.find(p => p.id === m.id)?.avatar || stubAvatar} alt={m.nick} className={styles.memberAvatar} />
                        <span>{m.nick}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )))}
            
          </div>
        </section>
      )}
    </section>
  );
}

