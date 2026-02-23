import React, { useState, useEffect, useContext, useMemo, useRef, useCallback  } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import styles from './RatingPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';
import { useDebounce } from '../useDebounce';
import GameCard from '../components/GameCard/GameCard';

const tabs = ['ТОП', 'Игры', 'Статистика'];

const TAB_MAP = {
  top: 'ТОП',
  games: 'Игры',
  stats: 'Статистика',
};

const TAB_TO_QUERY = {
  'ТОП': 'top',
  'Игры': 'games',
  'Статистика': 'stats',
};


export default function RatingPage() {
  const [activeTab, setActiveTab] = useState('ТОП');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchParams, setSearchParams] = useSearchParams();


  useEffect(() => {
  const tabFromQuery = searchParams.get('tab');

  if (tabFromQuery && TAB_MAP[tabFromQuery]) {
    setActiveTab(TAB_MAP[tabFromQuery]);
  }
}, [searchParams]);


  const event_id="1"

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [gamesCurrentPage, setGamesCurrentPage] = useState(1);
  const [gamesPerPage, setGamesPerPage] = useState(8); // Значение по умолчанию

  useEffect(() => {
    const updateGamesPerPage = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setGamesPerPage(4); // Маленький экран (мобильные)
      } else if (width < 1024) {
        setGamesPerPage(6); // Средний экран (планшеты)
      } else if (width < 1280) {
        setGamesPerPage(8); // Маленькие ПК (1024-1279px)
      } else if (width < 1920) {
        setGamesPerPage(8); // Средние ПК (1280-1919px)
      } else {
        setGamesPerPage(10); // Большие ПК (1920px и выше, например, 4K)
      }
    };

    // Установить начальное значение
    updateGamesPerPage();

    // Добавить слушатель изменения размера окна
    window.addEventListener('resize', updateGamesPerPage);

    // Очистить слушатель при размонтировании
    return () => window.removeEventListener('resize', updateGamesPerPage);
  }, [gamesPerPage]);


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
  
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [locations, setLocations] = useState([]);       // список локаций
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(null);
  const [detailedStatsTotalCount, setDetailedStatsTotalCount] = useState(0);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(false);
  const [detailedStatsError, setDetailedStatsError] = useState(null);
  const [averagePoints, setAveragePoints] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);


  const fetchLocations = async (event_id) => {
  if (!event_id) return;

  setLocationsLoading(true);
  setLocationsError(null);

  try {
    const res = await fetch(`/api/events/${event_id}/location`);
    if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);

    const data = await res.json();

    // ожидаем { event_id, locations: [] }
    if (data && Array.isArray(data.locations)) {
      setLocations(data.locations);
    } else {
      setLocations([]); // если пришло что-то странное — держим пустой список
      throw new Error("Некорректная структура ответа (locations)");
    }
  } catch (e) {
    setLocationsError(e.message);
    setLocations([]); // при ошибке тоже пустой список
  } finally {
    setLocationsLoading(false);
  }
};


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

  const fetchPlayers = async () => {
    setPlayersLoading(true);
    setPlayersError(null);

  try {
    const res = await fetch(`/api/events/${event_id}/player-stats`);
    if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status}`);

    const data = await res.json();

    if (!data || !Array.isArray(data.players)) {
      throw new Error("Некорректная структура ответа (players)");
    }

    const players = data.players;

    // -----------------------------
    // Вычисляем скор и сортируем
    // -----------------------------
    const playersWithScore = players.map((player) => {
      const totalGames = player.gamesPlayed
        ? Object.values(player.gamesPlayed).reduce((sum, value) => sum + value, 0)
        : 1;
      const score = player.totalPoints / Math.sqrt(totalGames);
      return { ...player, score: parseFloat(score.toFixed(2)) };
    });

    // Сортировка по убыванию score
    playersWithScore.sort((a, b) => b.score - a.score);

    setPlayersData(playersWithScore);
    setTotalPlayersCount(playersWithScore.length);
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
    if (activeTab === 'ТОП') {
        fetchPlayers(currentPage);
    } else if (activeTab === 'Игры') {
        fetchGames();
    } else if (activeTab === 'Статистика') {
        fetchDetailedStats(event_id);
        fetchLocations(event_id);
    }
  }, [activeTab, currentPage]);



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


  const totalPages = Math.ceil(totalPlayersCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPlayers = playersData.slice(startIndex, startIndex + itemsPerPage);

  const memoizedPlayerCards = useMemo(() => {
    return currentPlayers.map((player, index) => {
      const rank = startIndex + index + 1;

      const clubColorClass = (() => {
        switch (player.club) {
          case 'WakeUp | MIET':
            return styles.clubMIET;
          case 'WakeUp | MIPT':
            return styles.clubMIPT;
          case 'Misis Mafia':
            return styles.clubMisis;
          case 'Триада Менделеева':
            return styles.clubMend;
          default:
            return '';
        }
      })();

      return (
        <article key={player.id ?? `${rank}-${index}`} className={styles.card}>
          <div className={styles.cardPlayer}>
            <div className={styles.avatarWrap}>
              <img
                src={player.photoUrl || defaultAvatar}
                alt="avatar"
                className={styles.avatar}
              />
              <div className={styles.rankBadge} aria-label={`Место ${rank}`}>
                {rank}
              </div>
            </div>
            <div>
              <div
                className={`${styles.playerName} ${styles.clickablePlayerName}`}
                onClick={() => handlePlayerClick(player.id)}
              >
                {player.nickname}
              </div>
              <div className={styles.playerSubtitle}>
                {player.club || 'Клуб не указан'}
              </div>
            </div>
          </div>

          <div className={styles.statsBlock}>
            <div className={styles.statColumn}>{player.games_miet}</div>
            <div className={styles.statColumn}>{player.games_mipt}</div>
            <div className={`${styles.divider} ${clubColorClass}`} />
            <div className={styles.cardPoints}>{player.score}</div>
          </div>
        </article>
      );
    });
  }, [currentPlayers, startIndex, styles, defaultAvatar, handlePlayerClick]);


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
              onClick={() => {
                setActiveTab(tab);
                setSearchParams(prev => {
                  const params = new URLSearchParams(prev);
                  params.set('tab', TAB_TO_QUERY[tab]);
                  return params;
                });
              }}
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

        {activeTab === 'ТОП' && (
          <>
            {playersLoading && <p>Загрузка игроков...</p>}
            {playersError && <p>Ошибка: {playersError}</p>}

            {!playersLoading && !playersError && (
              <>
                <section className={styles.cardsWrapper}>
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

                  <section>
                    {memoizedPlayerCards}
                  </section>
                </section>

                {totalPages > 1 && (
                  <nav className={styles.pagination} aria-label="Пейджинг рейтинга">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
                    >
                      ‹
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`${styles.pageBtn} ${p === currentPage ? styles.pageActive : ''}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`${styles.pageBtn} ${styles.pageArrow}`}
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
<nav className={styles.pagination} aria-label="Пейджинг игр">
  {/* Кнопка "назад" */}
  <button
    onClick={() => handleGamesPageChange(gamesCurrentPage - 1)}
    disabled={gamesCurrentPage === 1}
    className={`${styles.pageBtn} ${styles.pageArrow}`}
    type="button"
    aria-label="Предыдущая страница"
  >
    ‹
  </button>

  {/* Рендер страниц */}
  {(() => {
    const pages = [];
    let startPage = 1;
    let endPage = gamesTotalPages;

    if (gamesTotalPages > 7) {
      // Делаем окно из 7 кнопок
      startPage = Math.max(gamesCurrentPage - 3, 1);
      endPage = Math.min(startPage + 6, gamesTotalPages);

      // Корректировка, если окно уходит за пределы
      if (endPage - startPage < 6) {
        startPage = Math.max(endPage - 6, 1);
      }
    }

    for (let p = startPage; p <= endPage; p++) {
      const isActive = p === gamesCurrentPage;
      pages.push(
        <button
          key={p}
          onClick={() => handleGamesPageChange(p)}
          className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
          aria-current={isActive ? 'page' : undefined}
          type="button"
          aria-label={`Страница ${p}`}
        >
          {p}
        </button>
      );
    }

    return pages;
  })()}

  {/* Кнопка "вперед" */}
  <button
    onClick={() => handleGamesPageChange(gamesCurrentPage + 1)}
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
              locations={locations}
              onPageChange={handleDetailedStatsPageChange}
              user={user}
              // key={detailedStatsCurrentPage}
              eventId={event_id}
            />
          </section>
        )}
      </main>
    </div>
  );
}



