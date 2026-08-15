/**
 * Copie un texte dans le presse-papiers.
 *
 * Retourne `true` en cas de succès, `false` sinon — à charge de l'appelant
 * d'afficher le retour utilisateur (toast). Cette fonction ne peut pas
 * utiliser le hook useToast : ce n'est pas un composant React.
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Échec de la copie dans le presse-papiers :', err);
    return false;
  }
};

export default copyToClipboard;
