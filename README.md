[![npm](https://img.shields.io/npm/v/matrix-react-sdk)](https://www.npmjs.com/package/matrix-react-sdk)
![Tests](https://github.com/matrix-org/matrix-react-sdk/actions/workflows/tests.yml/badge.svg)
![Static Analysis](https://github.com/matrix-org/matrix-react-sdk/actions/workflows/static_analysis.yaml/badge.svg)
[![matrix-react-sdk](https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/ppvnzg/develop&style=flat&logo=cypress)](https://dashboard.cypress.io/projects/ppvnzg/runs)
[![This project is using Percy.io for visual regression testing.](https://percy.io/static/images/percy-badge.svg)](https://percy.io/dfde73bd/matrix-react-sdk)
[![Weblate](https://translate.element.io/widgets/element-web/-/matrix-react-sdk/svg-badge.svg)](https://translate.element.io/engage/element-web/)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=matrix-react-sdk&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=matrix-react-sdk)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=matrix-react-sdk&metric=coverage)](https://sonarcloud.io/summary/new_code?id=matrix-react-sdk)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=matrix-react-sdk&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=matrix-react-sdk)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=matrix-react-sdk&metric=bugs)](https://sonarcloud.io/summary/new_code?id=matrix-react-sdk)

# matrix-react-sdk

This is a react-based SDK for inserting a Matrix chat/voip client into a web page.

This package provides the React components needed to build a Matrix web client
using React. It is not useable in isolation, and instead must be used from
a 'skin'. A skin provides:

-   Customised implementations of presentation components.
-   Custom CSS
-   The containing application
-   Zero or more 'modules' containing non-UI functionality

As of Aug 2018, the only skin that exists is
[`vector-im/element-web`](https://github.com/vector-im/element-web/); it and
`matrix-org/matrix-react-sdk` should effectively
be considered as a single project (for instance, matrix-react-sdk bugs
are currently filed against vector-im/element-web rather than this project).

## Translation Status

[![Translation status](https://translate.element.io/widgets/element-web/-/multi-auto.svg)](https://translate.element.io/engage/element-web/?utm_source=widget)

## Developer Guide

Platform Targets:

-   Chrome, Firefox and Safari.
-   WebRTC features (VoIP and Video calling) are only available in Chrome & Firefox.
-   Mobile Web is not currently a target platform - instead please use the native
    iOS (https://github.com/matrix-org/matrix-ios-kit) and Android
    (https://github.com/matrix-org/matrix-android-sdk2) SDKs.

All code lands on the `develop` branch - `master` is only used for stable releases.
**Please file PRs against `develop`!!**

We use the same contribution guide as Element. Check it out here:
https://github.com/vector-im/element-web/blob/develop/CONTRIBUTING.md

Our code style is also the same as Element's:
https://github.com/vector-im/element-web/blob/develop/code_style.md

Code should be committed as follows:

-   All new components:
    https://github.com/matrix-org/matrix-react-sdk/tree/master/src/components
-   Element-specific components:
    https://github.com/vector-im/element-web/tree/master/src/components
    -   In practice, `matrix-react-sdk` is still evolving so fast that the
        maintenance burden of customising and overriding these components for
        Element can seriously impede development. So right now, there should be
        very few (if any) customisations for Element.
-   CSS: https://github.com/matrix-org/matrix-react-sdk/tree/master/res/css
-   Theme specific CSS & resources:
    https://github.com/matrix-org/matrix-react-sdk/tree/master/res/themes

React components in matrix-react-sdk come in two different flavours:
'structures' and 'views'. Structures are stateful components which handle the
more complicated business logic of the app, delegating their actual presentation
rendering to stateless 'view' components. For instance, the RoomView component
that orchestrates the act of visualising the contents of a given Matrix chat
room tracks lots of state for its child components which it passes into them for
visual rendering via props.

Good separation between the components is maintained by adopting various best
practices that anyone working with the SDK needs to be aware of and uphold:

-   Components are named with upper camel case (e.g. views/rooms/EventTile.js)

-   They are organised in a typically two-level hierarchy - first whether the
    component is a view or a structure, and then a broad functional grouping
    (e.g. 'rooms' here)

-   The view's CSS file MUST have the same name (e.g. view/rooms/MessageTile.css).
    CSS for matrix-react-sdk currently resides in
    https://github.com/matrix-org/matrix-react-sdk/tree/master/res/css.

-   Per-view CSS is optional - it could choose to inherit all its styling from
    the context of the rest of the app, although this is unusual for any but
-   Theme specific CSS & resources:
    https://github.com/matrix-org/matrix-react-sdk/tree/master/res/themes
    structural components (lacking presentation logic) and the simplest view
    components.

-   The view MUST _only_ refer to the CSS rules defined in its own CSS file.
    'Stealing' styling information from other components (including parents)
    is not cool, as it breaks the independence of the components.

-   CSS classes are named with an app-specific name-spacing prefix to try to
    avoid CSS collisions. The base skin shipped by Matrix.org with the
    matrix-react-sdk uses the naming prefix "mx*". A company called Yoyodyne
    Inc might use a prefix like "yy*" for its app-specific classes.

-   CSS classes use upper camel case when they describe React components - e.g.
    .mx_MessageTile is the selector for the CSS applied to a MessageTile view.

-   CSS classes for DOM elements within a view which aren't components are named
    by appending a lower camel case identifier to the view's class name - e.g.
    .mx_MessageTile_randomDiv is how you'd name the class of an arbitrary div
    within the MessageTile view.

-   We deliberately use vanilla CSS 3.0 to avoid adding any more magic
    dependencies into the mix than we already have. App developers are welcome
    to use whatever floats their boat however. In future we'll start using
    css-next to pull in features like CSS variable support.

-   The CSS for a component can override the rules for child components.
    For instance, .mx*RoomList .mx_RoomTile {} would be the selector to override
    styles of RoomTiles when viewed in the context of a RoomList view.
    Overrides \_must* be scoped to the View's CSS class - i.e. don't just define
    .mx_RoomTile {} in RoomList.css - only RoomTile.css is allowed to define its
    own CSS. Instead, say .mx_RoomList .mx_RoomTile {} to scope the override
    only to the context of RoomList views. N.B. overrides should be relatively
    rare as in general CSS inheritance should be enough.

-   Components should render only within the bounding box of their outermost DOM
    element. Page-absolute positioning and negative CSS margins and similar are
    generally not cool and stop the component from being reused easily in
    different places.

Originally `matrix-react-sdk` followed the Atomic design pattern as per
http://patternlab.io to try to encourage a modular architecture. However, we
found that the grouping of components into atoms/molecules/organisms
made them harder to find relative to a functional split, and didn't emphasise
the distinction between 'structural' and 'view' components, so we backed away
from it.

## Github Issues

All issues should be filed under https://github.com/vector-im/element-web/issues
for now.

## Development

Ensure you have the latest LTS version of Node.js installed.

Using `yarn` instead of `npm` is recommended. Please see the Yarn 1 [install
guide](https://classic.yarnpkg.com/docs/install) if you do not have it
already. This project has not yet been migrated to Yarn 2, so please ensure
`yarn --version` shows a version from the 1.x series.

`matrix-react-sdk` depends on
[`matrix-js-sdk`](https://github.com/matrix-org/matrix-js-sdk). To make use of
changes in the latter and to ensure tests run against the develop branch of
`matrix-js-sdk`, you should set up `matrix-js-sdk`:

```bash
git clone https://github.com/matrix-org/matrix-js-sdk
cd matrix-js-sdk
git checkout develop
yarn link
yarn install
```

Then check out `matrix-react-sdk` and pull in dependencies:

```bash
git clone https://github.com/matrix-org/matrix-react-sdk
cd matrix-react-sdk
git checkout develop
yarn link matrix-js-sdk
yarn install
```

See the [help for `yarn link`](https://classic.yarnpkg.com/docs/cli/link) for
more details about this.

### Running tests

Ensure you've followed the above development instructions and then:

```bash
yarn test
```

### Running lint

To check your code complies with the project style, ensure you've followed the
above development instructions and then:

```bash
yarn lint
```

### Dependency problems

If you see errors (particularly "Cannot find module") running the lint or test
commands, and `yarn install` doesn't fix them, it may be because
yarn is not fetching git dependencies eagerly enough.

Try running this:

```bash
yarn cache clean && yarn install --force
```

Now the yarn commands should work as normal.

### End-to-End tests

Make sure you've got your Element development server running (by doing `yarn
start` in element-web), and then in this project, run `yarn run test:cypress`. See
[`docs/cypress.md`](https://github.com/matrix-org/matrix-react-sdk/blob/develop/docs/cypress.md)
for more information.
