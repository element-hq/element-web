# Skinning

Skinning in the context of the react-sdk is component replacement rather than CSS. This means you can override (replace)
any accessible component in the project to implement custom behaviour, look & feel, etc. Depending on your approach,
overriding CSS classes to apply custom styling is also possible, though harder to do.

At present, the react-sdk offers no stable interface for components - this means properties and state can and do change
at any time without notice. Once we determine the react-sdk to be stable enough to use as a proper SDK, we will adjust
this policy. In the meantime, skinning is done completely at your own risk.

The approach you take is up to you - we suggest using a module replacement plugin, as found in
[webpack](https://webpack.js.org/plugins/normal-module-replacement-plugin/), though you're free to use whichever build
system works for you. The react-sdk does not have any particular functions to call to load skins, so simply replace or
extend the components/stores/etc you're after and build. As a reminder though, this is done completely at your own risk
as we cannot guarantee a stable interface at this time.

Taking a look at [element-web](https://github.com/vector-im/element-web)'s approach to skinning may be worthwhile, as it
overrides some relatively simple components.
