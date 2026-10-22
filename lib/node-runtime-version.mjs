const loggedFunctions = new Set();

// Keep runtime evidence in Vercel logs, without exposing it in HTTP responses.
export function logNodeRuntimeVersion(functionName) {
  if (process.env.VERCEL !== '1' || loggedFunctions.has(functionName)) return;
  loggedFunctions.add(functionName);
  console.info(JSON.stringify({
    event: 'node_runtime_version',
    function: functionName,
    node: process.version,
    versions: {
      ares: process.versions.ares,
      brotli: process.versions.brotli,
      openssl: process.versions.openssl,
      undici: process.versions.undici,
    },
  }));
}
