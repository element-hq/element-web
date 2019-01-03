/*
Copyright 2018 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

async function migrateFromOldOrigin() {
    console.log("Attempting to migrate data between origins");

    // We can use the same preload script: we just need ipcRenderer exposed
    const preloadScript = path.normalize(`${__dirname}/preload.js`);
    await new Promise(resolve => {
        const migrateWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                preload: preloadScript,
                nodeIntegration: false,
                sandbox: true,
                enableRemoteModule: false,
                webgl: false,
            },
        });
        ipcMain.on('origin_migration_complete', (e, success, sentSummary, storedSummary) => {
            if (success) {
                console.log("Origin migration completed successfully!");
            } else {
                console.error("Origin migration failed!");
            }
            console.error("Data sent", sentSummary);
            console.error("Data stored", storedSummary);
            migrateWindow.close();
            resolve();
        });
        ipcMain.on('origin_migration_nodata', (e) => {
            console.log("No session to migrate from old origin");
            migrateWindow.close();
            resolve();
        });
        // Normalise the path because in the distribution, __dirname will be inside the
        // electron asar.
        const sourcePagePath = path.normalize(__dirname + '/../../origin_migrator/source.html');
        console.log("Loading path: " + sourcePagePath);
        migrateWindow.loadURL('file://' + sourcePagePath);
    });
}

module.exports = {
    migrateFromOldOrigin,
};
