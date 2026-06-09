import { androidSetupText } from "../services/network/androidSetup";

interface Props {
  port: number;
  lanHost: string | null;
  onCopy: () => void;
}

export function NetworkPanel({ port, lanHost, onCopy }: Props) {
  const host = lanHost ?? "LAN IP not detected";
  const setup = lanHost ? androidSetupText(lanHost, port) : "Enable LAN sharing and refresh network info.";

  return (
    <section className="panel" aria-labelledby="network-heading">
      <p className="eyebrow">Network</p>
      <h2 id="network-heading">Device setup</h2>
      <div className="address-grid">
        <div>
          <strong>Local browser</strong>
          <code>127.0.0.1:{port}</code>
        </div>
        <div>
          <strong>LAN devices</strong>
          <code>{host}{lanHost ? `:${port}` : ""}</code>
        </div>
      </div>
      <h3>Android setup</h3>
      <pre className="setup-text">{setup}</pre>
      <button type="button" onClick={onCopy} disabled={!lanHost}>Copy Android setup</button>
    </section>
  );
}
