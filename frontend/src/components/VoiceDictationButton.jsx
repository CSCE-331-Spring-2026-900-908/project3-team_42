import useSpeechRecognition, { speechSupported } from '../hooks/useSpeechRecognition';

/**
 * Microphone button for voice dictation (Lea persona).
 * Uses the Web Speech API to transcribe speech and append it to an input field.
 *
 * @param {object} props
 * @param {(text: string) => void} props.onTranscript - called with recognized text
 * @param {string} [props.lang='en-US'] - BCP 47 language for recognition
 * @param {string} [props.className] - extra classes on the wrapper
 * @param {string} [props.size='md'] - 'sm' | 'md' — button sizing
 */
export default function VoiceDictationButton({
  onTranscript,
  lang = 'en-US',
  className = '',
  size = 'md',
}) {
  const { listening, interim, toggle, supported } = useSpeechRecognition({
    lang,
    continuous: false,
    onResult: (text) => onTranscript?.(text),
  });

  if (!supported) return null;

  const dims = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className={`flex ${dims} items-center justify-center rounded-xl border-2 transition-colors ${
          listening
            ? 'border-red-500 bg-red-50 text-red-600 animate-pulse'
            : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50 hover:border-stone-400'
        }`}
        aria-label={listening ? 'Stop dictation' : 'Start voice dictation'}
        aria-pressed={listening}
        title={listening ? 'Listening… click to stop' : 'Click to dictate with your voice'}
      >
        {listening ? (
          <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
      {listening && interim && (
        <span className="absolute left-full ml-2 whitespace-nowrap rounded-lg bg-stone-800 px-2 py-1 text-xs text-white shadow-lg" aria-live="polite">
          {interim}
        </span>
      )}
    </div>
  );
}
