# Media handling

Surely media should be as easy as just putting a URL into an `img` and calling it good, right?
Not quite. Matrix uses something called a Matrix Content URI (better known as MXC URI) to identify
content, which is then converted to a regular HTTPS URL on the homeserver. However, sometimes that
URL can change depending on deployment considerations.

The react-sdk features a [customisation endpoint](https://github.com/vector-im/element-web/blob/develop/docs/customisations.md)
for media handling where all conversions from MXC URI to HTTPS URL happen. This is to ensure that
those obscure deployments can route all their media to the right place.

For development, there are currently two functions available: `mediaFromMxc` and `mediaFromContent`.
The `mediaFromMxc` function should be self-explanatory. `mediaFromContent` takes an event content as
a parameter and will automatically parse out the source media and thumbnail. Both functions return
a `Media` object with a number of options on it, such as getting various common HTTPS URLs for the
media.

**It is extremely important that all media calls are put through this customisation endpoint.** So
much so it's a lint rule to avoid accidental use of the wrong functions.
