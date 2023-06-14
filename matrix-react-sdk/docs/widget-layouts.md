# Widget layout support

Rooms can have a default widget layout to auto-pin certain widgets, make the container different
sizes, etc. These are defined through the `io.element.widgets.layout` state event (empty state key).

Full example content:

```json5
{
    widgets: {
        "first-widget-id": {
            container: "top",
            index: 0,
            width: 60,
            height: 40,
        },
        "second-widget-id": {
            container: "right",
        },
    },
}
```

As shown, there are two containers possible for widgets. These containers have different behaviour
and interpret the other options differently.

## `top` container

This is the "App Drawer" or any pinned widgets in a room. This is by far the most versatile container
though does introduce potential usability issues upon members of the room (widgets take up space and
therefore fewer messages can be shown).

The `index` for a widget determines which order the widgets show up in from left to right. Widgets
without an `index` will show up as the rightmost widgets. Tiebreaks (same `index` or multiple defined
without an `index`) are resolved by comparing widget IDs. A maximum of 3 widgets can be in the top
container - any which exceed this will be ignored (placed into the `right` container). Smaller numbers
represent leftmost widgets.

The `width` is relative width within the container in percentage points. This will be clamped to a
range of 0-100 (inclusive). The widgets will attempt to scale to relative proportions when more than
100% space is allocated. For example, if 3 widgets are defined at 40% width each then the client will
attempt to show them at 33% width each.

Note that the client may impose minimum widths on the widgets, such as a 10% minimum to avoid pinning
hidden widgets. In general, widgets defined in the 30-70% range each will be free of these restrictions.

The `height` is not in fact applied per-widget but is recorded per-widget for potential future
capabilities in future containers. The top container will take the tallest `height` and use that for
the height of the whole container, and thus all widgets in that container. The `height` is relative
to the container, like with `width`, meaning that 100% will consume as much space as the client is
willing to sacrifice to the widget container. Like with `width`, the client may impose minimums to avoid
the container being uselessly small. Heights in the 30-100% range are generally acceptable. The height
is also clamped to be within 0-100, inclusive.

## `right` container

This is the default container and has no special configuration. Widgets which overflow from the top
container will be put in this container instead. Putting a widget in the right container does not
automatically show it - it only mentions that widgets should not be in another container.

The behaviour of this container may change in the future.
