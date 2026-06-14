'use client';

import { MoreVertical } from 'lucide-react';

interface ParticipantCardProps {
    name: string;
    status: 'connecting' | 'success' | string;
    highlightName?: boolean;
}

export function ParticipantCard({ name, status, highlightName = false }: ParticipantCardProps) {
    const isReady = status === 'success';
    const statusLabel = isReady ? 'Ready' : 'Connecting...';
    const statusColor = isReady ? 'text-emerald-500' : 'text-amber-500';

    return (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
            <div>
                <p className={`font-medium text-sm ${highlightName ? 'text-cyan-600' : 'text-gray-800'}`}>{name}</p>
                <span className={`text-xs ${statusColor}`}>{statusLabel}</span>
            </div>
            <MoreVertical className="w-4 h-4 text-gray-400" />
        </div>
    );
}
