# Widget Toggles Module

Adds room header buttons for widgets in the room.

This module needs to be configured to control what widget types get buttons added for them.
The following config snippet enables the module and configures it to add buttons for both
custom and jitsi widgets:

```
"modules": [
    "/modules/widget-toggles/lib/index.js"
],
"io.element.element-web-modules.widget-toggles": {
    "types": ["m.custom", "jitsi"]
}
```
