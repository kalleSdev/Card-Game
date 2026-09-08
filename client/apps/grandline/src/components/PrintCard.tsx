import { useCallback, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { PrintId } from "@cg/meta";
import { PRINT_INFO } from "@cg/meta";
import "../design/card.css";

export interface CardFace {
  id: string;
  name: string;
  atk: number;
  hp: number;
  cost: number;
}

/** Base is deliberately flat. Everything above it catches the light. */
const CATCHES_LIGHT: Record<PrintId, boolean> = {
  base: false,
  foil: true,
  altArt: true,
  blackLabel: true,
  secret: true,
  signed: true,
};

/** How far the card leans toward the pointer, in degrees. */
const MAX_TILT = 7;

/**
 * Placeholder illustration until real art exists. The same card always gets the
 * same two colours, so a binder looks like a binder rather than noise.
 */
function artColors(id: string): { a: string; b: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    a: `hsl(${hue} 42% 26%)`,
    b: `hsl(${(hue + 40) % 360} 48% 12%)`,
  };
}

export default function PrintCard({
  card,
  print,
  width = 168,
  count,
  duplicate = false,
  interactive = true,
  onClick,
}: {
  card: CardFace;
  print: PrintId;
  width?: number;
  /** Shown top right when you hold more than one. */
  count?: number;
  /** Dims the card, for a duplicate in a pack opening. */
  duplicate?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const info = PRINT_INFO[print];
  const art = artColors(card.id);
  const ref = useRef<HTMLDivElement>(null);

  const lights = CATCHES_LIGHT[print] && interactive && !duplicate;

  // Written straight onto the node rather than through state: this fires on
  // every pointer move, and a re-render per frame would be wasteful.
  const onMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || !lights) return;
      const box = el.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      el.style.setProperty("--pc-mx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--pc-my", `${(y * 100).toFixed(1)}%`);
      el.style.transform =
        `rotateY(${((x - 0.5) * MAX_TILT * 2).toFixed(2)}deg) ` +
        `rotateX(${((0.5 - y) * MAX_TILT * 2).toFixed(2)}deg) ` +
        `translateY(-4px)`;
      el.classList.add("pc--tilting");
    },
    [lights],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("pc--tilting");
    el.style.transform = "";
    el.style.setProperty("--pc-mx", "50%");
    el.style.setProperty("--pc-my", "50%");
  }, []);

  const style = {
    "--pc-w": `${width}px`,
    "--pc-art-a": art.a,
    "--pc-art-b": art.b,
  } as CSSProperties;

  const classes = [
    "pc",
    `pc--${print}`,
    interactive ? "pc--interactive" : "",
    duplicate ? "pc--duplicate" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="pc-slot">
      <div
        ref={ref}
        className={classes}
        style={style}
        onClick={onClick}
        onPointerMove={lights ? onMove : undefined}
        onPointerLeave={lights ? onLeave : undefined}
      >
        <div className="pc__ribbon">
          {info.tier}
          {"★"} {info.name}
        </div>
        {count !== undefined && count > 1 && <div className="pc__count">{"×"}{count}</div>}

        <div className="pc__art">
          <div className="pc__art-fill" />
          <div className="pc__sun" />
          <div className="pc__horizon" />
          {print === "signed" && (
            <svg className="pc__signature" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M12 74 C 26 52, 34 84, 46 60 S 62 40, 70 62 C 76 76, 84 52, 92 44"
                fill="none"
                stroke="#F2ECDF"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.92"
              />
              <path d="M60 82 L 90 78" fill="none" stroke="#F2ECDF" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
            </svg>
          )}
        </div>

        <div className="pc__body">
          <div className="pc__name">{card.name}</div>
          <div className="pc__stats">
            <span>
              ATK <b>{card.atk}</b>
            </span>
            <span>
              HP <b>{card.hp}</b>
            </span>
            <span style={{ marginLeft: "auto" }}>
              <b>{card.cost}</b>
            </span>
          </div>
        </div>

        {lights && (
          <>
            <div className="pc__sheen" />
            <div className="pc__glare" />
          </>
        )}
      </div>
    </div>
  );
}
