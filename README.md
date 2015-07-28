Vector/Web
==========

Vector is a Matrix web client built using the Matrix React SDK (https://github.com/matrix-org/matrix-react-sdk).

Getting started
===============

1. Install or update `node.js` so that your `npm` is at least at version `2.0.0`
2. Clone the repo: `git clone https://github.com/vector-im/vector-web.git` 
3. Switch to the SDK directory: `cd vector-web`
4. Install the prerequisites: `npm install`
5. Switch to the example directory: `cd examples/vector`
6. Install the example app prerequisites: `npm install`
7. Build the example and start a server: `npm start`

Now open http://127.0.0.1:8080/ in your browser to see your newly built
Vector.

Development
===========

To work on the CSS and Javascript and have the bundle files update as you
change the source files, you'll need to do two extra things:

1. Link the react sdk package into the example:
   `cd vector-web/examples/vector; npm link ../../`
2. Start a watcher for the CSS files:
   `cd vector-web; npm run start:css`

Note that you may need to restart the CSS builder if you add a new file. Note
that `npm start` builds debug versions of the javascript and CSS, which are
much larger than the production versions build by the `npm run build` commands.

IMPORTANT: If you customise components in your application (and hence require
react from your app) you must be sure to:

1. Make your app depend on react directly
2. If you `npm link` matrix-react-sdk, manually remove the 'react' directory
   from matrix-react-sdk's `node_modules` folder, otherwise browserify will
   pull in both copies of react which causes the app to break.

How to customise the SDK
========================

The matrix-react-sdk provides well-defined reusable UI components which may be
customised/replaced by the developer to build into an app.  A set of consistent
UI components (View + CSS classes) is called a 'skin' - currently the SDK
provides a very vanilla whitelabelled 'base skin'.  In future the SDK could
provide alternative skins (probably by extending the base skin) that provide more
specific look and feels (e.g. "IRC-style", "Skype-style") etc.  However, unlike
Wordpress themes and similar, we don't normally expect app developers to define
reusable skins.  Instead you just go and incorporate your view customisations
into your actual app.

The SDK uses the 'atomic' design pattern as seen at http://patternlab.io to
encourage a very modular and reusable architecture, making it easy to
customise and use UI widgets independently of the rest of the SDK and your app.
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
    React, the ComponentBroker and matrix-react-sdk and a call to Render
    the root React element as in the examples.
  * Create React classes for any custom components you wish to add. These
    can be based off the files in `views` in the `matrix-react-sdk` package,
    modifying the require() statement appropriately.
    You only need to copy files you want to customise.
  * Add a ComponentBroker.set() call for each of your custom components. These
    must come *before* `require("matrix-react-sdk")`.
  * Add a way to build your project: we suggest copying the browserify calls
    from the example projects, but you could use grunt or gulp.
  * Create an index.html file pulling in your compiled index.js file, the
    CSS bundle from matrix-react-sdk.

For more specific detail on any of these steps, look at the `custom` example in
matrix-react-sdk/examples.
