/**
 * Community Hub and its backend are deployed together, so API requests always
 * stay on the origin serving the current Hub. Local development keeps working
 * through Vite's same-origin API proxy.
 */
export function intelApiUrl(path: string): string {
  return path;
}
