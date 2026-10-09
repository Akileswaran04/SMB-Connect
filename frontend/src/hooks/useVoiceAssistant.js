/**
 * useVoiceAssistant — thin wrapper around the browser's built-in Web Speech
 * API (SpeechRecognition for mic input, SpeechSynthesis for spoken replies).
 * No backend speech infra — Groq only ever sees already-transcribed text
 * (see app/core/ai.py + the /assistant/voice endpoint).
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionCtor = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function isVoiceSupported() {
  return !!SpeechRecognitionCtor && typeof window !== 'undefined' && !!window.speechSynthesis;
}

// BCP-47 codes SpeechRecognition expects, keyed by the same language labels
// used elsewhere in the app (preferred_language, assistant source_language).
const LANG_CODES = {
  english: 'en-US', en: 'en-US',
  tamil: 'ta-IN', ta: 'ta-IN',
  // Tanglish is Tamil typed in Latin letters — an Indian-English voice reads it
  // naturally, a Tamil-script voice does not.
  tanglish: 'en-IN',
  hindi: 'hi-IN', hi: 'hi-IN',
  telugu: 'te-IN', te: 'te-IN',
  kannada: 'kn-IN', kn: 'kn-IN',
  malayalam: 'ml-IN', ml: 'ml-IN',
};

function toBcp47(language) {
  return LANG_CODES[(language || 'en').toLowerCase()] || 'en-US';
}

export default function useVoiceAssistant(language = 'en') {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const startListening = useCallback((onResult) => {
    if (!SpeechRecognitionCtor) {
      setError('Voice input is not supported in this browser');
      return;
    }
    setError('');
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = toBcp47(language);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      onResult(transcript);
    };
    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed' ? 'Microphone access was denied' : 'Could not hear that — try again');
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback((text, spokenLanguage) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = toBcp47(spokenLanguage || language);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [language]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  return { listening, speaking, error, startListening, stopListening, speak, supported: isVoiceSupported() };
}
