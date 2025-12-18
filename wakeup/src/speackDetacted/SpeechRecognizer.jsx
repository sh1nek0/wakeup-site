import React, { useState, useEffect, useRef } from 'react';

const SpeechRecognizer = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const isStoppedManuallyRef = useRef(false); // Используем ref, чтобы избежать замыканий в useEffect

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
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Обновляем транскрипт с финальным и промежуточным текстом
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      setError(`Ошибка: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Если остановка не была ручной, перезапускаем распознавание
      if (!isStoppedManuallyRef.current) {
        setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.start();
          }
        }, 100); // Небольшая задержка для избежания бесконечных циклов
      }
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
      isStoppedManuallyRef.current = false; // Сбрасываем флаг ручной остановки
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      isStoppedManuallyRef.current = true; // Устанавливаем флаг ручной остановки
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
      
    </div>
  );
};

export default SpeechRecognizer;
