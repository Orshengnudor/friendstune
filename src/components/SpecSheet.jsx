// Spells out the connection between what was read on-chain and what's
// actually playing, so it's stated outright rather than left implied.
export default function SpecSheet({ composition }) {
  const layerNames = ['melody'];
  if (composition.layerCount >= 2) layerNames.push('bass');
  if (composition.layerCount >= 3) layerNames.push('arpeggio');
  if (composition.percussion) layerNames.push('percussion');

  const linerNotes = `Plays in ${composition.rootNoteName} ${composition.scaleName} at ${composition.bpm} BPM, ` +
    `a ${composition.waveform} voice across ${layerNames.length} layer${layerNames.length > 1 ? 's' : ''} ` +
    `(${layerNames.join(', ')}).`;

  return (
    <div className="spec-sheet">
      <p className="spec-liner">{linerNotes}</p>
      <dl className="spec-grid">
        <div className="spec-cell"><dt>Key</dt><dd>{composition.rootNoteName} {composition.scaleName}</dd></div>
        <div className="spec-cell"><dt>Tempo</dt><dd>{composition.bpm} BPM</dd></div>
        <div className="spec-cell"><dt>Voice</dt><dd>{composition.waveform}</dd></div>
        <div className="spec-cell"><dt>Layers</dt><dd>{layerNames.length}</dd></div>
      </dl>
    </div>
  );
}
