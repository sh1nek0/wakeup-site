import React, { useContext, useMemo, useState, useEffect } from "react";
import styles from "./Event.module.css";
import { AuthContext } from "../../AuthContext";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import TournamentGames from "../../components/TournamentGames/TournamentGames";
import { DetailedStatsTable } from "../../DetailedStatsTable/DetailedStatsTable";
import PersonCard from '../../components/PersonCard/PersonCard';

const stubAvatar = "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
       <rect fill='#303030' width='100%' height='100%'/>
       <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle'
             fill='#ff6f00' font-family='Arial' font-size='42'>😼</text>
     </svg>`
  );

// Функция из ProfilePage для форматирования размера файла
const humanFileSize = (bytes) => {
  const thresh = 1024*2;
  if (Math.abs(bytes) < thresh) return bytes + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + " " + units[u];
};

export default function Event() {
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
  const [judges, setJudges] = useState(eventData.judges || []);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [userRegistrationStatus, setUserRegistrationStatus] = useState('none');

  const [loading, setLoading] = useState(true);

  const [numRounds, setNumRounds] = useState(8);
  const [numTables, setNumTables] = useState(1);
  const [exclusionsText, setExclusionsText] = useState("");
  const isJudge = eventData.judges?.some(j => j?.id === user?.id);
  console.log()

  // ------------------------------
  // Новое: Состояние для статистики игроков из API
  // ------------------------------
  const [playersStats, setPlayersStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // ------------------------------
  // Редактирование события
  const [editedFields, setEditedFields] = useState({}); // храним только изменённые поля
  const [isEditing, setIsEditing] = useState(false);


  const typeNormalized = String(eventData.type ?? '').toLowerCase().trim();
  const showTeamTabs = ['team', 'teams', 'pair', 'pairs'].includes(typeNormalized);
  const [activeTab, setActiveTab] = useState('player');
  // ВАЖНО: activeTab лучше объявить до return, но после загрузки данных тоже ок

  // Список разрешённых табов (чтобы не ставить невозможные)
  const allowedTabs = useMemo(() => {
    const tabs = ['player', 'games', 'solo', 'nomsSolo'];

    if (typeNormalized === 'pair' || typeNormalized === 'team') tabs.push('team');
    if (showTeamTabs) tabs.push('teamStat');
    if (isAdmin || isJudge) tabs.push('admin');

    return tabs;
  }, [typeNormalized, showTeamTabs, isAdmin]);

  // 1) Читать tab из query и применять
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const qTab = sp.get('tab');

    if (qTab && allowedTabs.includes(qTab) && qTab !== activeTab) {
      setActiveTab(qTab);
      return;
    }

    // Если таб невалидный/недоступный — можно аккуратно откатить на player
    if (qTab && !allowedTabs.includes(qTab) && activeTab !== 'player') {
      setActiveTab('player');
    }
  }, [location.search, allowedTabs, activeTab]);

  // 2) Менять таб и синхронить URL
  const setTab = (tab) => {
    if (!allowedTabs.includes(tab)) return;

    setActiveTab(tab);

    const sp = new URLSearchParams(location.search);
    sp.set('tab', tab);

    navigate(
      { pathname: location.pathname, search: `?${sp.toString()}` },
      { replace: true } // чтобы не засорять историю браузера
    );
  };



    useEffect(() => {
  if (eventData.judges) {
    setJudges(eventData.judges);
  }
}, [eventData.judges]);


  const startEditing = () => {
    setEditedFields({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedFields({});
    setIsEditing(false);
  };

  const updateEditedField = (field, value) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
    console.log(value);
  };

  const getDates = () => editedFields.dates ?? eventData.dates ?? [];

  const addDate = () => {
    const newDates = [...getDates(), new Date().toISOString().split('T')[0]];
    updateEditedField('dates', newDates);
  };

  const removeDate = (index) => {
    const newDates = getDates().filter((_, i) => i !== index);
    updateEditedField('dates', newDates);
  };

  const updateDate = (index, value) => {
    const newDates = getDates().map((d, i) => (i === index ? value : d));
    updateEditedField('dates', newDates);
  };

const saveEvent = async () => {
 
  
  if (!Object.keys(editedFields).length && !eventAvatarFile) {
    showMessage("Нет изменений для сохранения");
    return;
  }

  if (!token) {
    showMessage("Требуется авторизация", true);
    return;
  }

  const payload = {};

  for (const [key, value] of Object.entries(editedFields)) {
    console.log(`3. Processing key: ${key}`, value);
    
    if (value === undefined || value === null) continue;

    if (key === "dates") {
      if (Array.isArray(value)) {
        payload.dates = value
          .map(d => new Date(d).toISOString().split("T")[0])
          .filter(Boolean);
      }
      continue;
    }

    if (key === "seating_exclusions") {
      if (Array.isArray(value)) {
        payload.seating_exclusions = value.map(row =>
          Array.isArray(row) ? row.map(String) : []
        );
      }
      continue;
    }

    // ОСОБАЯ ОБРАБОТКА ДЛЯ СУДЕЙ
    if (key === "judges") {
     
      if (Array.isArray(value)) {
        // Извлекаем только ID судей (фильтруем тех, у кого есть id)
        const judgeIds = value
          .filter(judge => {
           
            return judge?.id;
          })
          .map(judge => {
            
            return judge.id;
          });
        
       
        payload.judge_ids = judgeIds;
      }
      continue; // Пропускаем, чтобы не добавлять в payload под ключом "judges"
    }

    payload[key] = value;
  }

 
 

  try {
    const formData = new FormData();

    // 🔹 JSON данные
    const jsonString = JSON.stringify(payload);
    
    formData.append("request", jsonString);

    // 🔹 Файл (если выбран)
    if (eventAvatarFile) {
      
      formData.append("avatar", eventAvatarFile);
    }

    
    for (let pair of formData.entries()) {
     
    }

    const response = await fetch(`/api/event/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

   
    
    const data = await response.json();
    

    if (!response.ok) {
      showMessage(data.detail || "Ошибка сохранения", true);
      return;
    }

    showMessage("Событие успешно обновлено");

    setEventAvatarFile(null);
    setEventAvatarPreview(null);

    await fetchEventData();

    setEditedFields({});
    setIsEditing(false);

  } catch (error) {
    console.error("16. Ошибка сохранения:", error);
    showMessage("Ошибка сохранения", true);
  }
  
  
};

  // Форматирование дат для отображения
  const formatDates = (dates) => {
    if (!dates || dates.length === 0) return "Не указаны";
    return dates.map(d => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d))).join(', ');
  };

  const fetchEventData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const headers = { 'Cache-Control': 'no-cache' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/getEvent/${eventId}`, { headers });
      if (!res.ok) throw new Error("Ошибка загрузки данных ивента");
      const data = await res.json();
      console.log(data);
      setEventData(data);
      setParticipants(data.participants || []);
      setTeams(data.teams || []);
      setPendingRegistrations(data.pending_registrations || []);
      setUserRegistrationStatus(data.user_registration_status || 'none');
      setExclusionsText(data.seating_exclusions || "");
    } catch (err) {
      console.error("Ошибка загрузки ивента:", err);
    } finally {
      setLoading(false);
    }
  };


  const handleGenerateNextRound = async () => {
  if (!isAdmin && !isJudge) return;

  try {
    const response = await fetch(`/api/events/${eventId}/generate_next_round`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.detail || "Ошибка генерации раунда");

    showMessage(`Раунд ${data.round} успешно создан`);

    await fetchEventData();
    await fetchPlayersStats();

  } catch (error) {
    showMessage(error.message, true);
  }
};
  // ------------------------------
  // Новое: Загрузка статистики из API
  // ------------------------------
  const fetchPlayersStats = async () => {
    if (!eventId) return;
    setStatsLoading(true);
    try {
      const headers = { 'Cache-Control': 'no-cache' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/events/${eventId}/player-stats`, { headers });
      if (!res.ok) throw new Error("Ошибка загрузки статистики игроков");
      const data = await res.json();
      setPlayersStats(data.players || []);
      console.log(data.games)
    } catch (err) {
      console.error("Ошибка загрузки статистики:", err);
      setPlayersStats([]);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
    fetchPlayersStats();  // Загружаем статистику параллельно
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
      fetchPlayersStats();  // Обновляем статистику после удаления игры
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
  // Новое: Состояние для аватара мероприятия
  // ------------------------------
  const [eventAvatarFile, setEventAvatarFile] = useState(null);
  const [eventAvatarPreview, setEventAvatarPreview] = useState(null);
  const [uploadingEventAvatar, setUploadingEventAvatar] = useState(false);
  const [uploadEventAvatarError, setUploadEventAvatarError] = useState(null);
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB

  // ------------------------------
  // Новое: Функции для обработки аватара мероприятия
  // ------------------------------
  const onPickEventAvatar = (file) => {
    setUploadEventAvatarError(null);
    setEventAvatarFile(null);
    setEventAvatarPreview(null);

    if (!file) return;
    if (file.type !== "image/png") {
      setUploadEventAvatarError("Допустим только PNG-файл.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadEventAvatarError(
        `Файл слишком большой (${humanFileSize(file.size)}). Лимит: ${humanFileSize(MAX_BYTES)}.`
      );
      return;
    }
    const url = URL.createObjectURL(file);
    setEventAvatarFile(file);
    setEventAvatarPreview(url);
  };




  // ------------------------------
  // TEST DATA for tables (personal)
  // ------------------------------
  const pageSize = 10;

  // ------------------------------
  // Изменено: playersStats теперь из API, сортируем в useMemo
  // ------------------------------
  const playersStatsSorted = useMemo(() => {
    return [...playersStats].sort((a, b) => b.totalPoints - a.totalPoints);
  }, [playersStats]);

  const personalTotalPages = useMemo(() => Math.ceil(playersStatsSorted.length / pageSize), [playersStatsSorted, pageSize]);
  const [personalPage, setPersonalPage] = useState(1);
  const personalPageData = useMemo(() => {
    const start = (personalPage - 1) * pageSize;
    const end = personalPage * pageSize;
    return playersStatsSorted.slice(start, end);
  }, [playersStatsSorted, personalPage, pageSize]);

  // ------------------------------
  // Командная агрегация
  // ------------------------------
  
  const handleDeletePlayer = async (userId, eventId) => {
  if (!isAdmin || !window.confirm(`Вы уверены, что хотите удалить этого игрока из события?`)) return;
  try {
    const response = await fetch(`/api/deletePlayer/${userId}/Event/${eventId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Ошибка удаления игрока");
    showMessage(data.message);
    // Обновляем данные события после удаления
    await fetchEventData();
  } catch (error) {
    showMessage(`Ошибка: ${error.message}`, true);
  }
}



  const aggregatedTeamData = useMemo(() => {
    if (!teams || !playersStatsSorted) return [];  // Изменено

    const playerIndexByName = new Map(
      playersStatsSorted.map(p => [p.name.toLowerCase().trim(), p])  // Изменено
    );

    // ⬅️ ШАГ 1 — сначала формируем массив без возврата
    const data = teams.map(team => {
      const membersStats = (team.members || [])
        .map(m => m.nick ? playerIndexByName.get(m.nick.toLowerCase().trim()) : null)
        .filter(Boolean);

      const zeroWins = { sheriff: 0, citizen: 0, mafia: 0, don: 0 };

      const sumField = (field) =>
        membersStats.reduce((s, p) => s + Number(p?.[field] || 0), 0);

      const sumDict = (key) =>
        membersStats.reduce((acc, p) => {
          const src = p?.[key] || {};
          for (const role of ["sheriff", "citizen", "mafia", "don"]) {
            acc[role] += Number(src[role] || 0);
          }
          return acc;
        }, { ...zeroWins });

      const mergeRolePlus = () => {
        const out = { sheriff: [], citizen: [], mafia: [], don: [] };
        for (const p of membersStats) {
          const rp = p?.role_plus || {};
          for (const role of ["sheriff", "citizen", "mafia", "don"]) {
            out[role].push(...(rp[role] || []));
          }
        }
        return out;
      };

      return {
        id: team.id,
        nickname: team.name || "Без имени",
        totalPoints: sumField("totalPoints"),
        wins: sumDict("wins"),
        gamesPlayed: sumDict("gamesPlayed"),
        total_sk_penalty: sumField("total_sk_penalty"),  // Изменено
        total_jk_penalty: sumField("total_jk_penalty"),  // Изменено
        total_ppk_penalty: sumField("totalCb"),  // Изменено
        role_plus: mergeRolePlus(),
        totalCi: sumField("totalCi") || 0,
        totalCb: sumField("totalCb") || 0,
        membersStats,
      };
    });

    // ⬅️ ШАГ 2 — сортировка
    data.sort((a, b) => b.totalPoints - a.totalPoints);

    // ⬅️ ШАГ 3 — возвращаем отсортированный массив
    return data;
  }, [teams, playersStatsSorted]);  // Изменено

  // ------------------------------
  // Лучшая номинация по ролям
  // ------------------------------
    const roleNominations = useMemo(() => {
    if (!playersStatsSorted || playersStatsSorted.length === 0) return [];

    const roles = ["sheriff", "citizen", "mafia", "don"];

    return roles.map((role) => {
      const top3 = playersStatsSorted
        .map((p) => {
          const roleGames = p.gamesPlayed?.[role] || 0;
          const roleBonus = (p.role_plus?.[role] || []).reduce((a, b) => a + b, 0);
          const score = roleBonus - 2.5 * roleGames;
          

          return { id: p.id, name: p.name, value: Number(score.toFixed(2)),roleGames,roleBonus  };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
        

      return { role, winners: top3 };
    });
  }, [playersStatsSorted]);

  
  // Изменено

  // ------------------------------
  // Лучшая общая номинация
  // ------------------------------
  const overallNomination = useMemo(() => {
  if (!playersStatsSorted || playersStatsSorted.length === 0) return [];

  return playersStatsSorted
    .map((p) => {
      const totalGames = Object.values(p.gamesPlayed || {}).reduce((a, b) => a + b, 0);
      const totalBonus = Object.values(p.role_plus || {})
        .flat()
        .reduce((a, b) => a + b, 0);

      const score = totalBonus - 2.5 * totalGames;

      return { id: p.id, name: p.name, value: Number(score.toFixed(1)) };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}, [playersStatsSorted]);



  const [teamPage, setTeamPage] = useState(1);
useEffect(() => {
  console.log("Judges state changed:", judges);
}, [judges]);

useEffect(() => {
  console.log("EditedFields changed:", editedFields);
}, [editedFields]);

  

  if (loading || statsLoading) return <div>Загрузка...</div>;  // Изменено: ждем и статистику

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

  // Новое: Источник аватара мероприятия
  const eventAvatarSrc = eventAvatarPreview || eventData.avatar || stubAvatar;

  return (
    <section className={styles.pageWrap}>
      {successMessage && <div className={styles.notificationSuccess}>{successMessage}</div>}
      {errorMessage && <div className={styles.notificationError}>{errorMessage}</div>}

      <header className={styles.header}>
        {isEditing && (
        <img
          src={eventAvatarSrc}
          alt="Аватар мероприятия"
          className={styles.eventAvatar}  // Добавьте CSS для стилизации, например: width: 60px; height: 60px; border-radius: 50%; margin-right: 10px;
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = stubAvatar;
          }}
        />)}
        <h1 className={styles.title}>
          {isEditing ? (
            <input
              type="text"
              value={editedFields.title ?? eventData.title ?? ""}
              onChange={(e) => updateEditedField("title", e.target.value)}
              style={{ width: '100%', fontSize: '2rem' }}
            />
          ) : (
            eventData.title
          )}
        </h1>
        {isAdmin && !isEditing && (
          <button onClick={startEditing} className={styles.editButton}>Редактировать событие</button>
        )}
      </header>

      {/* Новое: Секция загрузки аватара в режиме редактирования */}
      {isAdmin && isEditing && (
        <div className={styles.uploadEventAvatarBox}>  {/* Добавьте CSS для стилизации, аналогично ProfilePage */}
          <label className={styles.fileLabel}>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => onPickEventAvatar(e.target.files?.[0] || null)}
            />
            Выбрать PNG для аватара мероприятия
          </label>
          {eventAvatarPreview && (
            <div className={styles.hint}>
              Аватар будет загружен после нажатия «Сохранить»
            </div>
          )}

        
          
          
          {eventData.avatar && !eventAvatarPreview && (
            <button
              onClick={() => {
                updateEditedField("avatar", null);
                setEventData(prev => ({ ...prev, avatar: null }));
              }}
              className={styles.deleteButton}
            >
              Удалить аватар
            </button>
          )}

          {uploadEventAvatarError && <div className={styles.errorText}>{uploadEventAvatarError}</div>}
        </div>
      )}

      <div className={styles.topGrid}>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Даты проведения</div>
            <div className={styles.value}>
              {isEditing ? (
                <div>
                  {getDates().map((date, index) => (
                    <div key={index} style={{ marginBottom: '5px' }}>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => updateDate(index, e.target.value)}
                      />
                      <button onClick={() => removeDate(index)} style={{ marginLeft: '10px' }}>Удалить</button>
                    </div>
                  ))}
                  <button onClick={addDate}>Добавить дату</button>
                </div>
              ) : (
                formatDates(eventData.dates)
              )}
            </div>
          </div>

          {/* ------------------ Место ------------------ */}
          <div className={styles.infoCard}>
            <div className={styles.caption}>Место</div>
            <div className={styles.value}>
              {isEditing ? (
                <input
                  type="text"
                  value={editedFields.location ?? eventData.location ?? ""}
                  onChange={(e) => updateEditedField("location", e.target.value)}
                />
              ) : (
                eventData.location
              )}
            </div>
          </div>

          {/* ------------------ Тип ивента ------------------ */}
          <div className={styles.infoCard}>
            <div className={styles.caption}>Тип ивента</div>
            <div className={styles.value}>
              {isEditing ? (
                <select
                  value={editedFields.type ?? eventData.type ?? ""}
                  onChange={(e) => updateEditedField("type", e.target.value)}
                >
                  <option value="solo">Личный</option>
                  <option value="pair">Парный</option>
                  <option value="team">Командный</option>
                </select>
              ) : (
                typeNormalized === "solo" ? "Личный" : typeNormalized === "pair" ? "Парный" : "Командный"
              )}
            </div>
          </div>

          {/* ------------------ Участники ------------------ */}
          <div className={styles.infoCard}>
            <div className={styles.caption}>Участники</div>
            <div className={styles.value}>
              {isEditing ? (
                <input
                  type="number"
                  value={editedFields.participants_limit ?? eventData.participantsLimit ?? 0}
                  onChange={(e) => updateEditedField("participants_limit", parseInt(e.target.value) || 0)}
                />
              ) : (
                `${eventData.participantsCount ?? 0} из ${eventData.participantsLimit ?? 0}`
              )}
            </div>
          </div>

          {/* ------------------ Взнос ------------------ */}
          {isEditing && (
            <div className={styles.infoCard}>
              <div className={styles.caption}>Взнос</div>
              <div className={styles.value}>
                <input
                  type="number"
                  value={editedFields.fee ?? eventData.fee ?? 0}
                  onChange={(e) => updateEditedField("fee", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {/* ------------------ Валюта ------------------ */}
          {isEditing && (
            <div className={styles.infoCard}>
              <div className={styles.caption}>Валюта</div>
              <div className={styles.value}>
                <input
                  type="text"
                  value={editedFields.currency ?? eventData.currency ?? ""}
                  onChange={(e) => updateEditedField("currency", e.target.value)}
                />
              </div>
            </div>
          )}

            <button
              type="button"
              className={styles.discussBtn}
              onClick={() => window.open("https://forms.gle/Bbfv1vfnaU356dqL8", "_blank", "noopener,noreferrer")}
          >
            💬 Подать апелляцию
          </button>
        </div>


        <aside className={styles.rightCol}>
          <PersonCard 
        user={eventData.gs} 
        isEdit={isEditing} 
        onChange={(user, role) => { 
          updateEditedField('gs_name', user?.nickname); 
          updateEditedField('gs_role', role); 
          updateEditedField('gs_avatar',user?.photoUrl)
        }} 
        token={token} 
        defaultRole="GS" 
      />
      <PersonCard 
        user={eventData.org} 
        isEdit={isEditing} 
        onChange={(user, role) => { 
          updateEditedField('org_name', user?.nickname); 
          updateEditedField('org_role', role); 
          updateEditedField('org_avatar',user?.photoUrl)
        }} 
        token={token} 
        defaultRole="Организатор" 
      />
          
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

        {isEditing && (
          <div className={styles.editActions}>
            <button onClick={saveEvent} className={styles.saveButton}>Сохранить</button>
            <button onClick={cancelEditing} className={styles.cancelButton}>Отмена</button>
          </div>
        )}
      </div>


      {/* Tabs for standings & nominations */}
      <section className={styles.tabsWrap}>
        <nav className={styles.tabsNav} aria-label="Панель вкладок зачёта и номинаций">
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'player' ? styles.tabActive : ''}`}
            onClick={() => setTab('player')}
            aria-selected={activeTab === 'player'}
            role="tab"
          >
            Участники
          </button>

          {(typeNormalized === "pair" || typeNormalized === "team") && (
            <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'team' ? styles.tabActive : ''}`}
            onClick={() => setTab('team')}
            aria-selected={activeTab === 'team'}
            role="tab"
          >
            {typeNormalized === "pair" ? "Пары" : "Команды"}
          </button>
          )}

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'games' ? styles.tabActive : ''}`}
            onClick={() => setTab('games')}
            aria-selected={activeTab === 'games'}
            role="tab"
          >
            Игры
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'solo' ? styles.tabActive : ''}`}
            onClick={() => setTab('solo')}
            aria-selected={activeTab === 'solo'}
            role="tab"
          >
            Личный зачёт
          </button>

          {showTeamTabs && (
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'teamStat' ? styles.tabActive : ''}`}
              onClick={() => setTab('teamStat')}
              aria-selected={activeTab === 'teamStat'}
              role="tab"
            >
              Командный зачёт
            </button>
          )}

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'nomsSolo' ? styles.tabActive : ''}`}
            onClick={() => setTab('nomsSolo')}
            aria-selected={activeTab === 'nomsSolo'}
            role="tab"
          >
            Номинации 
          </button>

           {(isAdmin || isJudge) && <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'admin' ? styles.tabActive : ''}`}
            onClick={() => setTab('admin')}
            aria-selected={activeTab === 'admin'}
            role="tab"
          >
            Админ-панель
          </button>}


        </nav>

        {activeTab === "admin" && (
  <>
    <section className={styles.adminPanel}>
      <h2 className={styles.h2}>Панель администратора</h2>
      <div className={styles.adminGrid}>
        <div className={styles.adminForm}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Количество раундов</label>
            <input
              type="number"
              className={styles.input}
              value={numRounds}
              onChange={(e) => setNumRounds(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Количество столов</label>
            <input
              type="number"
              className={styles.input}
              value={numTables}
              onChange={(e) => setNumTables(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Исключения рассадки (каждая пара с новой строки)</label>
            <textarea
              className={styles.textarea}
              value={exclusionsText}
              onChange={(e) => setExclusionsText(e.target.value)}
              placeholder="Player1, Player2\nPlayer3, Player4"
            />
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
    <div className={styles.judgesSection}>
      <h3>Судьи</h3>

      {judges.map((judge, index) => (
        <div key={index} className={styles.judgeCard}>
          <PersonCard
  user={judge}
  isEdit={true}
  token={token}
  defaultRole="Судья"
  onChange={(user, role) => {
    console.log("1. onChange received:", { user, role });
    
    // Создаем новый массив judges
    const updated = [...judges];
    
    // Важно! user может быть полным объектом или уже готовым
    // Проверяем структуру и сохраняем ID
    updated[index] = {
      id: user?.id, // Сохраняем ID
      nickname: user?.nickname || user?.name,
      avatar: user?.avatar || user?.photoUrl,
      role: role,
    };
    
    
    
    // Обновляем состояние
    setJudges(updated);
    
    // Обновляем editedFields
    updateEditedField("judges", updated);
  }}
/>

 <button
  className={styles.saveButton}
  onClick={() => {
    
    
    // Обновляем editedFields с текущим массивом judges
    updateEditedField("judges", judges);
    
    // Вызываем saveEvent
    saveEvent();
  }}
>
  Сохранить
</button>
          <button
            className={styles.deleteButton}
            onClick={() => {
              const updated = judges.filter((_, i) => i !== index);
              setJudges(updated);
              updateEditedField("judges", updated);
            }}
          >
            Удалить
          </button>
        </div>
      ))}

      <button
        className={styles.primaryBtn}
        onClick={() => {
          const updated = [...judges, { id: null }];
          setJudges(updated);
          updateEditedField("judges", updated);
          
        }}
      >
        + Добавить судью
      </button>
      
    </div>
  </>
)}
            





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
                {isAdmin && 
                            (<div 
                              onClick={() => handleDeletePlayer(p.id, eventId)} 
                              style={{ cursor: 'pointer', color: 'red', fontSize: '20px' }}
                              title="Удалить игрока"
                            >
                              x
                            </div>
                          )}
              </div>
            ))}
          </div>
        )}
      </section>
        )}

  {activeTab === "games" && (
  <section className={styles.gamesSection}>
    <h2 className={styles.h2}>Игры ивента</h2>

    {eventData.games_are_hidden ? ( // Если игры СКРЫТЫ
      isAuthenticated ? ( // Пользователь АВТОРИЗОВАН
        // Передаем игры. TournamentGames сам обработает пустой список, если он будет.
        <>
        <TournamentGames
          games={eventData.games ?? []}
          isAdmin={isAdmin}
          onDelete={handleDeleteGame}
          onEdit={(gameId, eventId) => navigate(`/Event/${eventId}/Game/${gameId}`)}
          onPlayerClick={(playerId) => navigate(`/profile/playerId}`)}
          showOnlyNames={eventData.games_are_hidden && !isAdmin}
          isJudges={isJudge} // true, т.к. игры скрыты и пользователь НЕ админ
        />
        {isJudge && (
  <button
    className={styles.primaryBtn}
    onClick={handleGenerateNextRound}
  >
    Добавить раунд
  </button>
)}
        </>
      ) : ( // Пользователь НЕ АВТОРИЗОВАН И игры СКРЫТЫ
        <div className={styles.emptyHint}>
          Пожалуйста, авторизуйтесь, чтобы увидеть игры и результаты.
        </div>
      )
    ) : ( // Если игры НЕ СКРЫТЫ (видно ВСЕМ)
      // Показываем игры без проверки авторизации.
      // TournamentGames сам обработает пустой список, если он будет.
      <>
      <TournamentGames
        games={eventData.games ?? []}
        isAdmin={isAdmin}
        onDelete={handleDeleteGame}
        onEdit={(gameId, eventId) => navigate(`/Event/${eventId}/Game/${gameId}`)}
        onPlayerClick={(playerId) => navigate(`/profile/${playerId}`)}
        showOnlyNames={false} // Игры не скрыты, поэтому этот флаг не нужен для ограничения
        isJudges={isJudge}
      />
      {isJudge && (
  <button
    className={styles.primaryBtn}
    onClick={handleGenerateNextRound}
  >
    Добавить раунд
  </button>
)}
      </>
    )}
  </section>
)}

        {activeTab === "solo" && (
          <section className={styles.tabPanel} role="tabpanel">
            <h2 className={styles.h2}>Личный зачёт</h2>

            {eventData.games_are_hidden ? (
              isAuthenticated ? (
                <DetailedStatsTable
                  data={playersStatsSorted}
                  currentPage={personalPage}
                  totalPages={personalTotalPages}
                  onPageChange={setPersonalPage}
                  user={user}
                  key={personalPage}
                />
              ) : (
                <div className={styles.emptyHint}>
                  Пожалуйста, авторизуйтесь, чтобы увидеть статистику.
                </div>
              )
            ) : (
              <DetailedStatsTable
                data={playersStatsSorted}
                currentPage={personalPage}
                totalPages={personalTotalPages}
                onPageChange={setPersonalPage}
                user={user}
                key={personalPage}
              />
            )}
          </section>
        )}

        {activeTab === "teamStat" && showTeamTabs && (
  <section className={styles.tabPanel} role="tabpanel">
    <h2 className={styles.h2}>Командный зачёт</h2>

    {eventData.games_are_hidden ? (
      isAuthenticated ? (
        <DetailedStatsTable
          data={aggregatedTeamData}
          currentPage={teamPage}
          totalPages={Math.ceil(aggregatedTeamData.length / pageSize)}
          onPageChange={setTeamPage}
          user={user}
          isSolo={0}
        />
      ) : (
        <div className={styles.emptyHint}>
          Пожалуйста, авторизуйтесь, чтобы увидеть статистику.
        </div>
      )
    ) : (
      <DetailedStatsTable
        data={aggregatedTeamData}
        currentPage={teamPage}
        totalPages={Math.ceil(aggregatedTeamData.length / pageSize)}
        onPageChange={setTeamPage}
        user={user}
        isSolo={0}
      />
    )}
  </section>
        )}


