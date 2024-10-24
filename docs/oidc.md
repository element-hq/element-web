# OIDC and delegated authentication

## Compatibility/OIDC-aware mode

[MSC2965: OIDC provider discovery](https://github.com/matrix-org/matrix-spec-proposals/pull/2965)
[MSC3824: OIDC aware clients](https://github.com/matrix-org/matrix-spec-proposals/pull/3824)
This mode uses an SSO flow to gain a `loginToken` from the authentication provider, then continues with SSO login.
Element Web uses [MSC2965: OIDC provider discovery](https://github.com/matrix-org/matrix-spec-proposals/pull/2965) to discover the configured provider.
Wherever valid MSC2965 configuration is discovered, OIDC-aware login flow will be the only option offered.

## (🧪Experimental) OIDC-native flow

Can be enabled by a config-level-only setting in `config.json`

```json
{
    "features": {
        "feature_oidc_native_flow": true
    }
}
```

See https://areweoidcyet.com/client-implementation-guide/ for implementation details.

Element Web uses [MSC2965: OIDC provider discovery](https://github.com/matrix-org/matrix-spec-proposals/pull/2965) to discover the configured provider.
Where OIDC native login flow is enabled and valid MSC2965 configuration is discovered, OIDC native login flow will be the only login option offered.
Element Web will attempt to [dynamically register](https://openid.net/specs/openid-connect-registration-1_0.html) with the configured OP.
Then, authentication will be completed [as described here](https://areweoidcyet.com/client-implementation-guide/).

#### Statically configured OIDC clients

Clients that are already registered with the OP can configure their `client_id` in `config.json`.
Where static configuration exists for the OP dynamic client registration will not be attempted.

```json
{
    "oidc_static_clients": {
        "https://dummyoidcprovider.com/": {
            "client_id": "abc123"
        }
    }
}
```
