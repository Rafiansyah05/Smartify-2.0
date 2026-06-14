import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface UseQuizRealtimeProps {
    quizId: string | number;
    enabled?: boolean;
    onProgressUpdate?: (payload: any) => void;
    onParticipantJoin?: (payload: any) => void;
    onQuizStatusChange?: (payload: any) => void;
}

export function useQuizRealtime({ quizId, enabled = true, onProgressUpdate, onParticipantJoin, onQuizStatusChange }: UseQuizRealtimeProps) {
    const channelRef = useRef<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    const quizIdStr = quizId.toString();
    const quizIdInt = parseInt(quizIdStr);

    const onProgressUpdateRef = useRef(onProgressUpdate);
    const onParticipantJoinRef = useRef(onParticipantJoin);
    const onQuizStatusChangeRef = useRef(onQuizStatusChange);


    useEffect(() => {
        onProgressUpdateRef.current = onProgressUpdate;
        onParticipantJoinRef.current = onParticipantJoin;
        onQuizStatusChangeRef.current = onQuizStatusChange;
    }, [onProgressUpdate, onParticipantJoin, onQuizStatusChange]);

    const setupSubscriptions = useCallback(async () => {
        if (!enabled || isNaN(quizIdInt)) return;

        const channelName = `quiz-progress-${quizIdStr}`;

        if (channelRef.current && channelRef.current.topic === `realtime:${channelName}`) {
            return;
        }

        if (channelRef.current) {
            await supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        console.log(`Setting up realtime for quiz ${quizIdInt}`);
        const channel = supabase.channel(channelName);

        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jawaban_siswa' }, (payload) => {
            if (onProgressUpdateRef.current) onProgressUpdateRef.current(payload);
        });

        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jawaban_siswa' }, (payload) => {
            if (onProgressUpdateRef.current) onProgressUpdateRef.current(payload);
        });

        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hasil_kuis' }, (payload) => {
            if (onProgressUpdateRef.current) onProgressUpdateRef.current(payload);
        });

        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'peserta_kuis', filter: `kuis_id=eq.${quizIdInt}` }, (payload) => {
            if (onProgressUpdateRef.current) onProgressUpdateRef.current(payload);
        });

        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peserta_kuis', filter: `kuis_id=eq.${quizIdInt}` }, (payload) => {
            if (onParticipantJoinRef.current) onParticipantJoinRef.current(payload);
            if (onProgressUpdateRef.current) onProgressUpdateRef.current(payload);
        });

        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kuis', filter: `kuis_id=eq.${quizIdInt}` }, (payload) => {
            if (onQuizStatusChangeRef.current) onQuizStatusChangeRef.current(payload);
        });

        channel.subscribe((status) => {
            console.log(`📡 Progress realtime status for quiz ${quizIdStr}:`, status);
            setIsConnected(status === 'SUBSCRIBED');
        });

        channelRef.current = channel;
    }, [quizIdStr, quizIdInt, enabled]);

    useEffect(() => {
        if (enabled && !isNaN(quizIdInt)) {
            setupSubscriptions();
        }
    }, [enabled, setupSubscriptions, quizIdInt]);

    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, []);

    const unsubscribe = useCallback(async () => {
        if (channelRef.current) {
            await supabase.removeChannel(channelRef.current);
            channelRef.current = null;
            setIsConnected(false);
        }
    }, []);

    return { unsubscribe, isConnected };
}
