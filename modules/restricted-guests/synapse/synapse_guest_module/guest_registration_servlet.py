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
import secrets
import string
from typing import Any, Dict, Tuple

from synapse.module_api import (
    DirectServeJsonResource,
    ModuleApi,
    parse_json_object_from_request,
)
from twisted.web.server import Request

from synapse_guest_module.config import GuestModuleConfig

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
    ):
        super().__init__()
        self._api = api
        self._config = config

    async def _async_render_POST(self, request: Request) -> Tuple[int, Dict[str, Any]]:
        """On POST requests, generate a new username for a guest, check that it
        doesn't exist yet, append the suffix to the displayname, create the user,
        create a device, and return the session data to the caller.
        """

        json_dict = parse_json_object_from_request(request)

        displayname = json_dict.get("displayname")
        if not isinstance(displayname, str) or len(displayname.strip()) == 0:
            return 400, {"msg": "You must provide a 'displayname' as a string"}

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

            logger.info("Register guest with user %s", localpart)
            user_id = await self._api.register_user(
                localpart, displayname.strip() + self._config.display_name_suffix
            )

            device_id, access_token, _, _ = await self._api.register_device(user_id)

            logger.debug("Registered user %s", user_id)

            res = {
                "userId": user_id,
                "deviceId": device_id,
                "accessToken": access_token,
                "homeserverUrl": self._api.public_baseurl,
            }

            return 201, res

        return 500, {"msg": "Internal error: Could not find a free username"}
