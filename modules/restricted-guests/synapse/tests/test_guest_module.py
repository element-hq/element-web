# Copyright 2023 Nordeck IT + Consulting GmbH
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import aiounittest
from synapse.module_api import ProfileInfo, UserProfile
from synapse.module_api.errors import ConfigError
from synapse.types import UserID

from synapse_guest_module.config import GuestModuleConfig
from synapse_guest_module.guest_module import GuestModule
from tests import create_module


class GuestModuleTest(aiounittest.AsyncTestCase):
    async def test_parse_config_empty(self) -> None:
        config = GuestModule.parse_config({})

        self.assertEqual(
            config,
            GuestModuleConfig(
                user_id_prefix="guest-",
                display_name_suffix=" (Guest)",
                enable_user_reaper=True,
                user_expiration_seconds=24 * 60 * 60,
            ),
        )

    async def test_parse_config_custom(self) -> None:
        config = GuestModule.parse_config(
            {
                "user_id_prefix": "tmp-",
                "display_name_suffix": " (Temporary)",
                "enable_user_reaper": False,
                "user_expiration_seconds": 100,
            }
        )

        self.assertEqual(
            config,
            GuestModuleConfig(
                user_id_prefix="tmp-",
                display_name_suffix=" (Temporary)",
                enable_user_reaper=False,
                user_expiration_seconds=100,
            ),
        )

    async def test_parse_config_fail_user_id_prefix(self) -> None:
        with self.assertRaisesRegex(
            ConfigError, "Config option 'user_id_prefix' must be a string"
        ):
            GuestModule.parse_config(
                {
                    "user_id_prefix": 1234,
                }
            )

    async def test_parse_config_fail_display_name_suffix(self) -> None:
        with self.assertRaisesRegex(
            ConfigError, "Config option 'display_name_suffix' must be a string"
        ):
            GuestModule.parse_config(
                {
                    "display_name_suffix": 1234,
                }
            )

    async def test_parse_config_fail_enable_user_reaper(self) -> None:
        with self.assertRaisesRegex(
            ConfigError, "Config option 'enable_user_reaper' must be a bool"
        ):
            GuestModule.parse_config(
                {
                    "enable_user_reaper": "False",
                }
            )

    async def test_parse_config_fail_user_expiration_seconds(self) -> None:
        with self.assertRaisesRegex(
            ConfigError, "Config option 'user_expiration_seconds' must be a number"
        ):
            GuestModule.parse_config(
                {
                    "user_expiration_seconds": "1",
                }
            )

    async def test_profile_update_no_guest(self) -> None:
        module, module_api, _ = create_module()

        await module.profile_update(
            "@my-user:matrix.local",
            ProfileInfo(display_name="My User", avatar_url=None),
            True,
            False,
        )

        module_api.set_displayname.assert_not_called()

    async def test_profile_update_guest_keep(self) -> None:
        module, module_api, _ = create_module()

        await module.profile_update(
            "@guest-asdf:matrix.local",
            ProfileInfo(display_name="My User (Guest)", avatar_url=None),
            True,
            False,
        )

        module_api.set_displayname.assert_not_called()

    async def test_profile_update_guest_add_and_trim(self) -> None:
        module, module_api, _ = create_module()

        await module.profile_update(
            "@guest-asdf:matrix.local",
            ProfileInfo(display_name="My User ", avatar_url=None),
            True,
            False,
        )

        module_api.set_displayname.assert_awaited_once_with(
            UserID.from_string("@guest-asdf:matrix.local"),
            "My User (Guest)",
        )

    async def test_callback_user_may_create_room_no_guest(self) -> None:
        module, _, _ = create_module()

        allow = await module.callback_user_may_create_room(
            "@my-user:matrix.local",
        )

        self.assertTrue(allow)

    async def test_callback_user_may_create_room_guest(self) -> None:
        module, _, _ = create_module()

        allow = await module.callback_user_may_create_room(
            "@guest-asdf:matrix.local",
        )

        self.assertFalse(allow)

    async def test_callback_user_may_invite_no_guest(self) -> None:
        module, _, _ = create_module()

        allow = await module.callback_user_may_invite(
            "@my-user:matrix.local",
            "@inviter:matrix.local",
            "!room:matrix.local",
        )

        self.assertTrue(allow)

    async def test_callback_user_may_invite_guest(self) -> None:
        module, _, _ = create_module()

        allow = await module.callback_user_may_invite(
            "@guest-asdf:matrix.local",
            "@inviter:matrix.local",
            "!room:matrix.local",
        )

        self.assertFalse(allow)

    async def test_callback_check_username_for_spam_no_guest(self) -> None:
        module, _, _ = create_module()

        allow = await module.callback_check_username_for_spam(
            UserProfile(
                user_id="@my-user:matrix.local",
                display_name=None,
                avatar_url=None,
            ),
        )

        self.assertFalse(allow)

    async def test_callback_check_username_for_spam_guest(self) -> None:
        module, _, _ = create_module()

        allow = await module.callback_check_username_for_spam(
            UserProfile(
                user_id="@guest-asdf:matrix.local",
                display_name=None,
                avatar_url=None,
            ),
        )

        self.assertTrue(allow)
