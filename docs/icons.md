# Icons

Icons are loaded using [@svgr/webpack](https://www.npmjs.com/package/@svgr/webpack).
This is configured in [element-web](https://github.com/vector-im/element-web/blob/develop/webpack.config.js#L458).

Each `.svg` exports a `ReactComponent` at the named export `Icon`.
Icons have `role="presentation"` and `aria-hidden` automatically applied. These can be overriden by passing props to the icon component.

SVG file recommendations:

-   Colours should not be defined absolutely. Use `currentColor` instead.
-   SVG files should be taken from the design compound as they are. Some icons contain special padding.
    This means that there should be icons for each size, e.g. warning-16px and warning-32px.

Example usage:

```
import { Icon as FavoriteIcon } from 'res/img/element-icons/favorite.svg';

const MyComponent = () => {
    return <>
        <FavoriteIcon className="mx_Icon mx_Icon_16">
    </>;
}
```

If possible, use the icon classes from [here](../res/css/compound/_Icon.pcss).

## Custom styling

Icon components are svg elements and may be custom styled as usual.

`_MyComponents.pcss`:

```css
.mx_MyComponent-icon {
    height: 20px;
    width: 20px;

    * {
        fill: $accent;
    }
}
```

`MyComponent.tsx`:

```typescript
import { Icon as FavoriteIcon } from 'res/img/element-icons/favorite.svg';

const MyComponent = () => {
    return <>
        <FavoriteIcon className="mx_MyComponent-icon" role="img" aria-hidden="false">
    </>;
}
```
