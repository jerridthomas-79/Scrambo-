const AVATARS = {
  sloth: { emoji: "🦥", label: "Sloth" },
  jet: { emoji: "✈️", label: "Jet fighter" },
  firepit: { emoji: "🔥", label: "Fire pit" },
  soda: { emoji: "🥤", label: "Orange soda" },
  popsicle: { emoji: "🍊", label: "Outshine popsicle" },
  reeses: { emoji: "🍫", label: "Peanut butter cup" },
  golf: { emoji: "⛳", label: "Golf" },
  sunglasses: { emoji: "😎", label: "Sunglasses" },
  rocket: { emoji: "🚀", label: "Rocket" },
  tiki: { emoji: "🗿", label: "Tiki" },
  wolf: { emoji: "🐺", label: "Wolf" },
  crown: { emoji: "👑", label: "Crown" },
} as const;

export type AvatarKey = keyof typeof AVATARS;
export const avatarOptions = Object.entries(AVATARS).map(([key, value]) => ({ key: key as AvatarKey, ...value }));

export function Avatar({ avatarKey, size = "medium" }: { avatarKey?: string | null; size?: "small" | "medium" | "large" }) {
  const avatar = AVATARS[(avatarKey as AvatarKey) ?? "sloth"] ?? AVATARS.sloth;
  return <span className={`avatar avatar--${size}`} role="img" aria-label={avatar.label}>{avatar.emoji}</span>;
}
