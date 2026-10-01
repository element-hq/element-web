# @element-hq/element-web-module-widget-lifecycle

Widget lifecycle module for Element Web.

Supports the following configuration options under the configuration key `io.element.element-web-modules.widget-lifecycle`:

| Key                | Type   | Description                                      |
| ------------------ | ------ | ------------------------------------------------ |
| widget_permissions | object | Map of widget URL patterns to approval settings. |

Each widget configuration can use the following options:

- `preload_approved` - if true, the preload dialog is not displayed for this widget.
- `identity_approved` - if true, requests for an identity token are automatically accepted.
- `capabilities_approved` - a list of capabilities that should be approved for this widget.

The widget URL and capability strings can use a trailing `*` to match multiple widgets or capabilities.
This is useful when widgets have multiple routes or capabilities include variable state keys.

## Matching and precedence

- Patterns ending in `*` are matched by prefix; other patterns must match exactly.
- If multiple rules match, the most specific match wins per field.
- The capabilities allow-list is not merged across rules; the most specific rule that defines it wins.

## Example configuration (exact match)

```json
{
    "io.element.element-web-modules.widget-lifecycle": {
        "widget_permissions": {
            "https://widget.example.com/": {
                "preload_approved": true,
                "identity_approved": true,
                "capabilities_approved": [
                    "org.matrix.msc2931.navigate",
                    "org.matrix.msc2762.receive.state_event:m.room.power_levels"
                ]
            }
        }
    }
}
```

## Example configuration (wildcards)

```json
{
    "io.element.element-web-modules.widget-lifecycle": {
        "widget_permissions": {
            "https://widget.example.com/*": {
                "preload_approved": true,
                "identity_approved": true,
                "capabilities_approved": [
                    "org.matrix.msc2931.navigate",
                    "org.matrix.msc2762.receive.state_event:m.room.power_levels",
                    "org.matrix.msc2762.send.state_event:net.custom_event#*"
                ]
            }
        }
    }
}
```
