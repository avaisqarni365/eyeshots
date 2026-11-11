'use client';

import React, { useState, useEffect } from 'react';
import { 
  Languages, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  X, 
  Volume2, 
  FileText 
} from 'lucide-react';
import { translateText, summarizeDocument, TranslationResult } from '@/lib/ai/translation-service';

interface TextSelectionTranslatorProps {
  onInsertTranslation?: (text: string) => void;
}

export const TextSelectionTranslator: React.FC<TextSelectionTranslatorProps> = ({ onInsertTranslation }) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [targetLang, setTargetLang] = useState<string>('es');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translatedResult, setTranslatedResult] = useState<TranslationResult | null>(null);
  const [summaryMode, setSummaryMode] = useState<boolean>(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
      const text = selection.toString().trim();
      if (text.length > 3) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setPosition({
          x: Math.max(10, rect.left + rect.width / 2),
          y: Math.max(10, rect.top + window.scrollY - 45),
        });
        setTranslatedResult(null);
        setSummaryText(null);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#selection-translator-popup')) {
        setPosition(null);
        setSelectedText('');
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  if (!position || !selectedText) return null;

  const handleTranslate = async (lang: string) => {
    setTargetLang(lang);
    setIsTranslating(true);
    setSummaryMode(false);
    try {
      const res = await translateText(selectedText, lang);
      setTranslatedResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSummarize = () => {
    setSummaryMode(true);
    setTranslatedResult(null);
    const summary = summarizeDocument(selectedText);
    setSummaryText(summary.executiveSummary);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="selection-translator-popup"
      className="fixed z-50 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 text-xs select-none animate-fade-in flex flex-col gap-2 max-w-sm"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Floating Action Bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 border-r pr-1.5 border-slate-200 dark:border-slate-700">
          <Languages className="w-3.5 h-3.5 text-indigo-600" />
          <select
            value={targetLang}
            onChange={(e) => handleTranslate(e.target.value)}
            className="bg-transparent font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="es">Spanish (ES)</option>
            <option value="de">German (DE)</option>
            <option value="fr">French (FR)</option>
            <option value="it">Italian (IT)</option>
            <option value="pt">Portuguese (PT)</option>
            <option value="ar">Arabic (AR)</option>
            <option value="zh">Chinese (ZH)</option>
            <option value="ja">Japanese (JA)</option>
            <option value="hi">Hindi (HI)</option>
            <option value="en">English (EN)</option>
          </select>
        </div>

        <button
          onClick={() => handleTranslate(targetLang)}
          disabled={isTranslating}
          className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 flex items-center gap-1"
        >
          {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          <span>Translate</span>
        </button>

        <button
          onClick={handleSummarize}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1"
        >
          <FileText className="w-3 h-3 text-emerald-600" />
          <span>Summarize</span>
        </button>

        <button
          onClick={() => setPosition(null)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Result Display Bubble */}
      {(translatedResult || summaryText) && (
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border text-slate-800 dark:text-slate-200 space-y-2 mt-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>{summaryMode ? 'Key Summary' : `Translation (${targetLang.toUpperCase()})`}</span>
            <button
              onClick={() => handleCopy(translatedResult ? translatedResult.translatedText : summaryText || '')}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-xs leading-relaxed max-h-36 overflow-y-auto">
            {translatedResult ? translatedResult.translatedText : summaryText}
          </p>
          {onInsertTranslation && translatedResult && (
            <button
              onClick={() => onInsertTranslation(translatedResult.translatedText)}
              className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow"
            >
              Replace Selected Text
            </button>
          )}
        </div>
      )}
    </div>
  );
};
