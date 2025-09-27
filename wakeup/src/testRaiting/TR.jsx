import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import styles from '../RaitingPage/RatingPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';

const tabs = ['Общий рейтинг', 'Игры', 'Статистика'];

export default function TR() {
  const [activeTab, setActiveTab] = useState('Общий рейтинг');
  const [currentPage, setCurrentPage] = useState(1);
  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  const { user, isAuthenticated } = useContext(AuthContext);
  const isAdmin = 1;

  const [gamesError, setGamesError] = useState(null);

  // ===== mock =====
  const mockPlayersData = [
    { name: 'Klever', club: 'WakeUp Mafia | MET', avatarUrl: null, points: 1056 },
    { name: 'Ошо', club: 'WakeUp Mafia | MET', avatarUrl: null, points: 900 },
    { name: 'SWAGG', club: 'WakeUp Mafia | MET', avatarUrl: null, points: 800 },
    { name: 'Businka', club: 'WakeUp Mafia | MET', avatarUrl: null, points: 700 },
    { name: 'Ной', club: 'WakeUp Mafia | MET', avatarUrl: null, points: 55 },
    { name: 'Shaggy', club: 'WakeUp Mafia | MET', avatarUrl: null, points: 5 },
  ];
  const mockTotalPlayersCount = mockPlayersData.length;

  const mockGamesData = [
    {
      id: 1, date: '2023-10-01', badgeColor: 'red', players: [
        { name: 'Игрок 1', role: 'Шериф', points: 10 },
        { name: 'Игрок 2', role: 'Мафия', points: -5 },
        { name: 'Игрок 3', role: 'Мирный', points: 5 },
      ]
    },
    {
      id: 1, date: '2023-10-01', badgeColor: 'red', players: [
        { name: 'Игрок 1', role: 'Шериф', points: 10 },
        { name: 'Игрок 2', role: 'Мафия', points: -5 },
        { name: 'Игрок 3', role: 'Мирный', points: 5 },
      ]
    },
    {
      id: 1, date: '2023-10-01', badgeColor: 'red', players: [
        { name: 'Игрок 1', role: 'Шериф', points: 10 },
        { name: 'Игрок 2', role: 'Мафия', points: -5 },
        { name: 'Игрок 3', role: 'Мирный', points: 5 },
      ]
    },
    {
      id: 1, date: '2023-10-01', badgeColor: 'red', players: [
        { name: 'Игрок 1', role: 'Шериф', points: 10 },
        { name: 'Игрок 2', role: 'Мафия', points: -5 },
        { name: 'Игрок 3', role: 'Мирный', points: 5 },
      ]
    },
    {
      id: 2, date: '2023-10-02', badgeColor: 'black', players: [
        { name: 'Игрок 4', role: 'Дон', points: 15 },
        { name: 'Игрок 5', role: 'СК', points: 8 },
      ]
    },
  ];
  const mockTotalGamesCount = mockGamesData.length;

  const mockDetailedStatsData = [
    {
      nickname: 'Игрок 1', totalPoints: 150,
      wins: { red: 5, peaceful: 3, mafia: 2, don: 1, sk: 0, jk: 0 },
      gamesPlayed: { red: 10, peaceful: 8, mafia: 5, don: 2, sk: 0, jk: 0 },
      role_plus: { red: [1.5, 2.0], peaceful: [0.5, 1.0], mafia: [2.5], don: [3.0], sk: [], jk: [] },
      bonuses: 10.5, penalties: -2.0,
      wins_plus_list: { red: [1.5, 2.0], peaceful: [0.5, 1.0] },
      losses_plus_list: { mafia: [1.0, 1.5] }
    },
    {
      nickname: 'Игрок 2', totalPoints: 140,
      wins: { red: 4, peaceful: 2, mafia: 3, don: 0, sk: 1, jk: 0 },
      gamesPlayed: { red: 8, peaceful: 6, mafia: 7, don: 0, sk: 2, jk: 0 },
      role_plus: { red: [1.0, 1.8], peaceful: [0.8], mafia: [2.0, 2.5], don: [], sk: [1.5], jk: [] },
      bonuses: 8.0, penalties: -1.5,
      wins_plus_list: { red: [1.0, 1.8], mafia: [2.0] },
      losses_plus_list: { peaceful: [0.5] }
    },
  ];
  const mockDetailedStatsTotalCount = mockDetailedStatsData.length;
  const mockAveragePoints = 145.0;

  // ===== state =====
  const [playersData, setPlayersData] = useState([]);
  const [totalPlayersCount, setTotalPlayersCount] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState(null);

  const [gamesData, setGamesData] = useState([]);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [gamesLoading, setGamesLoading] = useState(false);

  const [detailedStatsData, setDetailedStatsData] = useState([]);
  const [detailedStatsTotalCount, setDetailedStatsTotalCount] = useState(0);
  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(false);
  const [detailedStatsError, setDetailedStatsError] = useState(null);
  const detailedStatsItemsPerPage = 10;

  const [averagePoints, setAveragePoints] = useState(0);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const gamesStartIndex = (gamesCurrentPage - 1) * itemsPerPage;
  const detailedStatsStartIndex = (detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage;

  const totalPages = Math.ceil(mockTotalPlayersCount / itemsPerPage);
  const gamesTotalPages = Math.ceil(mockTotalGamesCount / itemsPerPage);
  const detailedStatsTotalPages = Math.ceil(mockDetailedStatsTotalCount / detailedStatsItemsPerPage);

  const [expandedStatsPlayer, setExpandedStatsPlayer] = useState(null);
  const toggleExpandedStatsRow = (playerName) => setExpandedStatsPlayer(prev => (prev === playerName ? null : playerName));

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteGameId, setDeleteGameId] = useState(null);
  const [adminNickname, setAdminNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showMessage = (message, isError = false) => {
    if (isError) { setErrorMessage(message); setSuccessMessage(''); }
    else { setSuccessMessage(message); setErrorMessage(''); }
    setTimeout(() => { setSuccessMessage(''); setErrorMessage(''); }, 5000);
  };

  // ===== histogram =====
  function CombinedBonusHistogram({ winsPlusList, lossesPlusList }) {
    const winsPlus = [].concat(...Object.values(winsPlusList || {}));
    const lossesPlus = [].concat(...Object.values(lossesPlusList || {}));
    if (winsPlus.length === 0 && lossesPlus.length === 0) return null;

    const allPlus = [...winsPlus, ...lossesPlus];
    const maxPlus = Math.max(...allPlus, 0);
    const bins = {};
    for (let i = 0; i <= maxPlus + 0.5; i += 0.5) bins[i] = { wins: 0, losses: 0 };

    winsPlus.forEach(v => { const b = Math.floor(v / 0.5) * 0.5; if (bins[b]) bins[b].wins += 1; });
    lossesPlus.forEach(v => { const b = Math.floor(v / 0.5) * 0.5; if (bins[b]) bins[b].losses += 1; });

    const binKeys = Object.keys(bins).map(Number).sort((a, b) => a - b);
    const maxFreq = Math.max(...binKeys.map(b => bins[b].wins + bins[b].losses));

    const width = 600, height = 300, margin = { top: 20, bottom: 50, left: 50, right: 20 };
    const barWidth = (width - margin.left - margin.right) / binKeys.length;

    const yTicksCount = 5;
    const yTickStep = maxFreq / yTicksCount;

    return (
      <svg width={width} height={height} role="img" aria-label="Гистограмма бонусов">
        <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="black" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="black" />
        {[...Array(yTicksCount + 1)].map((_, i) => {
          const yValue = i * yTickStep;
          const y = height - margin.bottom - (yValue / maxFreq) * (height - margin.top - margin.bottom);
          return (
            <g key={i}>
              <line x1={margin.left - 5} y1={y} x2={margin.left} y2={y} stroke="black" />
              <text x={margin.left - 10} y={y + 4} fontSize="10" textAnchor="end" fill="black">{Math.round(yValue)}</text>
            </g>
          );
        })}
        {binKeys.map((bin, i) => {
          const x = margin.left + i * barWidth;
          const loss = bins[bin].losses;
          const win = bins[bin].wins;
          const areaHeight = height - margin.top - margin.bottom;
          const hL = maxFreq ? (loss / maxFreq) * areaHeight : 0;
          const hW = maxFreq ? (win / maxFreq) * areaHeight : 0;

          return (
            <g key={bin}>
              <rect x={x + barWidth * .1} y={height - margin.bottom - hL} width={barWidth * .8} height={hL} fill="green" />
              <rect x={x + barWidth * .1} y={height - margin.bottom - hL - hW} width={barWidth * .8} height={hW} fill="red" />
              <text x={x + barWidth / 2} y={height - margin.bottom + 15} fontSize="10" textAnchor="middle" fill="black">{bin}</text>
            </g>
          );
        })}
        <g transform={`translate(${width - 120}, 20)`}>
          <rect x={0} y={0} width={10} height={10} fill="green" /><text x={15} y={8} fontSize="10">Поражения</text>
          <rect x={0} y={15} width={10} height={10} fill="red" /><text x={15} y={23} fontSize="10">Победы</text>
        </g>
      </svg>
    );
  }

  // ===== load mock =====
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (activeTab === 'Общий рейтинг') {
      setPlayersData(mockPlayersData.slice(startIndex, startIndex + itemsPerPage));
      setTotalPlayersCount(mockTotalPlayersCount);
      setPlayersLoading(false);
    } else if (activeTab === 'Игры') {
      setGamesData(mockGamesData.slice(gamesStartIndex, gamesStartIndex + itemsPerPage));
      setTotalGamesCount(mockTotalGamesCount);
      setGamesLoading(false);
    } else if (activeTab === 'Статистика') {
      setDetailedStatsData(
        mockDetailedStatsData.slice(detailedStatsStartIndex, detailedStatsStartIndex + detailedStatsItemsPerPage)
      );
      setDetailedStatsTotalCount(mockDetailedStatsTotalCount);
      setAveragePoints(mockAveragePoints);
      setDetailedStatsLoading(false);
    }
  }, [activeTab, currentPage, gamesCurrentPage, detailedStatsCurrentPage, isAuthenticated]);

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };
  const handleGamesPageChange = (p) => { if (p >= 1 && p <= gamesTotalPages) setGamesCurrentPage(p); };
  const handleDetailedStatsPageChange = (p) => { if (p >= 1 && p <= detailedStatsTotalPages) setDetailedStatsCurrentPage(p); };

  const handleCreateGame = () => {
    const eventId = '1';
    const gameId = totalGamesCount + 1;
    navigate(`/Event/${eventId}/Game/${gameId}`);
  };

  const handleDeleteGame = async () => {
    if (!deleteGameId || !adminNickname || !adminPassword) {
      showMessage('Пожалуйста, заполните все поля для аутентификации.', true);
      return;
    }
    showMessage('Игра удалена (заглушка).');
    setShowDeleteModal(false);
    setAdminNickname('');
    setAdminPassword('');
    setDeleteGameId(null);
  };

  const openDeleteModal = (gameId) => { setDeleteGameId(gameId); setShowDeleteModal(true); };

  return (
    <div className={styles.pageWrapper}>
      {successMessage && <div className={styles.notification}>{successMessage}</div>}
      {errorMessage && <div className={styles.notification}>{errorMessage}</div>}

      <main className={styles.main}>
        {/* HERO */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Рейтинг</h1>
          <p className={styles.heroText}>
            Рейтинг в студенческой мафии — это числовой показатель силы игрока, который вычисляется
            по специальной математической формуле на основе его результатов в турнирных играх.
            Если просто, рейтинг — это ваш «уровень навыка» в глазах сообщества. Он объективно
            отражает вашу способность выигрывать и влиять на исход игры.
          </p>
        </section>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
              aria-selected={activeTab === tab}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ====== ОБЩИЙ РЕЙТИНГ ====== */}
        {activeTab === 'Общий рейтинг' && (
          <>
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p>Ошибка: {playersError}</p>}
            {!playersLoading && !playersError && Array.isArray(playersData) && (
              <>
                <section className={styles.cardsWrapper} role="tabpanel" aria-label="Рейтинг игроков">
                  <div className={styles.cardsHeader}>
                    <div className={styles.cardPlayerHeader}>Игрок</div>
                    <div className={styles.cardPointsHeader}>Баллы</div>
                  </div>

                  {playersData.map((player, index) => {
                    const rank = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <article key={`${rank}-${index}`} className={styles.card}>
                        <div className={styles.cardPlayer}>
                          <div className={styles.avatarWrap}>
                            <img
                              src={player.avatarUrl || defaultAvatar}
                              alt={`${player.name} avatar`}
                              className={styles.avatar}
                            />
                            <span className={styles.rankBadge} aria-label={`Место ${rank}`}>{rank}</span>
                          </div>
                          <div>
                            <div className={styles.playerName}>{player.name}</div>
                            <div className={styles.playerSubtitle}>{player.club}</div>
                          </div>
                        </div>

                        <div className={styles.pointsBlock}>
                          <div className={styles.cardPoints}>{player.points}</div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {totalPages > 0 && (
                  <nav className={styles.pagination} aria-label="Пейджинг рейтинга">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      aria-label="Предыдущая страница"
                      type="button"
                    >
                      ‹
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const p = i + 1; const isActive = p === currentPage;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`Страница ${p}`}
                          type="button"
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
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
            )}
          </>
        )}

        {/* ====== ИГРЫ (лист как на макете / sheet*) ====== */}
        {activeTab === 'Игры' && (
          <div>
            {isAdmin && (
              <button onClick={handleCreateGame} className={styles.createGameBtn} type="button">
                Создать игру
              </button>
            )}
            {gamesLoading && <p>Загрузка игр...</p>}
            {gamesError && <p>Ошибка: {gamesError}</p>}
            {!gamesLoading && !gamesError && Array.isArray(gamesData) && (
              <>
                <section className={styles.gamesGridSheet} role="tabpanel" aria-label="Список игр">
                  {gamesData.map((game) => {
                    const rows = Array.from({ length: 10 }, (_, i) => game.players?.[i] || {});
                    return (
                      <article key={game.id} className={styles.sheetCard}>
                        {/* верхняя плашка */}
                        <div className={styles.sheetTop}>
                          <span className={styles.sheetTitle}>Игра #{game.id}</span>
                          <div className={styles.sheetSlashTop} aria-hidden="true" />
                          <time className={styles.sheetDate}>{game.date || ''}</time>
                        </div>

                        {/* таблица */}
                        <div className={styles.sheetTableWrap}>
                          <table className={styles.sheetTable}>
                            <thead>
                              <tr>
                                <th>№</th>
                                <th>Игрок</th>
                                <th>Роль</th>
                                <th>Очки</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, i) => (
                                <tr key={`${game.id}-${i}`}>
                                  <td>{i + 1}</td>
                                  <td>{row.name ?? row.nickname ?? ''}</td>
                                  <td>{row.role ?? row.role_name ?? ''}</td>
                                  <td>{row.points ?? ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* нижняя плашка */}
                        <div className={styles.sheetBottom}>
                          <span className={styles.sheetBottomLeft}>Результат</span>
                          <div className={styles.sheetSlashBottom} aria-hidden="true" />
                          <span className={styles.sheetBottomRight}>
                            {game.result || (game.badgeColor === 'red' ? 'Победа мафии' : 'Победа мирных')}
                          </span>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => openDeleteModal(game.id)}
                            className={styles.sheetDeleteBtn}
                            type="button"
                            aria-label={`Удалить игру ${game.id}`}
                          >
                            Удалить
                          </button>
                        )}
                      </article>
                    );
                  })}
                </section>

                {gamesTotalPages > 0 && (
                  <nav className={styles.pagination} aria-label="Пейджинг игр">
                    <button
                      onClick={() => handleGamesPageChange(gamesCurrentPage - 1)}
                      disabled={gamesCurrentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      aria-label="Предыдущая страница"
                      type="button"
                    >
                      ‹
                    </button>
                    {[...Array(gamesTotalPages)].map((_, i) => {
                      const p = i + 1; const isActive = p === gamesCurrentPage;
                      return (
                        <button
                          key={p}
                          onClick={() => handleGamesPageChange(p)}
                          className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`Страница ${p}`}
                          type="button"
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleGamesPageChange(gamesCurrentPage + 1)}
                      disabled={gamesCurrentPage === gamesTotalPages}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      aria-label="Следующая страница"
                      type="button"
                    >
                      ›
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        )}

        {/* ====== СТАТИСТИКА ====== */}
        {activeTab === 'Статистика' && (
          <section className={styles.statsWrapper} role="tabpanel" aria-label="Общая статистика">
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Общее количество игр</h3>
                <p className={styles.statValue}>{totalGamesCount}</p>
              </div>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Общее количество игроков</h3>
                <p className={styles.statValue}>{detailedStatsTotalCount}</p>
              </div>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Средний балл</h3>
                <p className={styles.statValue}>{averagePoints.toFixed(2)}</p>
              </div>
              <div className={styles.statItem}>
                <h3 className={styles.statTitle}>Лучший игрок</h3>
                <p className={styles.statValue}>{detailedStatsData.length > 0 ? detailedStatsData[0].nickname : '-'}</p>
              </div>
            </div>

            <div className={styles.detailedStatsSection}>
              <h2 className={styles.detailedStatsTitle}>Детальная статистика игроков</h2>
              {detailedStatsLoading && <p>Загрузка детальной статистики...</p>}
              {detailedStatsError && <p>Ошибка: {detailedStatsError}</p>}
              {!detailedStatsLoading && !detailedStatsError && Array.isArray(detailedStatsData) && (
                <div className={styles.tableWrapper}>
                  <table className={styles.detailedStatsTable}>
                    <thead>
                      <tr>
                        <th>#</th><th>Игрок</th><th>Σ</th><th>1🏆</th><th>СК</th><th>ЖК</th><th>ЛХ</th><th>Допы</th><th>Ci</th><th>−</th>
                        <th>Общая</th><th>Шериф</th><th>Мирн.</th><th>Мафия</th><th>Дон</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedStatsData.map((p, i) => {
                        const rank = (detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage + i + 1;

                        const totalGames =
                          (p.gamesPlayed?.peaceful || 0) + (p.gamesPlayed?.mafia || 0) +
                          (p.gamesPlayed?.red || 0) + (p.gamesPlayed?.don || 0) +
                          (p.gamesPlayed?.sk || 0) + (p.gamesPlayed?.jk || 0);

                        const totalWins =
                          (p.wins?.red || 0) + (p.wins?.peaceful || 0) +
                          (p.wins?.mafia || 0) + (p.wins?.don || 0) +
                          (p.wins?.sk || 0) + (p.wins?.jk || 0);

                        function renderRoleStats(wins, games, arr) {
                          const g = games || 0; const w = wins || 0;
                          const wp = g ? Math.round((w / g) * 100) : 0;
                          const sum = arr?.reduce((a, b) => a + b, 0) || 0;
                          const max = arr?.length ? Math.max(...arr) : 0;
                          return (<>{w} / {g} ({wp}%)<br />Доп: {sum.toFixed(2)} макс: {max.toFixed(2)}</>);
                        }
                        function renderSpecialRoleStats(arr) {
                          return (arr?.reduce((a, b) => a + b, 0) || 0).toFixed(2);
                        }

                        return (
                          <React.Fragment key={p.nickname}>
                            <tr
                              className={p.nickname === user?.nickname ? styles.currentUserRow : ''}
                              onClick={() => toggleExpandedStatsRow(p.nickname)}
                              style={{ cursor: 'pointer' }}
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') toggleExpandedStatsRow(p.nickname); }}
                              aria-expanded={expandedStatsPlayer === p.nickname ? 'true' : 'false'}
                              role="button"
                            >
                              <td>{rank}</td>
                              <td>
                                <span
                                  className={styles.link}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/player/${encodeURIComponent(p.nickname)}`); }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/player/${encodeURIComponent(p.nickname)}`); }}
                                >
                                  {p.nickname}
                                </span>
                              </td>
                              <td>{p.totalPoints?.toFixed(2) || 0}</td>
                              <td>{totalWins}</td>
                              <td>{renderSpecialRoleStats(p.role_plus?.sk || [])}</td>
                              <td>{renderSpecialRoleStats(p.role_plus?.jk || [])}</td>
                              <td>{0}</td>
                              <td>{p.bonuses?.toFixed(2) || 0}</td>
                              <td>{0}</td>
                              <td>{p.penalties?.toFixed(2) || 0}</td>

                              <td>{renderRoleStats(totalWins, totalGames, [].concat(...Object.values(p.role_plus || {})))}</td>
                              <td>{renderRoleStats(p.wins?.red, p.gamesPlayed?.red, p.role_plus?.red || [])}</td>
                              <td>{renderRoleStats(p.wins?.peaceful, p.gamesPlayed?.peaceful, p.role_plus?.peaceful || [])}</td>
                              <td>{renderRoleStats(p.wins?.mafia, p.gamesPlayed?.mafia, p.role_plus?.mafia || [])}</td>
                              <td>{renderRoleStats(p.wins?.don, p.gamesPlayed?.don, p.role_plus?.don || [])}</td>
                            </tr>

                            {expandedStatsPlayer === p.nickname && (
                              <tr className={styles.expandedRow}>
                                <td colSpan={15} style={{ padding: '10px', backgroundColor: '#f9f9f9' }}>
                                  <h4>Распределение бонусов за победы и поражения для {p.nickname}</h4>
                                  <CombinedBonusHistogram
                                    winsPlusList={p.wins_plus_list || {}}
                                    lossesPlusList={p.losses_plus_list || {}}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {detailedStatsTotalPages > 0 && (
                <nav className={`${styles.pagination} ${styles.detailedPagination}`} aria-label="Пейджинг детальной статистики">
                  <button
                    onClick={() => handleDetailedStatsPageChange(detailedStatsCurrentPage - 1)}
                    disabled={detailedStatsCurrentPage === 1}
                    className={`${styles.pageBtn} ${styles.pageArrow}`}
                    aria-label="Предыдущая страница"
                    type="button"
                  >
                    ‹
                  </button>
                  {[...Array(detailedStatsTotalPages)].map((_, i) => {
                    const p = i + 1; const isActive = p === detailedStatsCurrentPage;
                    return (
                      <button
                        key={p}
                        onClick={() => handleDetailedStatsPageChange(p)}
                        className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={`Страница ${p}`}
                        type="button"
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handleDetailedStatsPageChange(detailedStatsCurrentPage + 1)}
                    disabled={detailedStatsCurrentPage === detailedStatsTotalPages}
                    className={`${styles.pageBtn} ${styles.pageArrow}`}
                    aria-label="Следующая страница"
                    type="button"
                  >
                    ›
                  </button>
                </nav>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>Удалить игру</h2>
            <p>Введите credentials админа для подтверждения:</p>
            <form onSubmit={(e) => { e.preventDefault(); handleDeleteGame(); }}>
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
                <button type="button" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>Отмена</button>
                <button type="submit" disabled={isDeleting}>{isDeleting ? 'Удаление...' : 'Удалить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
