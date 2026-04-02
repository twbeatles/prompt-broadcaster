export function createChromeMock({ grantedOrigins = [], requestGrantsMissingOrigins = true } = {}) {
  const localStorage = {};
  const sessionStorage = {};
  const alarms = {};
  const granted = new Set(grantedOrigins);

  function createStorageArea(store) {
    return {
      async get(key) {
        if (typeof key === "string") {
          return { [key]: store[key] };
        }

        if (Array.isArray(key)) {
          return Object.fromEntries(key.map((entry) => [entry, store[entry]]));
        }

        if (key && typeof key === "object") {
          return Object.fromEntries(
            Object.entries(key).map(([entryKey, fallbackValue]) => [
              entryKey,
              store[entryKey] ?? fallbackValue,
            ]),
          );
        }

        return { ...store };
      },
      async set(nextValue) {
        Object.assign(store, nextValue ?? {});
      },
      async remove(key) {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((entry) => {
          delete store[entry];
        });
      },
    };
  }

  return {
    __getGrantedOrigins() {
      return [...granted].sort();
    },
    __getStorage() {
      return {
        local: { ...localStorage },
        session: { ...sessionStorage },
      };
    },
    __getAlarms() {
      return { ...alarms };
    },
    storage: {
      local: createStorageArea(localStorage),
      session: createStorageArea(sessionStorage),
    },
    permissions: {
      async contains(permission) {
        const origins = Array.isArray(permission?.origins) ? permission.origins : [];
        return origins.every((origin) => granted.has(origin));
      },
      async request(permission) {
        const origins = Array.isArray(permission?.origins) ? permission.origins : [];
        if (!requestGrantsMissingOrigins) {
          return false;
        }

        origins.forEach((origin) => granted.add(origin));
        return true;
      },
      async remove(permission) {
        const origins = Array.isArray(permission?.origins) ? permission.origins : [];
        origins.forEach((origin) => granted.delete(origin));
        return true;
      },
    },
    i18n: {
      getMessage() {
        return "";
      },
    },
    alarms: {
      clear(name) {
        const key = String(name ?? "");
        const existed = Object.prototype.hasOwnProperty.call(alarms, key);
        delete alarms[key];
        return existed;
      },
      create(name, value) {
        alarms[String(name ?? "")] = value ?? {};
      },
    },
  };
}
