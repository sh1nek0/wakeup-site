import React, { useState, useEffect, useRef } from 'react';

const SpeechRecognizer = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Проверяем поддержку API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Ваш браузер не поддерживает распознавание речи. Попробуйте Chrome или Edge.');
      return;
    }

    // Создаем экземпляр
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;

    // Настройки
    recognition.continuous = true; // Непрерывное распознавание
    recognition.interimResults = true; // Промежуточные результаты
    recognition.lang = 'ru-RU'; // Язык (русский; можно изменить на 'en-US' и т.д.)

    // Обработчики событий
    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      setTranscript(prev => prev + finalTranscript); // Добавляем финальный текст
    };

    recognition.onerror = (event) => {
      setError(`Ошибка: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    // Очистка при размонтировании
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Распознаватель речи</h2>
      <button onClick={startListening} disabled={isListening}>
        {isListening ? 'Слушаю...' : 'Начать слушать'}
      </button>
      <button onClick={stopListening} disabled={!isListening} style={{ marginLeft: '10px' }}>
        Остановить
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p><strong>Распознанный текст:</strong></p>
      <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '50px' }}>
        {transcript || 'Здесь появится текст...'}
      </div>
    </div>
  );
};

export default SpeechRecognizer;
