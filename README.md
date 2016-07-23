matrix-react-sdk
================

This is a react-based SDK for inserting a Matrix chat/voip client into a web page.

This package provides the React components needed to build a Matrix web client
using React.  It is not useable in isolation, and instead must must be used from
a 'skin'. A skin provides:
 * Customised implementations of presentation components.
 * Custom CSS
 * The containing application
 * Zero or more 'modules' containing non-UI functionality

**WARNING: As of July 2016, the skinning abstraction is broken due to rapid
development of `matrix-react-sdk` to meet the needs of Vector, the first app
to be built on top of the SDK** (https://github.com/vector-im/vector-web).
Right now `matrix-react-sdk` depends on some functionality from `vector-web`
(e.g. CSS), and `matrix-react-sdk` contains some Vector specific behaviour
(grep for 'vector').  This layering will be fixed asap once Vector development
has stabilised, but for now we do not advise trying to create new skins for
matrix-react-sdk until the layers are clearly separated again.

In the interim, `vector-im/vector-web` and `matrix-org/matrix-react-sdk` should
be considered as a single project (for instance, matrix-react-sdk bugs
are currently filed against vector-im/vector-web rather than this project).

Developer Guide
===============

Platform Targets:
 * Chrome, Firefox and Safari.
 * Edge should also work, but we're not testing it proactively.
 * WebRTC features (VoIP and Video calling) are only available in Chrome & Firefox.
 * Mobile Web is not currently a target platform - instead please use the native
   iOS (https://github.com/matrix-org/matrix-ios-kit) and Android
   (https://github.com/matrix-org/matrix-android-sdk) SDKs.

All code lands on the `develop` branch - `master` is only used for stable releases.
**Please file PRs against `develop`!!**

Please follow the standard Matrix contributor's guide:
https://github.com/matrix-org/synapse/tree/master/CONTRIBUTING.rst

Please follow the Matrix JS/React code style as per:
https://github.com/matrix-org/matrix-react-sdk/tree/master/code_style.rst

Whilst the layering separation between matrix-react-sdk and Vector is broken
(as of July 2016), code should be committed as follows:
 * All new components: https://github.com/matrix-org/matrix-react-sdk/tree/master/src/components
 * Vector-specific components: https://github.com/vector-im/vector-web/tree/master/src/components
   * In practice, `matrix-react-sdk` is still evolving so fast that the maintenance
     burden of customising and overriding these components for Vector can seriously
     impede development.  So right now, there should be very few (if any) customisations for Vector.
 * CSS for Matrix SDK components: https://github.com/vector-im/vector-web/tree/master/src/skins/vector/css/matrix-react-sdk
 * CSS for Vector-specific overrides and components: https://github.com/vector-im/vector-web/tree/master/src/skins/vector/css/vector-web

React components in matrix-react-sdk are come in two different flavours:
'structures' and 'views'.  Structures are stateful components which handle the
more complicated business logic of the app, delegating their actual presentation
rendering to stateless 'view' components.  For instance, the RoomView component
that orchestrates the act of visualising the contents of a given Matrix chat room
tracks lots of state for its child components which it passes into them for visual
rendering via props.

Good separation between the components is maintained by adopting various best
practices that anyone working with the SDK needs to be be aware of and uphold:

  * Components are named with upper camel case (e.g. views/rooms/EventTile.js)

  * They are organised in a typically two-level hierarchy - first whether the
    component is a view or a structure, and then a broad functional grouping
    (e.g. 'rooms' here)

  * After creating a new component you must run `npm run reskindex` to regenerate
    the `component-index.js` for the SDK (used in future for skinning)

  * The view's CSS file MUST have the same name (e.g. view/rooms/MessageTile.css).
    CSS for matrix-react-sdk currently resides in
    https://github.com/vector-im/vector-web/tree/master/src/skins/vector/css/matrix-react-sdk.

  * Per-view CSS is optional - it could choose to inherit all its styling from
    the context of the rest of the app, although this is unusual for any but
    structural components (lacking presentation logic) and the simplest view
    components.

  * The view MUST *only* refer to the CSS rules defined in its own CSS file.
    'Stealing' styling information from other components (including parents)
    is not cool, as it breaks the independence of the components.

  * CSS classes are named with an app-specific namespacing prefix to try to avoid
    CSS collisions.  The base skin shipped by Matrix.org with the matrix-react-sdk
    uses the naming prefix "mx_".  A company called Yoyodyne Inc might use a
    prefix like "yy_" for its app-specific classes.

  * CSS classes use upper camel case when they describe React components - e.g.
    .mx_MessageTile is the selector for the CSS applied to a MessageTile view.

  * CSS classes for DOM elements within a view which aren't components are named
    by appending a lower camel case identifier to the view's class name - e.g.
    .mx_MessageTile_randomDiv is how you'd name the class of an arbitrary div
    within the MessageTile view.

  * We deliberately use vanilla CSS 3.0 to avoid adding any more magic
    dependencies into the mix than we already have.  App developers are welcome
    to use whatever floats their boat however.  In future we'll start using
    css-next to pull in features like CSS variable support.

  * The CSS for a component can override the rules for child components.
    For instance, .mx_RoomList .mx_RoomTile {} would be the selector to override
    styles of RoomTiles when viewed in the context of a RoomList view.
    Overrides *must* be scoped to the View's CSS class - i.e. don't just define
    .mx_RoomTile {} in RoomList.css - only RoomTile.css is allowed to define its
    own CSS.  Instead, say .mx_RoomList .mx_RoomTile {} to scope the override
    only to the context of RoomList views.  N.B. overrides should be relatively
    rare as in general CSS inheritence should be enough.

  * Components should render only within the bounding box of their outermost DOM
    element. Page-absolute positioning and negative CSS margins and similar are
    generally not cool and stop the component from being reused easily in
    different places.

Originally `matrix-react-sdk` followed the Atomic design pattern as per
http://patternlab.io to try to encourage a modular architecture.  However, we
found that the grouping of components into atoms/molecules/organisms
made them harder to find relative to a functional split, and didn't emphasise
the distinction between 'structural' and 'view' components, so we backed away
from it.

Github Issues
=============

All issues should be filed under https://github.com/vector-im/vector-web/issues
for now.

OUTDATED: To Create Your Own Skin
=================================

**This is ALL LIES currently, as skinning is currently broken - see the WARNING
section at the top of this readme.**

Skins are modules are exported from such a package in the `lib` directory.
`lib/skins` contains one directory per-skin, named after the skin, and the
`modules` directory contains modules as their javascript files.

A basic skin is provided in the matrix-react-skin package. This also contains
a minimal application that instantiates the basic skin making a working matrix
client.

You can use matrix-react-sdk directly, but to do this you would have to provide
'views' for each UI component. To get started quickly, use matrix-react-skin.

To actually change the look of a skin, you can create a base skin (which
does not use views from any other skin) or you can make a derived skin.
Note that derived skins are currently experimental: for example, the CSS
from the skins it is based on will not be automatically included.

To make a skin, create React classes for any custom components you wish to add
in a skin within `src/skins/<skin name>`. These can be based off the files in
`views` in the `matrix-react-skin` package, modifying the require() statement
appropriately.

If you make a derived skin, you only need copy the files you wish to customise.

Once you've made all your view files, you need to make a `skinfo.json`. This
contains all the metadata for a skin. This is a JSON file with, currently, a
single key, 'baseSkin'. Set this to the empty string if your skin is a base skin,
or for a derived skin, set it to the path of your base skin's skinfo.json file, as
you would use in a require call.

Now you have the basis of a skin, you need to generate a skindex.json file. The
`reskindex.js` tool in matrix-react-sdk does this for you. It is suggested that
you add an npm script to run this, as in matrix-react-skin.

For more specific detail on any of these steps, look at matrix-react-skin.

Alternative instructions:

  * Create a new NPM project. Be sure to directly depend on react, (otherwise
    you can end up with two copies of react).
  * Create an index.js file that sets up react. Add require statements for
    React and matrix-react-sdk. Load a skin using the 'loadSkin' method on the
    SDK and call Render. This can be a skin provided by a separate package or
    a skin in the same package.
  * Add a way to build your project: we suggest copying the scripts block
    from matrix-react-skin (which uses babel and webpack). You could use
    different tools but remember that at least the skins and modules of
    your project should end up in plain (ie. non ES6, non JSX) javascript in
    the lib directory at the end of the build process, as well as any
    packaging that you might do.
  * Create an index.html file pulling in your compiled javascript and the
    CSS bundle from the skin you use. For now, you'll also need to manually
    import CSS from any skins that your skin inherts from.

