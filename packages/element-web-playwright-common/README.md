# @element-hq/element-web-playwright-common

Set of Playwright & testcontainers utilities to make it easier to write tests for Element Web, Element Web Modules & Element Desktop.

The main export includes a number of fixtures and custom assertions as documented in JSDoc.

The `lib/testcontainers` export contains the following modules:

- `SynapseContainer` - A testcontainer for running a Synapse server
- `MatrixAuthenticationServiceContainer` - A testcontainer for running a Matrix Authentication Service
- `MailpitContainer` - A testcontainer for running a Mailpit SMTP server

There are a number of utils available in the `lib/utils` export.

## Releases

The API is versioned using semver, with the major version incremented for breaking changes.

## Copyright & License

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
