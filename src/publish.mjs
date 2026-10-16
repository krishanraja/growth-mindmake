export async function handoff(batch, remote) {
  // The remote adapter persists drafts and readbacks only. It cannot send a message.
  return remote.commit(batch);
}
