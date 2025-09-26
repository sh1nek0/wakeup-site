import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import styles from './RatingPage.module.css';
import defaultAvatar from "../NavBar/avatar.png";

const tabs = ['Общая сводка', 'Игры', 'Статистика'];

export default function RatingPage() {
  const [activeTab, setActiveTab] = useState('Общая сводка');
  const [currentPage, setCurrentPage] = useState(1);
  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);  // Новое состояние для пагинации игр
  const itemsPerPage = 10;
  const navigate = useNavigate();

  const { user, isAuthenticated } = useContext(AuthContext);
  const isAdmin = user && user.role === 'admin';

  const [gamesError, setGamesError] = useState(null);

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
  const gamesStartIndex = (gamesCurrentPage - 1) * itemsPerPage;  // Новое для игр
  const detailedStatsStartIndex = (detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage;

  const totalPages = totalPlayersCount && itemsPerPage ? Math.ceil(totalPlayersCount / itemsPerPage) : 0;
  const gamesTotalPages = totalGamesCount && itemsPerPage ? Math.ceil(totalGamesCount / itemsPerPage) : 0;
  const detailedStatsTotalPages = detailedStatsTotalCount && detailedStatsItemsPerPage ? Math.ceil(detailedStatsTotalCount / detailedStatsItemsPerPage) : 0;

  const [expandedStatsPlayer, setExpandedStatsPlayer] = useState(null);

  const toggleExpandedStatsRow = (playerName) => {
    setExpandedStatsPlayer(prev => (prev === playerName ? null : playerName));
  };

  // Новые состояния для модального окна удаления
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteGameId, setDeleteGameId] = useState(null);
  const [adminNickname, setAdminNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Новые состояния для уведомлений
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Функция для показа уведомлений с автосокрытием
  const showMessage = (message, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setSuccessMessage('');
    } else {
      setSuccessMessage(message);
      setErrorMessage('');
    }
    // Автосокрытие через 5 секунд
    setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 5000);
  };

  function CombinedBonusHistogram({ winsPlusList, lossesPlusList }) {
    const winsPlus = [].concat(...Object.values(winsPlusList || {}));
    const lossesPlus = [].concat(...Object.values(lossesPlusList || {}));

    if (winsPlus.length === 0 && lossesPlus.length === 0) return null;

    const allPlus = [...winsPlus, ...lossesPlus];
    const maxPlus = Math.max(...allPlus, 0);
    const bins = {};
    for (let i = 0; i <= maxPlus + 0.5; i += 0.5) {
      bins[i] = { wins: 0, losses: 0 };
    }

    winsPlus.forEach(val => {
      const bin = Math.floor(val / 0.5) * 0.5;
      if (bins[bin]) bins[bin].wins += 1;
    });

    lossesPlus.forEach(val => {
      const bin = Math.floor(val / 0.5) * 0.5;
      if (bins[bin]) bins[bin].losses += 1;
    });

    const binKeys = Object.keys(bins).map(Number).sort((a, b) => a - b);
    const maxFreq = Math.max(...binKeys.map(bin => bins[bin].wins + bins[bin].losses));

    const width = 600;
    const height = 300;
    const margin = { top: 20, bottom: 50, left: 50, right: 20 };
    const barWidth = (width - margin.left - margin.right) / binKeys.length;

    const yTicksCount = 5;
    const yTickStep = maxFreq / yTicksCount;

    return (
      <svg width={width} height={height} role="img" aria-label="Гистограмма распределения бонусов за победы и поражения">
        <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="black" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="black" />

        {[...Array(yTicksCount + 1)].map((_, i) => {
          const yValue = i * yTickStep;
          const y = height - margin.bottom - (yValue / maxFreq) * (height - margin.top - margin.bottom);
          return (
            <g key={i}>
              <line x1={margin.left - 5} y1={y} x2={margin.left} y2={y} stroke="black" />
              <text x={margin.left - 10} y={y + 4} fontSize="10" textAnchor="end" fill="black">
                {Math.round(yValue)}
              </text>
            </g>
          );
        })}

        {binKeys.map((bin, i) => {
          const x = margin.left + i * barWidth;
          const lossFreq = bins[bin].losses;
          const winFreq = bins[bin].wins;

          const barHeightLoss = maxFreq ? (lossFreq / maxFreq) * (height - margin.top - margin.bottom) : 0;
          const barHeightWin = maxFreq ? (winFreq / maxFreq) * (height - margin.top - margin.bottom) : 0;

          return (
            <g key={bin}>
              <rect
                x={x + barWidth * 0.1}
                y={height - margin.bottom - barHeightLoss}
                width={barWidth * 0.8}
                height={barHeightLoss}
                fill="green"
                aria-label={`Поражения: ${lossFreq} игр с бонусом ~${bin}`}
              />
              <rect
                x={x + barWidth * 0.1}
                y={height - margin.bottom - barHeightLoss - barHeightWin}
                width={barWidth * 0.8}
                height={barHeightWin}
                fill="red"
                aria-label={`Победы: ${winFreq} игр с бонусом ~${bin}`}
              />
              <text x={x + barWidth / 2} y={height - margin.bottom + 15} fontSize="10" textAnchor="middle" fill="black">
                {bin}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${width - 120}, 20)`}>
          <rect x={0} y={0} width={10} height={10} fill="green" />
          <text x={15} y={8} fontSize="10">Поражения</text>
          <rect x={0} y={15} width={10} height={10} fill="red" />
          <text x={15} y={23} fontSize="10">Победы</text>
        </g>
      </svg>
    );
  }

  const fetchPlayers = async () => {
    const cacheKey = `players_offset_${startIndex}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheExpiry = 5 * 60 * 1000;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheExpiry && parsed.data && Array.isArray(parsed.data.players)) {
          setPlayersData(parsed.data.players);
          setTotalPlayersCount(parsed.data.total_count || 0);
          setPlayersLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Ошибка парсинга кэша игроков:', e);
        localStorage.removeItem(cacheKey);
      }
    }

    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const response = await fetch(`/api/getRating?limit=${itemsPerPage}&offset=${startIndex}`);
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.players)) {
        setPlayersData(data.players);
        setTotalPlayersCount(data.total_count || 0);
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      } else {
        throw new Error('Некорректная структура ответа от сервера (отсутствует players)');
      }
    } catch (error) {
      setPlayersError(error.message);
      setPlayersData([]);
      setTotalPlayersCount(0);
    } finally {
      setPlayersLoading(false);
    }
  };

  const fetchGames = async () => {
    const cacheKey = `games_offset_${gamesStartIndex}`;  // Исправлено на gamesStartIndex
    const cached = localStorage.getItem(cacheKey);
    const cacheExpiry = 3 * 60 * 1000;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheExpiry && parsed.data && Array.isArray(parsed.data.games)) {
          setGamesData(parsed.data.games);
          setTotalGamesCount(parsed.data.total_count || 0);
          setGamesLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Ошибка парсинга кэша игр:', e);
        localStorage.removeItem(cacheKey);
      }
    }

    setGamesLoading(true);
    setGamesError(null);
    try {
      const response = await fetch(`/api/getGames?limit=${itemsPerPage}&offset=${gamesStartIndex}`);
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.games)) {
        setGamesData(data.games);
        setTotalGamesCount(data.total_count || 0);
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      } else {
        throw new Error('Некорректная структура ответа от сервера (отсутствует games)');
      }
    } catch (error) {
      setGamesError(error.message);
      setGamesData([]);
      setTotalGamesCount(0);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchDetailedStats = async () => {
    const cacheKey = `detailedStats_offset_${detailedStatsStartIndex}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheExpiry = 3 * 60 * 1000;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheExpiry && parsed.data && Array.isArray(parsed.data.players)) {
          setDetailedStatsData(parsed.data.players);
          setDetailedStatsTotalCount(parsed.data.total_count || 0);
          setAveragePoints(parsed.data.average_points || 0);
          setDetailedStatsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Ошибка парсинга кэша детальной статистики:', e);
        localStorage.removeItem(cacheKey);
      }
    }

    setDetailedStatsLoading(true);
    setDetailedStatsError(null);
    try {
      const response = await fetch(`/api/getDetailedStats?limit=${detailedStatsItemsPerPage}&offset=${detailedStatsStartIndex}`);
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.players)) {
        setDetailedStatsData(data.players);
        setDetailedStatsTotalCount(data.total_count || 0);
        setAveragePoints(data.average_points || 0);
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      } else {
        throw new Error('Некорректная структура ответа (отсутствует players)');
      }
    } catch (error) {
      setDetailedStatsError(error.message);
      setDetailedStatsData([]);
      setDetailedStatsTotalCount(0);
      setAveragePoints(0);
    } finally {
      setDetailedStatsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (activeTab === 'Общая сводка') {
      fetchPlayers();
    } else if (activeTab === 'Игры') {
      fetchGames();
    } else if (activeTab === 'Статистика') {
      fetchDetailedStats();
    }
  }, [activeTab, currentPage, gamesCurrentPage, detailedStatsCurrentPage, isAuthenticated]);  // Добавлено gamesCurrentPage

  const handlePageChange = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleGamesPageChange = (pageNum) => {
    if (pageNum >= 1 && pageNum <= gamesTotalPages) {
      setGamesCurrentPage(pageNum);  // Исправлено
    }
  };

  const handleDetailedStatsPageChange = (pageNum) => {
    if (pageNum >= 1 && pageNum <= detailedStatsTotalPages) {
      setDetailedStatsCurrentPage(pageNum);
    }
  };

  const handleCreateGame = () => {
    const eventId = '1';
    const gameId = totalGamesCount + 1;  // Корректно
    navigate(`/Event/${eventId}/Game/${gameId}`);
  };

  // Новая функция для обработки удаления игры
  const handleDeleteGame = async () => {
    if (!deleteGameId || !adminNickname || !adminPassword) {
      showMessage('Пожалуйста, заполните все поля для аутентификации.', true);
      return;
    }

    setIsDeleting(true);
    try {
        const response = await fetch(`/api/deleteGame/${deleteGameId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_nickname: adminNickname,
          admin_password: adminPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        showMessage(data.message);  // Успех
        setShowDeleteModal(false);
        setAdminNickname('');
        setAdminPassword('');
        setDeleteGameId(null);
        fetchGames();  // Обновляем список игр
        fetchPlayers();  // Обновляем общую сводку (рейтинг игроков)
        fetchDetailedStats();  // Обновляем статистику
      } else {
        let errorMsg = 'Неизвестная ошибка';
        if (response.status === 400) {
          errorMsg = 'Админ с таким nickname не найден или неверный пароль.';
        } else if (response.status === 403) {
          errorMsg = 'У вас нет прав для удаления игры (требуется роль admin).';
        } else if (response.status === 404) {
          errorMsg = 'Игра не найдена.';
        } else {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        }
        showMessage(errorMsg, true);
      }
    } catch (error) {
      showMessage('Ошибка сети: ' + error.message, true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Функция для открытия модального окна
  const openDeleteModal = (gameId) => {
    setDeleteGameId(gameId);
    setShowDeleteModal(true);
  };

  // Остальной JSX без изменений, кроме исправлений в пагинации для игр (используем gamesCurrentPage)
  return (
    <div className={styles.pageWrapper}>
      {/* Уведомления */}
      {successMessage && (
        <div className={styles.notification} style={{ backgroundColor: 'green', color: 'white' }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className={styles.notification} style={{ backgroundColor: 'red', color: 'white' }}>
          {errorMessage}
        </div>
      )}

      <main className={styles.main}>
        <h1 className={styles.title}>Сезонный Рейтинг</h1>

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

        {/* Вкладка "Общая сводка" - без изменений */}
        {activeTab === 'Общая сводка' && (
          <>
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p>Ошибка: {playersError}</p>}
            {!playersLoading && !playersError && playersData && Array.isArray(playersData) && (
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
                          <div className={styles.flex}>
                            <div className={styles.rankBadge} aria-label={`Место ${rank}`}>
                              {rank}
                            </div>
                            <img
                              src={player.avatarUrl ? player.avatarUrl : defaultAvatar}
                              alt="avatar"
                              className={styles.avatar}
                            />
                            <div>
                              <div className={styles.playerName}>{player.name}</div>
                              <div className={styles.playerSubtitle}>{player.club}</div>
                            </div>
                          </div>
                        </div>
                        <div className={styles.flex}>
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
                      const pageNum = i + 1;
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`Страница ${pageNum}`}
                          type="button"
                        >
                          {pageNum}
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

        {/* Вкладка "Игры" - исправлена пагинация и добавлено удаление */}
        {activeTab === 'Игры' && (
          <div className={styles.gamesContainer}>
            {isAdmin && (
              <button onClick={handleCreateGame} className={styles.createGameBtn} type="button">
                Создать игру
              </button>
            )}
            {gamesLoading && <p>Загрузка игр...</p>}
            {gamesError && <p>Ошибка: {gamesError}</p>}
            {!gamesLoading && !gamesError && gamesData && Array.isArray(gamesData) && (
              <>
                <section className={styles.gamesGrid} role="tabpanel" aria-label="Список игр">
                  {gamesData.map((game) => (
                    <article key={game.id} className={styles.gameCard}>
                      <header
                        className={`${styles.gameHeader} ${
                          game.badgeColor === 'red'
                            ? styles.gameHeaderRed
                            : game.badgeColor === 'black'
                            ? styles.gameHeaderBlack
                            : ''
                        }`}
                      >
                        <div className={styles.gameTitle}>
                          Игра {game.id} <span className={styles.checkMark} aria-label="Завершена">✔</span>
                        </div>
                        <div className={styles.gameDate}>{game.date}</div>
                      </header>

                      <table className={styles.gameTable}>
                        <thead>
                          <tr>
                            <th>№</th>
                            <th>Игрок</th>
                            <th>Роль</th>
                            <th>Баллы</th>
                          </tr>
                        </thead>
                        <tbody>
                          {game.players &&
                            Array.isArray(game.players) &&
                            game.players.map((player, i) => (
                              <tr key={`${game.id}-${player.name}-${i}`}>
                                <td>{i + 1}</td>
                                <td>{player.name}</td>
                                <td className={styles.statusCell}>
                                  <span className={styles.icon} title={player.role}>
                                    {player.role}
                                  </span>
                                </td>
                                <td>{player.points}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>

                      {/* Кнопка удаления (только для админов) */}
                      {isAdmin && (
                        <button
                          onClick={() => openDeleteModal(game.id)}
                          className={styles.deleteGameBtn}
                          type="button"
                          aria-label={`Удалить игру ${game.id}`}
                        >
                          Удалить
                        </button>
                      )}
                    </article>
                  ))}
                </section>

                {gamesTotalPages > 0 && (
                  <nav className={styles.pagination} aria-label="Пейджинг игр">
                    <button
                      onClick={() => handleGamesPageChange(gamesCurrentPage - 1)}  // Исправлено
                      disabled={gamesCurrentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      aria-label="Предыдущая страница"
                      type="button"
                    >
                      ‹
                    </button>
                    {[...Array(gamesTotalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      const isActive = pageNum === gamesCurrentPage;  // Исправлено
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handleGamesPageChange(pageNum)}
                          className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`Страница ${pageNum}`}
                          type="button"
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleGamesPageChange(gamesCurrentPage + 1)}  // Исправлено
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

        {/* Вкладка "Статистика" - без изменений */}
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
                <p className={styles.statValue}>
                  {detailedStatsData.length > 0 ? detailedStatsData[0].nickname : '-'}
                </p>
              </div>
            </div>

            {/* Детальная статистика (оставлена без изменений) */}
            <div className={styles.detailedStatsSection}>
              <h2 className={styles.detailedStatsTitle}>Детальная статистика игроков</h2>
              {detailedStatsLoading && <p>Загрузка детальной статистики...</p>}
              {detailedStatsError && <p>Ошибка: {detailedStatsError}</p>}
              {!detailedStatsLoading &&
                !detailedStatsError &&
                detailedStatsData &&
                Array.isArray(detailedStatsData) && (
                  <div className={styles.tableWrapper}>
                    <table className={styles.detailedStatsTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Игрок</th>
                          <th>Σ</th>
                          <th>1🏆</th>
                          <th>СК</th>
                          <th>ЖК</th>
                          <th>ЛХ</th>
                          <th>Допы</th>
                          <th>Ci</th>
                          <th>−</th>
                          <th>Общая</th>
                          <th>Шериф</th>
                          <th>Мирн.</th>
                          <th>Мафия</th>
                          <th>Дон</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedStatsData.map((p, i) => {
                          const rank = (detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage + i + 1;

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

                          function renderRoleStats(wins, games, rolePlusArr) {
                            const gamesCount = games || 0;
                            const winsCount = wins || 0;
                            const winPercent = gamesCount ? Math.round((winsCount / gamesCount) * 100) : 0;
                            const bonusSum = rolePlusArr?.reduce((a, b) => a + b, 0) || 0;
                            const bonusMax = rolePlusArr?.length ? Math.max(...rolePlusArr) : 0;

                            return (
                              <>
                                {winsCount} / {gamesCount} ({winPercent}%)
                                <br />
                                Доп: {bonusSum.toFixed(2)} макс: {bonusMax.toFixed(2)}
                              </>
                            );
                          }

                          function renderSpecialRoleStats(rolePlusArr) {
                            const totalCards = rolePlusArr?.reduce((a, b) => a + b, 0) || 0;
                            return totalCards.toFixed(2);
                          }

                          return (
                            <React.Fragment key={p.nickname}>
                              <tr
                                className={p.nickname === user?.nickname ? styles.currentUserRow : ''}
                                onClick={() => toggleExpandedStatsRow(p.nickname)}
                                style={{ cursor: 'pointer' }}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') toggleExpandedStatsRow(p.nickname);
                                }}
                                aria-expanded={expandedStatsPlayer === p.nickname ? 'true' : 'false'}
                                role="button"
                              >
                                <td>{rank}</td>
                                <td>
                                  <span
                                    className={styles.link}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/player/${encodeURIComponent(p.nickname)}`);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') navigate(`/player/${encodeURIComponent(p.nickname)}`);
                                    }}
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
                                    <CombinedBonusHistogram winsPlusList={p.wins_plus_list || {}} lossesPlusList={p.losses_plus_list || {}} />
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
                    const pageNum = i + 1;
                    const isActive = pageNum === detailedStatsCurrentPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handleDetailedStatsPageChange(pageNum)}
                        className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={`Страница ${pageNum}`}
                        type="button"
                      >
                        {pageNum}
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

      {/* Модальное окно для удаления игры */}
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
                <button type="button" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                  Отмена
                </button>
                <button type="submit" disabled={isDeleting}>
                  {isDeleting ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
