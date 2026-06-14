'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Camera, Calendar, Mail, User, Briefcase } from 'lucide-react';

interface UserData {
    user_id: number;
    email: string;
    nama: string;
    role: string;
    avatar_url: string | null;
    created_at: string;
}

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserData | null;
    onUpdate: (updatedUser: UserData) => void;
}

export function ProfileModal({ isOpen, onClose, user, onUpdate }: ProfileModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editForm, setEditForm] = useState({
        nama: '',
        avatar_url: '',
    });
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setEditForm({
                nama: user.nama || '',
                avatar_url: user.avatar_url || '',
            });
            setAvatarPreview(user.avatar_url);
        }
    }, [user]);

    // Format tanggal: 1 Januari 2025
    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);

        // Cek apakah date valid
        if (isNaN(date.getTime())) return '-';

        const day = date.getDate();
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();

        return `${day} ${month} ${year}`;
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'guru':
                return 'Guru';
            case 'admin':
                return 'Administrator';
            case 'siswa':
                return 'Siswa';
            default:
                return role;
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            setError('Hanya file gambar yang diperbolehkan');
            return;
        }

        // Validasi ukuran (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Ukuran file maksimal 2MB');
            return;
        }

        setUploadingAvatar(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const res = await fetch('/api/user/avatar', {
                method: 'POST',
                body: formData,
            });

            // Cek response sebelum parsing JSON
            const textResponse = await res.text();

            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (parseError) {
                console.error('Response text:', textResponse);
                throw new Error('Server mengembalikan response yang tidak valid');
            }

            if (!res.ok) {
                throw new Error(data.error || 'Gagal upload avatar');
            }

            // Preview gambar lokal dulu
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            setEditForm((prev) => ({ ...prev, avatar_url: data.avatar_url }));
            setSuccess('Avatar berhasil diupdate');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Gagal upload avatar');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!editForm.nama.trim()) {
            setError('Nama lengkap tidak boleh kosong');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nama: editForm.nama.trim(),
                    avatar_url: editForm.avatar_url,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Gagal update profile');
            }

            setSuccess('Profile berhasil diupdate');
            setIsEditing(false);

            if (onUpdate && data.user) {
                onUpdate(data.user);
            }

            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit Profile' : 'Profil Saya'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}
                    {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-sm">{success}</div>}

                    {/* Avatar Section */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-white text-2xl font-bold">{user?.nama?.substring(0, 2).toUpperCase() || 'UN'}</span>}
                            </div>

                            {isEditing && (
                                <>
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="absolute bottom-0 right-0 p-2 bg-cyan-400 rounded-full text-white hover:bg-cyan-500 transition-colors disabled:opacity-50">
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                                </>
                            )}
                        </div>
                        {uploadingAvatar && <p className="text-xs text-gray-400 mt-2">Mengupload...</p>}
                    </div>

                    {isEditing ? (
                        // Edit Mode
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={editForm.nama}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, nama: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                                    placeholder="Nama lengkap"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed" />
                                <p className="text-xs text-gray-400 mt-1">Email tidak dapat diubah</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <input type="text" value={getRoleLabel(user?.role || '')} disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed" />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditForm({
                                            nama: user?.nama || '',
                                            avatar_url: user?.avatar_url || '',
                                        });
                                        setAvatarPreview(user?.avatar_url || null);
                                        setError('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                                >
                                    Batal
                                </button>
                                <button onClick={handleSaveProfile} disabled={loading} className="flex-1 px-4 py-2 bg-cyan-400 hover:bg-cyan-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
                                    {loading ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        // View Mode
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <User className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Nama Lengkap</p>
                                    <p className="font-medium text-gray-800">{user?.nama || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <Mail className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="font-medium text-gray-800">{user?.email || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <Briefcase className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Role</p>
                                    <p className="font-medium text-gray-800">{getRoleLabel(user?.role || '')}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Bergabung Sejak</p>
                                    <p className="font-medium text-gray-800">{user?.created_at ? formatDate(user.created_at) : '-'}</p>
                                </div>
                            </div>

                            <button onClick={() => setIsEditing(true)} className="w-full mt-4 px-4 py-2 bg-cyan-400 hover:bg-cyan-500 text-white font-medium rounded-xl transition-colors">
                                Edit Profile
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
