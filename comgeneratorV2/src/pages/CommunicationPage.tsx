import React from 'react';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import Textarea from '../components/ui/Textarea';
import { useAuthStore } from '../lib/store';
import useTokenBalance from '../hooks/useTokenBalance';
import copyToClipboard from '../lib/copyToClipboard';
import { generateCommunication } from '../lib/generateCommunication';
import { generateReply } from '../lib/generateReply';

export function CommunicationPage() {
  const { user } = useAuthStore();
  const tokenBalance = useTokenBalance();

  // Fonction 1
  const [destinataire, setDestinataire] = React.useState("Parents d'élèves");
  const [ton, setTon] = React.useState('Détendu');
  const [contenu, setContenu] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [generatedContent, setGeneratedContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Fonction 2
  const [messageRecu, setMessageRecu] = React.useState('');
  const [tonReponse, setTonReponse] = React.useState('Neutre');
  const [objectifsReponse, setObjectifsReponse] = React.useState('');
  const [generatedReply, setGeneratedReply] = React.useState('');
  const [loadingReply, setLoadingReply] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedContent('');

    try {
      const text = await generateCommunication({ destinataire, ton, contenu });
      setGeneratedContent(text);
    } catch (err: any) {
      setError('Erreur lors de la génération');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReply = async () => {
    setLoadingReply(true);
    setReplyError(null);
    setGeneratedReply('');

    try {
      const reply = await generateReply({
        messageRecu,
        ton: tonReponse,
        objectifs: objectifsReponse
      });
      setGeneratedReply(reply);
    } catch (err: any) {
      setReplyError('Erreur lors de la génération de la réponse.');
      console.error(err);
    } finally {
      setLoadingReply(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="space-y-10">
        {/* Token Counter */}
        <div className="text-right text-sm text-gray-500 dark:text-gray-400">
          🪙 {tokenBalance ?? '...'} tokens restants
        </div>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Communication
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Générez des communications professionnelles pour différents destinataires.
          </p>
        </div>

        {/* Fonction 1 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Générer une communication à envoyer
          </h2>

          <Select
            id="destinataire"
            label="Type de destinataire"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            options={[
              { value: "Parents d'élèves", label: "Parents d'élèves" },
              { value: 'Élève', label: 'Élève' },
              { value: 'Classe', label: 'Classe' },
              { value: 'Collègue(s)', label: 'Collègue(s)' },
              {
                value: "Chef(fe) d'établissement / Chef(fe) adjoint",
                label: "Chef(fe) d'établissement / Chef(fe) adjoint"
              }
            ]}
          />

          <Select
            id="ton"
            label="Ton de la communication"
            value={ton}
            onChange={(e) => setTon(e.target.value)}
            options={[
              { value: 'Détendu', label: 'Détendu' },
              { value: 'Neutre', label: 'Neutre' },
              { value: 'Stricte', label: 'Stricte' }
            ]}
          />

          <Textarea
            id="contenu"
            rows={4}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Décrivez les éléments à faire apparaître..."
          />

          <Button onClick={handleGenerate} loading={loading} className="w-full">
            Générer la communication
          </Button>

          {error && <p className="text-red-600">{error}</p>}
        </div>

        {generatedContent && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Communication générée
            </h2>

            <Textarea
              rows={6}
              value={generatedContent}
              onChange={(e) => setGeneratedContent(e.target.value)}
            />

            <Button onClick={() => copyToClipboard(generatedContent)} className="w-full">
              Copier le message
            </Button>
          </div>
        )}

        {/* Fonction 2 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Répondre à une communication reçue
          </h2>

          <Textarea
            rows={4}
            placeholder="Collez ici le message reçu..."
            value={messageRecu}
            onChange={(e) => setMessageRecu(e.target.value)}
          />

          <Select
            id="ton-reponse"
            label="Ton de la réponse"
            value={tonReponse}
            onChange={(e) => setTonReponse(e.target.value)}
            options={[
              { value: 'Détendu', label: 'Détendu' },
              { value: 'Neutre', label: 'Neutre' },
              { value: 'Stricte', label: 'Stricte' }
            ]}
          />

          <Textarea
            rows={3}
            placeholder="Quels éléments doit contenir la réponse ?"
            value={objectifsReponse}
            onChange={(e) => setObjectifsReponse(e.target.value)}
          />

          <Button onClick={handleGenerateReply} loading={loadingReply} className="w-full">
            Générer la réponse
          </Button>

          {replyError && <p className="text-red-600">{replyError}</p>}
        </div>

        {generatedReply && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Réponse générée
            </h2>

            <Textarea
              rows={6}
              value={generatedReply}
              onChange={(e) => setGeneratedReply(e.target.value)}
            />

            <Button onClick={() => copyToClipboard(generatedReply)} className="w-full">
              Copier la réponse
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunicationPage;
