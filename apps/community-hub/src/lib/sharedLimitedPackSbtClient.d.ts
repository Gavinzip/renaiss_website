declare module "*limited-pack-sbt-client.js" {
  type LimitedPackSbtSnapshot = import("./limitedPackSbt").LimitedPackSbtSnapshot;
  export function subscribePackSnapshot(url: string, onChange: (snapshot: LimitedPackSbtSnapshot) => void): () => void;
}
