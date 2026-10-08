declare module "*limited-pack-sbt.js" {
  type LimitedPackSbtSnapshot = import("./limitedPackSbt").LimitedPackSbtSnapshot;
  type PackSbtCampaign = import("./limitedPackSbt").PackSbtCampaign;
  type PackSbtBadge = import("./limitedPackSbt").PackSbtBadge;
  type FeedCard = import("../types").FeedCard;
  type Language = import("../types").Language;
  export const limitedPackSbtCopy: Record<Language, Record<string, string>>;
  export interface PackSbtTask {
    key: string;
    name: string;
    category: "first_pull" | "s_card";
    pack_name: string;
    acquisition: string;
    official: PackSbtBadge | null;
  }
  export function packSbtPair(pack: PackSbtCampaign, lang: Language): PackSbtTask[];
  export function packDateTime(value: string | null, lang: Language): string;
  export function validPackSnapshot(value: unknown): value is LimitedPackSbtSnapshot;
  export function taipeiWeek(reference: Date): [number, number];
  export function packInCurrentWindow(pack: PackSbtCampaign, reference: Date): boolean;
  export function weeklyPackCampaigns(snapshot: LimitedPackSbtSnapshot, officialCards: FeedCard[], reference?: Date): PackSbtCampaign[];
}
