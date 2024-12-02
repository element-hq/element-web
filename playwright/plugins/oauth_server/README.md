# oauth_server

A very simple OAuth identity provider server.

The following endpoints are exposed:

- `/oauth/auth.html`: An OAuth2 [authorization endpoint](https://openid.net/specs/openid-connect-core-1_0.html#AuthorizationEndpoint).
  In a proper OAuth2 system, this would prompt the user to log in; we just give a big "Submit" button (and an
  auth code that can be changed if we want the next step to fail). It redirects back to the calling application
  with a "code".

- `/oauth/token`: An OAuth2 [token endpoint](https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint).
  Receives the code issued by "auth.html" and, if it is valid, exchanges it for an OAuth2 access token.

- `/oauth/userinfo`: An OAuth2 [userinfo endpoint](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo).
  Returns details about the owner of the offered access token.

To start the server, do:

```javascript
cy.task("startOAuthServer").then((port) => {
    // now we can configure Synapse or Element to talk to the OAuth2 server.
});
```
