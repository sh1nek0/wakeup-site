import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // ИЗМЕНЕНИЕ: Добавлен useLocation
import { AuthContext } from '../AuthContext';
import styles from './RatingPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';

const tabs = ['Общая сводка', 'Игры', 'Статистика'];

const baseURL = ""


export default function RatingPage() {
  const [activeTab, setActiveTab] = useState('Общая сводка');

  // Рейтинг (общая сводка)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Игры
  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);

  // Детальная статистика
  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const detailedStatsItemsPerPage = 10;

  const navigate = useNavigate();
  const location = useLocation(); // ИЗМЕНЕНИЕ: Получаем location
  const { user, isAuthenticated, token, isAdmin } = useContext(AuthContext);

  // ====== STATE ======
  const [playersData, setPlayersData] = useState([]);
  const [totalPlayersCount, setTotalPlayersCount] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState(null);

  const [gamesData, setGamesData] = useState([]);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState(null);

  const [detailedStatsData, setDetailedStatsData] = useState([]);
  const [detailedStatsTotalCount, setDetailedStatsTotalCount] = useState(0);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(false);
  const [detailedStatsError, setDetailedStatsError] = useState(null);
  const [averagePoints, setAveragePoints] = useState(0);

  // Для фильтрации по событиям
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('all');

  // Состояние для процессов
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false); // New state

  // Уведомления
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ИЗМЕНЕНИЕ: Эффект для переключения на нужную вкладку после редиректа
  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab);
    }
  }, [location.state]);

  // ====== HELPERS ======
  const startIndex = (currentPage - 1) * itemsPerPage;
  const gamesStartIndex = (gamesCurrentPage - 1) * itemsPerPage;
  const detailedStatsStartIndex =
    (detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage;

  const totalPages =
    totalPlayersCount && itemsPerPage
      ? Math.ceil(totalPlayersCount / itemsPerPage)
      : 0;
  const gamesTotalPages =
    totalGamesCount && itemsPerPage
      ? Math.ceil(totalGamesCount / itemsPerPage)
      : 0;
  const detailedStatsTotalPages =
    detailedStatsTotalCount && detailedStatsItemsPerPage
      ? Math.ceil(detailedStatsTotalCount / detailedStatsItemsPerPage)
      : 0;

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

  const clearCache = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('players_') || key.startsWith('games_') || key.startsWith('detailedStats_')) {
        localStorage.removeItem(key);
      }
    });
  };

  const handleEventChange = (eventId) => {
    setSelectedEventId(eventId);
    setCurrentPage(1);
    setGamesCurrentPage(1);
    setDetailedStatsCurrentPage(1);
    clearCache();
  };

  // ====== DATA FETCH ======
  const fetchPlayers = async () => {
    const cacheExpiry = 60 * 1000; // 1 минута
    const cacheKey = `players_offset_${startIndex}_event_${selectedEventId}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (
          Date.now() - parsed.timestamp < cacheExpiry &&
          parsed.data &&
          Array.isArray(parsed.data.players)
        ) {
          setPlayersData(parsed.data.players);
          setTotalPlayersCount(parsed.data.total_count || 0);
          setPlayersLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const res = await fetch(
        baseURL+`/api/getRating?limit=${itemsPerPage}&offset=${startIndex}` +
        (selectedEventId !== 'all' ? `&event_id=${selectedEventId}` : '')
      );
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.players)) {
        setPlayersData(data.players);
        setTotalPlayersCount(data.total_count || 0);
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } else {
        throw new Error('Некорректная структура ответа (players)');
      }
    } catch (e) {
      setPlayersError(e.message);
      setPlayersData([]);
      setTotalPlayersCount(0);
    } finally {
      setPlayersLoading(false);
    }
  };

  const fetchGames = async () => {
    const cacheExpiry = 60 * 1000; // 1 минута
    const cacheKey = `games_offset_${gamesStartIndex}_event_${selectedEventId}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (
          Date.now() - parsed.timestamp < cacheExpiry &&
          parsed.data &&
          Array.isArray(parsed.data.games)
        ) {
          setGamesData(parsed.data.games);
          setTotalGamesCount(parsed.data.total_count || 0);
          setGamesLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    setGamesLoading(true);
    setGamesError(null);
    try {
      const res = await fetch(
        `/api/getGames?limit=${itemsPerPage}&offset=${gamesStartIndex}` +
        (selectedEventId !== 'all' ? `&event_id=${selectedEventId}` : '')
      );
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.games)) {
        setGamesData(data.games);
        setTotalGamesCount(data.total_count || 0);
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } else {
        throw new Error('Некорректная структура ответа (games)');
      }
    } catch (e) {
      setGamesError(e.message);
      setGamesData([]);
      setTotalGamesCount(0);
    } finally {
      setGamesLoading(false);
    }
  };

  const fetchDetailedStats = async () => {
    const cacheExpiry = 60 * 1000; // 1 минута
    const cacheKey = `detailedStats_offset_${detailedStatsStartIndex}_event_${selectedEventId}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (
          Date.now() - parsed.timestamp < cacheExpiry &&
          parsed.data &&
          Array.isArray(parsed.data.players)
        ) {
          setDetailedStatsData(parsed.data.players);
          setDetailedStatsTotalCount(parsed.data.total_count || 0);
          setAveragePoints(parsed.data.average_points || 0);
          setDetailedStatsLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    setDetailedStatsLoading(true);
    setDetailedStatsError(null);
    try {
      const res = await fetch(
        `/api/getDetailedStats?limit=${detailedStatsItemsPerPage}&offset=${detailedStatsStartIndex}` +
        (selectedEventId !== 'all' ? `&event_id=${selectedEventId}` : '')
      );
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.players)) {
        setDetailedStatsData(data.players);
        setDetailedStatsTotalCount(data.total_count || 0);
        setAveragePoints(data.average_points || 0);
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } else {
        throw new Error('Некорректная структура ответа (players)');
      }
    } catch (e) {
      setDetailedStatsError(e.message);
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
    if (activeTab === 'Общая сводка') fetchPlayers();
    else if (activeTab === 'Игры') fetchGames();
    else if (activeTab === 'Статистика') fetchDetailedStats();

    fetch('/api/events')
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(err => console.error("Не удалось загрузить события:", err));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    currentPage,
    gamesCurrentPage,
    detailedStatsCurrentPage,
    isAuthenticated,
    selectedEventId,
  ]);

  // ====== ПАГИНАЦИЯ ХЕНДЛЕРЫ ======
  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };
  const handleGamesPageChange = (p) => {
    if (p >= 1 && p <= gamesTotalPages) setGamesCurrentPage(p);
  };
  const handleDetailedStatsPageChange = (p) => {
    if (p >= 1 && p <= detailedStatsTotalPages) setDetailedStatsCurrentPage(p);
  };

  // ====== ДЕЙСТВИЯ ======
  const handleCreateGame = async () => {
    setIsCreatingGame(true);
    try {
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        const eventId = selectedEventId !== 'all' ? selectedEventId : '1';
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const response = await fetch(`/api/checkGameExists/${gameId}`);
        if (!response.ok) {
          showMessage('Ошибка проверки ID игры на сервере.', true);
          return;
        }
        const data = await response.json();

        if (!data.exists) {
          navigate(`/Event/${eventId}/Game/${gameId}`);
          return; // Успешно, выходим из функции
        }
        
        attempts++;
      }
      showMessage('Не удалось сгенерировать уникальный ID для игры. Попробуйте еще раз.', true);
    } catch (error) {
      showMessage('Ошибка сети при создании игры: ' + error.message, true);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm(`Вы уверены, что хотите удалить игру #${gameId}?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/deleteGame/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        showMessage(data.message || 'Игра удалена.');
        clearCache();
        fetchGames();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showMessage(errorData.detail || 'Ошибка при удалении игры.', true);
      }
    } catch (e) {
      showMessage('Ошибка сети: ' + e.message, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateCi = () => {
    if (!isAdmin) {
      showMessage('Это действие доступно только администратору.', true);
      return;
    }
    setIsRecalculating(true);
    showMessage('Обновление данных...');
    clearCache();
    
    // Re-fetch data for the current tab
    if (activeTab === 'Общая сводка') {
      fetchPlayers().finally(() => setIsRecalculating(false));
    } else if (activeTab === 'Игры') {
      fetchGames().finally(() => setIsRecalculating(false));
    } else if (activeTab === 'Статистика') {
      fetchDetailedStats().finally(() => setIsRecalculating(false));
    } else {
      setIsRecalculating(false);
    }
    showMessage('Данные обновлены.');
  };

  return (
    <div className={styles.pageWrapper}>
      {successMessage && (
        <div
          className={styles.notification}
          style={{ backgroundColor: 'green', color: 'white' }}
        >
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div
          className={styles.notification}
          style={{ backgroundColor: 'red', color: 'white' }}
        >
          {errorMessage}
        </div>
      )}

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Рейтинг</h1>
          <p className={styles.heroText}>
            Рейтинг в студенческой мафии — это числовой показатель силы игрока, который вычисляется
            по специальной математической формуле на основе его результатов в турнирных играх.
            Если просто, рейтинг — это ваш «уровень навыка» в глазах сообщества. Он объективно
            отражает вашу способность выигрывать и влиять на исход игры.
          </p>
        </section>

        <div className={styles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabBtn} ${
                activeTab === tab ? styles.tabActive : ''
              }`}
              aria-selected={activeTab === tab}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className={styles.eventSelector}>
          <label htmlFor="event-select">Рейтинг по событию:</label>
          <select
            id="event-select"
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className={styles.eventSelectInput}
          >
            <option value="all">Все события</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </div>


        {activeTab === 'Общая сводка' && (
          <>
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p>Ошибка: {playersError}</p>}

            {!playersLoading && !playersError && Array.isArray(playersData) && (
              <>
                <section
                  className={styles.cardsWrapper}
                  role="tabpanel"
                  aria-label="Рейтинг игроков"
                >
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
                              alt="avatar"
                              className={styles.avatar}
                            />
                            <div
                              className={styles.rankBadge}
                              aria-label={`Место ${rank}`}
                            >
                              {rank}
                            </div>
                          </div>
                          <div>
                            <div className={styles.playerName}>
                              {player.name}
                            </div>
                            <div className={styles.playerSubtitle}>
                              {player.club}
                            </div>
                          </div>
                        </div>

                        <div className={styles.pointsBlock}>
                          <div className={styles.cardPoints}>
                            {player.points}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {totalPages > 0 && (
                  <nav
                    className={styles.pagination}
                    aria-label="Пейджинг рейтинга"
                  >
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
                      const p = i + 1;
                      const isActive = p === currentPage;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`${styles.pageBtn} ${
                            isActive ? styles.pageActive : ''
                          }`}
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

        {activeTab === 'Игры' && (
          <div>
            {isAdmin && (
              <div className={styles.adminActions}>
                <button
                  onClick={handleCreateGame}
                  className={styles.createGameBtn}
                  type="button"
                  disabled={isCreatingGame}
                >
                  {isCreatingGame ? 'Создание...' : 'Создать игру'}
                </button>
                <button
                  onClick={handleUpdateCi}
                  className={styles.createGameBtn}
                  type="button"
                  disabled={isRecalculating}
                >
                  {isRecalculating ? 'Обновление...' : 'Обновить Ci'}
                </button>
              </div>
            )}

            {gamesLoading && <p>Загрузка игр...</p>}
            {gamesError && <p>Ошибка: {gamesError}</p>}

            {!gamesLoading && !gamesError && Array.isArray(gamesData) && (
              <>
                <section
                  className={styles.gamesGridSheet}
                  role="tabpanel"
                  aria-label="Список игр"
                >
                  {gamesData.map((game, idx) => {
                    const gameNumber = totalGamesCount - gamesStartIndex - idx;
                    const rows = Array.from(
                      { length: 10 },
                      (_, i) => game.players?.[i] || {}
                    );
                    return (
                      <article key={game.id} className={styles.sheetCard}>
                        <div className={styles.sheetTop}>
                          <span className={styles.sheetTitle}>
                            Игра #{gameNumber}
                          </span>
                          <div
                            className={styles.sheetSlashTop}
                            aria-hidden="true"
                          />
                          <time className={styles.sheetDate}>
                            {game.date || ''}
                          </time>
                        </div>

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

                        <div className={styles.sheetBottom}>
                          <span className={styles.sheetBottomLeft}>
                            Результат
                          </span>
                          <div
                            className={styles.sheetSlashBottom}
                            aria-hidden="true"
                          />
                          <span className={styles.sheetBottomRight}>
                            {game.result ||
                              (game.badgeColor === 'black'
                                ? 'Победа мафии'
                                : 'Победа мирных')}
                          </span>
                        </div>

                        {isAdmin && (
                          <div className={styles.sheetActions}>
                            <button
                              onClick={() => navigate(`/Event/${game.event_id || '1'}/Game/${game.id}`)}
                              className={styles.sheetEditBtn}
                              type="button"
                              aria-label={`Редактировать игру ${gameNumber}`}
                            >
                              Редактировать
                            </button>
                            <button
                              onClick={() => handleDeleteGame(game.id)}
                              className={styles.sheetDeleteBtn}
                              type="button"
                              aria-label={`Удалить игру ${gameNumber}`}
                              disabled={isDeleting}
                            >
                              {isDeleting ? '...' : 'Удалить'}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>

                {gamesTotalPages > 0 && (
                  <nav
                    className={styles.pagination}
                    aria-label="Пейджинг игр"
                  >
                    <button
                      onClick={() =>
                        handleGamesPageChange(gamesCurrentPage - 1)
                      }
                      disabled={gamesCurrentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      type="button"
                      aria-label="Предыдущая страница"
                    >
                      ‹
                    </button>
                    {[...Array(gamesTotalPages)].map((_, i) => {
                      const p = i + 1;
                      const isActive = p === gamesCurrentPage;
                      return (
                        <button
                          key={p}
                          onClick={() => handleGamesPageChange(p)}
                          className={`${styles.pageBtn} ${
                            isActive ? styles.pageActive : ''
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                          type="button"
                          aria-label={`Страница ${p}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        handleGamesPageChange(gamesCurrentPage + 1)
                      }
                      disabled={gamesCurrentPage === gamesTotalPages}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                      type="button"
                      aria-label="Следующая страница"
                    >
                      ›
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'Статистика' && (
          <section
            className={styles.statsWrapper}
            role="tabpanel"
            aria-label="Общая статистика"
          >
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
                  {detailedStatsData.length > 0
                    ? detailedStatsData[0].nickname
                    : '-'}
                </p>
              </div>
            </div>

            <DetailedStatsTable
              data={detailedStatsData}
              currentPage={detailedStatsCurrentPage}
              totalPages={detailedStatsTotalPages}
              onPageChange={handleDetailedStatsPageChange}
              user={user}
            />
          </section>
        )}
      </main>
    </div>
  );
}

/* ------------------ ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ------------------ */

function DetailedStatsTable({ data, currentPage, totalPages, onPageChange, user }) {
  const renderRoleStats = (wins, games, rolePlusArr) => {
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
  };

  const renderSpecialRoleStats = (rolePlusArr) => {
    const totalCards = rolePlusArr?.reduce((a, b) => a + b, 0) || 0;
    return totalCards.toFixed(2);
  };

  return (
    <>
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

                return (
                  <tr
                    key={p.nickname}
                    className={p.nickname === user?.nickname ? styles.currentUserRow : ''}
                  >
                    <td>{rank}</td>
                    <td><span className={styles.link}>{p.nickname}</span></td>
                    <td>{p.totalPoints?.toFixed(2) || 0}</td>
                    <td>{totalWins}</td>
                    <td>{renderSpecialRoleStats(p.role_plus?.sk || [])}</td>
                    <td>{renderSpecialRoleStats(p.role_plus?.jk || [])}</td>
                    <td>{0}</td>
                    <td>{p.bonuses?.toFixed(2) || 0}</td>
                    <td>{0}</td>
                    <td>{p.penalties?.toFixed(2) || 0}</td>
                    <td>
                      {renderRoleStats(
                        totalWins,
                        totalGames,
                        [].concat(...Object.values(p.role_plus || {}))
                      )}
                    </td>
                    <td>{renderRoleStats(p.wins?.red,      p.gamesPlayed?.red,      p.role_plus?.red      || [])}</td>
                    <td>{renderRoleStats(p.wins?.peaceful, p.gamesPlayed?.peaceful, p.role_plus?.peaceful || [])}</td>
                    <td>{renderRoleStats(p.wins?.mafia,    p.gamesPlayed?.mafia,    p.role_plus?.mafia    || [])}</td>
                    <td>{renderRoleStats(p.wins?.don,      p.gamesPlayed?.don,      p.role_plus?.don      || [])}</td>
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