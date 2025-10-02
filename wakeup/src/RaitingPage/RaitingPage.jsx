import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { user, isAuthenticated } = useContext(AuthContext);

  // Временно: включаем админский функционал
const { isAdmin } = useContext(AuthContext);
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

  // Модалка удаления
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteGameId, setDeleteGameId] = useState(null);
  const [adminNickname, setAdminNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Уведомления
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleEventChange = (eventId) => {
    setSelectedEventId(eventId);
    // Сбрасываем страницы при смене фильтра
    setCurrentPage(1);
    setGamesCurrentPage(1);
    setDetailedStatsCurrentPage(1);
    // Очищаем кэш, чтобы загрузить новые данные
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('players_') || key.startsWith('games_') || key.startsWith('detailedStats_')) {
        localStorage.removeItem(key);
      }
    });
  };

  // ====== DATA FETCH ======
  const fetchPlayers = async () => {
    const cacheKey = `players_offset_${startIndex}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheExpiry = 5 * 60 * 1000;

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
    const cacheKey = `games_offset_${gamesStartIndex}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheExpiry = 3 * 60 * 1000;

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
    const cacheKey = `detailedStats_offset_${detailedStatsStartIndex}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheExpiry = 3 * 60 * 1000;

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

    // Загрузка списка событий для фильтра
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
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/deleteGame/${deleteGameId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_nickname: adminNickname,
          admin_password: adminPassword,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showMessage(data.message || 'Игра удалена.');
        setShowDeleteModal(false);
        setAdminNickname('');
        setAdminPassword('');
        setDeleteGameId(null);
        fetchGames();
        fetchPlayers();
        fetchDetailedStats();
      } else {
        let msg = 'Неизвестная ошибка';
        if (res.status === 400) msg = 'Админ не найден или неверный пароль.';
        else if (res.status === 403) msg = 'Нет прав (нужна роль admin).';
        else if (res.status === 404) msg = 'Игра не найдена.';
        else {
          const e = await res.json().catch(() => ({}));
          msg = e.detail || msg;
        }
        showMessage(msg, true);
      }
    } catch (e) {
      showMessage('Ошибка сети: ' + e.message, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (gameId) => {
    setDeleteGameId(gameId);
    setShowDeleteModal(true);
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
        {/* HERO блок (опционально, стили есть в CSS) */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Рейтинг</h1>
          <p className={styles.heroText}>
            Рейтинг в студенческой мафии — это числовой показатель силы игрока, который вычисляется
            по специальной математической формуле на основе его результатов в турнирных играх.
            Если просто, рейтинг — это ваш «уровень навыка» в глазах сообщества. Он объективно
            отражает вашу способность выигрывать и влиять на исход игры.
          </p>
        </section>

        {/* Табы */}
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

        {/* Селектор событий/рейтингов */}
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


        {/* ====== ОБЩАЯ СВОДКА ====== */}
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

        {/* ====== ИГРЫ (лист как на макете / sheet*) ====== */}
        {activeTab === 'Игры' && (
          <div>
            {isAdmin && (
              <button
                onClick={handleCreateGame}
                className={styles.createGameBtn}
                type="button"
              >
                Создать игру
              </button>
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
                    const rows = Array.from(
                      { length: 10 },
                      (_, i) => game.players?.[i] || {}
                    );
                    return (
                      <article key={`${game.id}-${idx}`} className={styles.sheetCard}>
                        {/* верхняя плашка */}
                        <div className={styles.sheetTop}>
                          <span className={styles.sheetTitle}>
                            Игра #{game.id}
                          </span>
                          <div
                            className={styles.sheetSlashTop}
                            aria-hidden="true"
                          />
                          <time className={styles.sheetDate}>
                            {game.date || ''}
                          </time>
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
                          <span className={styles.sheetBottomLeft}>
                            Результат
                          </span>
                          <div
                            className={styles.sheetSlashBottom}
                            aria-hidden="true"
                          />
                          <span className={styles.sheetBottomRight}>
                            {game.result ||
                              (game.badgeColor === 'red'
                                ? 'Победа мафии'
                                : 'Победа мирных')}
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

        {/* ====== СТАТИСТИКА ====== */}
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

            {/* Детальная таблица */}
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

      {/* Модалка удаления игры */}
      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Удалить игру</h2>
            <p>Введите credentials админа для подтверждения:</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDeleteGame();
              }}
            >
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
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
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