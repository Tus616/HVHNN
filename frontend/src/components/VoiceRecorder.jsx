import { Mic, MicOff, Languages } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useEffect, useState } from 'react';

export default function VoiceRecorder({ onTranscript }) {
  const {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    language,
    setLanguage
  } = useSpeechRecognition();

  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isSupported) return null;

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      if (transcript) onTranscript(transcript);
    } else {
      startListening();
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en-IN' ? 'hi-IN' : 'en-IN');
  };

  return (
    <div className="relative flex items-center gap-3">
      {/* Language Toggle */}
      <button
        type="button"
        onClick={toggleLanguage}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-bold hover:bg-gray-50 transition-all text-gray-700 shadow-sm"
        title="Switch Speech Language"
      >
        <Languages size={14} className="text-indigo-500" />
        <span>{language === 'en-IN' ? 'English' : 'Hindi'}</span>
      </button>

      {/* Mic Button */}
      <button
        type="button"
        onClick={handleToggleListening}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all shadow-md group ${
          isListening 
            ? 'mic-pulsing text-white' 
            : 'bg-white border border-gray-100 text-gray-600 hover:text-indigo-600 hover:border-indigo-100'
        }`}
        title={isListening ? 'Stop Recording' : 'Click to speak your request'}
      >
        {isListening ? <Mic size={20} /> : <Mic size={20} />}
        
        {!isListening && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Click to speak
          </div>
        )}
      </button>

      {/* Error Message */}
      {showError && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-red-50 border border-red-200 text-red-700 text-[10px] px-3 py-2 rounded-lg shadow-lg w-48 animate-in fade-in slide-in-from-top-1">
          <strong>Mic Error:</strong> {error === 'not-allowed' ? 'Access denied. Please enable mic in browser settings.' : error}
        </div>
      )}

      {/* Live Transcript Overlay */}
      {isListening && transcript && (
        <div className="absolute bottom-full mb-3 right-0 z-40 bg-white/90 backdrop-blur-md border border-indigo-100 p-3 rounded-2xl shadow-xl max-w-[280px] min-w-[200px] animate-in zoom-in-95 duration-200">
          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1 flex justify-between">
            <span>Live Transcript</span>
            <span className="animate-pulse">● Rec</span>
          </div>
          <p className="text-sm text-gray-800 italic leading-relaxed">
            "{transcript}..."
          </p>
        </div>
      )}
    </div>
  );
}
