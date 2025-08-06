const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    alert("Échec de la copie dans le presse-papiers.");
  }
};

export default copyToClipboard;
