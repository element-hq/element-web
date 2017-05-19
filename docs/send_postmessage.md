Logging in or out Riot from external server
===========================================

An external and whitelisted origin can log an user in or out, provided
it has all credentials of the user and is whitelisted in config.json.

To do this, the sender must send a postMessage to an element containing
Riot, like an iframe, with all credentials and also a valid token for the user.

The sender must be defined in config.json in `allowedPostMessageOrigins` List
to be allowed to effectively interfere in the user's session.

The parameters that are obligatory are the following:

 1. `action`: If the origin wants to 'login' or 'logout' Riot.
 2. `homeserverUrl`: The Home Server where the user is registered
 3. `identityServerUrl`: The Identity Server where her/his user is stored
 4. `accessToken`: a valid Access Token of the user session
 5. `userId`: the complete user ID

Besides these obligatory credentials, the postMessage might have the following
options:

 1. `deviceId`: The device ID where user is logged in. This is important if
 E2E is being used by this user.
 2. `forceLogout`: Boolean option to define if the user must see a dialog
 before logging out to have the option to export her/his E2E keys and therefore
 be able to recover encrypted messages' history. Default is *false*

Example:
========

``
window.onload = function() {
    var msg = {action: "login", accessToken:"{ACCESS_TOKEN}", homeserverUrl: "{HOME_SERVER_URL}", identityServerUrl: "{IDENTITY_SERVER_URL}", userId: "{USER_ID}"};
    var iframe = document.createElement('iframe');
    iframe.onload = function() { iframe.contentWindow.postMessage(JSON.stringify(msg), "*"); }; // before setting 'src'
    iframe.src = 'http://example_riot_iframe.org';
    document.body.appendChild(iframe);
};
``
