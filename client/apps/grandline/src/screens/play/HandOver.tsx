import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import { Button, Panel, Text } from "../../components/primitives";

/**
 * The screen between two people sharing one keyboard.
 *
 * A local game only works if the person about to play has not just watched the
 * other one draft. So the board goes away, the screen says whose turn it is,
 * and nothing comes back until they say they are looking. It is the same thing
 * you do with a board game when you hand someone the cards face down.
 */

export default function HandOver({ seat, note, onReady, onLeave }: {
  /** Who the keyboard is going to, as they are named on the board. */
  seat: string;
  /** What they are about to do. */
  note: string;
  onReady: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: `
          radial-gradient(1100px 620px at 50% -8%, rgba(62,143,160,0.09), transparent 68%),
          ${COLOR.abyss}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE.xl,
      }}
    >
      <Panel padding={SPACE.xxl} style={{ width: 420, textAlign: "center" }}>
        <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>Pass the keyboard</span>

        <div style={{ marginTop: SPACE.sm }}>
          <Text as="h2" role="display">{seat}</Text>
        </div>

        <p
          style={{
            ...text("body"),
            color: COLOR.mist,
            margin: `${SPACE.md}px auto ${SPACE.xl}px`,
            maxWidth: 300,
          }}
        >
          {note}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
            paddingTop: SPACE.lg,
            borderTop: `1px solid ${COLOR.rope}`,
            borderRadius: RADIUS.sm,
          }}
        >
          <Button tone="primary" full onClick={onReady}>I am looking</Button>
          <Button tone="ghost" size="sm" full onClick={onLeave}>Leave</Button>
        </div>
      </Panel>
    </div>
  );
}
