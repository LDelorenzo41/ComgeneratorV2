import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export function SynthesePage() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const { user } = useAuthStore();

  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [selection, setSelection] = React.useState<{ x: number; y: number; w: number; h: number; dragging: boolean } | null>(null);
  const [maxChars, setMaxChars] = React.useState(300);
  const [summary, setSummary] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [tokenCount, setTokenCount] = React.useState<number | null>(null);

  const fetchTokenCount = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ user_id: user.id, tokens: 100000 })
            .select('tokens')
            .single();
          setTokenCount(newProfile?.tokens ?? 100000);
          return;
        }
        throw error;
      }

      setTokenCount(data?.tokens ?? 0);
    } catch (err) {
      console.error('Erreur lors de la récupération des tokens:', err);
    }
  }, [user]);

  React.useEffect(() => {
    fetchTokenCount();
  }, [fetchTokenCount]);

  const getResponsiveScale = (containerWidth: number, page: pdfjsLib.PDFPageProxy): number => {
    const desiredWidth = Math.min(containerWidth, 800); // limite à 800px max
    const viewport = page.getViewport({ scale: 1 });
    return desiredWidth / viewport.width;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPdfDoc(pdf);

    const page = await pdf.getPage(1);
    const canvas = canvasRef.current!;
    const containerWidth = canvas.parentElement?.clientWidth ?? 600;
    const scale = getResponsiveScale(containerWidth, page);
    const viewport = page.getViewport({ scale });
    const ctx = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas
    }).promise;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelection({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0, dragging: true });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selection?.dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSelection(s => s && ({
      ...s,
      w: (e.clientX - rect.left) - s.x,
      h: (e.clientY - rect.top) - s.y
    }));
  };

  const onMouseUp = () => {
    setSelection(s => s && ({ ...s, dragging: false }));
  };

  const extractText = async (): Promise<string> => {
    if (!pdfDoc || !selection || selection.w <= 0 || selection.h <= 0) return '';
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const selected: string[] = [];

    for (const item of textContent.items as any[]) {
      const transform = item.transform;
      const tx = transform[4];
      const ty = transform[5];
      const px = tx;
      const py = viewport.height - ty;

      if (
        px >= selection.x && px <= selection.x + selection.w &&
        py >= selection.y && py <= selection.y + selection.h
      ) {
        selected.push(item.str);
      }
    }

    const extractedText = selected.join(' ').trim();
    if (extractedText) return extractedText;

    // fallback OCR
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = selection.w;
    tempCanvas.height = selection.h;
    tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);

    const worker = await createWorker('fra');
    const { data: { text: ocrText } } = await worker.recognize(tempCanvas.toDataURL());
    await worker.terminate();

    return ocrText.trim();
  };

  const generateSynthese = async () => {
    if (!selection) return;
    setLoading(true);
    const extracted = await extractText();
    if (!extracted) {
      setLoading(false);
      alert('Aucun texte détecté dans la zone sélectionnée.');
      return;
    }

    const prompt = `
Voici plusieurs commentaires de professeurs extraits d’un bulletin scolaire.

Tu dois générer une appréciation globale en identifiant les grandes tendances : points forts, difficultés éventuelles, éléments positifs. Ne cite pas les professeurs mais tu peux mentionner les matières. Utilise un ton fluide, synthétique et pertinent.

La synthèse doit respecter la limite maximale de ${maxChars} caractères.

Commentaires :
${extracted}
`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: Math.floor(maxChars * 1.5),
        })
      });

      const data = await response.json();
      setSummary(data.choices?.[0]?.message?.content || '');
    } catch (error) {
      console.error('Erreur lors de l’appel à OpenAI:', error);
      alert("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Générer une synthèse
        </h1>
        {tokenCount !== null && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Crédits restants : {tokenCount.toLocaleString()} tokens
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Input type="file" accept="application/pdf" onChange={handleFileChange} />

        <Input
          type="number"
          label="Limite maximale de caractères"
          value={maxChars}
          onChange={e => setMaxChars(Number(e.target.value))}
          min={50}
        />

        <div className="relative border rounded overflow-hidden max-w-full">
          <canvas
            ref={canvasRef}
            className="w-full"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          />
          {selection && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
              style={{
                left: Math.min(selection.x, selection.x + selection.w),
                top: Math.min(selection.y, selection.y + selection.h),
                width: Math.abs(selection.w),
                height: Math.abs(selection.h)
              }}
            />
          )}
        </div>

        <Button onClick={generateSynthese} loading={loading}>
          Générer la synthèse
        </Button>

        {summary && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Synthèse générée
            </h3>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-md shadow">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


