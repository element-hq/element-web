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

const { ipcRenderer, webFrame, remote } = require('electron');
const { Menu, getCurrentWindow } = remote;
window.ipcRenderer = ipcRenderer;

const standardMenus = [
    {
        label: 'Undo',
        role: 'undo',
        accelerator: 'CommandOrControl+Z',
    },
    {
        label: 'Redo',
        role: 'redo',
        accelerator: process.platform === 'win32' ? 'Control+Y' : 'CommandOrControl+Shift+Z',
    },
    {
        type: 'separator',
    },
    {
        label: 'Cut',
        role: 'cut',
        accelerator: 'CommandOrControl+X',
    },
    {
        label: 'Copy',
        role: 'copy',
        accelerator: 'CommandOrControl+C',
    },
    {
        label: 'Paste',
        role: 'paste',
        accelerator: 'CommandOrControl+V',
    },
    {
        label: 'Select All',
        role: 'selectall',
        accelerator: 'CommandOrControl+A',
    },
];

// Allow the fetch API to load resources from this
// protocol: this is necessary to load olm.wasm.
// (Also mark it a secure although we've already
// done this in the main process).
webFrame.registerURLSchemeAsPrivileged('vector', {
    secure: true,
    supportFetchAPI: true,
});

window.addEventListener('contextmenu', (event) => {
    if (event.target.isContentEditable) {
        event.preventDefault();
        //TODO: send event 'spellchec' to host with text

        ipcRenderer.send('spellcheck:getcontextmenu', window.getSelection().toString());
    }
});
//TODO: build context menu

// ipcRenderer.on('spellcheck: getcontextmenu', (event, arg) => {
//     console.log('IPC', 'getcontextmenu', arg);

// });
ipcRenderer.send('spellcheck:setlanguage', window.navigator.language);
ipcRenderer.on('spellcheck:getcontextmenu:result', (event, arg) => {
    const menu = Menu.buildFromTemplate(standardMenus.concat(arg));
        menu.popup({ window: getCurrentWindow() });
})
