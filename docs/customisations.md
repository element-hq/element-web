# Customisations

Element Web and the React SDK support "customisation points" that can be used to
easily add custom logic specific to a particular deployment of Element Web.

An example of this is the [security customisations
module](https://github.com/matrix-org/matrix-react-sdk/blob/develop/src/customisations/Security.ts).
This module in the React SDK only defines some empty functions and their types:
it does not do anything by default.

To make use of these customisation points, you will first need to fork Element
Web so that you can add your own code. Even though the default module is part of
the React SDK, you can still override it from the Element Web layer:

1. Copy the default customisation module to
   `element-web/src/customisations/YourNameSecurity.ts`
2. Edit customisations points and make sure export the ones you actually want to
   activate
3. Tweak the Element build process to use the customised module instead of the
   default by adding this to the `additionalPlugins` array in `webpack.config.js`:

```js
new webpack.NormalModuleReplacementPlugin(
    /src[\/\\]customisations[\/\\]Security\.ts/,
    path.resolve(__dirname, 'src/customisations/YourNameSecurity.ts'),
),
```

If we add more customisation modules in the future, we'll likely improve these
steps to remove the need for build changes like the above.

By isolating customisations to their own module, this approach should remove the
chance of merge conflicts when updating your fork, and thus simplify ongoing
maintenance.
