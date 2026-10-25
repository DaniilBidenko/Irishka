/** Синхронизация вкладок через BroadcastChannel + revalidate on focus. */

const CHANNEL = "workbook-mutations";

export type SyncMessage = {
  type: "invalidate";
  keys?: string[];
  at: string;
};

type Listener = (msg: SyncMessage) => void;

let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev: MessageEvent<SyncMessage>) => {
      for (const l of listeners) l(ev.data);
    };
  }
  return channel;
}

export function publishMutation(keys?: string[]): void {
  const msg: SyncMessage = {
    type: "invalidate",
    keys,
    at: new Date().toISOString(),
  };
  getChannel()?.postMessage(msg);
}

export function subscribeMutations(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
