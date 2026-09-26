import { useEffect, useState } from 'react';
import { getOwnedFriends, COLLECTIONS } from '../lib/friends';

export default function FriendPicker({ address, onSelect, error }) {
  const [status, setStatus] = useState('loading'); // loading | listed | fallback
  const [friends, setFriends] = useState([]);
  const [counts, setCounts] = useState(null);
  const [manualCollection, setManualCollection] = useState('genesis');
  const [manualId, setManualId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getOwnedFriends(address).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFriends(result.friends);
        setStatus('listed');
      } else {
        setCounts(result.counts);
        setStatus('fallback');
      }
    });
    return () => { cancelled = true; };
  }, [address]);

  const submitManual = (e) => {
    e.preventDefault();
    const id = manualId.trim();
    if (!id || Number.isNaN(Number(id))) return;
    onSelect(manualCollection, id);
  };

  return (
    <div className="picker">
      {status === 'loading' && <p className="picker-status">Reading your wallet's holdings...</p>}

      {status === 'listed' && friends.length > 0 && (
        <>
          <p className="picker-label">Your Friends</p>
          <div className="friend-grid">
            {friends.map((f) => (
              <button
                key={`${f.collection}-${f.tokenId}`}
                className="friend-tile"
                onClick={() => onSelect(f.collection, f.tokenId)}
              >
                <span className="friend-tile-collection">{COLLECTIONS[f.collection].label}</span>
                <span className="friend-tile-id">#{f.tokenId}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {status === 'fallback' && (
        <p className="picker-status">
          Couldn't auto-list your Friends right now.
          {counts && (counts.genesis || counts.generations)
            ? ` This wallet holds ${counts.genesis ?? '?'} Genesis and ${counts.generations ?? '?'} Generations. Enter an ID below to pick one.`
            : ' Enter a token ID below and we\'ll verify it live.'}
        </p>
      )}

      <form className="manual-entry" onSubmit={submitManual}>
        <p className="picker-label">Or enter a token ID</p>
        <div className="manual-entry-row">
          <select value={manualCollection} onChange={(e) => setManualCollection(e.target.value)}>
            <option value="genesis">Genesis</option>
            <option value="generations">Generations</option>
          </select>
          <input
            type="number"
            min="0"
            placeholder="Token ID"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <button type="submit" className="btn-primary">Listen</button>
        </div>
      </form>

      {error && <p className="picker-error">{error}</p>}
    </div>
  );
}
