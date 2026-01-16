# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.
#
# Originally licensed under the Apache License, Version 2.0:
# <http://www.apache.org/licenses/LICENSE-2.0>.

import asyncio
import logging
import secrets
import string
import time
from typing import Any, Dict, Tuple

from synapse.module_api import (
    DatabasePool,
    DirectServeJsonResource,
    ModuleApi,
    parse_json_object_from_request,
)
from synapse.types import UserID
from twisted.web.server import Request

from synapse_guest_module.config import GuestModuleConfig
from synapse_guest_module.mas_admin_client import MasAdminClient

logger = logging.getLogger("synapse.contrib." + __name__)


class GuestRegistrationServlet(DirectServeJsonResource):
    """The `POST /_synapse/client/register_guest` endpoints provides an endpoint
    to register a new guest user. It requires the `displayname` property and
    returns an object that matches the `AccountAuthInfo` of the
    `@matrix-org/react-sdk-module-api`.
    """

    def __init__(
        self,
        config: GuestModuleConfig,
        api: ModuleApi,
        mas_admin_client: MasAdminClient | None = None,
        mas_tables_ready: asyncio.Event | None = None,
    ):
        super().__init__()
        self._api = api
        self._config = config
        self._mas_admin_client = mas_admin_client
        self._mas_tables_ready = mas_tables_ready

    async def _async_render_POST(self, request: Request) -> Tuple[int, Dict[str, Any]]:
        """On POST requests, generate a new username for a guest, check that it
        doesn't exist yet, append the suffix to the displayname, create the user,
        create a device, and return the session data to the caller.
        """

        json_dict = parse_json_object_from_request(request)

        displayname = json_dict.get("displayname")
        if not isinstance(displayname, str) or len(displayname.strip()) == 0:
            return 400, {"msg": "You must provide a 'displayname' as a string"}

        displayname = displayname.strip()

        # make sure the regex is unique
        for _ in range(10):
            random_string = "".join(
                secrets.choice(string.ascii_lowercase + string.digits)
                for _ in range(32)
            )

            localpart = self._config.user_id_prefix + random_string

            # make sure the user-id does not exist yet
            if await self._api.check_user_exists(
                self._api.get_qualified_user_id(localpart)
            ):
                continue

            if self._mas_admin_client is None:
                logger.info(
                    "Registering local Synapse guest user with localpart '%s'",
                    localpart,
                )
                user_id = await self._api.register_user(
                    localpart, displayname + self._config.display_name_suffix
                )

                device_id, access_token, _, _ = await self._api.register_device(user_id)
            else:
                logger.info("Registering MAS guest user with username '%s'", localpart)
                mas_user_id = await self._mas_admin_client.create_user(localpart)

                user_id = self._api.get_qualified_user_id(localpart)

                await self._api.set_displayname(
                    UserID.from_string(user_id),
                    displayname + self._config.display_name_suffix,
                )

                await self._store_mas_user(mas_user_id, int(time.time()))

                # Determine how long to keep the access token valid for.
                #
                # If a user reaper is enabled, just have the token expire after
                # the configured period.
                expires_in = (
                    self._config.user_expiration_seconds
                    if self._config.enable_user_reaper
                    else 0
                )
                (
                    device_id,
                    access_token,
                ) = await self._mas_admin_client.create_personal_session(
                    mas_user_id, expires_in
                )

            logger.debug("Registered user '%s'", user_id)

            res = {
                "userId": user_id,
                "deviceId": device_id,
                "accessToken": access_token,
                "homeserverUrl": self._api.public_baseurl,
            }

            return 201, res

        return 500, {"msg": "Internal error: Could not find a free username"}

    async def _store_mas_user(self, mas_user_id: str, created_at: int) -> None:
        if self._mas_tables_ready is not None:
            await self._mas_tables_ready.wait()

        def store_user(txn: Any) -> None:
            DatabasePool.simple_insert_txn(
                txn,
                table="guest_module_mas_users",
                values={
                    "mas_user_id": mas_user_id,
                    "created_at": created_at,
                },
            )

        await self._api.run_db_interaction("guest_module_store_mas_user", store_user)
