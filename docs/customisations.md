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
3. Create/add an entry to `customisations.json` next to the webpack config:

```json
{
    "src/customisations/Security.ts": "src/customisations/YourNameSecurity.ts"
}
```

By isolating customisations to their own module, this approach should remove the
chance of merge conflicts when updating your fork, and thus simplify ongoing
maintenance.

**Note**: The project deliberately does not exclude `customisations.json` from Git.
This is to ensure that in shared projects it's possible to have a common config. By
default, Element Web does *not* ship with this file to prevent conflicts.

### Custom components

Instead of implementing skinning from the react-sdk, maintainers can use the above system to override components
if they wish. Maintenance and API surface compatibility are left as a responsibility for the project - the layering
in Element Web (including the react-sdk) do not make guarantees that properties/state machines won't change.

### Component visibility customisation

UI for some actions can be hidden via the ComponentVisibility customisation:
- inviting users to rooms and spaces,
- creating rooms,
- creating spaces,

To customise visibility create a customisation module from [ComponentVisibility](https://github.com/matrix-org/matrix-react-sdk/blob/master/src/customisations/ComponentVisibility.ts) following the instructions above.

`shouldShowComponent` determines whether the active MatrixClient user should be able to use
the given UI component. When `shouldShowComponent` returns falsy all UI components for that feature will be hidden.
If shown, the user might still not be able to use the
component depending on their contextual permissions. For example, invite options
might be shown to the user, but they won't have permission to invite users to
the current room: the button will appear disabled.

For example, to only allow users who meet a certain condition to create spaces:
```typescript
function shouldShowComponent(component: UIComponent): boolean {
    if (component === UIComponent.CreateSpaces) {
        // customConditionCheck() is a function of your own creation
        const userMeetsCondition = customConditionCheck(MatrixClientPeg.get().getUserId());
        return userMeetsCondition;
    }
    return true;
}
```
In this example, all UI related to creating a space will be hidden unless the users meets the custom condition.
