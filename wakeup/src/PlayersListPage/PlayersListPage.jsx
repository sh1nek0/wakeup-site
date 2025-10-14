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

                <section className={styles.listWrapper}>
                    <div className={styles.listHeader}>
                        <div className={styles.headerRank}>#</div>
                        <div className={styles.headerPlayer}>Игрок</div>
                        <div className={styles.headerGames}>Сыграно игр</div>
                    </div>

                    {filteredPlayers.slice(0, 10).map((player, index) => {
                        const clubColor = player.club === 'WakeUp | MIET' ? '#FF7A1A' : player.club === 'WakeUp | MIPT' ? '#2962FF' : '#616161';
                        return (
                            <NavLink to={`/profile/${player.id}`} key={player.id} className={styles.playerRow}>
                                <div className={styles.orangeStripe} style={{'--stripe-color': clubColor}} />
                                
                                <div className={styles.playerInfo}>
                                    <div className={styles.rank}>{index + 1}</div>
                                    <img src={player.photoUrl || defaultAvatar} alt="avatar" className={styles.avatar} />
                                    <div>
                                        <div className={styles.playerName}>{player.nickname}</div>
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
            </main>
        </div>
    );
};

export default PlayersListPage;