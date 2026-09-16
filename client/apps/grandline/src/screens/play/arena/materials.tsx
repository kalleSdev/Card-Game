/**
 * The board's materials.
 *
 * Four greyscale textures, each turned into an SVG pattern that any shape on
 * the board can be filled with. They carry no colour of their own: they are
 * laid over a surface that has already been tinted by the theme, so the same
 * wood is bone, slate or candy depending on which table you are playing on.
 *
 * Every pattern is mirror tiled.
 *
 * None of the four supplied textures is seamless — measured against their own
 * pixel to pixel noise, the step across a tile boundary is three to sixteen
 * times larger than the material's own grain, which on a surface the size of
 * this board would draw a visible line at every repeat. A mirror tile solves
 * that without touching the files: each tile is drawn four times in a two by
 * two block, flipped in x, in y, and in both, so every edge meets its own
 * reflection and the step is gone by construction. The cost is a symmetry in
 * the pattern, which at these scales reads as grain rather than as a mirror.
 *
 * Tile sizes are in stage units, chosen so the material reads at a believable
 * size on an object this big rather than at whatever size the file happens to
 * be. The battlefield's block is deliberately larger than the battlefield, so
 * the surface a player stares at all game has no repeat in it at all.
 */

export type MaterialName = "wood" | "stone" | "brass" | "parchment";

/**
 * How many stage units one tile of each texture covers.
 *
 * Wood is the structural body, so its grain is the largest: two planks span
 * the board, and the one knot in the tile lands on the rim's far band, under
 * the stone, rather than repeating nine times across the wood the way it did
 * at a third of that size — which was the one thing that made the board read
 * as a tiled background rather than as a plank. Stone sits on pieces small enough to
 * take under a tile each. Brass runs along narrow trim, so it is finer. The
 * parchment block is 1400 units against a 948 by 520 battlefield, which means
 * the play surface is inside a single block and cannot repeat.
 */
export const MATERIAL_TILE: Record<MaterialName, number> = {
  wood: 620,
  stone: 240,
  brass: 170,
  parchment: 700,
};

/**
 * How strongly each material is allowed to show, and how it is mixed in.
 *
 * The play surface is the quietest thing on the board because cards sit on it
 * and it must not compete with them. Stone used to be the loudest, when it
 * was only two small blocks meant to look rough; now it is the whole frame
 * and both stations, and at that size the tile's own dark patches read as
 * dirt on a panel rather than grain, so it is mixed more quietly. Brass is
 * mixed softly so it reads as aged metal picking up the lamp rather than as
 * grey stone.
 */
export const MATERIAL_MIX: Record<MaterialName, { opacity: number; blend: "overlay" | "soft-light" }> = {
  wood: { opacity: 0.74, blend: "overlay" },
  stone: { opacity: 0.58, blend: "overlay" },
  brass: { opacity: 0.5, blend: "soft-light" },
  parchment: { opacity: 0.32, blend: "soft-light" },
};

const NAMES: MaterialName[] = ["wood", "stone", "brass", "parchment"];

/** The id a shape fills itself with. */
export function materialFill(name: MaterialName): string {
  return `url(#mat-${name})`;
}

/**
 * The pattern definitions, dropped into a defs block once per SVG that uses
 * them. Both board layers declare their own, because a pattern is looked up by
 * id within the document and two boards are never on screen at once.
 */
export default function Materials({ only }: { only?: MaterialName[] }) {
  const wanted = only ?? NAMES;

  return (
    <>
      {wanted.map(name => {
        const tile = MATERIAL_TILE[name];
        const block = tile * 2;
        const href = `/arena/${name}.webp`;

        return (
          <pattern
            key={name}
            id={`mat-${name}`}
            patternUnits="userSpaceOnUse"
            width={block}
            height={block}
          >
            {/* Four flips of the same tile. A negative scale puts the image on
                the far side of the origin, so each one is translated back by a
                whole block to land in its own quarter. */}
            <image href={href} x={0} y={0} width={tile} height={tile} preserveAspectRatio="none" />
            <image
              href={href}
              x={0}
              y={0}
              width={tile}
              height={tile}
              preserveAspectRatio="none"
              transform={`translate(${block} 0) scale(-1 1)`}
            />
            <image
              href={href}
              x={0}
              y={0}
              width={tile}
              height={tile}
              preserveAspectRatio="none"
              transform={`translate(0 ${block}) scale(1 -1)`}
            />
            <image
              href={href}
              x={0}
              y={0}
              width={tile}
              height={tile}
              preserveAspectRatio="none"
              transform={`translate(${block} ${block}) scale(-1 -1)`}
            />
          </pattern>
        );
      })}
    </>
  );
}
