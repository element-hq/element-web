/*
Copyright 2016 OpenMarket Ltd

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

const {app, shell, Menu} = require('electron');

// Menu template from http://electron.atom.io/docs/api/menu/, edited
const template = [
    {
        label: '&Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'pasteandmatchstyle' },
            { role: 'delete' },
            { role: 'selectall' },
        ],
    },
    {
        label: '&View',
        submenu: [
            { type: 'separator' },
            { role: 'resetzoom' },
            { role: 'zoomin', accelerator: 'CommandOrControl+=' },
            { role: 'zoomout' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
            { role: 'toggledevtools' },
        ],
    },
    {
        label: '&Window',
        role: 'window',
        submenu: [
            { role: 'minimize' },
            { role: 'close' },
        ],
    },
    {
        label: '&Help',
        role: 'help',
        submenu: [
            {
                label: 'riot.im',
                click() { shell.openExternal('https://riot.im/'); },
            },
        ],
    },
];

// macOS has specific menu conventions...
if (process.platform === 'darwin') {
    // first macOS menu is the name of the app
    const name = app.getName();
    template.unshift({
        label: name,
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
                role: 'services',
                submenu: [],
            },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
        ],
    });
    // Edit menu.
    // This has a 'speech' section on macOS
    template[1].submenu.push(
        { type: 'separator' },
        {
            label: 'Speech',
            submenu: [
                { role: 'startspeaking' },
                { role: 'stopspeaking' },
            ],
        });

    // Window menu.
    // This also has specific functionality on macOS
    template[3].submenu = [
        {
            label: 'Close',
            accelerator: 'CmdOrCtrl+W',
            role: 'close',
        },
        {
            label: 'Minimize',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize',
        },
        {
            label: 'Zoom',
            role: 'zoom',
        },
        {
            type: 'separator',
        },
        {
            label: 'Bring All to Front',
            role: 'front',
        },
    ];
} else {
    template.unshift({
        label: '&File',
        submenu: [
            // For some reason, 'about' does not seem to work on windows.
            /*{
                role: 'about'
            },*/
            { role: 'quit' },
        ],
    });
}

module.exports = Menu.buildFromTemplate(template);

