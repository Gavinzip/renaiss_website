import { createElement } from "react";

interface IconProps {
  className?: string;
  name: string;
}

export function Icon({ className, name }: IconProps) {
  return createElement("iconify-icon", { "aria-hidden": "true", class: className, icon: `lucide:${name}` });
}
