# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.

import base64
import logging
from typing import Any, Dict

from synapse.module_api import ModuleApi

from synapse_guest_module.config import MasConfig

logger = logging.getLogger("synapse.contrib." + __name__)


class MasAdminClient:
    def __init__(self, api: ModuleApi, config: MasConfig):
        self._api = api
        self._config = config
        # Strip trailing any slashes if present
        self._admin_api_base_url = config.admin_api_base_url.rstrip("/")
        self._oauth_base_url = config.oauth_base_url.rstrip("/")

    async def create_user(self, username: str) -> None:
        token = await self.request_admin_token()
        url = self._build_admin_url("/api/admin/v1/users")

        await self._api.http_client.post_json_get_json(
            uri=url,
            post_json={"username": username},
            headers={"Authorization": [f"Bearer {token}"]},
        )

    async def request_admin_token(self) -> str:
        url = self._build_oauth_url("/oauth2/token")
        basic_auth = base64.b64encode(
            f"{self._config.client_id}:{self._config.client_secret}".encode("utf-8")
        ).decode("ascii")
        headers = {
            "Authorization": [f"Basic {basic_auth}"],
            "Content-Type": ["application/x-www-form-urlencoded"],
        }
        data = {
            "grant_type": "client_credentials",
            "scope": "urn:mas:admin",
        }

        response = await self._post_urlencoded_get_json(url, data, headers)
        access_token = response.get("access_token")
        if not isinstance(access_token, str) or len(access_token) == 0:
            raise ValueError("MAS token response missing access_token")
        return access_token

    async def _post_urlencoded_get_json(
        self, url: str, data: Dict[str, str], headers: Dict[str, Any]
    ) -> Any:
        http_client = self._api.http_client
        post_urlencoded = getattr(http_client, "post_urlencoded_get_json", None)
        if callable(post_urlencoded):
            return await post_urlencoded(url, data, headers=headers)

        logger.debug(
            "MAS client falling back to post_json_get_json for %s", url
        )
        return await http_client.post_json_get_json(
            uri=url, post_json=data, headers=headers
        )

    def _build_admin_url(self, path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return f"{self._admin_api_base_url}{path}"

    def _build_oauth_url(self, path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return f"{self._oauth_base_url}{path}"
