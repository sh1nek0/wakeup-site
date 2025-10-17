import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './PlayersListPage.module.css';
import defaultAvatar from '../NavBar/avatar.png';
import { useDebounce } from '../useDebounce'; // Импортируем хук

const PlayersListPage = () => {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ ПАГИНАЦИИ ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    // --- КОНЕЦ НОВЫХ СОСТОЯНИЙ ---

    useEffect(() => {
        const fetchPlayers = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/getPlayersList');
                if (!response.ok) {
                    throw new Error('Не удалось загрузить список игроков');
                }
                const data = await response.json();
                setPlayers(data.players || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, []);

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

    const filteredPlayers = players.filter(player =>
        player.nickname.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- ЛОГИКА ПАГИНАЦИИ ---
    const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPlayers = filteredPlayers.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };
    // --- КОНЕЦ ЛОГИКИ ПАГИНАЦИИ ---

    if (loading) {
        return <div className={styles.pageWrapper}><p>Загрузка игроков...</p></div>;
    }

    if (error) {
        return <div className={styles.pageWrapper}><p>Ошибка: {error}</p></div>;
    }

    return (
        <div className={styles.pageWrapper}>
            <main className={styles.main}>
                <h1 className={styles.title}>Список игроков</h1>

                <div className={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="Поиск по никнейму..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Сбрасываем на первую страницу при поиске
                        }}
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

                <section className={styles.listWrapper}>
                    <div className={styles.listHeader}>
                        <div className={styles.headerRank}>#</div>
                        <div className={styles.headerPlayer}>Игрок</div>
                        <div className={styles.headerGames}>Сыграно игр</div>
                    </div>

                    {paginatedPlayers.map((player, index) => {
                        const rank = startIndex + index + 1; // Правильный ранг с учетом страницы
                        let clubStripeClass = '';
                        if (player.club === 'WakeUp | MIET') {
                            clubStripeClass = styles.clubMIET;
                        } else if (player.club === 'WakeUp | MIPT') {
                            clubStripeClass = styles.clubMIPT;
                        }

                        return (
                            <NavLink to={`/profile/${player.id}`} key={player.id} className={styles.playerRow}>
                                <div className={`${styles.orangeStripe} ${clubStripeClass}`} />
                                
                                <div className={styles.playerInfo}>
                                    <div className={styles.rank}>{rank}</div>
                                    <img src={player.photoUrl || defaultAvatar} alt="avatar" className={styles.avatar} />
                                    <div>
                                        <div className={styles.playerName}>
                                            {player.nickname.length > 10
                                                ? player.nickname.length(0, 10) + '...'
                                                : player.nickname}
                                        </div>
                                        <div className={styles.playerClub}>{player.club || 'Клуб не указан'}</div>
                                    </div>
                                </div>
                                <div className={styles.gameCount}>
                                    {player.game_count}
                                </div>
                            </NavLink>
                        );
                    })}
                </section>

                {/* --- КОМПОНЕНТ ПАГИНАЦИИ --- */}
                {totalPages > 1 && (
                    <nav className={styles.pagination}>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`${styles.pageBtn} ${styles.pageArrow}`}
                        >
                            ‹
                        </button>
                        {[...Array(totalPages)].map((_, i) => {
                            const pageNumber = i + 1;
                            return (
                                <button
                                    key={pageNumber}
                                    onClick={() => handlePageChange(pageNumber)}
                                    className={`${styles.pageBtn} ${currentPage === pageNumber ? styles.pageActive : ''}`}
                                >
                                    {pageNumber}
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
                {/* --- КОНЕЦ КОМПОНЕНТА ПАГИНАЦИИ --- */}
            </main>
        </div>
    );
};

export default PlayersListPage;