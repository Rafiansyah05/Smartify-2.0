'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Users, BarChart3, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Navbar } from '@/components/dashboard/Navbar';
import { downloadExcel } from '@/lib/utils/exportExcel';

export default function QuizDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;
    const quizId = id as string;

    const [quiz, setQuiz] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchProgress = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/quiz/${quizId}/progress`, { credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                setQuiz(data.quiz);
                setParticipants(data.participants || []);
                setStatistics(data.statistics);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Gagal memuat data kuis');
            } finally {
                setLoading(false);
            }
        };

        fetchProgress();
    }, [quizId]);

    const handleDownload = () => {
        if (participants.length === 0) return;
        const excelData = participants.map((p, idx) => ({
            'NO': idx + 1,
            'Nama Lengkap': p.nama_siswa,
            'Waktu Mengerjakan': p.durasi_pengerjaan ? `${Math.floor(p.durasi_pengerjaan / 60)}m ${p.durasi_pengerjaan % 60}s` : '-',
            'Nilai Akhir': p.nilai !== null ? p.nilai : '-',
            'Status': p.status_lulus ? 'Lulus' : 'Remedial'
        }));
        downloadExcel(excelData, `Hasil_Kuis_${quiz?.judul || 'Data'}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <button onClick={() => router.push('/dashboard')} className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
                        Kembali ke Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const passedCount = statistics?.passedCount || 0;
    const remedialCount = statistics?.totalParticipants - passedCount || 0;
    const passPercentage = statistics?.totalParticipants > 0 ? (passedCount / statistics.totalParticipants) * 100 : 0;

    const filteredParticipants = participants.filter(p => p.nama_siswa.toLowerCase().includes(searchQuery.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / itemsPerPage));
    const currentParticipants = filteredParticipants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar fullWidth showBackButton backButtonText="Back to Home" />

            <main className="pt-24 pb-16 px-6 max-w-[1400px] mx-auto">
                {/* Header Section */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">DASHBOARD &gt; DETAIL KUIS</p>
                        <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ujian Tengah Semester'}</h1>
                    </div>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#42bbed] hover:bg-[#3ba8d5] text-white font-medium rounded-full transition-colors shadow-sm shadow-cyan-200"
                    >
                        <Download className="w-4 h-4" />
                        Download Hasil
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Sidebar */}
                    <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">

                        {/* Ringkasan */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h2 className="font-bold text-gray-800 mb-5 text-lg">Ringkasan</h2>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <p className="text-xs text-gray-500 mb-1">Total Siswa</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold text-gray-800">{statistics?.totalParticipants || 0}</span>
                                        <Users className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <p className="text-xs text-gray-500 mb-1">Rata-rata Nilai</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold text-emerald-500">{statistics?.avgScore || 0}%</span>
                                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8">
                                <div className="flex justify-between text-xs font-medium mb-2">
                                    <span className="text-[#42bbed]">Lulus ({passedCount})</span>
                                    <span className="text-red-400">Remedial ({remedialCount})</span>
                                </div>
                                <div className="h-2 w-full bg-red-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-[#42bbed]" style={{ width: `${passPercentage}%` }}></div>
                                    <div className="h-full bg-red-300" style={{ width: `${100 - passPercentage}%` }}></div>
                                </div>
                            </div>

                            <button
                                onClick={() => router.push(`/quiz/${quizId}/preview`)}
                                className="w-full py-3 bg-[#42bbed] hover:bg-[#3ba8d5] text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <FileText className="w-5 h-5" />
                                Lihat soal
                            </button>
                        </div>
                    </div>

                    {/* Right Main Content - Table */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="relative w-64">
                                <input
                                    type="text"
                                    placeholder="Cari nama siswa..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition-all"
                                />
                                <svg className="w-4 h-4 text-gray-400 absolute left-4 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase">NO</th>
                                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase">Nama Lengkap</th>
                                        <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase">Waktu Mengerjakan</th>
                                        <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase">Nilai Akhir</th>
                                        <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {currentParticipants.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-gray-500">
                                                Tidak ada data peserta ditemukan
                                            </td>
                                        </tr>
                                    ) : (
                                        currentParticipants.map((p, idx) => (
                                            <tr key={p.peserta_id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 px-4 text-sm text-gray-600">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                <td className="py-4 px-4">
                                                    <span className="font-medium text-gray-800">{p.nama_siswa}</span>
                                                </td>
                                                <td className="py-4 px-4 text-center text-sm text-gray-600">
                                                    {p.durasi_pengerjaan ? `${Math.floor(p.durasi_pengerjaan / 60)}m ${p.durasi_pengerjaan % 60}s` : '-'}
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <span className="font-semibold text-gray-800">{p.nilai !== null ? p.nilai : '-'}</span>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${p.status_lulus ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {p.status_lulus ? 'Lulus' : 'Remedial'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                                <span className="text-sm text-gray-500">
                                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} dari {Math.min(currentPage * itemsPerPage, filteredParticipants.length)} dari {filteredParticipants.length} hasil
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>

                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === i + 1 ? 'bg-[#42bbed] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
