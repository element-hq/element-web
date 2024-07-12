# Theming Element

Themes are a very basic way of providing simple alternative look & feels to the
Element app via CSS & custom imagery.

They are _NOT_ co be confused with 'skins', which describe apps which sit on top
of matrix-react-sdk - e.g. in theory Element itself is a react-sdk skin.
As of March 2022, skins are not fully supported; Element is the only available skin.

To define a theme for Element:

1.  Pick a name, e.g. `teal`. at time of writing we have `light` and `dark`.
2.  Fork `src/skins/vector/css/themes/dark.pcss` to be `teal.pcss`
3.  Fork `src/skins/vector/css/themes/_base.pcss` to be `_teal.pcss`
4.  Override variables in `_teal.pcss` as desired. You may wish to delete ones
    which don't differ from `_base.pcss`, to make it clear which are being
    overridden. If every single colour is being changed (as per `_dark.pcss`)
    then you might as well keep them all.
5.  Add the theme to the list of entrypoints in webpack.config.js
6.  Add the theme to the list of themes in matrix-react-sdk's UserSettings.js
7.  Sit back and admire your handywork.

In future, the assets for a theme will probably be gathered together into a
single directory tree.

# Custom Themes

Themes derived from the built in themes may also be defined in settings.

After enabling custom themes and devtools, go to the devtools panel, Explore account data then im.vector.web.settings and modify custom_themes. 

e.g. 

```
"custom_themes": [
    {
      "name": "Coffee",
      "is_dark": false,
      "fonts": {
        "faces": [
          {
            "font-family": "Inter",
            "src": [
              {
                "url": "/fonts/Inter.ttf",
                "format": "ttf"
              }
            ]
          }
        ],
        "general": "Inter, sans",
        "monospace": "'Courier New'"
      },
      "colors": {
        "panels": "#303446",
        "secondary-content": "#babbf1",
        "accent-color": "#babbf1",
        "primary-color": "#babbf1",
        "warning-color": "#e78284",
        "alert": "#faa81a",
        "sidebar-color": "#232634",
        "roomlist-background-color": "#292c3c",
        "roomlist-text-color": "#c6d0f5",
        "roomlist-text-secondary-color": "#303446",
        "roomlist-highlights-color": "#51576d",
        "roomlist-separator-color": "#838ba7",
        "timeline-background-color": "#303446",
        "timeline-text-color": "#c6d0f5",
        "tertiary-content": "#c6d0f5",
        "timeline-text-secondary-color": "#a5adce",
        "timeline-highlights-color": "#292c3c",
        "reaction-row-button-selected-bg-color": "#51576d",
        "menu-selected-color": "#51576d",
        "focus-bg-color": "#626880",
        "room-highlight-color": "#99d1db",
        "togglesw-off-color": "#949cbb",
        "other-user-pill-bg-color": "#99d1db",
        "cpd-color-text-primary": "#ebeef2",
        "cpd-color-bg-canvas-default": "#51576c",
        "cpd-color-text-secondary": "#aec0e8",
        "cpd-color-bg-subtle-secondary": "#313447",
        "cpd-color-bg-action-secondary-rest": "#51576c",
        "cpd-color-icon-primary": "#717a89",
        "cpd-color-text-critical-primary": "#ff5b55",
        "cpd-color-text-decorative-1": "var(--cpd-color-yellow-300)",
        "cpd-color-text-decorative-2": "var(--cpd-color-blue-700)",
        "cpd-color-text-decorative-3": "var(--cpd-color-orange-700)",
        "cpd-color-text-decorative-4": "var(--cpd-color-lime-400)",
        "cpd-color-text-decorative-5": "var(--cpd-color-lime-500)",
        "cpd-color-text-decorative-6": "var(--cpd-color-yellow-400)",
        "cpd-color-bg-decorative-1": "var(--cpd-color-yellow-300)",
        "cpd-color-bg-decorative-2": "var(--cpd-color-blue-700)",
        "cpd-color-bg-decorative-3": "var(--cpd-color-orange-700)",
        "cpd-color-bg-decorative-4": "var(--cpd-color-lime-400)",
        "cpd-color-bg-decorative-5": "var(--cpd-color-lime-500)",
        "cpd-color-bg-decorative-6": "var(--cpd-color-yellow-400)"
      }
    }
  ]
```

To avoid name collisions, the internal name of a theme is
`custom-${theme.name}`. So if you want to set the custom theme below as the
default theme, you would use `default_theme: "custom-Electric Blue"`.

e.g. in config.json:

```
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