{activeTab === "nomsSolo" && (
  <section className={styles.nomsSection}>
    <h2 className={styles.h2}>Номинации</h2>

    {eventData.games_are_hidden ? ( // Если номинации скрыты (используем games_are_hidden)
      isAuthenticated ? ( // Пользователь авторизован
        <>
          {(() => {
            const roleNames = {
              sheriff: "Шериф",
              citizen: "Мирный",
              mafia: "Черный",
              don: "Дон",
            };

            const renderTop3 = (arr) => {
              const list = Array.isArray(arr) ? arr.slice(0, 3) : [];
              if (!list.length) return <div className={styles.empty}>—</div>;

              return list.map((w, idx) => (
                <button
                  key={w?.id ?? `${w?.name || "player"}-${idx}`}
                  type="button"
                  className={styles.winnerLink}
                  onClick={() => w?.id && navigate(`/profile/${w.id}`)}
                  title={w?.name || ""}
                >
                  <span className={styles.winnerPlace}>{idx + 1}.</span>
                  <span className={styles.winnerName}>{w?.name ?? "—"}</span>
                  <span className={styles.winnerValue}>({w?.value ?? "0"})</span>
                </button>
              ));
            };

            const mvpTop3 = Array.isArray(overallNomination)
              ? overallNomination
              : overallNomination
              ? [overallNomination]
              : [];

            return (
              <div className={styles.nominationsGrid}>
                {(roleNominations || []).map((n) => (
                  <div key={n.role} className={styles.nominationCard}>
                    <div className={styles.nominationTitle}>
                      Лучший {roleNames[n.role] || n.role}
                    </div>
                    <div className={styles.nominationWinners}>
                      {renderTop3(n.winners ?? (n.winner ? [n.winner] : []))}
                    </div>
                  </div>
                ))}

                {mvpTop3.length > 0 && (
                  <div className={styles.nominationCard}>
                    <div className={styles.nominationTitle}>MVP</div>
                    <div className={styles.nominationWinners}>
                      {renderTop3(mvpTop3)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </>
      ) : ( // Пользователь не авторизован и номинации скрыты
        <div className={styles.emptyHint}>
          Пожалуйста, авторизуйтесь, чтобы увидеть номинации.
        </div>
      )
    ) : ( // Номинации не скрыты — видны всем
      <>
        {(() => {
          const roleNames = {
            sheriff: "Шериф",
            citizen: "Мирный",
            mafia: "Черный",
            don: "Дон",
          };

          const renderTop3 = (arr) => {
            const list = Array.isArray(arr) ? arr.slice(0, 3) : [];
            if (!list.length) return <div className={styles.empty}>—</div>;

            return list.map((w, idx) => (
              <button
                key={w?.id ?? `${w?.name || "player"}-${idx}`}
                type="button"
                className={styles.winnerLink}
                onClick={() => w?.id && navigate(`/profile/${w.id}`)}
                title={w?.name || ""}
              >
                <span className={styles.winnerPlace}>{idx + 1}.</span>
                <span className={styles.winnerName}>{w?.name ?? "—"}</span>
                <span className={styles.winnerValue}>({w?.value ?? "0"})</span>
              </button>
            ));
          };

          const mvpTop3 = Array.isArray(overallNomination)
            ? overallNomination
            : overallNomination
            ? [overallNomination]
            : [];

          return (
            <div className={styles.nominationsGrid}>
              {(roleNominations || []).map((n) => (
                <div key={n.role} className={styles.nominationCard}>
                  <div className={styles.nominationTitle}>
                    Лучший {roleNames[n.role] || n.role}
                  </div>
                  <div className={styles.nominationWinners}>
                    {renderTop3(n.winners ?? (n.winner ? [n.winner] : []))}
                  </div>
                </div>
              ))}

              {mvpTop3.length > 0 && (
                <div className={styles.nominationCard}>
                  <div className={styles.nominationTitle}>MVP</div>
                  <div className={styles.nominationWinners}>
                    {renderTop3(mvpTop3)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        
      </>
    )}
  </section>
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
