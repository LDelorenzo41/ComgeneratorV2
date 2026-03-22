import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Star,
  ThumbsUp,
  CreditCard,
  RefreshCw,
  Download,
  Loader2,
  AlertTriangle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../lib/ragApi';
import { fetchFeedbackSynthesis, exportFeedbackCSV } from '../lib/feedbackApi';
import { FEEDBACK_SECTIONS } from '../types/feedback';
import type { FeedbackSynthesisData, SectionSynthesis } from '../types/feedback';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
);

// ============================================================================
// KPI CARD
// ============================================================================
function KPICard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RATING BAR
// ============================================================================
function RatingBar({ label, average, count }: { label: string; average: number; count: number }) {
  const pct = (average / 5) * 100;
  const color = average >= 4 ? 'bg-green-500' : average >= 3 ? 'bg-yellow-500' : average >= 2 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 text-gray-600 dark:text-gray-400 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right font-medium text-gray-700 dark:text-gray-300">{average}/5</span>
      <span className="w-10 text-right text-xs text-gray-400">({count})</span>
    </div>
  );
}

// ============================================================================
// FEATURE CARD
// ============================================================================
function FeatureCard({ section }: { section: SectionSynthesis }) {
  const ratingEntries = Object.entries(section.ratings);
  if (ratingEntries.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm">{section.label}</h3>
      <div className="space-y-2">
        {ratingEntries.map(([key, val]) => (
          <RatingBar key={key} label={key} average={val.average} count={val.count} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMMENTS PANEL
// ============================================================================
function CommentsPanel({ sections }: { sections: SectionSynthesis[] }) {
  const [activeTab, setActiveTab] = useState(0);

  const allTabs = sections.filter(s => s.comments.length > 0);

  if (allTabs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
        Aucun commentaire pour le moment.
      </div>
    );
  }

  const current = allTabs[activeTab] || allTabs[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5" />
          Commentaires par thème
        </h3>
        <div className="flex flex-wrap gap-2">
          {allTabs.map((tab, i) => (
            <button
              key={tab.section}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                i === activeTab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label} ({tab.comments.length})
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto space-y-3">
        {current.comments.map((c, i) => (
          <div key={i} className="border-l-2 border-blue-400 pl-3 py-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">{c.comment}</p>
            <p className="text-xs text-gray-400 mt-1">
              {c.tester_name} — {new Date(c.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export function FeedbackSynthesisPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeedbackSynthesisData | null>(null);
  const [showProfiles, setShowProfiles] = useState(false);

  useEffect(() => {
    checkIsAdmin().then((isAdmin) => {
      if (!isAdmin) {
        navigate('/dashboard');
        return;
      }
      loadData();
    });
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFeedbackSynthesis();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const csv = exportFeedbackCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback-profassist-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // KPIs
  const generalSection = data.sections.find(s => s.section === 'general');
  const pricingSection = data.sections.find(s => s.section === 'pricing');
  const avgSatisfaction = generalSection?.ratings?.satisfaction_globale?.average || 0;
  const avgRecommandation = generalSection?.ratings?.recommandation?.average || 0;
  const avgPretAPayer = pricingSection?.ratings?.pret_a_payer?.average || 0;

  // Fonctionnalité préférée (histogram data)
  const prefereeSection = data.sections.find(s => s.section === 'general_preferee');
  const prefereeCounts: Record<string, number> = {};
  FEEDBACK_SECTIONS.forEach(fs => { prefereeCounts[fs.label] = 0; });
  if (prefereeSection) {
    prefereeSection.comments.forEach(c => {
      const label = c.comment.trim();
      if (label in prefereeCounts) {
        prefereeCounts[label] += 1;
      }
    });
  }
  const prefereeLabels = Object.keys(prefereeCounts);
  const prefereeValues = Object.values(prefereeCounts);

  const prefereeData = {
    labels: prefereeLabels.map(l => {
      const words = l.split(' ');
      return words.length > 2 ? words.slice(0, 2).join(' ') + '...' : l;
    }),
    datasets: [
      {
        label: 'Votes',
        data: prefereeValues,
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(139, 92, 246, 0.7)',
          'rgba(236, 72, 153, 0.7)',
          'rgba(20, 184, 166, 0.7)',
          'rgba(249, 115, 22, 0.7)',
          'rgba(100, 116, 139, 0.7)',
          'rgba(34, 197, 94, 0.7)',
        ],
      },
    ],
  };

  // Radar data (utilité par feature)
  const featureSections = data.sections.filter(s =>
    FEEDBACK_SECTIONS.some(fs => fs.key === s.section)
  );

  const SHORT_LABELS: Record<string, string> = {
    'Appréciations Intelligentes': 'Appréciations',
    'Synthèses de Bulletins': 'Synthèses',
    'Communications Professionnelles': 'Communications',
    'Séances Pédagogiques': 'Séances',
    'Génération de Supports/Exercices': 'Supports/Exos',
    'Scénarios Pédagogiques': 'Scénarios',
    'Banques Personnalisées': 'Banques',
    'Veille Éducative': 'Veille',
    'Chatbot Personnel': 'Chatbot',
    'Choix du Modèle LLM': 'Modèle LLM',
  };

  const radarData = {
    labels: featureSections.map(s => SHORT_LABELS[s.label] || s.label),
    datasets: [
      {
        label: 'Utilité',
        data: featureSections.map(s => s.ratings?.utilite?.average || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  // Bar chart data
  const barLabels = featureSections.map(s => {
    const words = s.label.split(' ');
    return words.length > 2 ? words.slice(0, 2).join(' ') + '...' : s.label;
  });

  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Utilité',
        data: featureSections.map(s => s.ratings?.utilite?.average || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      },
      {
        label: 'Qualité',
        data: featureSections.map(s => s.ratings?.qualite?.average || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
      },
      {
        label: 'Facilité',
        data: featureSections.map(s => s.ratings?.facilite?.average || 0),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              Synthèse des retours testeurs
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {data.totalResponses} réponse{data.totalResponses > 1 ? 's' : ''} collectée{data.totalResponses > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard icon={Users} label="Réponses" value={data.totalResponses} color="bg-blue-600" />
          <KPICard icon={Star} label="Satisfaction moy." value={`${avgSatisfaction}/5`} color="bg-green-600" />
          <KPICard icon={ThumbsUp} label="Recommandation moy." value={`${avgRecommandation}/5`} color="bg-purple-600" />
          <KPICard icon={CreditCard} label="Prêt à payer moy." value={`${avgPretAPayer}/5`} color="bg-yellow-600" />
        </div>

        {/* Profils des testeurs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <button
            onClick={() => setShowProfiles(!showProfiles)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Profils des testeurs ({data.sessions.length})
            </h3>
            {showProfiles ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showProfiles && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4">Nom</th>
                    <th className="pb-2 pr-4">Matière</th>
                    <th className="pb-2 pr-4">Niveau</th>
                    <th className="pb-2 pr-4">Exp.</th>
                    <th className="pb-2 pr-4">Tokens achetés</th>
                    <th className="pb-2 pr-4">Prévoit acheter</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                      <td className="py-2 pr-4">{s.tester_name || 'Anonyme'}</td>
                      <td className="py-2 pr-4">{s.matiere || '-'}</td>
                      <td className="py-2 pr-4">{s.niveau || '-'}</td>
                      <td className="py-2 pr-4">{s.anciennete != null ? `${s.anciennete} ans` : '-'}</td>
                      <td className="py-2 pr-4">{s.a_achete_tokens === true ? 'Oui' : s.a_achete_tokens === false ? 'Non' : '-'}</td>
                      <td className="py-2 pr-4">{s.prevoit_acheter || '-'}</td>
                      <td className="py-2">{s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Radar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Utilité perçue par fonctionnalité</h3>
            <div className="mx-auto" style={{ maxHeight: '420px', aspectRatio: '1' }}>
              <Radar
                data={radarData}
                options={{
                  layout: { padding: 20 },
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 5,
                      ticks: { stepSize: 1 },
                      pointLabels: { font: { size: 12 } },
                    },
                  },
                  plugins: { legend: { display: false } },
                  maintainAspectRatio: true,
                }}
              />
            </div>
          </div>

          {/* Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Comparaison par fonctionnalité</h3>
            <Bar
              data={barData}
              options={{
                scales: {
                  y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 } },
                },
                plugins: {
                  legend: { position: 'bottom' },
                },
                maintainAspectRatio: true,
              }}
            />
          </div>
        </div>

        {/* Histogramme fonctionnalité préférée */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Quelle est votre fonctionnalité préférée ?</h3>
          <Bar
            data={prefereeData}
            options={{
              indexAxis: 'y',
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: { stepSize: 1, precision: 0 },
                  title: { display: true, text: 'Nombre de votes' },
                },
              },
              plugins: {
                legend: { display: false },
              },
              maintainAspectRatio: true,
            }}
          />
        </div>

        {/* Feature Cards */}
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 text-lg">Détail par section</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {data.sections.map((section) => (
            <FeatureCard key={section.section} section={section} />
          ))}
        </div>

        {/* Comments */}
        <CommentsPanel sections={data.sections} />
      </div>
    </div>
  );
}