'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Volume2, 
  Check, 
  Clock, 
  Sparkles,
  Download
} from 'lucide-react';

export interface VoiceNote {
  id: string;
  pageNumber: number;
  label: string;
  audioUrl: string;
  durationSeconds: number;
  recordedAt: string;
}

interface VoiceAnnotationRecorderProps {
  currentPageNumber?: number;
  onSaveVoiceNote?: (note: VoiceNote) => void;
}

export const VoiceAnnotationRecorder: React.FC<VoiceAnnotationRecorderProps> = ({
  currentPageNumber = 1,
  onSaveVoiceNote,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [noteLabel, setNoteLabel] = useState<string>('Important Contract Clause Review');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Timer tick
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record voice explanation notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    if (!audioElementRef.current && audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audioElementRef.current = audio;
    }

    if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSave = () => {
    if (!audioUrl) return;

    const newNote: VoiceNote = {
      id: 'voice_' + Math.random().toString(36).substring(2, 9),
      pageNumber: currentPageNumber,
      label: noteLabel,
      audioUrl: audioUrl,
      durationSeconds: recordSeconds,
      recordedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (onSaveVoiceNote) {
      onSaveVoiceNote(newNote);
    }

    setAudioUrl(null);
    setRecordSeconds(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3 text-xs select-none">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-white">Record Voice Explanation</h4>
            <p className="text-[10px] text-slate-400">Attach audio explanation pin to Page {currentPageNumber}</p>
          </div>
        </div>
        {isRecording && (
          <span className="flex items-center gap-1.5 text-red-500 font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>REC {formatTime(recordSeconds)}</span>
          </span>
        )}
      </div>

      {!audioUrl ? (
        <div className="space-y-2">
          <input
            type="text"
            value={noteLabel}
            onChange={(e) => setNoteLabel(e.target.value)}
            placeholder="Note title (e.g. Legal Indemnity Clause Note)..."
            className="w-full px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              {isRecording ? 'Speak clearly into your microphone' : 'Ready to record memo'}
            </span>

            {isRecording ? (
              <button
                onClick={stopRecording}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Recording</span>
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Start Recording Note</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className="p-2 rounded-full bg-purple-600 text-white shadow hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <div>
                <span className="font-bold text-purple-900 dark:text-purple-200 block truncate max-w-[160px]">
                  {noteLabel}
                </span>
                <span className="text-[10px] text-purple-600">
                  Duration: {formatTime(recordSeconds)} &bull; Page {currentPageNumber}
                </span>
              </div>
            </div>

            <button
              onClick={() => { setAudioUrl(null); setRecordSeconds(0); }}
              className="p-1 text-slate-400 hover:text-red-500"
              title="Discard recording"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Check className="w-4 h-4" />
            <span>Pin Voice Note to Document</span>
          </button>
        </div>
      )}
    </div>
  );
};
