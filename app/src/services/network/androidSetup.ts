export function androidSetupText(host: string, port: number): string {
  return [`Proxy hostname: ${host}`, `Proxy port: ${port}`, "Install CA from: http://mitm.it"].join("\n");
}
