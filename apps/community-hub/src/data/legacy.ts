import "../../../../website/assets/beginner-guide-data.js";
import "../../../../website/assets/sbt-catalog.js";
import defaultCoverImage from "../../../../website/assets/renaiss-community-default-cover.jpg";
import renaissLogo from "../../../../website/assets/renaiss-logo-alpha-cropped.png";
import type { LegacyBeginnerData, LegacySbtRow } from "@/types";

const guideAssets = import.meta.glob("../../../../website/assets/beginner-guide/*", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

function fileName(value: string): string {
  return value.split("/").pop() ?? "";
}

function assetFor(value: string | undefined): string {
  const target = fileName(value ?? "");
  const match = Object.entries(guideAssets).find(([path]) => path.endsWith(`/${target}`));
  return match?.[1] ?? "";
}

export const assets = {
  defaultCoverImage,
  renaissLogo,
  guideAsset: assetFor,
};

export function beginnerGuideData(): LegacyBeginnerData {
  return window.BEGINNER_GUIDE_STATIC ?? {};
}

export function sbtCatalog(): readonly LegacySbtRow[] {
  return window.RENAISS_SBT_CATALOG ?? [];
}

export function sbtIconUrl(icon: string): string {
  const base = window.RENAISS_SBT_ICON_BASE;
  return base && icon ? `${base}${icon}` : "";
}
