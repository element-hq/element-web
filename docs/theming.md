Theming Riot
============

Themes are a very basic way of providing simple alternative look & feels to the
riot-web app via CSS & custom imagery.

They are *NOT* co be confused with 'skins', which describe apps which sit on top
of matrix-react-sdk - e.g. in theory Riot itself is a react-sdk skin.
As of Jan 2017, skins are not fully supported; riot is the only available skin.

To define a theme for Riot:

 1. Pick a name, e.g. `teal`. at time of writing we have `light` and `dark`.
 2. Fork `src/skins/vector/css/themes/dark.scss` to be teal.scss
 3. Fork `src/skins/vector/css/themes/_base.scss` to be _teal.scss
 4. Override variables in _teal.css as desired. You may wish to delete ones
    which don't differ from _base.scss, to make it clear which are being
    overridden. If every single colour is being changed (as per _dark.scss)
    then you might as well keep them all.
 5. Add the theme to the list of entrypoints in webpack.config.js
 6. Add the theme to the list of themes in matrix-react-sdk's UserSettings.js
 7. Sit back and admire your handywork.

In future, the assets for a theme will probably be gathered together into a
single directory tree.