import React from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import ReactMarkdown from 'react-markdown';

type LessonBank = {
  id: string;
  subject: string;
  topic: string;
  level: string;
  pedagogy_type: string;
  duration: number;
  content: string;
  created_at: string;
};

export function LessonsBankPage() {
  const { user } = useAuthStore();
  const [lessons, setLessons] = React.useState<LessonBank[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchLessons = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('lessons_bank')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setLessons(data);
      setLoading(false);
    };
    fetchLessons();
  }, [user]);

  // Filtrage par recherche plein texte sur sujet/thème/contenu
  const filteredLessons = lessons.filter((l) =>
    [l.subject, l.topic, l.level, l.pedagogy_type, l.content]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Banque de séances
      </h1>

      <div className="mb-6 flex flex-col sm:flex-row items-center gap-3">
        <Input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher une séance par mot-clé, matière, niveau, pédagogie..."
          className="w-full sm:w-96"
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filteredLessons.length} résultat{filteredLessons.length > 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : filteredLessons.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucune séance enregistrée dans votre banque.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredLessons.map(lesson => (
            <div
              key={lesson.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold">
                  {lesson.subject}
                </span>
                <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                  {lesson.level}
                </span>
                <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200">
                  {lesson.pedagogy_type}
                </span>
                <span className="px-2 py-1 text-xs rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200">
                  {lesson.duration} min
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {new Date(lesson.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <h2 className="text-lg font-bold mb-1">{lesson.topic}</h2>
              <div className="prose prose-sm max-w-none dark:prose-invert mb-2">
                <ReactMarkdown>{lesson.content.slice(0, 400) + (lesson.content.length > 400 ? '…' : '')}</ReactMarkdown>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(lesson.content)}
                >
                  Copier
                </Button>
                {/* Ajouter ici l’export PDF ou autres actions si besoin */}
                {/* <Button type="button" variant="outline">PDF</Button> */}
                {/* <Button type="button" variant="destructive">Supprimer</Button> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LessonsBankPage;
