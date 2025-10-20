
import React, { useContext, useMemo, useState, useEffect } from "react";
import styles from "./Event.module.css";
import { AuthContext } from "../AuthContext";
import { useLocation, useParams, useNavigate, NavLink } from "react-router-dom";
import TournamentGames from "../components/TournamentGames/TournamentGames";

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

  const [tournament, setTournament] = useState({});
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
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/getEvent/${eventId}`, { headers });
      if (!res.ok) throw new Error("Ошибка загрузки данных события");
      const data = await res.json();
      
      setTournament(data);
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
    if (tournament.type === "pair") return 2;
    if (tournament.type === "team") return 5;
    return 1;
  }, [tournament.type]);

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
    if (!token) {
      showMessage("Токен авторизации отсутствует", true);
      return;
    }
    const membersWithCreator = [...new Set([...selectedIds, user.id])];
    const requestBody = { event_id: eventId, name: teamName.trim(), members: membersWithCreator };
    try {
      const response = await fetch("/api/createTeam", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Ошибка создания команды");
      }
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
      if (!response.ok) {
          throw new Error(data.detail || "Ошибка удаления");
      }
      showMessage(data.message);
      fetchEventData();
    } catch (error) {
      showMessage(`Ошибка: ${error.message}`, true);
    }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Ошибка регистрации");
      }
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
      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при обработке заявки");
      }
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
      setTournament(prev => ({ ...prev, games_are_hidden: data.games_are_hidden }));
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
      fetchEventData(); // Обновляем список игр
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


  if (loading) {
    return <div>Загрузка...</div>;
  }

  const isEventFull = tournament.participantsCount >= tournament.participantsLimit;
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
        <h1 className={styles.title}>{tournament.title}</h1>
      </header>
      <div className={styles.topGrid}>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Даты проведения</div>
            <div className={styles.value}>{tournament.dates}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Место</div>
            <div className={styles.value}>{tournament.location}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Тип турнира</div>
            <div className={styles.value}>
              {tournament.type === "solo" ? "Личный" : tournament.type === "pair" ? "Парный" : "Командный"}
            </div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.caption}>Участники</div>
            <div className={styles.value}>
              {tournament.participantsCount} из {tournament.participantsLimit}
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
            <img src={tournament.gs?.avatar || stubAvatar} alt={tournament.gs?.name} className={styles.avatar} />
            <div className={styles.personMeta}>
              <div className={styles.personName}>{tournament.gs?.name}</div>
              <div className={styles.personRole}>{tournament.gs?.role}</div>
            </div>
          </div>
          <div className={styles.personCard}>
            <img src={tournament.org?.avatar || stubAvatar} alt={tournament.org?.name} className={styles.avatar} />
            <div className={styles.personMeta}>
              <div className={styles.personName}>{tournament.org?.name}</div>
              <div className={styles.personRole}>{tournament.org?.role}</div>
            </div>
          </div>
          <div className={styles.feeCard}>
            <div className={styles.caption}>Стоимость участия</div>
            <div className={styles.fee}>
              {tournament.fee?.toLocaleString()} {tournament.currency}
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
                {tournament.games_are_hidden ? "Показать игры" : "Скрыть игры"}
              </button>
            </div>
          </div>
        </section>
      )}

      {(isAdmin || !tournament.games_are_hidden) && tournament.games && tournament.games.length > 0 && (
        <section className={styles.gamesSection}>
          <h2 className={styles.h2}>Игры турнира</h2>
          <TournamentGames
            games={tournament.games}
            isAdmin={isAdmin}
            onDelete={handleDeleteGame}
            onEdit={(gameId, eventId) => navigate(`/Event/${eventId}/Game/${gameId}`)}
            onPlayerClick={(playerId) => navigate(`/profile/${playerId}`)}
          />
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

      {(tournament.type === "pair" || tournament.type === "team") && userRegistrationStatus === 'approved' && (
        <section className={styles.teamsWrap}>
          <h2 className={styles.h2}>
            {tournament.type === "pair" ? "Пары" : "Команды"}
          </h2>
          <div className={styles.teamForm}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Название {tournament.type === "pair" ? "пары" : "команды"}
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
                {tournament.type === "pair" ? "/1" : `/${teamSize - 1}`})
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
              Создать {tournament.type === "pair" ? "пару" : "команду"}
            </button>
          </div>
          <div className={styles.teamsList}>
            {teams.length === 0 ? (
              <div className={styles.emptyHint}>
                {tournament.type === "pair" ? "Пока нет созданных пар." : "Пока нет созданных команд."}
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
              ))
            )}
          </div>
        </section>
      )}
    </section>
  );
}