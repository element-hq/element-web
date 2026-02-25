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

- Widget URLs are normalized by stripping query parameters and hash fragments before matching.
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

## Copyright & License

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
