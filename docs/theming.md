# Theming Element

Themes are a very basic way of providing simple alternative look & feels to the
Element app via CSS & custom imagery.

To define a theme for Element:

1.  Pick a name, e.g. `teal`. at time of writing we have `light` and `dark`.
2.  Fork `res/themes/dark/css/dark.pcss` to be `teal.pcss`
3.  Fork `res/themes/dark/css/_base.pcss` to be `_teal.pcss`
4.  Override variables in `_teal.pcss` as desired. You may wish to delete ones
    which don't differ from `_base.pcss`, to make it clear which are being
    overridden. If every single colour is being changed (as per `_dark.pcss`)
    then you might as well keep them all.
5.  Add the theme to the list of entrypoints in webpack.config.js
6.  Add the theme to the list of themes in theme.ts
7.  Sit back and admire your handywork.

In future, the assets for a theme will probably be gathered together into a
single directory tree.

# Custom Themes

Themes derived from the built in themes may also be defined in settings.

To avoid name collisions, the internal name of a theme is
`custom-${theme.name}`. So if you want to set the custom theme below as the
default theme, you would use `default_theme: "custom-Electric Blue"`.

e.g. in config.json:

```json5
"setting_defaults": {
        "custom_themes": [
            {
                "name": "Electric Blue",
                "is_dark": false,
                "fonts": {
                    "faces": [
                        {
                            "font-family": "Inter",
                            "src": [{"url": "/fonts/Inter.ttf", "format": "ttf"}]
                        }
                    ],
                    "general": "Inter, sans",
                    "monospace": "'Courier New'"
                },
                "colors": {
                    "accent-color": "#3596fc",
                    "primary-color": "#368bd6",
                    "warning-color": "#ff4b55",
                    "sidebar-color": "#27303a",
                    "roomlist-background-color": "#f3f8fd",
                    "roomlist-text-color": "#2e2f32",
                    "roomlist-text-secondary-color": "#61708b",
                    "roomlist-highlights-color": "#ffffff",
                    "roomlist-separator-color": "#e3e8f0",
                    "timeline-background-color": "#ffffff",
                    "timeline-text-color": "#2e2f32",
                    "timeline-text-secondary-color": "#61708b",
                    "timeline-highlights-color": "#f3f8fd",

                    // These should both be 8 values long
                    "username-colors": ["#ff0000", /*...*/],
                    "avatar-background-colors": ["#cc0000", /*...*/]
                },
                "compound": {
                    "--cpd-color-icon-accent-tertiary": "var(--cpd-color-blue-800)",
                    "--cpd-color-text-action-accent": "var(--cpd-color-blue-900)"
                }
            }, {
                "name": "Deep Purple",
                "is_dark": true,
                "colors": {
                    "accent-color": "#6503b3",
                    "primary-color": "#368bd6",
                    "warning-color": "#b30356",
                    "sidebar-color": "#15171B",
                    "roomlist-background-color": "#22262E",
                    "roomlist-text-color": "#A1B2D1",
                    "roomlist-text-secondary-color": "#EDF3FF",
                    "roomlist-highlights-color": "#343A46",
                    "roomlist-separator-color": "#a1b2d1",
                    "timeline-background-color": "#181b21",
                    "timeline-text-color": "#EDF3FF",
                    "timeline-text-secondary-color": "#A1B2D1",
                    "timeline-highlights-color": "#22262E"
                }
            }
        ]
    }
```

`compound` may contain overrides for any [semantic design token](https://compound.element.io/?path=/docs/tokens-semantic-colors--docs) belonging to our design system. The above example shows how you might change the accent color to blue by setting the relevant semantic tokens to refer to blue [base tokens](https://compound.element.io/?path=/docs/tokens-color-palettes--docs).

All properties in `fonts` are optional, and will default to the standard Riot fonts.
