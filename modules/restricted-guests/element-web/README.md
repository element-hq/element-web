# @element-hq/element-web-module-restricted-guests

Restricted Guests module for Element Web.

Supports the following configuration options under the configuration key `io.element.element-web-modules.restricted-guests`:

| Key                       | Type    | Description                                                                                                                                     |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| guest_user_homeserver_url | string  | URL of the homeserver on which to register the guest, must be running the synapse module.                                                       |
| guest_user_prefix         | string  | Prefix to apply to all guests registered via the module, defaults to `@guest-`.                                                                 |
| skip_single_sign_on       | boolean | If true, the user will be forwarded to the login page instead of to the SSO login. This is only required if the home server has no SSO support. |
