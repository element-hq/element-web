# Icons

Icons are loaded using [@svgr/webpack](https://www.npmjs.com/package/@svgr/webpack). This is configured in [element-web](https://github.com/vector-im/element-web/blob/develop/webpack.config.js#L458)

Each .svg exports a `ReactComponent` at the named export `Icon`.
Icons have `role="presentation"` and `aria-hidden` automatically applied. These can be overriden by passing props to the icon component.

eg
```
import { Icon as FavoriteIcon } from 'res/img/element-icons/favorite.svg';

const MyComponent = () => {
    return <>
        <FavoriteIcon>
        <FavoriteIcon className="mx_MyComponent-icon" role="img" aria-hidden="false">
    </>;
}
```

## Styling

Icon components are svg elements and can be styled as usual.

```
// _MyComponents.pcss
.mx_MyComponent-icon {
    height: 20px;
    width: 20px;

    * {
        fill: $accent;
    }
}

// MyComponent.tsx
import { Icon as FavoriteIcon } from 'res/img/element-icons/favorite.svg';

const MyComponent = () => {
    return <>
        <FavoriteIcon>
        <FavoriteIcon className="mx_MyComponent-icon" role="img" aria-hidden="false">
    </>;
}
```
