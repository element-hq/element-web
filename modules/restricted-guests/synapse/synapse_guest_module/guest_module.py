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

import logging
from typing import Any, Dict, Literal, Tuple, Union

from synapse.module_api import (
    NOT_SPAM,
    ModuleApi,
    ProfileInfo,
    UserProfile,
    errors,
    run_as_background_process,
)
from synapse.module_api.errors import ConfigError
from synapse.types import UserID

from synapse_guest_module.config import GuestModuleConfig
from synapse_guest_module.guest_registration_servlet import GuestRegistrationServlet
from synapse_guest_module.guest_user_reaper import GuestUserReaper

logger = logging.getLogger("synapse.contrib." + __name__)


class GuestModule:
    def __init__(self, config: GuestModuleConfig, api: ModuleApi):
        self._api = api
        self._config = config

        self.registration_servlet = GuestRegistrationServlet(config, api)
        self._api.register_web_resource(
            "/_synapse/client/register_guest", self.registration_servlet
        )
        self._api.register_third_party_rules_callbacks(
            on_profile_update=self.profile_update
        )
        self._api.register_spam_checker_callbacks(
            user_may_create_room=self.callback_user_may_create_room,
            user_may_invite=self.callback_user_may_invite,
            user_may_join_room=self.callback_user_may_join_room,
            check_username_for_spam=self.callback_check_username_for_spam,
        )

        # Start the user reaper
        self.reaper = GuestUserReaper(api, config)
        if config.enable_user_reaper:
            run_as_background_process(
                "guest_module_reaper_bg_task",
                self.reaper.run,
                bg_start_span=False,
            )

    @staticmethod
    def parse_config(config: Dict[str, Any]) -> GuestModuleConfig:
        """Parse the module configuration"""

        user_id_prefix = config.get("user_id_prefix", "guest-")
        if not isinstance(user_id_prefix, str):
            raise ConfigError("Config option 'user_id_prefix' must be a string")

        display_name_suffix = config.get("display_name_suffix", " (Guest)")
        if not isinstance(display_name_suffix, str):
            raise ConfigError("Config option 'display_name_suffix' must be a string")

        enable_user_reaper = config.get("enable_user_reaper", True)
        if not isinstance(enable_user_reaper, bool):
            raise ConfigError("Config option 'enable_user_reaper' must be a bool")

        user_expiration_seconds = config.get(
            "user_expiration_seconds",
            24 * 60 * 60,
        )
        if not isinstance(user_expiration_seconds, int):
            raise ConfigError(
                "Config option 'user_expiration_seconds' must be a number"
            )

        return GuestModuleConfig(
            user_id_prefix,
            display_name_suffix,
            enable_user_reaper,
            user_expiration_seconds,
        )

    async def profile_update(
        self,
        user_id: str,
        new_profile: ProfileInfo,
        by_admin: bool,
        deactivation: bool,
    ) -> None:
        """Is called whenever a profile is updated. We check that a guest user
        always contains the configured suffix (default ` (Guest)`) and add it if
        it is missing.
        """
        user_is_guest = user_id.startswith("@" + self._config.user_id_prefix)
        if user_is_guest:
            new_profile_display_name = (
                "" if new_profile.display_name is None else new_profile.display_name
            )
            guest_display_name_not_valid = not new_profile_display_name.endswith(
                self._config.display_name_suffix
            )
            if guest_display_name_not_valid:
                user_id_1 = UserID.from_string(user_id)
                guest_display_name = (
                    new_profile_display_name.strip() + self._config.display_name_suffix
                )
                await self._api.set_displayname(user_id_1, guest_display_name)

    async def callback_user_may_create_room(
        self,
        user_id: str,
    ) -> bool:
        """Returns whether this user is allowed to create a room. Guest users
        should not be able to do that.
        """
        user_is_guest = user_id.startswith("@" + self._config.user_id_prefix)
        return not user_is_guest

    async def callback_user_may_invite(
        self,
        inviter: str,
        invitee: str,
        room_id: str,
    ) -> bool:
        """Returns whether this user is allowed to invite someone into a room.
        Guest users should not be able to to that.
        """
        user_is_guest = inviter.startswith("@" + self._config.user_id_prefix)
        return not user_is_guest

    async def callback_user_may_join_room(
        self, user_id: str, room_id: str, is_invited: bool
    ) -> Union[
        Literal["NOT_SPAM"], errors.Codes, Tuple[errors.Codes, Dict[str, Any]], bool
    ]:
        """Returns whether this user is allowed to join a room. Guest users
        should only be able to do that if the room is Ask to Join (knock).
        """
        user_is_guest = user_id.startswith("@" + self._config.user_id_prefix)
        if not user_is_guest or is_invited:
            return NOT_SPAM

        join_rules_events = await self._api.get_state_events_in_room(
            room_id, [("m.room.join_rules", None)]
        )
        if join_rules_events is None or len(list(join_rules_events)) == 0:
            return errors.Codes.BAD_STATE

        for event in join_rules_events:
            join_rule = event.get("content", {})
            is_knock = join_rule.get("join_rule").startswith("knock")
            if user_is_guest and is_knock:
                return NOT_SPAM

        return errors.Codes.FORBIDDEN

    async def callback_check_username_for_spam(self, user_profile: UserProfile) -> bool:
        """Returns whether this user should appear in the user directory. Since
        we prefer to not invite guests into normal rooms, we hide them here.
        """
        user_is_guest = user_profile["user_id"].startswith(
            "@" + self._config.user_id_prefix
        )
        return user_is_guest
