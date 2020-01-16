export function cleanLocalstorage() {
    window.localStorage.clear();
}

export function deleteIndexedDB(dbName) {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            resolve();
            return;
        }

        const startTime = Date.now();
        console.log(`${startTime}: Removing indexeddb instance: ${dbName}`);
        const req = window.indexedDB.deleteDatabase(dbName);

        req.onblocked = () => {
            console.log(`${Date.now()}: can't yet delete indexeddb ${dbName} because it is open elsewhere`);
        };

        req.onerror = (ev) => {
            reject(new Error(
                `${Date.now()}: unable to delete indexeddb ${dbName}: ${ev.target.error}`,
            ));
        };

        req.onsuccess = () => {
            const now = Date.now();
            console.log(`${now}: Removed indexeddb instance: ${dbName} in ${now-startTime} ms`);
            resolve();
        };
    }).catch((e) => {
        console.error(`${Date.now()}: Error removing indexeddb instance ${dbName}: ${e}`);
        throw e;
    });
}

export function sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}
