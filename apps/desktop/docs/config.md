# Configuration

All Element Web options documented [here](https://github.com/vector-im/element-web/blob/develop/docs/config.md) can be used as well as the following:

---

The app contains a configuration file specified at build time using [these instructions](https://github.com/vector-im/element-desktop/#config).
This config can be overwritten by the end using by creating a `config.json` file at the paths described [here](https://github.com/vector-im/element-desktop/#user-specified-configjson).

After changing the config, the app will need to be exited fully (including via the task tray) and re-started.

---

1. `update_base_url`: Specifies the URL of the update server, see [document](https://github.com/vector-im/element-desktop/blob/develop/docs/updates.md).
2. `web_base_url`: Specifies the Element Web URL when performing actions such as popout widget. Defaults to `https://app.element.io/`.
