import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import FriendPicker from './components/FriendPicker';
import ScanBay from './components/ScanBay';
import TraitReadout from './components/TraitReadout';
import SpecSheet from './components/SpecSheet';
import Player from './components/Player';
import { verifyOwnership, getFriendData } from './lib/friends';
import { deriveComposition } from './lib/music';

export default function App() {
  const { address, isConnected } = useAccount();
  const [stage, setStage] = useState('pick'); // pick | scanning | denied | ready
  const [friendData, setFriendData] = useState(null);
  const [composition, setComposition] = useState(null);
  const [error, setError] = useState(null);

  const selectFriend = useCallback(async (collection, tokenId) => {
    setError(null);
    setStage('scanning');
    setFriendData(null);
    setComposition(null);

    const owns = await verifyOwnership(collection, tokenId, address);
    if (owns !== true) {
      setStage('denied');
      return;
    }

    try {
      const data = await getFriendData(collection, tokenId);
      setFriendData(data);
      setComposition(deriveComposition(data));
      setStage('ready');
    } catch (err) {
      setError(err.message || 'Could not read this Friend from the chain.');
      setStage('pick');
    }
  }, [address]);

  const reset = useCallback(() => {
    setStage('pick');
    setFriendData(null);
    setComposition(null);
    setError(null);
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="wordmark">
          FRIENDS<span className="wordmark-accent">TUNE</span>
        </div>
        <ConnectKitButton />
      </header>

      <main className="stage">
        {!isConnected && (
          <div className="empty-state">
            <p className="empty-state-lead">Connect a wallet to see your Friends.</p>
            <p className="empty-state-sub">Ownership decides which tunes you can hear. Nothing gets signed or spent, this only reads.</p>
          </div>
        )}

        {isConnected && stage === 'pick' && (
          <FriendPicker address={address} onSelect={selectFriend} error={error} />
        )}

        {isConnected && stage === 'scanning' && <ScanBay pending />}

        {isConnected && stage === 'denied' && (
          <div className="empty-state">
            <p className="empty-state-lead">That Friend isn't in this wallet.</p>
            <p className="empty-state-sub">Ownership is checked live on-chain, not cached. Try another ID, or pick one from the list.</p>
            <button className="btn-secondary" onClick={reset}>Back</button>
          </div>
        )}

        {isConnected && stage === 'ready' && friendData && (
          <div className="result-layout">
            <div className="result-media">
              <ScanBay friend={friendData} />
              <Player friend={friendData} composition={composition} onBack={reset} />
            </div>
            <div className="result-data">
              <TraitReadout friend={friendData} />
              <SpecSheet composition={composition} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
