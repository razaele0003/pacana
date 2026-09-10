import { defaults, type State } from "../core/model";
import { parseBackup } from "./backup";
let connection: Promise<IDBDatabase> | undefined;
function db() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open("pacana", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("state"))
          request.result.createObjectStore("state");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        connection = undefined;
        reject(
          new Error(
            "Local storage could not open. Enable browser storage and try again.",
          ),
        );
      };
      request.onblocked = () =>
        reject(
          new Error("Close other Pacana tabs to finish updating storage."),
        );
    });
  return connection;
}
// A single read/write transaction serializes all tabs; mutations always read the latest state.
export async function transact<T>(
  change: (state: State) => T,
): Promise<{ state: State; result: T }> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    const request = store.get("main");
    let state: State, result: T, failure: unknown;
    request.onsuccess = () => {
      try {
        state = request.result
          ? parseBackup(request.result)
          : defaults(Intl.DateTimeFormat().resolvedOptions().timeZone);
        const before = JSON.stringify(state);
        result = change(state);
        if (!request.result || JSON.stringify(state) !== before) {
          state.revision++;
          state = parseBackup(state);
          store.put(state, "main");
        }
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve({ state, result });
    tx.onerror = tx.onabort = () =>
      reject(
        failure ||
          new Error(
            "Changes could not be saved. Your previous data is preserved. Check available browser storage.",
          ),
      );
  });
}
export async function restore(state: State) {
  const validated = parseBackup(state);
  return transact((s) => {
    Object.assign(s, validated);
  });
}
