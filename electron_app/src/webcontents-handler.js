const {clipboard, nativeImage, Menu, MenuItem, shell} = require('electron');
const url = require('url');

let webContents;

const PERMITTED_URL_SCHEMES = [
    'http:',
    'https:',
    'mailto:',
];

function safeOpenURL(target) {
    // openExternal passes the target to open/start/xdg-open,
    // so put fairly stringent limits on what can be opened
    // (for instance, open /bin/sh does indeed open a terminal
    // with a shell, albeit with no arguments)
    const parsedUrl = url.parse(target);
    if (PERMITTED_URL_SCHEMES.indexOf(parsedUrl.protocol) > -1) {
        // explicitly use the URL re-assembled by the url library,
        // so we know the url parser has understood all the parts
        // of the input string
        const newTarget = url.format(parsedUrl);
        shell.openExternal(newTarget);
    }
}

function onWindowOrNavigate(ev, target) {
    // always prevent the default: if something goes wrong,
    // we don't want to end up opening it in the electron
    // app, as we could end up opening any sort of random
    // url in a window that has node scripting access.
    ev.preventDefault();
    safeOpenURL(target);
}

function onLinkContextMenu(ev, params) {
    const url = params.linkURL || params.srcURL;

    const popupMenu = new Menu();
    popupMenu.append(new MenuItem({
        label: url,
        click() {
            safeOpenURL(url);
        },
    }));

    if (params.mediaType && params.mediaType === 'image' && !url.startsWith('file://')) {
        popupMenu.append(new MenuItem({
            label: 'Copy Image',
            click() {
                if (url.startsWith('data:')) {
                    clipboard.writeImage(nativeImage.createFromDataURL(url));
                } else {
                    ev.sender.copyImageAt(params.x, params.y);
                }
            },
        }));
    }

    popupMenu.append(new MenuItem({
        label: 'Copy Link Address',
        click() {
            clipboard.writeText(url);
        },
    }));
    popupMenu.popup();
    ev.preventDefault();
}

function _CutCopyPasteSelectContextMenus(params) {
    return [{
        role: 'cut',
        enabled: params.editFlags.canCut,
    }, {
        role: 'copy',
        enabled: params.editFlags.canCopy,
    }, {
        role: 'paste',
        enabled: params.editFlags.canPaste,
    }, {
        role: 'pasteandmatchstyle',
        enabled: params.editFlags.canPaste,
    }, {
        role: 'selectall',
        enabled: params.editFlags.canSelectAll,
    }];
}

function onSelectedContextMenu(ev, params) {
    const items = _CutCopyPasteSelectContextMenus(params);
    const popupMenu = Menu.buildFromTemplate(items);

    popupMenu.popup();
    ev.preventDefault();
}

function onEditableContextMenu(ev, params) {
    const items = [
        { role: 'undo' },
        { role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
    ].concat(_CutCopyPasteSelectContextMenus(params));

    const popupMenu = Menu.buildFromTemplate(items);

    popupMenu.popup();
    ev.preventDefault();
}


module.exports = (_webContents) => {
    webContents = _webContents;

    webContents.on('new-window', onWindowOrNavigate);
    webContents.on('will-navigate', onWindowOrNavigate);

    webContents.on('context-menu', function(ev, params) {
        if (params.linkURL || params.srcURL) {
            onLinkContextMenu(ev, params);
        } else if (params.selectionText) {
            onSelectedContextMenu(ev, params);
        } else if (params.isEditable) {
            onEditableContextMenu(ev, params);
        }
    });
};
