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

### Component visibility customisation
UI for some actions can be hidden via the ComponentVisibility customisation:
- inviting users to rooms and spaces,
- creating rooms,
- creating spaces,

To customise visibility create a customisation module from [ComponentVisibility](https://github.com/matrix-org/matrix-react-sdk/blob/master/src/customisations/ComponentVisibility.ts) following the instructions above.

`shouldShowComponent` determines whether or not the active MatrixClient user should be able to use
the given UI component. When `shouldShowComponent` returns falsy all UI components for that feature will be hidden.
If shown, the user might still not be able to use the
component depending on their contextual permissions. For example, invite options
might be shown to the user but they won't have permission to invite users to
the current room: the button will appear disabled.

For example, to only allow users who meet a certain condition to create spaces:
```
function shouldShowComponent(component: UIComponent): boolean {
   if (component === UIComponent.CreateSpaces) {
      const userMeetsCondition = <<check your custom condition here>>
      return userMeetsCondition;
   }
   return true;
}
```
In this example, all UI related to creating a space will be hidden unless the users meets a custom condition.