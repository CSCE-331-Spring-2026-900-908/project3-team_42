import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const speechSupported = !!SpeechRecognition;

/**
 * Hook wrapping the Web Speech API for dictation.
 * Returns the current transcript, listening state, and controls.
 *
 * @param {object} opts
 * @param {string} [opts.lang='en-US'] - BCP 47 language tag
 * @param {boolean} [opts.continuous=false] - keep listening after pauses
 * @param {(transcript: string) => void} [opts.onResult] - called with final transcript
 */
export default function useSpeechRecognition({
  lang = 'en-US',
  continuous = false,
  onResult,
} = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;
    recRef.current?.abort();

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;

    rec.onstart = () => setListening(true);

    rec.onresult = (e) => {
      let final = '';
      let temp = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          temp += r[0].transcript;
        }
      }
      setInterim(temp);
      if (final) {
        onResultRef.current?.(final);
        setInterim('');
      }
    };

    rec.onerror = () => {
      setListening(false);
      setInterim('');
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    recRef.current = rec;
    rec.start();
  }, [lang, continuous]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, interim, start, stop, toggle, supported: speechSupported };
}
