/**
 * Module-level replace session so SELECT REPLACEMENT survives PlayerDetail
 * stack pushes (component blur/remount must not drop the outgoing player).
 */

let session = null;

export function startReplaceSession({ replacingPlayer, filterPosition, replaceToken }) {
  session = {
    replacingPlayer,
    filterPosition: filterPosition ?? null,
    replaceToken,
  };
}

export function getReplaceSession() {
  return session;
}

export function clearReplaceSession() {
  session = null;
}
