// Franja de marca Coreintel — eco del swirl multicolor del logo.
// 4px de alto, edge-to-edge, va arriba de todo (antes del header).
// Spec: ~/.claude/skills/coreintel-brand/SKILL.md → "Franja de marca"

export function BrandBar() {
  return (
    <div
      aria-hidden="true"
      className="h-1 w-full"
      style={{
        background:
          'linear-gradient(90deg, #0cc1d1 0%, #41aafd 22%, #4b457b 42%, #ff910e 64%, #ffc00d 82%, #b4d70e 100%)',
      }}
    />
  );
}
