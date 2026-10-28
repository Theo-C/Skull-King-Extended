// Collection de cartes (docs/boosters/SPEC.md) : variantes visuelles, purement esthétiques, partagées par le serveur
// et le site. Le moteur de jeu ne les connaît pas.

/** Les 8 variantes, de la plus commune à la plus rare. Standard est possédée par tout le monde. */
export const VARIANTS = ['std', 'patine', 'etain', 'holo', 'vivante', 'nacre', 'signee', 'numero'] as const;
export type Variant = typeof VARIANTS[number];
export const isVariant = (v: unknown): v is Variant => typeof v === 'string' && (VARIANTS as readonly string[]).includes(v);
