import { useEffect, useState } from 'react';
import { COLLECTIONS } from '../lib/friends';

function traitLines(friend) {
  const lines = [
    ['COLLECTION', COLLECTIONS[friend.collection].label],
    ['TOKEN', `#${friend.tokenId}`],
  ];
  if (friend.family) lines.push(['FAMILY', String(friend.family)]);
  if (friend.generation !== null && friend.generation !== undefined) lines.push(['GENERATION', String(friend.generation)]);
  if (friend.tier !== null && friend.tier !== undefined) lines.push(['ACTIVATION TIER', String(friend.tier)]);
  if (friend.state !== null && friend.state !== undefined) lines.push(['STATE', String(friend.state)]);
  return lines;
}

export default function TraitReadout({ friend }) {
  const [revealed, setRevealed] = useState(0);
  const lines = traitLines(friend);

  useEffect(() => {
    setRevealed(0);
    const timers = lines.map((_, i) =>
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 550 + i * 220)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.collection, friend.tokenId]);

  return (
    <dl className="trait-readout">
      {lines.map(([label, value], i) => (
        <div className={`trait-row ${i < revealed ? 'trait-row-visible' : ''}`} key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
