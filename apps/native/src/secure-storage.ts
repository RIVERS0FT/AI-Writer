import type { SecureStorageService } from "@ai-writer/platform";
import { appDataDir } from "@tauri-apps/api/path";
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";

type StrongholdStore = ReturnType<Client["getStore"]>;

export function createSecureStorage(): SecureStorageService {
  let stronghold: Stronghold | undefined;
  let store: StrongholdStore | undefined;

  return {
    async unlock(password) {
      if (!password.trim()) throw new Error("密钥库密码不能为空");
      const vaultPath = `${await appDataDir()}/ai-writer-vault.hold`;
      const loaded = await Stronghold.load(vaultPath, password);
      let client: Client;
      try {
        client = await loaded.loadClient("ai-writer");
      } catch {
        client = await loaded.createClient("ai-writer");
      }
      stronghold = loaded;
      store = client.getStore();
    },

    isUnlocked() {
      return Boolean(stronghold && store);
    },

    async setSecret(key, value) {
      if (!stronghold || !store) throw new Error("密钥库尚未解锁");
      await store.insert(key, Array.from(new TextEncoder().encode(value)));
      await stronghold.save();
    },

    async getSecret(key) {
      if (!store) throw new Error("密钥库尚未解锁");
      const value = await store.get(key);
      if (!value) return null;
      return new TextDecoder().decode(new Uint8Array(value));
    },

    async removeSecret(key) {
      if (!stronghold || !store) throw new Error("密钥库尚未解锁");
      await store.remove(key);
      await stronghold.save();
    },
  };
}
