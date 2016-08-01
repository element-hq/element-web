# Electron wrapping

[Electron](http://electron.atom.io/), a framework for creating native applications with web technologies.

Electorn in vector-web, currently, is like a local webserver, which serves bundled `html` `css` and `js`, as well as other static resources. The communications are not affected.

### Up and Running

You would like to manually install [`electron-prebuilt`](https://www.npmjs.com/package/electron-prebuilt), since electron-prebuilt is 1) pretty large in size, and 2) loosely coupled with the repository.

```bash
npm install -g electron-prebuilt
```

Before running, you would just build the repo as usual

```bash
npm run build
```

then

```bash
# in repo's root directory
electron .
```

### Debugging

To open the devtools, you may comment out `mainWindow.setMenu(null)` in `vector/electron-entry.js` to restore menu bar and open devools from there.

```javascript
app.on('ready', () => {
        mainWindow = new BrowserWindow({ width: 800, height: 600 });
        // this line --> mainWindow.setMenu(null);

        mainWindow.loadURL("file://" + __dirname + "/index.html");

        mainWindow.on('closed', function () {
                mainWindow = null;
        });
});
```
