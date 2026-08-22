/**
 * [LAYOUT ARCHETYPE]: Editorial Data Table & Activity Console
 * [RADIUS & BORDERS]: rounded-none to rounded (max 4px borders), high-contrast table rows
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow for active status pills, #D9B48F Nude for secondary text
 */

import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  Download, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  Phone, 
  Filter
} from 'lucide-react';
import { DispatchItem } from '../types';

interface LiveActivityLogsProps {
  logs: DispatchItem[];
  onClearLogs: () => void;
}

export const LiveActivityLogs: React.FC<LiveActivityLogsProps> = ({
  logs,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.phone.includes(searchTerm) || (log.name && log.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = 'ID,Telefone,Gatilho,Status,Data/Hora\n';
    const rows = logs
      .map(
        (l) =>
          `"${l.id}","${l.phone}","${l.opener}","${l.status}","${l.timestamp}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `disparos_whatsapp_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider">Histórico de Disparos</span>
            <span className="text-[10px] font-mono bg-[#141414] text-[#F2B705] border border-[#2c2c2c] px-1.5 py-0.2">
              AUDIT LOG
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Registro de Envios & Conversas
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Rastreabilidade completa de todas as mensagens e gatilhos disparados pelo motor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="px-3.5 py-2 neu-btn text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5 text-[#F2B705]" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="px-3.5 py-2 neu-btn text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="neu-card p-4 bg-[#181818] border border-[#282828] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por telefone ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full neu-sunken pl-9 pr-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#F2B705] border border-[#222222]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Status:
          </span>
          {(['all', 'sent', 'pending', 'failed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-mono uppercase transition-all ${
                statusFilter === st
                  ? 'bg-[#F2B705] text-[#121212] font-bold'
                  : 'neu-btn text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {st === 'all' ? 'Todos' : st === 'sent' ? 'Enviados' : st === 'pending' ? 'Fila' : 'Falha'}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="neu-card bg-[#181818] border border-[#282828] overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-xs font-mono">Nenhum registro encontrado no histórico.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#141414] border-b border-[#262626] text-[10px] text-[#D9B48F] uppercase tracking-wider">
                  <th className="py-3 px-4">Destinatário</th>
                  <th className="py-3 px-4">Gatilho Usado</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1c1c1c] transition-colors">
                    <td className="py-3 px-4 text-white font-bold flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#F2B705]" />
                      <span>{log.phone}</span>
                    </td>
                    <td className="py-3 px-4 text-[#D9B48F]">
                      <span className="px-2 py-0.5 bg-[#141414] border border-[#2a2a2a]">
                        {log.opener}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">WhatsApp Baileys</td>
                    <td className="py-3 px-4">
                      {log.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                          <CheckCheck className="w-3 h-3" />
                          {log.responseReceived ? 'Respondido' : 'Entregue'}
                        </span>
                      ) : log.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-amber-950/70 text-[#F2B705] border border-amber-800/40">
                          <Clock className="w-3 h-3" />
                          Na Fila
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-rose-950/70 text-rose-400 border border-rose-800/40">
                          <AlertCircle className="w-3 h-3" />
                          Falha
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400">
                      {log.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
