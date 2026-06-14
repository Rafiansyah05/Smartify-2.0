import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

export async function PUT(request: NextRequest) {
    try {
        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserFromToken(token);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { nama, avatar_url } = body;

        if (!nama || nama.trim() === '') {
            return NextResponse.json({ error: 'Nama lengkap tidak boleh kosong' }, { status: 400 });
        }

        // Update user profile
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                nama: nama.trim(),
                avatar_url: avatar_url || null,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.user_id)
            .select('user_id, email, nama, role, avatar_url, created_at')
            .single();

        if (updateError) {
            console.error('Update profile error:', updateError);
            return NextResponse.json({ error: 'Gagal update profile' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: updatedUser,
        });
    } catch (error: any) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