function DetailedStatsTable({
  data,
  currentPage = 1,
  onPageChange,
  user,
  isSolo = 1,
  locations = [],
  eventId,
}) {
  const navigate = useNavigate();

  const [selectedLocation, setSelectedLocation] = useState(null);

  // локальная копия данных таблицы (то, что реально рендерим)
  const [tableData, setTableData] = useState(Array.isArray(data) ? data : []);

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // чтобы не было "остаточных данных" из-за гонок запросов
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  const allColumns = useMemo(
    () => [
      // base
      { key: "rank", icon: "№", title: "#", label: "#" },
      { key: "player", icon: "👤", title: isSolo ? "Игрок" : "Команда", label: isSolo ? "Игрок" : "Команда" },
      { key: "totalPoints", icon: "Σ", title: "Сумма очков", label: "Σ" },
      { key: "totalGames", icon: "🎮", title: "Всего игр", label: "Игр" },
      { key: "totalWins", icon: "🏆", title: "Победы", label: "Поб" },
      { key: "winrate", icon: "%", title: "Win Rate", label: "WR" },
      { key: "bonusesSum", icon: "➕", title: "Сумма бонусов", label: "Доп Σ" },
      { key: "bonusesAvg", icon: "⚖️", title: "Средний бонус", label: "Доп Ср" },
      { key: "totalCi", icon: "⭐", title: "CI", label: "CI" },
      { key: "totalCb", icon: "💡", title: "Лучший ход", label: "ЛХ" },
      { key: "penalty", icon: "☠️", title: "Штрафы", label: "-" },

      { key: "deaths", icon: "💀", title: "Смертей", label: "Смерт" },
      { key: "deathsWith1Black", icon: "💀1", title: "Смертей с 1 чёрным", label: "1ч" },
      { key: "deathsWith2Black", icon: "💀2", title: "Смертей с 2 чёрными", label: "2ч" },
      { key: "deathsWith3Black", icon: "💀3", title: "Смертей с 3 чёрными", label: "3ч" },

      // sheriff
      { key: "sheriffWins", icon: "🕵️🏆", title: "Шериф Победы", label: "Ш П" },
      { key: "sheriffWR", icon: "🕵️%", title: "Шериф WinRate", label: "Ш WR" },
      { key: "sheriffGames", icon: "🕵️🎮", title: "Шериф Игры", label: "Ш И" },
      { key: "sheriffAvg", icon: "🕵️⚖️", title: "Шериф Ср", label: "Ш Ср" },
      { key: "sheriffMax", icon: "🕵️🔥", title: "Шериф Макс", label: "Ш М" },

      // citizen
      { key: "citizenWins", icon: "👔🏆", title: "Мирные Победы", label: "М П" },
      { key: "citizenWR", icon: "👔%", title: "Мирные WinRate", label: "М WR" },
      { key: "citizenGames", icon: "👔🎮", title: "Мирные Игры", label: "М И" },
      { key: "citizenAvg", icon: "👔⚖️", title: "Мирные Ср", label: "М Ср" },
      { key: "citizenMax", icon: "👔🔥", title: "Мирные Макс", label: "М М" },

      // mafia
      { key: "mafiaWins", icon: "😈🏆", title: "Мафия Победы", label: "Мф П" },
      { key: "mafiaWR", icon: "😈%", title: "Мафия WinRate", label: "Мф WR" },
      { key: "mafiaGames", icon: "😈🎮", title: "Мафия Игры", label: "Мф И" },
      { key: "mafiaAvg", icon: "😈⚖️", title: "Мафия Ср", label: "Мф Ср" },
      { key: "mafiaMax", icon: "😈🔥", title: "Мафия Макс", label: "Мф М" },

      // don
      { key: "donWins", icon: "🎩🏆", title: "Дон Победы", label: "Д П" },
      { key: "donWR", icon: "🎩%", title: "Дон WinRate", label: "Д WR" },
      { key: "donGames", icon: "🎩🎮", title: "Дон Игры", label: "Д И" },
      { key: "donAvg", icon: "🎩⚖️", title: "Дон Ср", label: "Д Ср" },
      { key: "donMax", icon: "🎩🔥", title: "Дон Макс", label: "Д М" },
    ],
    [isSolo]
  );

  const getCol = (key) => allColumns.find((c) => c.key === key);
  const getLabel = (key) => getCol(key)?.label ?? key;
  const getTitle = (key) => getCol(key)?.title ?? key;
  const getIcon = (key) => getCol(key)?.icon ?? "";

  // localStorage keys
  const storageKey = `columnVisibility_${user?.id || user?.name || "default"}`;
  const filterStorageKey = `filters_${user?.id || user?.name || "default"}`;
  const sortStorageKey = `sortConfig_${user?.id || user?.name || "default"}`;

  // ✅ Инициализируем видимость колонок и ДОБАВЛЯЕМ новые ключи, если allColumns изменился
  const [columnVisibility, setColumnVisibility] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallthrough to default
      }
    }
    const defaultVisibility = {};
    allColumns.forEach((col) => {
      defaultVisibility[col.key] = true;
    });
    return defaultVisibility;
  });

  // ✅ при изменении allColumns (например isSolo) — подмешиваем недостающие ключи
  useEffect(() => {
    setColumnVisibility((prev) => {
      const next = { ...(prev || {}) };
      let changed = false;
      for (const col of allColumns) {
        if (typeof next[col.key] === "undefined") {
          next[col.key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allColumns]);

  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem(filterStorageKey);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem(sortStorageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallthrough
      }
    }
    return { key: "totalPoints", direction: "desc" };
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  useEffect(() => {
    localStorage.setItem(filterStorageKey, JSON.stringify(filters));
  }, [filters, filterStorageKey]);

  useEffect(() => {
    localStorage.setItem(sortStorageKey, JSON.stringify(sortConfig));
  }, [sortConfig, sortStorageKey]);

  const toggleColumnVisibility = (key) => {
    if (getCol(key)?.alwaysVisible) return;
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  const toggleModal = () => setIsModalOpen((v) => !v);
  const toggleFilterModal = () => setIsFilterModalOpen((v) => !v);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
      setIsFilterModalOpen(false);
    }
  };

  // ✅ Управляемые поля фильтров (убираем document.getElementById — это ломает React)
  const [filterField, setFilterField] = useState("totalPoints");
  const [filterOperator, setFilterOperator] = useState(">");
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    // если выбрали "player" — разрешаем contains, иначе убираем его
    if (filterField !== "player" && filterOperator === "contains") {
      setFilterOperator(">");
    }
  }, [filterField, filterOperator]);

  const addFilterCondition = (field, operator, value, logical) => {
    setFilters((prev) => [
      ...(prev || []),
      { field, operator, value: field === "player" ? value : parseFloat(value), logical },
    ]);
  };

  const removeFilterCondition = (index) => {
    setFilters((prev) => (prev || []).filter((_, i) => i !== index));
  };

  const clearFilters = () => setFilters([]);

  // Приходят новые data от родителя — обновляем tableData ТОЛЬКО если выбран "Все"
  useEffect(() => {
    if (selectedLocation === null) {
      setTableData(Array.isArray(data) ? data : []);
    }
  }, [data, selectedLocation]);

  const applyFilters = (input) => {
    if (!Array.isArray(input)) return [];
    if (!filters || filters.length === 0) return input;

    return input.filter((player) => {
      let result = true;

      for (let i = 0; i < filters.length; i++) {
        const { field, operator, value, logical } = filters[i];
        let fieldValue;

        switch (field) {
          case "player":
            fieldValue = player?.name || player?.nickname || "";
            break;

          case "totalPoints":
            fieldValue = player?.totalPoints || 0;
            break;

          case "totalGames":
            fieldValue = Object.values(player?.gamesPlayed || {}).reduce((sum, val) => sum + (val || 0), 0);
            break;

          case "totalWins":
            fieldValue = Object.values(player?.wins || {}).reduce((sum, val) => sum + (val || 0), 0);
            break;

          case "winrate": {
            const totalGames = Object.values(player?.gamesPlayed || {}).reduce((sum, val) => sum + (val || 0), 0);
            const totalWins = Object.values(player?.wins || {}).reduce((sum, val) => sum + (val || 0), 0);
            fieldValue = totalGames > 0 ? totalWins / totalGames : 0;
            break;
          }

          case "bonusesSum":
            fieldValue = Object.values(player?.role_plus || {}).flat().reduce((sum, val) => sum + (val || 0), 0);
            break;

          case "bonusesAvg": {
            const totalBonuses = Object.values(player?.role_plus || {}).flat().reduce((sum, val) => sum + (val || 0), 0);
            const totalGames = Object.values(player?.gamesPlayed || {}).reduce((sum, val) => sum + (val || 0), 0);
            fieldValue = totalGames > 0 ? totalBonuses / totalGames : 0;
            break;
          }

          case "totalCi":
            fieldValue = player?.totalCi || 0;
            break;

          case "totalCb":
            fieldValue = player?.totalCb || 0;
            break;

          case "penalty":
            fieldValue = (player?.total_sk_penalty || 0) + (player?.total_jk_penalty || 0);
            break;

          case "deaths":
            fieldValue = player?.deaths || 0;
            break;

          case "deathsWith1Black":
            fieldValue = player?.deathsWith1Black || 0;
            break;

          case "deathsWith2Black":
            fieldValue = player?.deathsWith2Black || 0;
            break;

          case "deathsWith3Black":
            fieldValue = player?.deathsWith3Black || 0;
            break;

          // roles
          case "sheriffWins":
            fieldValue = player?.wins?.sheriff || 0;
            break;
          case "sheriffWR": {
            const g = player?.gamesPlayed?.sheriff || 0;
            fieldValue = g > 0 ? (player?.wins?.sheriff || 0) / g : 0;
            break;
          }
          case "sheriffGames":
            fieldValue = player?.gamesPlayed?.sheriff || 0;
            break;
          case "sheriffAvg": {
            const arr = player?.role_plus?.sheriff || [];
            fieldValue = arr.length ? arr.reduce((sum, v) => sum + (v || 0), 0) / arr.length : 0;
            break;
          }
          case "sheriffMax": {
            const arr = player?.role_plus?.sheriff || [];
            fieldValue = arr.length ? Math.max(...arr) : 0;
            break;
          }

          case "citizenWins":
            fieldValue = player?.wins?.citizen || 0;
            break;
          case "citizenWR": {
            const g = player?.gamesPlayed?.citizen || 0;
            fieldValue = g > 0 ? (player?.wins?.citizen || 0) / g : 0;
            break;
          }
          case "citizenGames":
            fieldValue = player?.gamesPlayed?.citizen || 0;
            break;
          case "citizenAvg": {
            const arr = player?.role_plus?.citizen || [];
            fieldValue = arr.length ? arr.reduce((sum, v) => sum + (v || 0), 0) / arr.length : 0;
            break;
          }
          case "citizenMax": {
            const arr = player?.role_plus?.citizen || [];
            fieldValue = arr.length ? Math.max(...arr) : 0;
            break;
          }

          case "mafiaWins":
            fieldValue = player?.wins?.mafia || 0;
            break;
          case "mafiaWR": {
            const g = player?.gamesPlayed?.mafia || 0;
            fieldValue = g > 0 ? (player?.wins?.mafia || 0) / g : 0;
            break;
          }
          case "mafiaGames":
            fieldValue = player?.gamesPlayed?.mafia || 0;
            break;
          case "mafiaAvg": {
            const arr = player?.role_plus?.mafia || [];
            fieldValue = arr.length ? arr.reduce((sum, v) => sum + (v || 0), 0) / arr.length : 0;
            break;
          }
          case "mafiaMax": {
            const arr = player?.role_plus?.mafia || [];
            fieldValue = arr.length ? Math.max(...arr) : 0;
            break;
          }

          case "donWins":
            fieldValue = player?.wins?.don || 0;
            break;
          case "donWR": {
            const g = player?.gamesPlayed?.don || 0;
            fieldValue = g > 0 ? (player?.wins?.don || 0) / g : 0;
            break;
          }
          case "donGames":
            fieldValue = player?.gamesPlayed?.don || 0;
            break;
          case "donAvg": {
            const arr = player?.role_plus?.don || [];
            fieldValue = arr.length ? arr.reduce((sum, v) => sum + (v || 0), 0) / arr.length : 0;
            break;
          }
          case "donMax": {
            const arr = player?.role_plus?.don || [];
            fieldValue = arr.length ? Math.max(...arr) : 0;
            break;
          }

          default:
            fieldValue = 0;
        }

        let conditionResult = false;

        if (field === "player") {
          const text = String(fieldValue || "");
          const val = String(value || "");

          switch (operator) {
            case "=":
              conditionResult = text === val;
              break;
            case "!=":
              conditionResult = text !== val;
              break;
            case "contains":
              conditionResult = text.toLowerCase().includes(val.toLowerCase());
              break;
            default:
              conditionResult = false;
          }
        } else {
          const num = Number(fieldValue) || 0;
          const val = Number(value) || 0;

          switch (operator) {
            case ">":
              conditionResult = num > val;
              break;
            case "<":
              conditionResult = num < val;
              break;
            case "=":
              conditionResult = num === val;
              break;
            case "!=":
              conditionResult = num !== val;
              break;
            default:
              conditionResult = false;
          }
        }

        if (i === 0) result = conditionResult;
        else if (logical === "AND") result = result && conditionResult;
        else if (logical === "OR") result = result || conditionResult;
      }

      return result;
    });
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  // ✅ сортировки (оставил твои, но безопаснее с undefined)
  const sortFunctions = useMemo(
    () => ({
      rank: (a, b) => (a?.totalPoints || 0) - (b?.totalPoints || 0),
      player: (a, b) => (a?.name || a?.nickname || "").localeCompare(b?.name || b?.nickname || ""),
      totalPoints: (a, b) => (a?.totalPoints || 0) - (b?.totalPoints || 0),
      totalGames: (a, b) => {
        const A = Object.values(a?.gamesPlayed || {}).reduce((s, v) => s + (v || 0), 0);
        const B = Object.values(b?.gamesPlayed || {}).reduce((s, v) => s + (v || 0), 0);
        return A - B;
      },
      totalWins: (a, b) => {
        const A = Object.values(a?.wins || {}).reduce((s, v) => s + (v || 0), 0);
        const B = Object.values(b?.wins || {}).reduce((s, v) => s + (v || 0), 0);
        return A - B;
      },
      winrate: (a, b) => {
        const wr = (p) => {
          const g = Object.values(p?.gamesPlayed || {}).reduce((s, v) => s + (v || 0), 0);
          const w = Object.values(p?.wins || {}).reduce((s, v) => s + (v || 0), 0);
          return g > 0 ? w / g : 0;
        };
        return wr(a) - wr(b);
      },
      bonusesSum: (a, b) => {
        const sum = (p) => Object.values(p?.role_plus || {}).flat().reduce((s, v) => s + (v || 0), 0);
        return sum(a) - sum(b);
      },
      bonusesAvg: (a, b) => {
        const avg = (p) => {
          const bonuses = Object.values(p?.role_plus || {}).flat().reduce((s, v) => s + (v || 0), 0);
          const g = Object.values(p?.gamesPlayed || {}).reduce((s, v) => s + (v || 0), 0);
          return g > 0 ? bonuses / g : 0;
        };
        return avg(a) - avg(b);
      },
      totalCi: (a, b) => (a?.totalCi || 0) - (b?.totalCi || 0),
      totalCb: (a, b) => (a?.totalCb || 0) - (b?.totalCb || 0),
      penalty: (a, b) =>
        ((a?.total_sk_penalty || 0) + (a?.total_jk_penalty || 0)) - ((b?.total_sk_penalty || 0) + (b?.total_jk_penalty || 0)),
      deaths: (a, b) => (a?.deaths || 0) - (b?.deaths || 0),
      deathsWith1Black: (a, b) => (a?.deathsWith1Black || 0) - (b?.deathsWith1Black || 0),
      deathsWith2Black: (a, b) => (a?.deathsWith2Black || 0) - (b?.deathsWith2Black || 0),
      deathsWith3Black: (a, b) => (a?.deathsWith3Black || 0) - (b?.deathsWith3Black || 0),

      sheriffWins: (a, b) => (a?.wins?.sheriff || 0) - (b?.wins?.sheriff || 0),
      sheriffWR: (a, b) => {
        const ga = a?.gamesPlayed?.sheriff || 0;
        const gb = b?.gamesPlayed?.sheriff || 0;
        const wra = ga > 0 ? (a?.wins?.sheriff || 0) / ga : 0;
        const wrb = gb > 0 ? (b?.wins?.sheriff || 0) / gb : 0;
        return wra - wrb;
      },
      sheriffGames: (a, b) => (a?.gamesPlayed?.sheriff || 0) - (b?.gamesPlayed?.sheriff || 0),
      sheriffAvg: (a, b) => {
        const A = a?.role_plus?.sheriff || [];
        const B = b?.role_plus?.sheriff || [];
        const avA = A.length ? A.reduce((s, v) => s + (v || 0), 0) / A.length : 0;
        const avB = B.length ? B.reduce((s, v) => s + (v || 0), 0) / B.length : 0;
        return avA - avB;
      },
      sheriffMax: (a, b) => {
        const A = a?.role_plus?.sheriff || [];
        const B = b?.role_plus?.sheriff || [];
        const mA = A.length ? Math.max(...A) : 0;
        const mB = B.length ? Math.max(...B) : 0;
        return mA - mB;
      },

      citizenWins: (a, b) => (a?.wins?.citizen || 0) - (b?.wins?.citizen || 0),
      citizenWR: (a, b) => {
        const ga = a?.gamesPlayed?.citizen || 0;
        const gb = b?.gamesPlayed?.citizen || 0;
        const wra = ga > 0 ? (a?.wins?.citizen || 0) / ga : 0;
        const wrb = gb > 0 ? (b?.wins?.citizen || 0) / gb : 0;
        return wra - wrb;
      },
      citizenGames: (a, b) => (a?.gamesPlayed?.citizen || 0) - (b?.gamesPlayed?.citizen || 0),
      citizenAvg: (a, b) => {
        const A = a?.role_plus?.citizen || [];
        const B = b?.role_plus?.citizen || [];
        const avA = A.length ? A.reduce((s, v) => s + (v || 0), 0) / A.length : 0;
        const avB = B.length ? B.reduce((s, v) => s + (v || 0), 0) / B.length : 0;
        return avA - avB;
      },
      citizenMax: (a, b) => {
        const A = a?.role_plus?.citizen || [];
        const B = b?.role_plus?.citizen || [];
        const mA = A.length ? Math.max(...A) : 0;
        const mB = B.length ? Math.max(...B) : 0;
        return mA - mB;
      },

      mafiaWins: (a, b) => (a?.wins?.mafia || 0) - (b?.wins?.mafia || 0),
      mafiaWR: (a, b) => {
        const ga = a?.gamesPlayed?.mafia || 0;
        const gb = b?.gamesPlayed?.mafia || 0;
        const wra = ga > 0 ? (a?.wins?.mafia || 0) / ga : 0;
        const wrb = gb > 0 ? (b?.wins?.mafia || 0) / gb : 0;
        return wra - wrb;
      },
      mafiaGames: (a, b) => (a?.gamesPlayed?.mafia || 0) - (b?.gamesPlayed?.mafia || 0),
      mafiaAvg: (a, b) => {
        const A = a?.role_plus?.mafia || [];
        const B = b?.role_plus?.mafia || [];
        const avA = A.length ? A.reduce((s, v) => s + (v || 0), 0) / A.length : 0;
        const avB = B.length ? B.reduce((s, v) => s + (v || 0), 0) / B.length : 0;
        return avA - avB;
      },
      mafiaMax: (a, b) => {
        const A = a?.role_plus?.mafia || [];
        const B = b?.role_plus?.mafia || [];
        const mA = A.length ? Math.max(...A) : 0;
        const mB = B.length ? Math.max(...B) : 0;
        return mA - mB;
      },

      donWins: (a, b) => (a?.wins?.don || 0) - (b?.wins?.don || 0),
      donWR: (a, b) => {
        const ga = a?.gamesPlayed?.don || 0;
        const gb = b?.gamesPlayed?.don || 0;
        const wra = ga > 0 ? (a?.wins?.don || 0) / ga : 0;
        const wrb = gb > 0 ? (b?.wins?.don || 0) / gb : 0;
        return wra - wrb;
      },
      donGames: (a, b) => (a?.gamesPlayed?.don || 0) - (b?.gamesPlayed?.don || 0),
      donAvg: (a, b) => {
        const A = a?.role_plus?.don || [];
        const B = b?.role_plus?.don || [];
        const avA = A.length ? A.reduce((s, v) => s + (v || 0), 0) / A.length : 0;
        const avB = B.length ? B.reduce((s, v) => s + (v || 0), 0) / B.length : 0;
        return avA - avB;
      },
      donMax: (a, b) => {
        const A = a?.role_plus?.don || [];
        const B = b?.role_plus?.don || [];
        const mA = A.length ? Math.max(...A) : 0;
        const mB = B.length ? Math.max(...B) : 0;
        return mA - mB;
      },
    }),
    []
  );

  // ✅ загрузка по локации без "остатков"
  const fetchStatsByLocation = async (loc) => {
    if (!eventId) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const myReqId = ++reqIdRef.current;

    setTableData([]);
    onPageChange?.(1);
    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const params = new URLSearchParams();
      if (loc) params.set("location", loc);

      const res = await fetch(`/api/events/${eventId}/player-stats?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}. ${text}`);
      }

      const json = await res.json();
      if (myReqId !== reqIdRef.current) return;

      setTableData(Array.isArray(json?.players) ? json.players : []);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setLocationError(e?.message || "Ошибка загрузки по локации");
      setTableData([]);
    } finally {
      if (myReqId === reqIdRef.current) setIsLoadingLocation(false);
    }
  };

  const handleLocationChange = (loc) => {
    setSelectedLocation(loc);
    fetchStatsByLocation(loc);
  };

  const filteredAndSortedData = useMemo(() => {
    const filtered = applyFilters(Array.isArray(tableData) ? [...tableData] : []);
    if (sortConfig.key && sortFunctions[sortConfig.key]) {
      filtered.sort((a, b) => {
        const r = sortFunctions[sortConfig.key](a, b);
        return sortConfig.direction === "asc" ? r : -r;
      });
    }
    return filtered;
  }, [tableData, filters, sortConfig, sortFunctions]);

  const itemsPerPage = 10;
  const totalPagesCalculated = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePlayerClick = (playerId) => {
    if (playerId) navigate(`/profile/${playerId}`);
  };

  useEffect(() => {
    if (currentPage > totalPagesCalculated && totalPagesCalculated > 0) {
      onPageChange?.(totalPagesCalculated);
    }
  }, [totalPagesCalculated, currentPage, onPageChange]);

  const renderRoleStats = (wins = 0, games = 0, bonuses = [], colorClass, roleKey) => {
    const wr = games > 0 ? (wins / games) * 100 : 0;
    const wrText = `${wr.toFixed(2)}%`;
    const avgBonus = bonuses.length ? (bonuses.reduce((sum, val) => sum + (val || 0), 0) / bonuses.length).toFixed(2) : "0.00";
    const maxBonus = bonuses.length ? Math.max(...bonuses).toFixed(2) : "0.00";

    return (
      <>
        {columnVisibility[`${roleKey}Wins`] && <td className={`${styles.roleCell} ${colorClass}`}>{wins}</td>}
        {columnVisibility[`${roleKey}WR`] && <td className={`${styles.roleCell} ${colorClass}`}>{wrText}</td>}
        {columnVisibility[`${roleKey}Games`] && <td className={`${styles.roleCell} ${colorClass}`}>{games}</td>}
        {columnVisibility[`${roleKey}Avg`] && <td className={`${styles.roleCell} ${colorClass}`}>{avgBonus}</td>}
        {columnVisibility[`${roleKey}Max`] && <td className={`${styles.roleCell} ${colorClass}`}>{maxBonus}</td>}
      </>
    );
  };

  const renderPagination = () => {
  const pages = [];
  let startPage = 1;
  let endPage = totalPagesCalculated;

  // Отображаем максимум 7 кнопок страниц
  if (totalPagesCalculated > 7) {
    startPage = Math.max(currentPage - 3, 1);
    endPage = Math.min(startPage + 6, totalPagesCalculated);

    // Корректируем startPage, если endPage ушло за пределы totalPagesCalculated
    if (endPage - startPage < 6) {
      startPage = Math.max(endPage - 6, 1);
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    const isActive = p === currentPage;
    pages.push(
      <button
        key={p}
        onClick={() => onPageChange?.(p)}
        className={`${styles.pageBtn} ${isActive ? styles.pageActive : ''}`}
        type="button"
        aria-current={isActive ? 'page' : undefined} // Для доступности: указывает текущую страницу
        aria-label={`Страница ${p}`} // Для доступности: более понятный текст для скринридеров
      >
        {p}
      </button>
    );
  }
  return pages;
  };

  const renderTh = (key, extraClass = "") => {
    if (!columnVisibility[key]) return null;

    const active = sortConfig.key === key;
    const arrow = active ? (sortConfig.direction === "asc" ? "▲" : "▼") : "";
    const icon = getIcon(key);

    return (
      <th
        key={key}
        onClick={() => requestSort(key)}
        className={`${styles.sortableTh} ${extraClass}`}
        title={getTitle(key)}
      >
        <span title={getTitle(key)} className={styles.thInner}>
         <span className={styles.thLabel}>{getLabel(key)}</span>
         
          
        </span>
        {arrow ? <span className={styles.thArrow}>{arrow}</span> : null}
      </th>
    );
  };



  return (
    <>
    <div className={styles.tableWrapper}>
      <div className={styles.btnWrap}>
        <button onClick={toggleModal} className={styles.editButton} type="button">
          Редактировать
        </button>
        <button onClick={toggleFilterModal} className={styles.editButton} type="button">
          Фильтры
        </button>

        {!!locations.length && <button
          className={`${styles.editButton} ${selectedLocation === null ? styles.activeButton : ""}`}
          onClick={() => handleLocationChange(null)}
          disabled={isLoadingLocation}
          type="button"
        >
          Все
        </button>}

        {Array.isArray(locations) &&
          locations.map((loc) => (
            <button
              key={loc}
              className={`${styles.editButton} ${selectedLocation === loc ? styles.activeButton : ""}`}
              onClick={() => handleLocationChange(loc)}
              disabled={isLoadingLocation}
              type="button"
            >
              {loc}
            </button>
          ))}
      </div>

      {locationError && <div className={styles.notification}>{locationError}</div>}
      {isLoadingLocation && <div className={styles.notification}>Загрузка...</div>}

      {/* Модалка столбцов */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={handleOverlayClick}>
          <div className={styles.modal}>
            <h4>Выберите столбцы для отображения:</h4>
            <div className={styles.columnToggles}>
              {allColumns
                .filter((col) => !col.alwaysVisible)
                .map((col) => (
                  <label key={col.key} style={{ marginRight: "10px", display: "block" }}>
                    <input type="checkbox" checked={!!columnVisibility[col.key]} onChange={() => toggleColumnVisibility(col.key)} />
                    <span title={col.title} style={{ marginLeft: 8 }}>
                      {col.icon}
                    </span>
                    <span style={{ marginLeft: 8 }}>{col.title}</span>
                  </label>
                ))}
            </div>
            <button onClick={toggleModal} className={styles.closeButton} type="button">
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модалка фильтров */}
      {isFilterModalOpen && (
        <div className={styles.modalOverlay} onClick={handleOverlayClick}>
          <div className={styles.modal}>
            <h4>Создать фильтры:</h4>
            <div className={styles.filterBuilder}>
              <div className={styles.filterForm}>
                <select id="field" value={filterField} onChange={(e) => setFilterField(e.target.value)}>
                  {allColumns
                    .filter((col) => col.key !== "rank")
                    .map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.title}
                      </option>
                    ))}
                </select>

                <select id="operator" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  {filterField === "player" && <option value="contains">содержит</option>}
                </select>

                <input type="text" id="value" placeholder="Значение" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />

                {filters.length > 0 && (
                  <select id="logical" defaultValue="AND">
                    <option value="AND">И</option>
                    <option value="OR">ИЛИ</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const value = filterValue.trim();
                    if (!value) return;

                    const logical =
                      filters.length > 0 ? document.getElementById("logical")?.value || "AND" : null;

                    addFilterCondition(filterField, filterOperator, value, logical);
                    setFilterValue("");
                  }}
                >
                  Добавить условие
                </button>
              </div>

              <div className={styles.filterList}>
                {filters.map((filter, index) => (
                  <div key={index} className={styles.filterItem}>
                    {index > 0 && <span>{filter.logical} </span>}
                    {getLabel(filter.field)} {filter.operator} {String(filter.value)}
                    <button type="button" onClick={() => removeFilterCondition(index)}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={clearFilters}>
                Сбросить все фильтры
              </button>
            </div>

            <button onClick={toggleFilterModal} className={styles.closeButton} type="button">
              Закрыть
            </button>
          </div>
        </div>
      )}

      <table className={styles.detailedStatsTable}>
        <thead>
          <tr>
            {/* base */}
            {renderTh("rank")}
            {renderTh("player")}
            {renderTh("totalPoints")}
            {renderTh("totalGames")}
            {renderTh("totalWins")}
            {renderTh("winrate")}
            {renderTh("bonusesSum")}
            {renderTh("bonusesAvg")}
            {renderTh("totalCi")}
            {renderTh("totalCb")}
            {renderTh("penalty")}
            {renderTh("deaths")}
            {renderTh("deathsWith1Black")}
            {renderTh("deathsWith2Black")}
            {renderTh("deathsWith3Black")}

            {/* roles */}
            {renderTh("sheriffWins", styles.roleSheriff)}
            {renderTh("sheriffWR", styles.roleSheriff)}
            {renderTh("sheriffGames", styles.roleSheriff)}
            {renderTh("sheriffAvg", styles.roleSheriff)}
            {renderTh("sheriffMax", styles.roleSheriff)}

            {renderTh("citizenWins", styles.roleCitizen)}
            {renderTh("citizenWR", styles.roleCitizen)}
            {renderTh("citizenGames", styles.roleCitizen)}
            {renderTh("citizenAvg", styles.roleCitizen)}
            {renderTh("citizenMax", styles.roleCitizen)}

            {renderTh("mafiaWins", styles.roleMafia)}
            {renderTh("mafiaWR", styles.roleMafia)}
            {renderTh("mafiaGames", styles.roleMafia)}
            {renderTh("mafiaAvg", styles.roleMafia)}
            {renderTh("mafiaMax", styles.roleMafia)}

            {renderTh("donWins", styles.roleDon)}
            {renderTh("donWR", styles.roleDon)}
            {renderTh("donGames", styles.roleDon)}
            {renderTh("donAvg", styles.roleDon)}
            {renderTh("donMax", styles.roleDon)}
          </tr>
        </thead>

       <tbody
        key={`${currentPage}-${selectedLocation ?? "all"}-${sortConfig.key}-${sortConfig.direction}-${JSON.stringify(filters)}`}
      >
        {paginatedData.length > 0 ? (
          paginatedData.map((player, index) => {
            const rank = (currentPage - 1) * itemsPerPage + index + 1;

            const sheriffBonuses = player?.role_plus?.sheriff || [];
            const citizenBonuses = player?.role_plus?.citizen || [];
            const mafiaBonuses = player?.role_plus?.mafia || [];
            const donBonuses = player?.role_plus?.don || [];

            const totalGames = Object.values(player?.gamesPlayed || {}).reduce(
              (sum, val) => sum + (val || 0),
              0
            );
            const totalWins = Object.values(player?.wins || {}).reduce(
              (sum, val) => sum + (val || 0),
              0
            );
            const winrate =
              totalGames > 0 ? `${((totalWins / totalGames) * 100).toFixed(0)}%` : "0%";

            const bonusesSum = Object.values(player?.role_plus || {})
              .flat()
              .reduce((sum, val) => sum + (val || 0), 0);
            const bonusesAvg = totalGames > 0 ? (bonusesSum / totalGames).toFixed(2) : "0.00";

            const penaltyTotal = (player?.total_sk_penalty || 0) + (player?.total_jk_penalty || 0);

            const rowKey = player?.id ?? player?.nickname ?? player?.name ?? index;

            // ✅ Чётность лучше считать по rank, чтобы "зебра" не сбивалась между страницами
            const rowClass = rank % 2 === 0 ? styles.evenRow : styles.oddRow;

            return (
              <tr key={rowKey} className={rowClass}>
                {columnVisibility.rank && <td>{rank}</td>}

                {columnVisibility.player && (
                  <td onClick={() => handlePlayerClick(player?.id)} className={styles.playerCell}>
                    {player?.name || player?.nickname || "Неизвестно"}
                  </td>
                )}

                {columnVisibility.totalPoints && <td>{player?.totalPoints || 0}</td>}
                {columnVisibility.totalGames && <td>{totalGames}</td>}
                {columnVisibility.totalWins && <td>{totalWins}</td>}
                {columnVisibility.winrate && <td>{winrate}</td>}
                {columnVisibility.bonusesSum && <td>{bonusesSum}</td>}
                {columnVisibility.bonusesAvg && <td>{bonusesAvg}</td>}
                {columnVisibility.totalCi && <td>{player?.totalCi || 0}</td>}
                {columnVisibility.totalCb && <td>{player?.totalCb || 0}</td>}

                {columnVisibility.penalty && (
                  <td className={styles.penaltyCell}>
                    {penaltyTotal > 0 ? `-${penaltyTotal}` : 0}
                  </td>
                )}

                {columnVisibility.deaths && <td>{player?.deaths || 0}</td>}
                {columnVisibility.deathsWith1Black && <td>{player?.deathsWith1Black || 0}</td>}
                {columnVisibility.deathsWith2Black && <td>{player?.deathsWith2Black || 0}</td>}
                {columnVisibility.deathsWith3Black && <td>{player?.deathsWith3Black || 0}</td>}

                {/* роли */}
                {renderRoleStats(
                  player?.wins?.sheriff || 0,
                  player?.gamesPlayed?.sheriff || 0,
                  sheriffBonuses,
                  styles.roleSheriff,
                  "sheriff"
                )}
                {renderRoleStats(
                  player?.wins?.citizen || 0,
                  player?.gamesPlayed?.citizen || 0,
                  citizenBonuses,
                  styles.roleCitizen,
                  "citizen"
                )}
                {renderRoleStats(
                  player?.wins?.mafia || 0,
                  player?.gamesPlayed?.mafia || 0,
                  mafiaBonuses,
                  styles.roleMafia,
                  "mafia"
                )}
                {renderRoleStats(
                  player?.wins?.don || 0,
                  player?.gamesPlayed?.don || 0,
                  donBonuses,
                  styles.roleDon,
                  "don"
                )}
              </tr>
            );
          })
        ) : (
            <tr>
              <td colSpan={allColumns.length} className={styles.noData}>
                Нет данных для отображения
              </td>
            </tr>
          )}
        </tbody>
      </table>

    </div>
    <div>
                {totalPagesCalculated > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => onPageChange?.(currentPage - 1)} disabled={currentPage === 1} className={styles.pageBtn} type="button">
            ‹
          </button>
          {renderPagination()}
          <button
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage === totalPagesCalculated}
            className={styles.pageBtn}
            type="button"
          >
            ›
          </button>
        </div>
      )}
    </div>
    </>
  );
}



export  {DetailedStatsTable};


