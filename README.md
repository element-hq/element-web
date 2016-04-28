matrix-react-sdk
================

This is a react-based SDK for inserting a Matrix chat/voip client into a web page.

This package provides the logic and 'controller' parts for the UI components. This
forms one part of a complete matrix client, but it not useable in isolation. It
must be used from a 'skin'. A skin provides:
 * The HTML for the UI components (in the form of React `render` methods)
 * The CSS for this HTML
 * The containing application 
 * Zero or more 'modules' containing non-UI functionality

Skins are modules are exported from such a package in the `lib` directory.
`lib/skins` contains one directory per-skin, named after the skin, and the
`modules` directory contains modules as their javascript files.

A basic skin is provided in the matrix-react-skin package. This also contains
a minimal application that instantiates the basic skin making a working matrix
client.

You can use matrix-react-sdk directly, but to do this you would have to provide
'views' for each UI component. To get started quickly, use matrix-react-skin.

How to customise the SDK
========================

The SDK formerly used the 'atomic' design pattern as seen at http://patternlab.io to
encourage a very modular and reusable architecture, making it easy to
customise and use UI widgets independently of the rest of the SDK and your app.

So unfortunately at the moment this document does not describe how to customize your UI!

###This is the old description for the atomic design pattern:

In practice this means:

 * The UI of the app is strictly split up into a hierarchy of components.
 
 * Each component has its own:
   * View object defined as a React javascript class containing embedded
     HTML expressed in React's JSX notation.
   * CSS file, which defines the styling specific to that component.
 
 * Components are loosely grouped into the 5 levels outlined by atomic design:
   * atoms: fundamental building blocks (e.g. a timestamp tag)
   * molecules: "group of atoms which functions together as a unit"
     (e.g. a message in a chat timeline)
   * organisms: "groups of molecules (and atoms) which form a distinct section
     of a UI" (e.g. a view of a chat room)
   * templates: "a reusable configuration of organisms" - used to combine and
     style organisms into a well-defined global look and feel
   * pages: specific instances of templates.

 Good separation between the components is maintained by adopting various best
 practices that anyone working with the SDK needs to be be aware of and uphold:

  * Views are named with upper camel case (e.g. molecules/MessageTile.js)

  * The view's CSS file MUST have the same name (e.g. molecules/MessageTile.css)

  * Per-view CSS is optional - it could choose to inherit all its styling from
    the context of the rest of the app, although this is unusual for any but 
    the simplest atoms and molecules.

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
    to use whatever floats their boat however.

  * The CSS for a component can however override the rules for child components.
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

  * We don't use the atomify library itself, as React already provides most
    of the modularity requirements it brings to the table.

With all this in mind, here's how you go about skinning the react SDK UI
components to embed a Matrix client into your app:

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

To Create Your Own Skin
=======================
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
