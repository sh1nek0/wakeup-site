import React, { useMemo } from 'react';
import GameCard from '../GameCard/GameCard';
import styles from './TournamentGames.module.css';

function TournamentGames({ games, isAdmin, onDelete, onEdit, onPlayerClick }) {
    const getRound = (id) => {
        const m = id.match(/_r(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    };

    const getTable = (id) => {
        const m = id.match(/_t(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    };

    const groupedGames = useMemo(() => {
        if (!games) return {};

        const sortedGames = [...games].sort((a, b) => {
            const roundA = getRound(a.id);
            const roundB = getRound(b.id);
            if (roundA !== roundB) return roundA - roundB;

            const tableA = getTable(a.id);
            const tableB = getTable(b.id);
            if (tableA !== tableB) return tableA - tableB;
            return a.id.localeCompare(b.id);
        });

        return sortedGames.reduce((acc, game) => {
            const matchRound = game.id.match(/_r(\d+)/);

            if (matchRound) {
                const roundKey= `Раунд ${matchRound[1]}`;
                if (!acc[roundKey]) acc[roundKey] = [];

                const matchTable = game.id.match(/_t(\d+)/);

                acc[roundKey].push({
                    ...game,
                    table: matchTable ? matchTable[1] : undefined,
                });
            } else {
                if (!acc['Прочие игры']) acc['Прочие игры'] = [];
                acc['Прочие игры'].push(game);
            }

            return acc;
        }, {});
    }, [games]);

    const roundKeys = useMemo(() => {
        return Object.keys(groupedGames).sort((a, b) => {
            if (a === 'Прочие игры') return 1;
            if (b === 'Прочие игры') return -1;

            const ma = a.match(/Раунд (\d+)/);
            const mb = b.match(/Раунд (\d+)/);

            const ra = ma ? parseInt(ma[1], 10) : 0;
            const rb = mb ? parseInt(mb[1], 10) : 0;

            return ra - rb;
        });
    }, [groupedGames]);

    return (
        <div className={styles.roundsContainer}>
            {roundKeys.map(round => (
                <div key={round} className={styles.roundGroup}>
                    <h3 className={styles.roundTitle}>{round}</h3>
                    <div className={styles.gamesGridSheet}>
                        {groupedGames[round].map(game => (
                            <GameCard
                                key={game.id}
                                game={game}
                                isAdmin={isAdmin}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onPlayerClick={onPlayerClick}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default TournamentGames;