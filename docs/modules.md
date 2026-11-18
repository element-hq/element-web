# Modules

Element Web (or Desktop) can be extended via 'Modules'. These are Javascript
scripts which are dynamically loaded at runtime by Element-Web.

A number of modules are included in the [element-web git
repository](https://github.com/element-hq/element-web/blob/develop/modules). Custom
modules can be developed using the [#module-api].

## Configuration

To configure which modules are loaded, set the [`modules`](config.md#modules)
configuration option.

Note that modules typically require their own configuration settings: see the
documentation for each module.

## Module API

Modules are loaded from the URL or path listed in `config.json` using dynamic
import (`import()`). The modules are loaded in order after Element Web
initializes but before the application fully starts. Modules must export a
compatible module format that works with the [Module
API](https://github.com/element-hq/element-web/tree/develop/packages/module-api).

## Module development

When working on a module, it can be useful to symlink the module into
Element Web's build output directory. For example, within a working copy of the
`element-web` repository

```sh
(cd modules/banner && pnpm build)
mkdir app/web/webapp/modules
ln -s ../../../../modules/banner/lib app/web/webapp/modules/banner
```

This can then be enabled with the following in `config.json`:

```json
{
    "modules": [ "/modules/banner/index.js" ]
}
```

# History

There was an earlier implementation of extensions known as
[Customisations](https://github.com/element-hq/element-web/blob/1cb068a91efbd659254388da41cd64bf5b5cf943/docs/customisations.md). This
is no longer supported.
