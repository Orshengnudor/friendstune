import { Link } from "wouter";
import { engine } from "../lib/audio";
import { useEngine } from "../lib/hooks";
import { player, useNowPlaying } from "../lib/player";
import { COLLECTION_LABEL } from "../lib/chain";
import { PixelArt, Tag } from "./kit";
import { Scope, StepLamps, Vu } from "./visuals";

/**
 * The cassette deck. Always mounted at the bottom of the shell so a tune keeps
 * running while you browse.
 */
export function Deck() {
  const { friend, comp, queue } = useNowPlaying();
  const { status, step, volume } = useEngine();
  const playing = status !== "idle";

  if (!friend || !comp) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-6">
          <span className="micro">deck empty</span>
          <span className="data text-[11px] text-ink-dim/70">
            pick a Friend, nothing plays until you press play
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/94 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-2.5 pb-4 sm:px-6 md:h-[86px] md:flex-row md:items-center md:gap-5 md:py-0 md:pb-0">
        {/* now playing */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={`/f/${friend.collection}/${friend.tokenId}`} className="shrink-0">
            <PixelArt
              src={friend.imageDataUri}
              alt={friend.name}
              tone={friend.collection}
              className="size-12"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/f/${friend.collection}/${friend.tokenId}`}
              className="font-display block truncate text-sm text-ink hover:text-teal"
            >
              {friend.name}
            </Link>
            <div className="data flex items-center gap-2 truncate text-[10px] text-ink-dim">
              <span>{COLLECTION_LABEL[friend.collection]}</span>
              <span className="text-line">/</span>
              <span>
                {comp.rootName} {comp.scaleName}
              </span>
              <span className="text-line">/</span>
              <span>{comp.bpm} BPM</span>
              {queue && (
                <>
                  <span className="text-line">/</span>
                  <span className="text-teal/80">{queue.label}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* transport */}
        <div className="flex items-center gap-2">
          {queue?.prev && (
            <button
              onClick={queue.prev}
              title="Previous"
              className="press flex size-9 items-center justify-center rounded-[4px] border border-line bg-panel-2 text-ink-dim hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 1h1.6v10H3zM10 1v10L5 6z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => (playing ? player.stop() : void player.start(friend, comp))}
            title={playing ? "Stop" : "Play"}
            className="press flex size-11 items-center justify-center rounded-[4px] border border-teal/50 bg-teal/14 text-teal hover:bg-teal/22"
          >
            {status === "starting" ? (
              <span className="ft-spin block size-4 rounded-full border-2 border-teal/30 border-t-teal" />
            ) : playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="2" width="10" height="10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5v11l9-5.5z" />
              </svg>
            )}
          </button>
          {queue?.next && (
            <button
              onClick={queue.next}
              title="Next"
              className="press flex size-9 items-center justify-center rounded-[4px] border border-line bg-panel-2 text-ink-dim hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M9 1h1.6v10H9zM2 1v10l5-5z" />
              </svg>
            </button>
          )}
        </div>

        {/* meters */}
        <div className="hidden w-[190px] shrink-0 flex-col gap-1.5 lg:flex">
          <Scope active={playing} height={30} />
          <Vu active={playing} />
        </div>

        <div className="hidden w-[150px] shrink-0 flex-col gap-1.5 xl:flex">
          <span className="micro">kick / hat</span>
          <StepLamps values={comp.kick} step={step} playing={playing} />
          <StepLamps values={comp.hat} step={step} playing={playing} tone="amber" />
        </div>

        {/* volume */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="micro hidden sm:block">vol</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => engine.setVolume(Number(e.target.value) / 100)}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-line accent-teal [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal"
          />
          {comp.unstable && (
            <Tag tone="violet" className="hidden sm:inline-flex">
              temporary
            </Tag>
          )}
        </div>
      </div>
    </div>
  );
}
