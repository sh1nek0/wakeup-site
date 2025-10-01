import React, { useContext, useMemo, useState, useEffect } from "react";
import styles from "./Event.module.css";
import { AuthContext } from "../AuthContext";
import { useLocation, useParams } from "react-router-dom";

const stubAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
       <rect fill='#303030' width='100%' height='100%'/>
       <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle'
             fill='#ff6f00' font-family='Arial' font-size='42'>😼</text>
     </svg>`
  );

export default function Game({
  tournament: tournamentProp,
  participants: participantsProp,
  initialTeams,
}) {
  const { isAdmin, user } = useContext(AuthContext) ?? { isAdmin: false, user: null };
  const currentUserId = user?.id ?? null;
  const { evenId } = useParams(); // Предполагаем, что evenId передается в URL как /event/:evenId

  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // State для данных события
  const [tournament, setTournament] = useState(tournamentProp || {});
  const [participants, setParticipants] = useState(participantsProp || []);
  const [teams, setTeams] = useState(initialTeams || []);
  const [detailedStatsData, setDetailedStatsData] = useState([]);
  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const [detailedStatsTotalPages, setDetailedStatsTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Получение данных по событию
  
  useEffect(() => {
    if (!evenId) return;

    setLoading(true);
    fetch(`http://localhost:8000/getEvent/${evenId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Ошибка загрузки данных события");
        return res.json();
      })
      .then((data) => {
        setTournament(data);
        setParticipants(data.participants || []);
        setTeams(data.teams || []);
      })
      .catch((err) => {
        console.error("Ошибка:", err);
        // Можно показать сообщение об ошибке пользователю
      })
      .finally(() => setLoading(false));
  }, [evenId]);


  const teamSize = useMemo(() => {
    if (tournament.type === "pair") return 2;
    if (tournament.type === "team") return 5;
    return 1;
  }, [tournament.type]);

  const assignedIds = new Set(teams.flatMap((t) => t.members.map(m => m.id)));
  const freeParticipants = participants.filter((p) => !assignedIds.has(p.id));

  /* форма создания */
  const [teamName, setTeamName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleMember = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* --- ограничения создания команды/пары --- */
  const mustIncludeSelf = !isAdmin && !!currentUserId;
  const includeSelfOk = !mustIncludeSelf || selectedIds.includes(currentUserId);

  const minTeamForTeamType = Math.ceil(teamSize / 2); // «половина» состава
  const sizeOk =
    tournament.type === "pair"
      ? selectedIds.length === 2
      : tournament.type === "team"
      ? selectedIds.length === teamSize ||
        selectedIds.length === minTeamForTeamType
      : selectedIds.length >= 1;

  const nameOk = teamName.trim().length > 0;

  const canCreateTeam = isAdmin
    ? nameOk && selectedIds.length >= 2 && selectedIds.length <= teamSize
    : nameOk && includeSelfOk && sizeOk;

  const createTeam = () => {
    if (!canCreateTeam) return;
    setTeams((prev) => [
      ...prev,
      {
        id: `team_${Date.now()}`,
        name: teamName.trim(),
        members: selectedIds.map(id => ({ id, nick: participants.find(p => p.id === id)?.nick || "Неизвестный" })),
      },
    ]);
    setTeamName("");
    setSelectedIds([]);
  };

  const deleteTeam = (id) => {
    if (!isAdmin) return;
    setTeams((prev) => prev.filter((t) => t.id !== id));
  };

  const PAGE_SIZE = 10;
  const handleDetailedStatsPageChange = (p) =>
    setDetailedStatsCurrentPage(
      Math.min(Math.max(1, p), detailedStatsTotalPages)
    );

  /* ===== вкладки результатов ===== */
  const [activeTab, setActiveTab] = useState(1);

  if (loading) {
    return <div>Загрузка...</div>; // Простой индикатор загрузки
  }

  return (
    <section className={styles.pageWrap}>
      {/* ===== верхний блок ===== */}
      <header className={styles.header}>
        <h1 className={styles.title}>{tournament.title}</h1>
      </header>

      <div className={styles.topGrid}>
        {/* левая зона */}
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
            onClick={() => alert("Открыть обсуждение")}
          >
            💬 Перейти к обсуждению
          </button>
        </div>

        {/* правая колонка */}
        <aside className={styles.rightCol}>
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
              className={styles.primaryBtn}
              onClick={() => alert("Регистрация")}
            >
              Зарегистрироваться
            </button>
          </div>
        </aside>
      </div>

      {/* ===== участники ===== */}
      <section className={styles.qualifiedWrap}>
        <h2 className={styles.h2}>Участники</h2>
        {participants.length === 0 ? (
          <div className={styles.emptyHint}>Ты можешь стать первым!</div>
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

      {/* ===== команды/пары ===== */}
      {(tournament.type === "pair" || tournament.type === "team") && (
        <section className={styles.teamsWrap}>
          <h2 className={styles.h2}>
            {tournament.type === "pair" ? "Пары" : "Команды"}
          </h2>

          {/* Форма */}
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

            {!isAdmin && (
              <div className={styles.hint}>
                Можно создавать{" "}
                {tournament.type === "pair" ? "пару" : "команду"} только с
                участием себя. Для командного турнира разрешено минимум
                половина состава.
              </div>
            )}
          </div>

          {/* Список команд/пар (под формой) */}
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

      {/* ===== РЕЗУЛЬТАТЫ (вкладки) ===== */}
      <section className={styles.resultsWrap}>
        <div className={styles.tabs}>
          {["Игры", "Личный зачёт", "Командный зачёт"].map((t, i) => (
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
              <DetailedStatsTable
                data={detailedStatsData.slice((detailedStatsCurrentPage - 1) * PAGE_SIZE, detailedStatsCurrentPage * PAGE_SIZE)}
                currentPage={detailedStatsCurrentPage}
                totalPages={detailedStatsTotalPages}
                onPageChange={handleDetailedStatsPageChange}
                user={user}
              />
            </div>
          )}

          {/* Командный зачёт — простой пример */}
          {activeTab === 2 && (
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

/* =========================
   Детальная таблица — компактная версия
   ========================= */
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
