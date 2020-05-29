# Skinning

The react-sdk can be skinned to replace presentation components, CSS, or
other relevant parts of the SDK. Typically consumers will replace entire
components and get the ability for custom CSS as a result.

This doc isn't exhaustive on how skinning works, though it should cover
some of the more complicated parts such as component replacement.

## Loading a skin

1. Generate a `component-index.js` (preferably using the tools that the react-sdk
exposes). This can typically be done with a npm script like `"reskindex -h src/header"`.
2. In your app's entry point, add something like this code:
   ```javascript
   import {loadSkin} from "matrix-react-sdk";
   loadSkin(import("component-index").components);
   // The rest of your imports go under this.
   ```
3. Import the remainder of the SDK and bootstrap your app.

It is extremely important that you **do not** import anything else from the
SDK prior to loading your skin as otherwise the skin might not work. Loading
the skin should be one of the first things your app does, if not the very
first thing.

Additionally, **do not** provide `loadSkin` with the react-sdk components
themselves otherwise the app might explode. The SDK is already aware of its
components and doesn't need to be told.

## Replacing components

Components that replace the react-sdk ones MUST have a `replaces` static
key on the component's class to describe which component it overrides. For
example, if your `VectorAuthPage` component is meant to replace the react-sdk
`AuthPage` component then you'd add `static replaces = 'views.auth.AuthPage';`
to the `VectorAuthPage` class.

Other than that, the skin just needs to be loaded normally as mentioned above.
Consumers of the SDK likely will not be interested in the rest of this section.

### SDK developer notes

Components in the react-sdk MUST be decorated with the `@replaceableComponent`
function. For components that can't use the decorator, they must use a
variation that provides similar functionality. The decorator gives consumers
an opportunity to load skinned components by abusing import ordering and 
behaviour.

Decorators are executed at import time which is why we can abuse the import
ordering behaviour: importing `loadSkin` doesn't trigger any components to
be imported, allowing the consumer to specify a skin. When the consumer does
import a component (for example, `MatrixChat`), it starts to pull in all the
components via `import` statements. When the components get pulled in the
decorator checks with the skinned components to see if it should be replacing
the component being imported. The decorator then effectively replaces the
components when needed by specifying the skinned component as an override for
the SDK's component, which should in theory override critical functions like
`render()` and lifecycle event handlers. 

The decorator also means that older usage of `getComponent()` is no longer
required because components should be replaced by the decorator. Eventually
the react-sdk should only have one usage of `getComponent()`: the decorator.

The decorator assumes that if `getComponent()` returns null that there is
no skinned version of the component and continues on using the SDK's component.
In previous versions of the SDK, the function would throw an error instead
because it also expected the skin to list the SDK's components as well, however
that is no longer possible due to the above.

In short, components should always be `import`ed.
