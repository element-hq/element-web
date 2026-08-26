# @element-hq/element-web-module-restricted-guests

Restricted Guests module for Element Web.

Supports the following configuration options under the configuration key `io.element.element-web-modules.restricted-guests`:

| Key                       | Type    | Description                                                                                                                                     |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| guest_user_homeserver_url | string  | URL of the homeserver on which to register the guest, must be running the synapse module.                                                       |
| guest_user_prefix         | string  | Prefix to apply to all guests registered via the module, defaults to `@guest-`.                                                                 |
| skip_single_sign_on       | boolean | If true, the user will be forwarded to the login page instead of to the SSO login. This is only required if the home server has no SSO support. |

## Copyright & License

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
