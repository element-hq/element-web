# OAuth2 and delegated authentication

See https://areweoidcyet.com/client-implementation-guide/ for implementation details.

Element Web uses [/auth_metadata](https://spec.matrix.org/v1.18/client-server-api/#get_matrixclientv1auth_metadata) to discover the configured provider.
Where a valid configuration is discovered, OAuth2 native login flow will be the only login option offered.
Element Web will attempt to [dynamically register](https://spec.matrix.org/v1.18/client-server-api/#client-registration) with the configured OP.
Then, authentication will be completed [as described here](https://areweoidcyet.com/client-implementation-guide/).

#### Statically configured OAuth2 clients

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
