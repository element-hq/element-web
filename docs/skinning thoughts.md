== Skinning refactor ==

matrix-react-sdk
  - base images
  - base CSS
  - all the components needed to build a workable app (including the top layer)

element-web: the Element skin
  - Element-specific classes (e.g. login header/footer)
  - Element-specific themes
    - light
    - dark

i.e. the only things which should go into element-web are bits which apply vector-specific skinning
specifically "Stuff that any other brand would not want to use. (e.g. Element logos, links, T&Cs)"
 - Questions:
   - Electron app?  (should probably be a separate repo in its own right?  but might as well go here for now)
   - index.html & index.js?  (should be in matrix-react-sdk, given the SDK is useless without them?)

ideally matrix-react-sdk itself should ship with a default skin which actually works built in.

status skin (can go in the same app for now)
  - has status theme
    - which inherits from Element light theme
    - how do we share graphics between skins?
      - shove them into react-sdk, or...
      - guess we do ../../vector/img 
      - this means keeping the skin name in the images (unless /img is a shortcut to the right skin's images)

out of scope:
  - making the components more independent, so they can be used in isolation.
  - that said, the bits which should probably be used by being embeded into a different app:
    - login/reg
    - RoomView + RoomSettings
    - MessageComposer
    - RoomList
    - MemberList
    - MemberInfo
    - Voip UI
    - UserSettings
  - sharing different js-sdks between the different isolated modules

other changes:
  - how do we handle i18n?
    - each skin should really be its own i18n project.  As long as all the commonality stuff is in matrix-react-sdk this shouldn't be too bad.
  - ability to associate components with a given skin
    - skins/vector/src <-- components
    - skins/vector/css
    - skins/vector/img
    - skins/vector/fonts
  - gather together themes (per skin) into a single place too
    - skins/vector/themes/foo/css
    - skins/vector/themes/foo/img
    - skins/vector/themes/foo/fonts
  - ideally element-web would contain almost nothing but skins/vector directory. 
  - ability to entirely replace CSS rather than override it for a given theme
    - e.g. if we replace `Login.js` with `StatusLogin.js`, then we should similarly be able to replace `_Login.scss` with `_StatusLogin.scss`.

random thoughts;
   - should we be able to change the entire skin at runtime (more like wordpress) - to the extent of replacing entire components?
     - might pose security issues if a theme can be swapped out to replace MatrixChat or other fundamental functionality at runtime
   - if so, perhaps skins & themes should converge...

-----------------

Immediate plan for Status:
 * Implement it as a theme for the Element skin
 * Ideally move skins to a sensible level (possibly even including src?)
