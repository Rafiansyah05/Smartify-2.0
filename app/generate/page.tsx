'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Lightbulb, Pencil, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { UpgradeModal } from '@/components/upgrade-modal';
import { FREE_TRIAL_MAX_QUESTIONS, PREMIUM_MAX_QUESTIONS, isPremiumEffective } from '@/lib/subscription/plan';

export default function GenerateQuizPage() {
  const router = useRouter();
  const [quizType, setQuizType] = useState('campuran');
  const [difficulty, setDifficulty] = useState('medium');
  const [multipleChoiceCount, setMultipleChoiceCount] = useState(5);
  const [shortAnswerCount, setShortAnswerCount] = useState(2);
  const [duration, setDuration] = useState(45);
  const [kkm, setKkm] = useState(75);
  const [title, setTitle] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [me, setMe] = useState<{ subscription_status?: string | null; expired_at?: string | null } | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeHint, setUpgradeHint] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPremium = isPremiumEffective(me?.subscription_status, me?.expired_at);
  const maxQuestionsLimit = isPremium ? PREMIUM_MAX_QUESTIONS : FREE_TRIAL_MAX_QUESTIONS;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!cancelled && res.ok && data.user) {
          setMe(data.user);
        }
      } catch {
        /* unauthenticated / siswa */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Free trial: hanya pilihan ganda — paksa tipe jika sebelumnya campuran/isian. */
  useEffect(() => {
    if (me === null) return;
    if (!isPremium && (quizType === 'isian' || quizType === 'campuran')) {
      setQuizType('pilihan_ganda');
    }
  }, [me, isPremium, quizType]);

  // Hitung total soal berdasarkan tipe yang dipilih
  const getTotalQuestions = () => {
    if (quizType === 'pilihan_ganda') {
      return multipleChoiceCount;
    } else if (quizType === 'isian') {
      return shortAnswerCount;
    } else {
      return multipleChoiceCount + shortAnswerCount;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError('');
    } else {
      setError('Hanya file PDF yang diperbolehkan');
      setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError('');
    } else {
      setError('Hanya file PDF yang diperbolehkan');
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      setError('Silakan upload materi PDF terlebih dahulu');
      return;
    }
    if (!title) {
      setError('Judul kuis harus diisi');
      return;
    }

    // Validasi jumlah soal
    const totalSoal = getTotalQuestions();
    if (totalSoal === 0) {
      setError('Jumlah soal minimal 1');
      return;
    }
    if (totalSoal > maxQuestionsLimit) {
      setError(`Jumlah soal maksimal ${maxQuestionsLimit} untuk paket ${isPremium ? 'Premium' : 'Free Trial'}`);
      return;
    }

    setLoading(true);
    setLoadingStep(1);
    setError('');

    // Simulasi progress steps
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < 4) return prev + 1;
        return prev;
      });
    }, 3500);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', quizType);
      formData.append('difficulty', difficulty);
      formData.append('totalQuestions', totalSoal.toString());
      formData.append(
        'multipleChoiceCount',
        quizType === 'pilihan_ganda' ? totalSoal.toString() : quizType === 'isian' ? '0' : multipleChoiceCount.toString(),
      );
      formData.append(
        'shortAnswerCount',
        quizType === 'isian' ? totalSoal.toString() : quizType === 'pilihan_ganda' ? '0' : shortAnswerCount.toString(),
      );
      formData.append('duration', duration.toString());
      formData.append('kkm', kkm.toString());

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'SUBSCRIPTION_LIMIT') {
          setUpgradeHint(data.error || 'Upgrade ke Premium untuk akses lebih banyak.');
          setUpgradeModalOpen(true);
        }
        throw new Error(data.error || 'Gagal generate kuis');
      }

      setLoadingStep(5); // Completed
      setTimeout(() => {
        router.push(`/quiz/${data.quizId}/preview`);
      }, 1000);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    } finally {
      clearInterval(stepInterval);
    }
  };

  const loadingStepsText = ['', 'Menyiapkan dokumen...', 'Membaca konten PDF...', 'Menganalisis materi...', 'Menyusun pertanyaan & kunci jawaban...', 'Finalisasi kuis...'];

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">GENERATE QUIZ</p>
        <h1 className="text-2xl font-bold text-gray-900">Buat Kuis Baru</h1>
      </div>

      {/* Main Content - Two Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: Sumber Materi */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold">1</div>
            <h2 className="text-lg font-semibold text-gray-900">Sumber Materi</h2>
          </div>

          {/* Upload Area */}
          <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragging ? 'border-primary bg-primary/5' : file ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <div className="flex flex-col items-center">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${file ? 'bg-primary/10' : 'bg-gray-50'}`}>
                <Upload className={`w-7 h-7 ${file ? 'text-primary' : 'text-primary/60'}`} />
              </div>

              {file ? (
                <>
                  <p className="text-gray-900 font-medium mb-1">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <p className="text-gray-800 font-medium mb-1">Tarik file PDF ke sini</p>
                  <p className="text-sm text-gray-400 mb-4">atau klik untuk memilih dari komputer</p>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full">MAX 10MB</span>
                    <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full">PDF ONLY</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tips Box */}
          <div className="mt-4 p-4 bg-amber-50 rounded-xl flex gap-3">
            <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">Tips: Gunakan materi yang bersih dari gambar agar mendapatkan hasil yang lebih baik</p>
          </div>

          {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
        </div>

        {/* Card 2: Konfigurasi Kuis */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold">2</div>
            <h2 className="text-lg font-semibold text-gray-900">Konfigurasi Kuis</h2>
          </div>

          <div className="space-y-5">
            {/* Judul Kuis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Judul Kuis</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ulangan Harian - Kalkulus 2"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {/* Jenis Soal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Soal</label>
              <div className="relative">
                <select
                  value={quizType}
                  onChange={(e) => setQuizType(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="pilihan_ganda">Pilihan Ganda</option>
                  <option value="isian" disabled={!isPremium}>
                    Isian Singkat{!isPremium ? ' (Premium)' : ''}
                  </option>
                  <option value="campuran" disabled={!isPremium}>
                    Campuran (PG &amp; Isian){!isPremium ? ' (Premium)' : ''}
                  </option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Jumlah Soal - Dynamic based on quiz type */}
            <div className="space-y-4">
              {/* Label Jumlah Soal */}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {quizType === 'pilihan_ganda' && 'Jumlah Soal Pilihan Ganda'}
                {quizType === 'isian' && 'Jumlah Soal Isian Singkat'}
                {quizType === 'campuran' && 'Komposisi Soal'}
              </label>

              {/* Campuran: tampilkan 2 input */}
              {quizType === 'campuran' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">PILIHAN GANDA</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={multipleChoiceCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setMultipleChoiceCount(Math.min(maxQuestionsLimit, Math.max(0, val)));
                        }}
                        min={0}
                        max={maxQuestionsLimit}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-primary">SOAL</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">ISIAN SINGKAT</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={shortAnswerCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setShortAnswerCount(Math.min(maxQuestionsLimit, Math.max(0, val)));
                        }}
                        min={0}
                        max={maxQuestionsLimit}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-primary">SOAL</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pilihan Ganda saja: tampilkan 1 input */}
              {quizType === 'pilihan_ganda' && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="relative">
                    <input
                      type="number"
                      value={multipleChoiceCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setMultipleChoiceCount(Math.min(maxQuestionsLimit, Math.max(1, val)));
                      }}
                      min={1}
                      max={maxQuestionsLimit}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-primary">SOAL</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Minimal 1 soal, maksimal {maxQuestionsLimit} soal ({isPremium ? 'Premium' : 'Free Trial'})
                  </p>
                </div>
              )}

              {/* Isian saja: tampilkan 1 input */}
              {quizType === 'isian' && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="relative">
                    <input
                      type="number"
                      value={shortAnswerCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setShortAnswerCount(Math.min(maxQuestionsLimit, Math.max(1, val)));
                      }}
                      min={1}
                      max={maxQuestionsLimit}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-primary">SOAL</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Minimal 1 soal, maksimal {maxQuestionsLimit} soal ({isPremium ? 'Premium' : 'Free Trial'})
                  </p>
                </div>
              )}

              {/* Total soal info (hanya untuk campuran) */}
              {quizType === 'campuran' && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-gray-500">Total Soal:</span>
                  <span className="text-lg font-bold text-primary">{multipleChoiceCount + shortAnswerCount} soal</span>
                </div>
              )}
            </div>

            {/* Tingkat Kesulitan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tingkat Kesulitan</label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-50 rounded-xl">
                {[
                  { value: 'easy', label: 'EASY' },
                  { value: 'medium', label: 'MEDIUM' },
                  { value: 'hard', label: 'HARD' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDifficulty(option.value)}
                    className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${difficulty === option.value ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Durasi & KKM */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durasi</label>
                <div className="relative">
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setDuration(Math.min(180, Math.max(1, val)));
                    }}
                    min={1}
                    max={180}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">MENIT</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">KKM</label>
                <div className="relative">
                  <input
                    type="number"
                    value={kkm}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setKkm(Math.min(100, Math.max(0, val)));
                    }}
                    min={0}
                    max={100}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">SKOR</span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleGenerate}
                disabled={loading || !file || !title || getTotalQuestions() === 0}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
              >
                <Pencil className="w-4 h-4" />
                {loading ? 'Meng-generate...' : 'Buat Soal Sekarang!'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative overflow-hidden">
            {/* Progress Bar Top */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100">
              <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(loadingStep / 5) * 100}%` }} />
            </div>

            <div className="text-center mb-8 mt-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                {loadingStep === 5 ? <CheckCircle2 className="w-8 h-8 text-primary" /> : <Loader2 className="w-8 h-8 text-primary animate-spin" />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Generate Quiz</h3>
              <p className="text-gray-500 text-sm">Mohon tunggu, Smartify sedang memproses materi Anda.</p>
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((stepIndex) => (
                <div key={stepIndex} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${loadingStep > stepIndex ? 'bg-primary border-primary text-white' : loadingStep === stepIndex ? 'border-primary text-primary' : 'border-gray-200 text-gray-300'
                      }`}
                  >
                    {loadingStep > stepIndex ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{stepIndex}</span>}
                  </div>
                  <span className={`text-sm font-medium transition-colors duration-300 ${loadingStep >= stepIndex ? 'text-gray-800' : 'text-gray-400'}`}>{loadingStepsText[stepIndex]}</span>
                  {loadingStep === stepIndex && <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          setUpgradeHint('');
        }}
        limitBanner={upgradeHint || undefined}
        onAfterPaymentFlow={() => {
          void (async () => {
            try {
              const res = await fetch('/api/auth/me');
              const data = await res.json();
              if (res.ok && data.user) setMe(data.user);
            } catch {
              /* ignore */
            }
          })();
        }}
      />
    </div>
  );
}
