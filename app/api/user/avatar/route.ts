import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserFromToken(token);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('avatar') as File;

        if (!file) {
            return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
        }

        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Hanya file gambar yang diperbolehkan' }, { status: 400 });
        }

        // Validasi ukuran (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'Ukuran file maksimal 2MB' }, { status: 400 });
        }

        // Konversi file ke buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `avatar-${user.user_id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Cek apakah bucket 'user-avatars' ada, jika tidak buat
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === 'user-avatars');

        if (!bucketExists) {
            // Buat bucket baru
            const { error: createBucketError } = await supabase.storage.createBucket('user-avatars', {
                public: true,
                fileSizeLimit: 2097152, // 2MB
            });

            if (createBucketError) {
                console.error('Create bucket error:', createBucketError);
                return NextResponse.json({ error: 'Gagal membuat storage bucket' }, { status: 500 });
            }
        }

        // Upload ke Supabase Storage
        const { error: uploadError } = await supabase.storage.from('user-avatars').upload(filePath, buffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: true,
        });

        if (uploadError) {
            console.error('Upload avatar error:', uploadError);
            return NextResponse.json({ error: 'Gagal upload avatar: ' + uploadError.message }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(filePath);

        const avatarUrl = urlData.publicUrl;

        // Update user avatar_url di database
        const { error: updateError } = await supabase
            .from('users')
            .update({
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.user_id);

        if (updateError) {
            console.error('Update avatar_url error:', updateError);
            return NextResponse.json({ error: 'Gagal update avatar' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            avatar_url: avatarUrl,
        });
    } catch (error: any) {
        console.error('Avatar upload error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
    }
}
