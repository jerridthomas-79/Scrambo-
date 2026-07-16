export const AVATARS = [
  { key: "sloth", label: "Sloth", emoji: "🦥" },
  { key: "jet", label: "Jet fighter", emoji: "✈️" },
  { key: "firepit", label: "Fire pit", emoji: "🔥" },
  { key: "orange-soda", label: "Orange soda", emoji: "🥤" },
  { key: "popsicle", label: "Outshine popsicle", emoji: "🍊" },
  { key: "peanut-butter-cup", label: "Peanut butter cup", emoji: "🍫" },
  { key: "golf", label: "Golf", emoji: "⛳" },
  { key: "sunglasses", label: "Cool shades", emoji: "😎" },
  { key: "rocket", label: "Rocket", emoji: "🚀" },
  { key: "tiki", label: "Tiki", emoji: "🗿" },
  { key: "wolf", label: "Wolf", emoji: "🐺" },
  { key: "crown", label: "Crown", emoji: "👑" },
] as const;

export type AvatarKey = (typeof AVATARS)[number]["key"];

export const DEFAULT_AVATAR: AvatarKey = "sloth";

export function avatarEmoji(key: string | null | undefined): string {
  return AVATARS.find((avatar) => avatar.key === key)?.emoji ?? AVATARS[0].emoji;
}
