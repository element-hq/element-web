# @element-hq/element-web-module-restricted-guests

Restricted Guests module for Element Web.

Supports the following configuration options under the configuration key `io.element.element-web-modules.restricted-guests`:

| Key                       | Type    | Description                                                                                                                                     |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| guest_user_homeserver_url | string  | URL of the homeserver on which to register the guest, must be running the synapse module.                                                       |
| guest_user_prefix         | string  | Prefix to apply to all guests registered via the module, defaults to `@guest-`.                                                                 |
| skip_single_sign_on       | boolean | If true, the user will be forwarded to the login page instead of to the SSO login. This is only required if the home server has no SSO support. |
| allow_copy_invite_link    | boolean | If true, the email invitation dialog shows a button to copy a link to the room. Defaults to `false`.                                            |

## Knocking ("ask to join") has to be enabled

In order to make the feature work, **knocking has to be enabled** via config.json

```
"features": {
  "feature_ask_to_join": true
}
```

## Inviting guests by email

Users who can invite people to a room get an "Invite guests" action in the room info panel and in the member list. They enter one or more email addresses, and the homeserver sends each guest an email invite.

Guests join a room by knocking. If the room isn't already "Ask to join", the inviter has to confirm switching the room to it, and the action is disabled if they aren't allowed to change the join rule. Rooms whose version doesn't support knocking can't have guests: the user is asked to upgrade the room or create a new one.

The homeserver must run the Synapse restricted-guests module, which provides the `/_synapse/client/invite_guests` endpoint used to send the invites.

## Facilitating how users can obtain the room link

If you want to make it more obvious to users how to copy the link, you can modify the link a user gets from "Copy link" in the right sidebar by using `permalink_prefix` in config.json. If you don't do that, users will have to copy the URL from the address bar.

Setting `allow_copy_invite_link` also adds a "Copy invite link" button to the email invitation dialog. That link uses `permalink_prefix` too.

## Development

Run these from `modules/restricted-guests`:

- `pnpm test:unit` runs the unit tests with vitest.
- `pnpm build` builds the module into `lib/`.

## Copyright & License

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
