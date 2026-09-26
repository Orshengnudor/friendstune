import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { playComposition, stopComposition, renderCompositionToWav } from '../lib/music';
import { downloadShareCard } from './ShareCard';
import { downloadBlob } from '../lib/download';

export default function Player({ friend, composition, onBack }) {
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const [playState, setPlayState] = useState('idle'); // idle | playing | done
  const [beat, setBeat] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    const analyser = new Tone.Analyser('waveform', 256);
    Tone.getDestination().connect(analyser);
    analyserRef.current = analyser;
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      analyser.dispose();
      stopComposition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (canvas && analyser) {
      const ctx = canvas.getContext('2d');
      const values = analyser.getValue();
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#5EEAD4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = (i / values.length) * w;
        const y = h / 2 + v * h * 0.45;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    rafRef.current = requestAnimationFrame(draw);
  }

  async function handlePlay() {
    setPlayState('playing');
    const duration = await playComposition(composition, (step) => setBeat(step));
    setTimeout(() => setPlayState('done'), duration * 1000);
  }

  function handleStop() {
    stopComposition();
    setPlayState('idle');
  }

  async function handleDownload() {
    setRendering(true);
    setDownloadError(null);
    try {
      const blob = await renderCompositionToWav(composition);
      downloadBlob(blob, `${friend.collection}-${friend.tokenId}-friendstune.wav`);
    } catch (err) {
      console.error('WAV render failed:', err);
      setDownloadError(err.message || 'Could not render the audio file.');
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="player">
      <canvas ref={canvasRef} width={480} height={100} className="oscilloscope" />

      <div className="player-controls">
        {playState !== 'playing' ? (
          <button className="btn-primary" onClick={handlePlay}>
            {playState === 'done' ? 'Play again' : 'Play'}
          </button>
        ) : (
          <button className="btn-secondary" onClick={handleStop}>Stop</button>
        )}
        <button className="btn-secondary" onClick={handleDownload} disabled={rendering}>
          {rendering ? 'Rendering...' : 'Download'}
        </button>
        <button className="btn-secondary" onClick={() => downloadShareCard(friend, composition)}>
          Share card
        </button>
        <span className={`beat-dot ${playState === 'playing' ? 'beat-dot-live' : ''}`} style={{ '--beat': beat }} />
      </div>

      {downloadError && <p className="picker-error">{downloadError}</p>}

      <button className="btn-link" onClick={onBack}>Choose a different Friend</button>
    </div>
  );
}
