import React, { useState, useRef } from 'react';
import styles from './SuggestionInput.module.css';

const SuggestionInput = ({ value, onChange, placeholder, disabled, className, inputStyle }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isActive, setIsActive] = useState(false);
    const debounceTimeoutRef = useRef(null);

    const fetchSuggestions = (query) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(async () => {
            if (query.length < 1) {
                setSuggestions([]);
                return;
            }
            try {
                const response = await fetch(`/api/get_player_suggestions?query=${query}`);
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data);
                } else {
                    setSuggestions([]);
                }
            } catch (error) {
                console.error("Failed to fetch suggestions:", error);
                setSuggestions([]);
            }
        }, 300);
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);
        fetchSuggestions(newValue);
    };

    const handleSuggestionClick = (name) => {
        onChange(name);
        setSuggestions([]);
    };

    return (
        <div className={styles.nameInputContainer}>
            <input
                type="text"
                className={className}
                style={inputStyle}
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                onFocus={() => setIsActive(true)}
                onBlur={() => setTimeout(() => setIsActive(false), 200)}
                disabled={disabled}
                autoComplete="off"
            />
            {isActive && suggestions.length > 0 && (
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
    );
};

export default SuggestionInput;