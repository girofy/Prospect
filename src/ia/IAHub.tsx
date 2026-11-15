import { useState } from 'react';
import { LayoutDashboard, BookOpen, Cpu, Sparkles, RotateCcw, Megaphone } from 'lucide-react';
import DashboardTab from './DashboardTab';
import KnowledgeTab from './KnowledgeTab';
import ModelsTab from './ModelsTab';
import LearningTab from './LearningTab';
import FollowUpTab from './FollowUpTab';
import CampaignsTab from './CampaignsTab';

const TABS = [
  { id: 'campanhas', label: 'Campanhas', icon: Megaphone },
  { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
  { id: 'retomar', label: 'Retomar', icon: RotateCcw },
  { id: 'conhecimento', label: 'Conhecimento', icon: BookOpen },
  { id: 'modelos', label: 'Modelos', icon: Cpu },
  { id: 'aprendizado', label: 'Aprendizado', icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]['id'];

function initial(): TabId {
  try {
    const saved = localStorage.getItem('girofy_ia_tab') as TabId | null;
    if (saved && TABS.some(t => t.id === saved)) return saved;
  } catch { /* sem storage: começa no Resumo */ }
  return 'resumo';
}

// Central da IA: tudo que mexe no agente, num lugar só, em quatro seções.
export default function IAHub() {
  const [tab, setTab] = useState<TabId>(initial);
  const choose = (id: TabId) => {
    setTab(id);
    try { localStorage.setItem('girofy_ia_tab', id); } catch { /* ignora */ }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[#0B0B12] leading-tight">Agente</h1>
        <p className="text-[14px] text-[#6B6F80] mt-1">Campanhas, conhecimento e testes do seu agente, num lugar só.</p>
      </div>

      {/* Controle segmentado, no estilo do iOS */}
      <div role="tablist" className="sticky top-0 z-20 -mx-1 px-1 py-1.5 bg-[#F6F7FB]/90 backdrop-blur-xl">
        <div className="flex gap-1 p-1 rounded-2xl bg-[#767680]/[0.12] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(t => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => choose(t.id)}
                className={`flex-1 min-w-[84px] flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl text-[11px] sm:text-[13px] font-semibold transition-all whitespace-nowrap ${on ? 'bg-white text-[#1531F5] shadow-[0_1px_3px_rgba(0,0,0,0.14)]' : 'text-[#5B5F70]'}`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'campanhas' && <CampaignsTab />}
      {tab === 'resumo' && <DashboardTab />}
      {tab === 'retomar' && <FollowUpTab />}
      {tab === 'conhecimento' && <KnowledgeTab />}
      {tab === 'modelos' && <ModelsTab />}
      {tab === 'aprendizado' && <LearningTab />}
    </div>
  );
}
