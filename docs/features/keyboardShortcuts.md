# Keyboard shortcuts

## Using the `KeyBindingManager`

The `KeyBindingManager` (accessible using `getKeyBindingManager()`) is a class
with several methods that allow you to get a `KeyBindingAction` based on a
`KeyboardEvent | React.KeyboardEvent`.

The event passed to the `KeyBindingManager` gets compared to the list of
shortcuts that are retrieved from the `IKeyBindingsProvider`s. The
`IKeyBindingsProvider` is in `KeyBindingDefaults`.

### Examples

Let's say we want to close a menu when the correct keys were pressed:

```ts
const onKeyDown = (ev: KeyboardEvent): void => {
    let handled = true;
    const action = getKeyBindingManager().getAccessibilityAction(ev);
    switch (action) {
        case KeyBindingAction.Escape:
            closeMenu();
            break;
        default:
            handled = false;
            break;
    }

    if (handled) {
        ev.preventDefault();
        ev.stopPropagation();
    }
};
```

## Managing keyboard shortcuts

There are a few things at play when it comes to keyboard shortcuts. The
`KeyBindingManager` gets `IKeyBindingsProvider`s one of which is
`defaultBindingsProvider` defined in `KeyBindingDefaults`. In
`KeyBindingDefaults` a `getBindingsByCategory()` method is used to create
`KeyBinding`s based on `KeyboardShortcutSetting`s defined in
`KeyboardShortcuts`.

### Adding keyboard shortcuts

To add a keyboard shortcut there are two files we have to look at:
`KeyboardShortcuts.ts` and `KeyBindingDefaults.ts`. In most cases we only need
to edit `KeyboardShortcuts.ts`: add a `KeyBindingAction` and add the
`KeyBindingAction` to the `KEYBOARD_SHORTCUTS` object.

Though, to make matters worse, sometimes we want to add a shortcut that has
multiple keybindings associated with. This keyboard shortcut won't be
customizable as it would be rather difficult to manage both from the point of
the settings and the UI. To do this, we have to add a `KeyBindingAction` and add
the UI representation of that keyboard shortcut to the `getUIOnlyShortcuts()`
method. Then, we also need to add the keybinding to the correct method in
`KeyBindingDefaults`.
