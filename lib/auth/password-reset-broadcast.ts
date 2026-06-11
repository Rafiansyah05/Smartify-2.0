export const PASSWORD_RESET_BROADCAST = "smartify-password-reset";

export function broadcastPasswordResetComplete() {
  if (typeof window === "undefined") return;
  try {
    const ch = new BroadcastChannel(PASSWORD_RESET_BROADCAST);
    ch.postMessage({ type: "PASSWORD_RESET_COMPLETE" });
    ch.close();
  } catch {
    /* BroadcastChannel tidak tersedia */
  }
}

export function onPasswordResetComplete(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  let ch: BroadcastChannel;
  try {
    ch = new BroadcastChannel(PASSWORD_RESET_BROADCAST);
    ch.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === "PASSWORD_RESET_COMPLETE") handler();
    };
  } catch {
    return () => {};
  }
  return () => ch.close();
}
