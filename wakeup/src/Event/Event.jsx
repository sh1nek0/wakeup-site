// wakeup-site/wakeup/src/Event/Event.jsx
import React, { useContext, useMemo, useState, useEffect } from "react";
import styles from "./Event.module.css";
import { AuthContext } from "../AuthContext";
import { useLocation, useParams, useNavigate } from "react-router-dom";

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
  const { isAdmin, user, token, isAuthenticated } = useContext(AuthContext) ?? { isAdmin: false, user: null, token: null, isAuthenticated: false };
  const { evenId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- НОВАЯ ЛОГИКА УВЕДОМЛЕНИЙ ---
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
  // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const [tournament, setTournament] = useState({});
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [userRegistrationStatus, setUserRegistrationStatus] = useState('none');
  
  const [detailedStatsData, setDetailedStatsData] = useState([]);
  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const [detailedStatsTotalPages, setDetailedStatsTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [detailedStatsItemsPerPage] = useState(10);
  const [selectedEventId, setSelectedEventId] = useState(evenId || 'all');
  const [detailedStatsError, setDetailedStatsError] = useState(null);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(false);
  
  const fetchEventData = async () => {
    if (!evenId) return;
    setLoading(true);
    try {
      const headers = { 'Cache-Control': 'no-cache' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/getEvent/${evenId}`, { headers });
      if (!res.ok) throw new Error("Ошибка загрузки данных события");
      const data = await res.json();
      
      setTournament(data);
      setParticipants(data.participants || []);
      setTeams(data.teams || []);
      setPendingRegistrations(data.pending_registrations || []);
      setUserRegistrationStatus(data.user_registration_status || 'none');
    } catch (err) {
      console.error("Ошибка:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [evenId, token]);

  useEffect(() => {
    const fetchDetailedStats = async () => {
      setDetailedStatsLoading(true);
      setDetailedStatsError(null);
      try {
        const res = await fetch(
          `/api/getDetailedStats?limit=999` +
          (selectedEventId !== 'all' ? `&event_id=${selectedEventId}` : ''),
          { headers: { 'Cache-Control': 'no-cache' } }
        );
        if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.players)) {
          setDetailedStatsData(data.players);
          setDetailedStatsTotalPages(Math.ceil(data.players.length / detailedStatsItemsPerPage));
          setDetailedStatsCurrentPage(1);
        } else {
          throw new Error('Некорректная структура ответа (players)');
        }
      } catch (e) {
        setDetailedStatsError(e.message);
        setDetailedStatsData([]);
      } finally {
        setDetailedStatsLoading(false);
      }
    };
    fetchDetailedStats();
  }, [selectedEventId, detailedStatsItemsPerPage]);

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

  const canCreateTeam = isAdmin && teamName.trim().length > 0 && selectedIds.length > 0;

  const createTeam = async () => {
    if (!canCreateTeam) return;
    if (!token) {
      showMessage("Токен авторизации отсутствует", true);
      return;
    }
    const requestBody = { event_id: evenId, name: teamName.trim(), members: selectedIds };
    try {
      const response = await fetch("/api/createTeam", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Ошибка создания команды");
      }
      const data = await response.json();
      setTeams((prev) => [
        ...prev,
        {
          id: data.team_id,
          name: teamName.trim(),
          members: selectedIds.map(id => ({ id, nick: participants.find(p => p.id === id)?.nick || "Неизвестный" })),
        },
      ]);
      setTeamName("");
      setSelectedIds([]);
      showMessage(data.message);
    } catch (error) {
      console.error("Ошибка создания команды:", error);
      showMessage(`Ошибка: ${error.message}`, true);
    }
  };

  const deleteTeam = async (id) => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`/api/deleteTeam/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Ошибка удаления");
      setTeams((prev) => prev.filter((t) => t.id !== id));
      showMessage("Команда удалена");
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
      const response = await fetch(`/api/events/${evenId}/register`, {
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

  const PAGE_SIZE = 10;
  const handleDetailedStatsPageChange = (p) =>
    setDetailedStatsCurrentPage(
      Math.min(Math.max(1, p), detailedStatsTotalPages)
    );

  const tabs = ["Игры", "Личный зачёт"];
  if (tournament.type !== "solo") {
    tabs.push("Командный зачёт");
  }
  const [activeTab, setActiveTab] = useState(1);

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

  return (
    <section className={styles.pageWrap}>
      {/* --- БЛОК УВЕДОМЛЕНИЙ --- */}
      {successMessage && <div className={styles.notificationSuccess}>{successMessage}</div>}
      {errorMessage && <div className={styles.notificationError}>{errorMessage}</div>}
      
      <header className={styles.header}>
        <h1 className={styles.title}>{tournament.title}</h1>
      </header>
      {/* ... остальной JSX без изменений ... */}
      <div className={styles.topGrid}>
        <div className={styles.infoGrid}>
          {/* ... info cards ... */}
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
              {tournament.type === "solo"
                ? "Личный"
                : tournament.type === "pair"
                ? "Парный"
                : "Командный"}
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
          {/* ... person cards ... */}
          <div className={styles.personCard}>
            <img
              src={tournament.gs?.avatar || stubAvatar}
              alt={tournament.gs?.name}
              className={styles.avatar}
            />
            <div className={styles.personMeta}>
              <div className={styles.personName}>{tournament.gs?.name}</div>
              <div className={styles.personRole}>{tournament.gs?.role}</div>
            </div>
          </div>

          <div className={styles.personCard}>
            <img
              src={tournament.org?.avatar || stubAvatar}
              alt={tournament.org?.name}
              className={styles.avatar}
            />
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

      {/* --- НОВЫЙ БЛОК ДЛЯ АДМИНА: ЗАЯВКИ НА УЧАСТИЕ --- */}
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
                <img
                  src={p.avatar || stubAvatar}
                  className={styles.qualifiedAvatar}
                  alt={p.nick}
                />
                <div className={styles.qualifiedNick}>{p.nick}</div>
                <div className={styles.qualifiedFrom}>{p.club || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- ФОРМА СОЗДАНИЯ КОМАНД ТЕПЕРЬ ТОЛЬКО ДЛЯ АДМИНА --- */}
      {isAdmin && (tournament.type === "pair" || tournament.type === "team") && (
        <section className={styles.teamsWrap}>
          <h2 className={styles.h2}>
            {tournament.type === "pair" ? "Пары" : "Команды"}
          </h2>
          <div className={styles.teamForm}>
            {/* ... form content ... */}
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
                Участники ({selectedIds.length}
                {tournament.type === "pair"
                  ? "/2"
                  : `/${teamSize} (минимум ${Math.ceil(teamSize / 2)})`}
                )
              </div>
              <div className={styles.membersPool}>
                {freeParticipants.length === 0 && (
                  <div className={styles.emptyHintSmall}>
                    Все участники уже распределены.
                  </div>
                )}
                {freeParticipants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      selectedIds.includes(p.id)
                        ? styles.memberBtnSelected
                        : styles.memberBtn
                    }
                    onClick={() => toggleMember(p.id)}
                  >
                    <img
                      alt={p.nick}
                      src={p.avatar || stubAvatar}
                      className={styles.memberAvatar}
                    />
                    <span>{p.nick}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={
                canCreateTeam ? styles.primaryBtn : styles.primaryBtnDisabled
              }
              disabled={!canCreateTeam}
              onClick={createTeam}
            >
              Создать {tournament.type === "pair" ? "пару" : "команду"}
            </button>
          </div>
          <div className={styles.teamsList}>
            {teams.length === 0 ? (
              <div className={styles.emptyHint}>
                {tournament.type === "pair"
                  ? "Пока нет созданных пар."
                  : "Пока нет созданных команд."}
              </div>
            ) : (
              teams.map((t) => (
                <div className={styles.teamCard} key={t.id}>
                  <div className={styles.teamHeader}>
                    <div className={styles.teamName}>{t.name}</div>
                    {isAdmin && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => deleteTeam(t.id)}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  <div className={styles.teamMembers}>
                    {t.members.map((m) => (
                      <div className={styles.teamMember} key={m.id}>
                        <img
                          src={participants.find(p => p.id === m.id)?.avatar || stubAvatar}
                          alt={m.nick}
                          className={styles.memberAvatar}
                        />
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

      <section className={styles.resultsWrap}>
        {/* ... tabs and results ... */}
        <div className={styles.tabs}>
          {tabs.map((t, i) => (
            <button
              key={t}
              type="button"
              className={i === activeTab ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(i)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className={styles.tabPanel}>
          {/* Игры — плейсхолдер */}
          {activeTab === 0 && (
            <div className={styles.placeholder}>
              Таблица «Игры» появится здесь
            </div>
          )}

          {/* Личный зачёт — только таблица */}
          {activeTab === 1 && (
            <div className={styles.tableOnly}>
              {detailedStatsLoading && <div>Загрузка статистики...</div>}
              {detailedStatsError && <div>Ошибка: {detailedStatsError}</div>}
              {!detailedStatsLoading && !detailedStatsError && (
                <DetailedStatsTable
                  data={detailedStatsData.slice((detailedStatsCurrentPage - 1) * PAGE_SIZE, detailedStatsCurrentPage * PAGE_SIZE)}
                  currentPage={detailedStatsCurrentPage}
                  totalPages={detailedStatsTotalPages}
                  onPageChange={handleDetailedStatsPageChange}
                  user={user}
                />
              )}
            </div>
          )}

          {/* Командный зачёт — простой пример */}
          {activeTab === 2 && tournament.type !== "solo" && (
            <div className={styles.tableWrapper}>
              <table
                className={styles.detailedStatsTable}
                aria-label="Командный зачёт"
              >
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>{tournament.type === "pair" ? "Пара" : "Команда"}</th>
                    <th>Очки</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", color: "#bbb" }}>
                        Нет данных
                      </td>
                    </tr>
                  ) : (
                    teams.map((t, idx) => (
                      <tr key={t.id}>
                        <td>{idx + 1}</td>
                        <td>{t.name}</td>
                        <td>0</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
// ... DetailedStatsTable component ...
function DetailedStatsTable({ data, currentPage, totalPages, onPageChange, user }) {
  const roleCell = (wins = 0, games = 0, plusArr = []) => {
    const g = games || 0;
    const w = wins || 0;
    const pct = g ? Math.round((w / g) * 100) : 0;
    const sum = (plusArr || []).reduce((a, b) => a + b, 0);
    const max = (plusArr || []).length ? Math.max(...plusArr) : 0;
    const tip = `Победы: ${w}/${g} (${pct}%) • Доп: ${sum.toFixed(2)} • Макс: ${max.toFixed(2)}`;
    return <span title={tip}>{w}/{g} ({pct}%)</span>;
  };

  const cardsCell = (plusArr = []) => {
    const total = plusArr.reduce((a, b) => a + b, 0);
    return <span className={styles.num}>{total.toFixed(2)}</span>;
  };

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.detailedStatsTable}>
          <colgroup>
            <col className={styles.colRank} />
            <col className={styles.colPlayer} />
            <col className={styles.colShort} />
            <col className={styles.colTiny} />
            <col className={styles.colTiny} />
            <col className={styles.colTiny} />
            <col className={styles.colTiny} />
            <col className={styles.colShort} />
            <col className={styles.colTiny} />
            <col className={styles.colTiny} />
            <col className={styles.colWide} />
            <col className={styles.colWide} />
            <col className={styles.colWide} />
            <col className={styles.colWide} />
            <col className={styles.colWide} />
          </colgroup>
          <thead>
            <tr>
              <th className={`${styles.stickyCol1} ${styles.center}`}>#</th>
              <th className={styles.stickyCol2}>Игрок</th>
              <th className={styles.center}>Σ</th>
              <th className={styles.center}>1🏆</th>
              <th className={styles.center}>СК</th>
              <th className={styles.center}>ЖК</th>
              <th className={styles.center}>ЛХ</th>
              <th className={styles.center}>Допы</th>
              <th className={styles.center}>Ci</th>
              <th className={styles.center}>−</th>
              <th className={styles.center}>Общая</th>
              <th className={styles.center}>Шериф</th>
              <th className={styles.center}>Мирн.</th>
              <th className={styles.center}>Мафия</th>
              <th className={styles.center}>Дон</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(data) &&
              data.map((p, i) => {
                const rank = (currentPage - 1) * 10 + i + 1;

                const totalGames =
                  (p.gamesPlayed?.peaceful || 0) +
                  (p.gamesPlayed?.mafia || 0) +
                  (p.gamesPlayed?.red || 0) +
                  (p.gamesPlayed?.don || 0) +
                  (p.gamesPlayed?.sk || 0) +
                  (p.gamesPlayed?.jk || 0);

                const totalWins =
                  (p.wins?.red || 0) +
                  (p.wins?.peaceful || 0) +
                  (p.wins?.mafia || 0) +
                  (p.wins?.don || 0) +
                  (p.wins?.sk || 0) +
                  (p.wins?.jk || 0);

                const allPlus = Object.values(p.role_plus || {}).flat();

                return (
                  <tr
                    key={p.nickname}
                    className={p.nickname === user?.nickname ? styles.currentUserRow : ""}
                  >
                    <td className={`${styles.stickyCol1} ${styles.center}`}>{rank}</td>
                    <td className={styles.stickyCol2}>
                      <span className={styles.link}>{p.nickname}</span>
                    </td>

                    <td className={`${styles.num} ${styles.center}`}>{(p.totalPoints ?? 0).toFixed(2)}</td>
                    <td className={`${styles.num} ${styles.center}`}>{totalWins}</td>
                    <td className={styles.center}>{cardsCell(p.role_plus?.sk || [])}</td>
                    <td className={styles.center}>{cardsCell(p.role_plus?.jk || [])}</td>
                    <td className={styles.center}>{cardsCell(p.role_plus?.red || [])}</td>
                    <td className={`${styles.num} ${styles.center}`}>{(p.bonuses ?? 0).toFixed(2)}</td>
                    <td className={`${styles.num} ${styles.center}`}>0</td>
                    <td className={`${styles.num} ${styles.center}`}>{(p.penalties ?? 0).toFixed(2)}</td>

                    <td className={styles.center}>{roleCell(totalWins, totalGames, allPlus)}</td>
                    <td className={styles.center}>{roleCell(p.wins?.red, p.gamesPlayed?.red, p.role_plus?.red)}</td>
                    <td className={styles.center}>{roleCell(p.wins?.peaceful, p.gamesPlayed?.peaceful, p.role_plus?.peaceful)}</td>
                    <td className={styles.center}>{roleCell(p.wins?.mafia, p.gamesPlayed?.mafia, p.role_plus?.mafia)}</td>
                    <td className={styles.center}>{roleCell(p.wins?.don, p.gamesPlayed?.don, p.role_plus?.don)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <nav
          className={`${styles.pagination} ${styles.detailedPagination}`}
          aria-label="Пейджинг детальной статистики"
        >
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`${styles.pageBtn} ${styles.pageArrow}`}
            aria-label="Предыдущая страница"
            type="button"
          >
            ‹
          </button>
          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`${styles.pageBtn} ${isActive ? styles.pageActive : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Страница ${p}`}
                type="button"
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`${styles.pageBtn} ${styles.pageArrow}`}
            aria-label="Следующая страница"
            type="button"
          >
            ›
          </button>
        </nav>
      )}
    </>
  );
}