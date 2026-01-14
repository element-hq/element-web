# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.
#
# Originally licensed under the Apache License, Version 2.0:
# <http://www.apache.org/licenses/LICENSE-2.0>.

import logging
from typing import Any, Dict, Literal, Optional, Tuple, Union

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

from synapse_guest_module.config import GuestModuleConfig, MasConfig
from synapse_guest_module.mas_admin_client import MasAdminClient
from synapse_guest_module.guest_registration_servlet import GuestRegistrationServlet
from synapse_guest_module.guest_user_reaper import GuestUserReaper

logger = logging.getLogger("synapse.contrib." + __name__)


class GuestModule:
    def __init__(self, config: GuestModuleConfig, api: ModuleApi):
        self._api = api
        self._config = config

        mas_admin_client = (
            MasAdminClient(api, config.mas) if config.mas is not None else None
        )
        self.registration_servlet = GuestRegistrationServlet(
            config, api, mas_admin_client
        )
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

        mas_config = config.get("mas")
        mas: Optional[MasConfig] = None
        if mas_config is not None:
            if not isinstance(mas_config, dict):
                raise ConfigError("Config option 'mas' must be an object")

            admin_api_base_url = mas_config.get("admin_api_base_url")
            if not isinstance(admin_api_base_url, str) or len(admin_api_base_url.strip()) == 0:
                raise ConfigError("Config option 'mas.admin_api_base_url' is required and must be a string")

            oauth_base_url = mas_config.get("oauth_base_url", admin_api_base_url)
            if not isinstance(oauth_base_url, str) or len(oauth_base_url.strip()) == 0:
                raise ConfigError(
                    "Config option 'mas.oauth_base_url' must be a string"
                )

            client_id = mas_config.get("client_id")
            if not isinstance(client_id, str) or len(client_id.strip()) == 0:
                raise ConfigError("Config option 'mas.client_id' is required and must be a string")

            client_secret = mas_config.get("client_secret")
            if not isinstance(client_secret, str) or len(client_secret.strip()) == 0:
                raise ConfigError("Config option 'mas.client_secret' is required and must be a string")

            mas = MasConfig(
                admin_api_base_url.strip(),
                oauth_base_url.strip(),
                client_id.strip(),
                client_secret.strip(),
            )

        return GuestModuleConfig(
            user_id_prefix,
            display_name_suffix,
            enable_user_reaper,
            user_expiration_seconds,
            mas,
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
