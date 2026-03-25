# Configuration

All Element Web options documented [here](https://github.com/vector-im/element-web/blob/develop/docs/config.md) can be used as well as the following:

---

The app contains a configuration file specified at build time using [these instructions](https://github.com/element-hq/element-web/blob/develop/apps/desktop/README.md#config).
This config can be overwritten by the end using by creating a `config.json` file at the paths described [here](https://github.com/element-hq/element-web/blob/develop/apps/desktop/README.md#user-specified-configjson).

After changing the config, the app will need to be exited fully (including via the task tray) and re-started.

---

1. `update_base_url`: Specifies the URL of the update server, see [document](https://github.com/element-hq/element-web/blob/develop/apps/desktop/docs/updates.md).
2. `web_base_url`: Specifies the Element Web URL when performing actions such as popout widget. Defaults to `https://app.element.io/`.
