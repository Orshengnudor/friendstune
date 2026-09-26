export default function ScanBay({ friend, pending }) {
  return (
    <div className="scan-bay">
      <div className={`scan-frame ${pending ? 'scan-frame-pending' : 'scan-frame-active'}`}>
        {friend?.image ? (
          <img src={friend.image} alt={friend.name} className="scan-portrait" />
        ) : (
          <div className="scan-portrait scan-portrait-empty" />
        )}
        <div className="scan-line" />
      </div>
      {pending && <p className="scan-caption">reading on-chain data...</p>}
    </div>
  );
}
