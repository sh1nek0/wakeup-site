import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import styles from './RatingPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';
import { useDebounce } from '../useDebounce';
import GameCard from '../components/GameCard/GameCard';

const tabs = ['Общий рейтинг', 'Игры', 'Статистика'];

const baseURL = ""

export default function RatingPage() {
  const [activeTab, setActiveTab] = useState('Общий рейтинг');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const event_id="1"

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);
  const gamesPerPage = 10;

  const [detailedStatsCurrentPage, setDetailedStatsCurrentPage] = useState(1);
  const detailedStatsItemsPerPage = 10;

  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, token, isAdmin } = useContext(AuthContext);

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

  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePlayerClick = (playerId) => {
    if (playerId) {
      navigate(`/profile/${playerId}`);
    }
  };

  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (debouncedSearchTerm.length > 1) {
        fetch(`/api/get_player_suggestions?query=${debouncedSearchTerm}`)
            .then(res => res.json())
            .then(data => setSuggestions(data))
            .catch(err => console.error("Failed to fetch suggestions:", err));
    } else {
        setSuggestions([]);
    }
  }, [debouncedSearchTerm]);

  const handleSuggestionClick = (name) => {
    setSearchTerm(name);
    setSuggestions([]);
    setIsSuggestionsVisible(false);
  };

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

  const fetchPlayers = async (page) => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
        const offset = (page - 1) * itemsPerPage;
        const res = await fetch(baseURL + `/api/getRating?limit=${itemsPerPage}&offset=${offset}`);
        if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.players)) {
            setPlayersData(data.players);
            setTotalPlayersCount(data.total_count || 0);
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
    setGamesLoading(true);
    setGamesError(null);
    try {
      const res = await fetch(`/api/getGames?limit=1000&offset=0`);
      if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.games)) {
        setGamesData(data.games);
        setTotalGamesCount(data.total_count || 0);
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

  const fetchDetailedStats = async (event_id) => {
  if (!event_id) {
    console.error("event_id is required");
    return;
  }

  setDetailedStatsLoading(true);
  setDetailedStatsError(null);
  try {
    const res = await fetch(`/api/events/${event_id}/player-stats`);
    if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.players)) {
      setDetailedStatsData(data.players);
      console.log(data.players);
      
      // Адаптируем под новый ответ: total_count как длина массива players (количество игроков)
      setDetailedStatsTotalCount(data.players.length);
      
      // Рассчитываем average_points как среднее totalPoints (если нужно; иначе можно убрать)
      const totalPointsSum = data.players.reduce((sum, player) => sum + (player.totalPoints || 0), 0);
      const average = data.players.length > 0 ? totalPointsSum / data.players.length : 0;
      setAveragePoints(average);
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
    if (activeTab === 'Общий рейтинг') {
        fetchPlayers(currentPage);
    } else if (activeTab === 'Игры') {
        fetchGames();
    } else if (activeTab === 'Статистика') {
        fetchDetailedStats(event_id);
    }
  }, [activeTab, currentPage]);

  const filteredPlayers = playersData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const paginatedPlayers = filteredPlayers;
  const totalPages = Math.ceil(totalPlayersCount / itemsPerPage);


  const filteredGames = gamesData.filter(g => 
    g.players.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (g.judge_nickname && g.judge_nickname.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const paginatedGames = filteredGames.slice((gamesCurrentPage - 1) * gamesPerPage, gamesCurrentPage * gamesPerPage);
  const gamesTotalPages = Math.ceil(filteredGames.length / gamesPerPage);

  const filteredStats = detailedStatsData.filter(p => p.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
  const paginatedStats = filteredStats.slice((detailedStatsCurrentPage - 1) * detailedStatsItemsPerPage, detailedStatsCurrentPage * detailedStatsItemsPerPage);
  const detailedStatsTotalPages = Math.ceil(filteredStats.length / detailedStatsItemsPerPage);

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };
  const handleGamesPageChange = (p) => { if (p >= 1 && p <= gamesTotalPages) setGamesCurrentPage(p); };
  const handleDetailedStatsPageChange = (p) => { if (p >= 1 && p <= detailedStatsTotalPages) setDetailedStatsCurrentPage(p); };

  const handleCreateGame = async () => {
    setIsCreatingGame(true);
    try {
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        const eventId = '1';
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const response = await fetch(`/api/checkGameExists/${gameId}`);
        if (!response.ok) {
          showMessage('Ошибка проверки ID игры на сервере.', true);
          return;
        }
        const data = await response.json();

        if (!data.exists) {
          navigate(`/Event/${eventId}/Game/${gameId}`);
          return;
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
        
        <div className={styles.searchContainer}>
            <input
                type="text"
                placeholder="Поиск по никнейму..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSuggestionsVisible(true)}
                onBlur={() => setTimeout(() => setIsSuggestionsVisible(false), 200)}
            />
            {isSuggestionsVisible && suggestions.length > 0 && (
                <div className={styles.suggestionsList}>
                    {suggestions.map((name, index) => (
                        <div
                            key={index}
                            className={styles.suggestionItem}
                            onMouseDown={() => handleSuggestionClick(name)}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>

        {activeTab === 'Общий рейтинг' && (
          <>
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p>Ошибка: {playersError}</p>}

            {!playersLoading && !playersError && (
              <>
                <section
                  className={styles.cardsWrapper}
                  role="tabpanel"
                  aria-label="Рейтинг игроков"
                >
                  <div className={styles.cardsHeader}>
                    <div className={styles.cardPlayerHeader}>Игрок</div>
                    <div className={styles.cardGamesHeader}>
                        <span>Количество игр</span>
                        <div className={styles.subHeaderGames}>
                            <span>МИЭТ</span>
                            <span>МФТИ</span>
                        </div>
                    </div>
                    <div className={styles.cardPointsHeader}>Рейтинг</div>
                  </div>

                  {paginatedPlayers.map((player, index) => {
                    const rank = (currentPage - 1) * itemsPerPage + index + 1;
                    
                    let clubColorClass = '';
                    if (player.club === 'WakeUp | MIET') {
                      clubColorClass = styles.clubMIET;
                    } else if (player.club === 'WakeUp | MIPT') {
                      clubColorClass = styles.clubMIPT;
                    }

                    return (
                      <article key={`${rank}-${index}`} className={styles.card}>
                        <div className={styles.cardPlayer}>
                          <div className={styles.avatarWrap}>
                            <img
                              src={player.photoUrl || defaultAvatar}
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
                            <div className={`${styles.playerName} ${styles.clickablePlayerName}`} onClick={() => handlePlayerClick(player.id)}>
                               {player.name}
                            </div> 
                            <div className={styles.playerSubtitle}>
                              {player.club}
                            </div>
                          </div>
                        </div>
                        
                        <div className={styles.statsBlock}>
                            <div className={styles.statColumn}>{player.games_miet}</div>
                            <div className={styles.statColumn}>{player.games_mipt}</div>
                            <div className={`${styles.divider} ${clubColorClass}`}></div>
                            <div className={styles.cardPoints}>
                                {player.rating_score.toFixed(2)}
                            </div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {totalPages > 1 && (
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
              </div>
            )}

            {gamesLoading && <p>Загрузка игр...</p>}
            {gamesError && <p>Ошибка: {gamesError}</p>}

            {!gamesLoading && !gamesError && (
              <>
                <section
                  className={styles.gamesGridSheet}
                  role="tabpanel"
                  aria-label="Список игр"
                >
                  {paginatedGames.map((game, idx) => {
                    const gameNumber = totalGamesCount - ((gamesCurrentPage - 1) * gamesPerPage) - idx;
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        gameNumber={gameNumber}
                        isAdmin={isAdmin}
                        onDelete={handleDeleteGame}
                        onEdit={(gameId, eventId) => navigate(`/Event/${eventId || '1'}/Game/${gameId}`)}
                        onPlayerClick={handlePlayerClick}
                      />
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
            

            <DetailedStatsTable
              data={detailedStatsData}
              currentPage={detailedStatsCurrentPage}
              totalPages={detailedStatsTotalPages}
              onPageChange={handleDetailedStatsPageChange}
              user={user}
              key={detailedStatsCurrentPage}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function DetailedStatsTable({ data, currentPage = 1, totalPages = 1, onPageChange, user, isSolo = 1 }) {
  const navigate = useNavigate();
  console.log(data);

  // Определяем все столбцы с их ключами и метками
  const allColumns = [
    { key: 'rank', label: '#', alwaysVisible: true }, // Ранг всегда видим
    { key: 'player', label: isSolo ? 'Игрок' : 'Команда' },
    { key: 'totalPoints', label: 'Σ' },
    { key: 'winrate', label: 'WR' },
    { key: 'bonuses', label: 'Допы Ср./Σ' },
    { key: 'totalCi', label: 'Ci' },
    { key: 'totalCb', label: 'Cb' },
    { key: 'penalty', label: '-' },
    { key: 'sheriffWins', label: 'Шериф П/И' },
    { key: 'sheriffAvg', label: 'Шериф Ср' },
    { key: 'sheriffMax', label: 'Шериф МАКС' },
    { key: 'citizenWins', label: 'Мирн. П/И' },
    { key: 'citizenAvg', label: 'Мирн. Ср' },
    { key: 'citizenMax', label: 'Мирн. МАКС' },
    { key: 'mafiaWins', label: 'Мафия П/И' },
    { key: 'mafiaAvg', label: 'Мафия Ср' },
    { key: 'mafiaMax', label: 'Мафия МАКС' },
    { key: 'donWins', label: 'Дон П/И' },
    { key: 'donAvg', label: 'Дон Ср' },
    { key: 'donMax', label: 'Дон МАКС' },
  ];

  // Ключ для localStorage: уникальный для пользователя (используем user.name или user.id, если доступно)
  const storageKey = `columnVisibility_${user?.id || user?.name || 'default'}`;

  // Инициализируем состояние видимости из localStorage или по умолчанию все видимы (кроме alwaysVisible)
  const [columnVisibility, setColumnVisibility] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
    // По умолчанию все столбцы видимы
    const defaultVisibility = {};
    allColumns.forEach(col => {
      defaultVisibility[col.key] = !col.alwaysVisible || true; // alwaysVisible всегда true
    });
    return defaultVisibility;
  });

  // Состояние для модального окна
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Состояние для сортировки: по умолчанию по totalPoints убыванию
  const [sortConfig, setSortConfig] = useState({ key: 'totalPoints', direction: 'desc' });

  // Сохраняем изменения в localStorage при обновлении columnVisibility
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  // Функция для переключения видимости столбца
  const toggleColumnVisibility = (key) => {
    if (allColumns.find(col => col.key === key)?.alwaysVisible) return; // Не даем скрывать всегда видимые
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Функция для открытия/закрытия модального окна
  const toggleModal = () => setIsModalOpen(!isModalOpen);

  // Функция для закрытия модала при клике на overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  // Функция для запроса сортировки
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Функции сортировки для каждого ключа
  const sortFunctions = {
    rank: (a, b) => {
      // Сортировка по рангу: рассчитываем rank на основе totalPoints
      const rankA = a.totalPoints; // Или другой логики, если rank не по totalPoints
      const rankB = b.totalPoints;
      return rankA - rankB;
    },
    player: (a, b) => (a.name || a.nickname || '').localeCompare(b.name || b.nickname || ''),
    totalPoints: (a, b) => a.totalPoints - b.totalPoints,
    winrate: (a, b) => {
      const getWinrate = (p) => {
        const totalGames = Object.values(p.gamesPlayed || {}).reduce((sum, val) => sum + val, 0);
        const totalWins = Object.values(p.wins || {}).reduce((sum, val) => sum + val, 0);
        return totalGames > 0 ? totalWins / totalGames : 0;
      };
      return getWinrate(a) - getWinrate(b);
    },
    bonuses: (a, b) => {
      const getBonusesAvg = (p) => {
        const totalBonuses = Object.values(p.role_plus || {}).flat().reduce((sum, val) => sum + val, 0);
        const totalGames = Object.values(p.gamesPlayed || {}).reduce((sum, val) => sum + val, 0);
        return totalGames > 0 ? totalBonuses / totalGames : 0;
      };
      return getBonusesAvg(a) - getBonusesAvg(b);
    },
    totalCi: (a, b) => (a.totalCi || 0) - (b.totalCi || 0),
    totalCb: (a, b) => (a.totalCb || 0) - (b.totalCb || 0),
    penalty: (a, b) => ((a.total_sk_penalty || 0) + (a.total_jk_penalty || 0)) - ((b.total_sk_penalty || 0) + (b.total_jk_penalty || 0)),
    sheriffWins: (a, b) => (a.wins?.sheriff || 0) - (b.wins?.sheriff || 0),
    sheriffAvg: (a, b) => {
      const bonuses = a.role_plus?.sheriff || [];
      const avgA = bonuses.length ? bonuses.reduce((sum, val) => sum + val, 0) / bonuses.length : 0;
      const bonusesB = b.role_plus?.sheriff || [];
      const avgB = bonusesB.length ? bonusesB.reduce((sum, val) => sum + val, 0) / bonusesB.length : 0;
      return avgA - avgB;
    },
    sheriffMax: (a, b) => {
      const bonuses = a.role_plus?.sheriff || [];
      const maxA = bonuses.length ? Math.max(...bonuses) : 0;
      const bonusesB = b.role_plus?.sheriff || [];
      const maxB = bonusesB.length ? Math.max(...bonusesB) : 0;
      return maxA - maxB;
    },
    citizenWins: (a, b) => (a.wins?.citizen || 0) - (b.wins?.citizen || 0),
    citizenAvg: (a, b) => {
      const bonuses = a.role_plus?.citizen || [];
      const avgA = bonuses.length ? bonuses.reduce((sum, val) => sum + val, 0) / bonuses.length : 0;
      const bonusesB = b.role_plus?.citizen || [];
      const avgB = bonusesB.length ? bonusesB.reduce((sum, val) => sum + val, 0) / bonusesB.length : 0;
      return avgA - avgB;
    },
    citizenMax: (a, b) => {
      const bonuses = a.role_plus?.citizen || [];
      const maxA = bonuses.length ? Math.max(...bonuses) : 0;
      const bonusesB = b.role_plus?.citizen || [];
      const maxB = bonusesB.length ? Math.max(...bonusesB) : 0;
      return maxA - maxB;
    },
    mafiaWins: (a, b) => (a.wins?.mafia || 0) - (b.wins?.mafia || 0),
    mafiaAvg: (a, b) => {
      const bonuses = a.role_plus?.mafia || [];
      const avgA = bonuses.length ? bonuses.reduce((sum, val) => sum + val, 0) / bonuses.length : 0;
      const bonusesB = b.role_plus?.mafia || [];
      const avgB = bonusesB.length ? bonusesB.reduce((sum, val) => sum + val, 0) / bonusesB.length : 0;
      return avgA - avgB;
    },
    mafiaMax: (a, b) => {
      const bonuses = a.role_plus?.mafia || [];
      const maxA = bonuses.length ? Math.max(...bonuses) : 0;
      const bonusesB = b.role_plus?.mafia || [];
      const maxB = bonusesB.length ? Math.max(...bonusesB) : 0;
      return maxA - maxB;
    },
    donWins: (a, b) => (a.wins?.don || 0) - (b.wins?.don || 0),
    donAvg: (a, b) => {
      const bonuses = a.role_plus?.don || [];
      const avgA = bonuses.length ? bonuses.reduce((sum, val) => sum + val, 0) / bonuses.length : 0;
      const bonusesB = b.role_plus?.don || [];
      const avgB = bonusesB.length ? bonusesB.reduce((sum, val) => sum + val, 0) / bonusesB.length : 0;
      return avgA - avgB;
    },
    donMax: (a, b) => {
      const bonuses = a.role_plus?.don || [];
      const maxA = bonuses.length ? Math.max(...bonuses) : 0;
      const bonusesB = b.role_plus?.don || [];
      const maxB = bonusesB.length ? Math.max(...bonusesB) : 0;
      return maxA - maxB;
    },
  };

  // Отсортированные данные (сортировка применяется ко всему data)
  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key && sortFunctions[sortConfig.key]) {
      sortableItems.sort((a, b) => {
        const result = sortFunctions[sortConfig.key](a, b);
        return sortConfig.direction === 'asc' ? result : -result;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  // Пагинация применяется после сортировки
  const itemsPerPage = 10; // Предполагаем 10 элементов на страницу; можно сделать пропсом, если нужно
  const totalPagesCalculated = Math.ceil(sortedData.length / itemsPerPage); // Рассчитываем totalPages на основе полного отсортированного массива
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePlayerClick = (playerId) => {
    if (playerId) navigate(`/profile/${playerId}`);
  };

  // Модифицированная функция renderRoleStats: принимает массив видимых столбцов и рендерит только видимые
  const renderRoleStats = (wins = 0, games = 0, bonuses = [], colorClass, roleKey) => {
    const avgBonus = bonuses.length
      ? (bonuses.reduce((sum, val) => sum + val, 0) / bonuses.length).toFixed(2)
      : "0.0";
    const maxBonus = bonuses.length ? Math.max(...bonuses).toFixed(2) : "0.0";

    return (
      <>
        {columnVisibility[`${roleKey}Wins`] && <td className={`${styles.roleCell} ${colorClass}`}>{wins}/{games}</td>}
        {columnVisibility[`${roleKey}Avg`] && <td className={`${styles.roleCell} ${colorClass}`}>{avgBonus}</td>}
        {columnVisibility[`${roleKey}Max`] && <td className={`${styles.roleCell} ${colorClass}`}>{maxBonus}</td>}
      </>
    );
  };

  return (
    <div className={styles.tableWrapper}>
      {/* Кнопка для открытия модального окна */}
      <button onClick={toggleModal} className={styles.editButton}>
        Редактировать таблицу
      </button>

      {/* Модальное окно */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={handleOverlayClick}>
          <div className={styles.modal}>
            <h4>Выберите столбцы для отображения:</h4>
            <div className={styles.columnToggles}>
              {allColumns.filter(col => !col.alwaysVisible).map(col => (
                <label key={col.key} style={{ marginRight: '10px', display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={columnVisibility[col.key]}
                    onChange={() => toggleColumnVisibility(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
            <button onClick={toggleModal} className={styles.closeButton}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      <table className={styles.detailedStatsTable}>
        <thead>
          <tr>
            {columnVisibility.rank && <th onClick={() => requestSort('rank')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'rank').label} {sortConfig.key === 'rank' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.player && <th onClick={() => requestSort('player')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'player').label} {sortConfig.key === 'player' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.totalPoints && <th onClick={() => requestSort('totalPoints')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'totalPoints').label} {sortConfig.key === 'totalPoints' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.winrate && <th onClick={() => requestSort('winrate')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'winrate').label} {sortConfig.key === 'winrate' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.bonuses && <th onClick={() => requestSort('bonuses')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'bonuses').label} {sortConfig.key === 'bonuses' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.totalCi && <th onClick={() => requestSort('totalCi')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'totalCi').label} {sortConfig.key === 'totalCi' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.totalCb && <th onClick={() => requestSort('totalCb')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'totalCb').label} {sortConfig.key === 'totalCb' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.penalty && <th onClick={() => requestSort('penalty')} className={styles.sortableTh}>{allColumns.find(c => c.key === 'penalty').label} {sortConfig.key === 'penalty' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}

            {columnVisibility.sheriffWins && <th onClick={() => requestSort('sheriffWins')} className={`${styles.roleSheriff} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'sheriffWins').label} {sortConfig.key === 'sheriffWins' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.sheriffAvg && <th onClick={() => requestSort('sheriffAvg')} className={`${styles.roleSheriff} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'sheriffAvg').label} {sortConfig.key === 'sheriffAvg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.sheriffMax && <th onClick={() => requestSort('sheriffMax')} className={`${styles.roleSheriff} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'sheriffMax').label} {sortConfig.key === 'sheriffMax' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}

            {columnVisibility.citizenWins && <th onClick={() => requestSort('citizenWins')} className={`${styles.roleCitizen} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'citizenWins').label} {sortConfig.key === 'citizenWins' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.citizenAvg && <th onClick={() => requestSort('citizenAvg')} className={`${styles.roleCitizen} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'citizenAvg').label} {sortConfig.key === 'citizenAvg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.citizenMax && <th onClick={() => requestSort('citizenMax')} className={`${styles.roleCitizen} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'citizenMax').label} {sortConfig.key === 'citizenMax' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}

            {columnVisibility.mafiaWins && <th onClick={() => requestSort('mafiaWins')} className={`${styles.roleMafia} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'mafiaWins').label} {sortConfig.key === 'mafiaWins' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.mafiaAvg && <th onClick={() => requestSort('mafiaAvg')} className={`${styles.roleMafia} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'mafiaAvg').label} {sortConfig.key === 'mafiaAvg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.mafiaMax && <th onClick={() => requestSort('mafiaMax')} className={`${styles.roleMafia} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'mafiaMax').label} {sortConfig.key === 'mafiaMax' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}

            {columnVisibility.donWins && <th onClick={() => requestSort('donWins')} className={`${styles.roleDon} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'donWins').label} {sortConfig.key === 'donWins' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.donAvg && <th onClick={() => requestSort('donAvg')} className={`${styles.roleDon} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'donAvg').label} {sortConfig.key === 'donAvg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
            {columnVisibility.donMax && <th onClick={() => requestSort('donMax')} className={`${styles.roleDon} ${styles.sortableTh}`}>{allColumns.find(c => c.key === 'donMax').label} {sortConfig.key === 'donMax' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>}
          </tr>
        </thead>
        <tbody key={sortConfig.key + sortConfig.direction}> {/* Добавлен key для перерендера при изменении сортировки */}
          {Array.isArray(paginatedData) && paginatedData.map((p, i) => {
            const rank = (currentPage - 1) * itemsPerPage + i + 1; // Глобальный rank на основе отсортированного списка

            // Защищаемся от undefined
            const wins = p.wins || { sheriff: 0, citizen: 0, mafia: 0, don: 0 };
            const gamesPlayed = p.gamesPlayed || { sheriff: 0, citizen: 0, mafia: 0, don: 0 };
            const role_plus = p.role_plus || { sheriff: [], citizen: [], mafia: [], don: [] };

            const totalGames = Object.values(gamesPlayed).reduce((a, b) => a + b, 0);
            const totalWins = Object.values(wins).reduce((a, b) => a + b, 0);
            const totalBonuses = Object.values(role_plus).flat().reduce((a, b) => a + b, 0);

            const winrate = totalGames > 0 ? `${(totalWins / totalGames * 100).toFixed(0)}% (${totalWins}/${totalGames})` : '0% (0/0)';

            const totalCi = p.totalCi !== undefined ? parseFloat(p.totalCi) : 0.0;
            const totalCb = p.totalCb !== undefined ? parseFloat(p.totalCb) : 0.0;

            return (
              <tr key={p.id || p.nickname || i} className={p.name === user?.name ? styles.currentUserRow : ''}>
                {columnVisibility.rank && <td>{rank}</td>}
                {columnVisibility.player && (
                  <td>
                    <span
                      className={styles.clickableName}
                      onClick={() => handlePlayerClick(p.id)}
                      title={p.name || p.nickname}
                    >
                      {(p.name || p.nickname || "—").length > 10 && isSolo
                        ? (p.name || p.nickname).slice(0, 10) + '...'
                        : (p.name || p.nickname || "—")}
                    </span>
                  </td>
                )}
                {columnVisibility.totalPoints && <td>{p.totalPoints.toFixed(2) || 0}</td>}
                {columnVisibility.winrate && <td>{winrate}</td>}
                {columnVisibility.bonuses && <td>{(totalBonuses / ((gamesPlayed.sheriff || 0) + (gamesPlayed.citizen || 0) + (gamesPlayed.mafia || 0) + (gamesPlayed.don || 0))).toFixed(2)}/{totalBonuses}</td>}
                {columnVisibility.totalCi && <td>{totalCi.toFixed(2)}</td>}
                {columnVisibility.totalCb && <td>{totalCb.toFixed(2)}</td>}
                {columnVisibility.penalty && <td>{((p.total_sk_penalty || 0) + (p.total_jk_penalty || 0)).toFixed(2)}</td>}

                {renderRoleStats(wins.sheriff, gamesPlayed.sheriff, role_plus.sheriff, styles.roleSheriff, 'sheriff')}
                {renderRoleStats(wins.citizen, gamesPlayed.citizen, role_plus.citizen, styles.roleCitizen, 'citizen')}
                {renderRoleStats(wins.mafia, gamesPlayed.mafia, role_plus.mafia, styles.roleMafia, 'mafia')}
                {renderRoleStats(wins.don, gamesPlayed.don, role_plus.don, styles.roleDon, 'don')}
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPagesCalculated > 1 && (
        <nav className={styles.pagination}>
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</button>
          {[...Array(totalPagesCalculated)].map((_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={page === currentPage ? styles.pageActive : styles.pageBtn}
              >
                {page}
              </button>
            );
          })}
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPagesCalculated} className={styles.pageBtn}>›</button>
        </nav>
      )}
    </div>
  );
}



export {DetailedStatsTable}