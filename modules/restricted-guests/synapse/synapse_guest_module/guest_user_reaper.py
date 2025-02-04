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
import time
from typing import List

from synapse.module_api import DatabasePool, LoggingTransaction, ModuleApi

from synapse_guest_module.config import GuestModuleConfig

logger = logging.getLogger("synapse.contrib." + __name__)


class GuestUserReaper:
    def __init__(self, api: ModuleApi, config: GuestModuleConfig):
        self._api = api
        self._config = config
        self.reaper_user = f"{config.user_id_prefix}reaper"

    async def run(self) -> None:
        logger.info("User cleanup job started")

        await self._api.sleep(5.0)  # Wait for Synapse to start properly

        while True:
            logger.debug("Run deactivation loop")

            try:
                await self.deactivate_expired_guest_users()
            except Exception as e:
                logger.error("Error in the user deactivation: %s", e)

            await self._api.sleep(60.0)

    async def deactivate_expired_guest_users(self) -> None:
        """Deactivate all users that are older than the specified expiration
        interval. This uses the admin API to disable the user.
        """

        def get_expired_users(txn: LoggingTransaction) -> List[str]:
            sql = """
            SELECT name
            FROM users
            WHERE name != ?
            AND name LIKE ?
            AND deactivated = 0
            AND creation_ts < ?;
            """

            # date operations are database-specific (postgres, sqlite, ...)
            expire_ts_seconds = int(time.time() - self._config.user_expiration_seconds)
            txn.execute(
                sql,
                (
                    self._api.get_qualified_user_id(self.reaper_user),
                    f"@{self._config.user_id_prefix}%:{self._api.server_name}",
                    expire_ts_seconds,
                ),
            )
            expired_users_rows = txn.fetchall()

            return [row[0] for row in expired_users_rows]

        expired_users: List[str] = await self._api.run_db_interaction(
            "guest_module_get_expired_users",
            get_expired_users,
        )

        if len(expired_users) > 0:
            logger.info("Deactivate %d users", len(expired_users))

            token = await self.get_admin_token()

            for user_id in expired_users:
                logger.debug("Deactivate user %s", user_id)

                url = f"http://localhost:8008/_synapse/admin/v1/deactivate/{user_id}"

                try:
                    await self._api.http_client.post_json_get_json(
                        uri=url,
                        post_json={},
                        headers={"Authorization": ["Bearer {}".format(token)]},
                    )
                except Exception as e:
                    logger.error('Failed to delete user "%s": %s', user_id, e)

    async def get_admin_token(self) -> str:
        """Create a new admin user in synapse so the module can call the admin
        api. If no user or login session exists, we create new ones.
        """

        def get_access_token_txn(txn: LoggingTransaction) -> str | None:
            tokens = DatabasePool.simple_select_onecol_txn(
                txn,
                table="access_tokens",
                keyvalues={
                    "user_id": self._api.get_qualified_user_id(self.reaper_user),
                },
                retcol="token",
            )

            if len(tokens) > 0 and isinstance(tokens[0], str):
                return tokens[0]
            else:
                return None

        token: str | None = await self._api.run_db_interaction(
            "guest_module_get_access_token",
            get_access_token_txn,
        )

        if token is not None:
            return token

        if not await self._api.check_user_exists(self.reaper_user):
            logger.info(
                'Register new administrator user "%s"',
                self.reaper_user,
            )

            await self._api.register_user(self.reaper_user, admin=True)

        logger.info('Register new device for administrator user "%s"', self.reaper_user)

        _, access_token, _, _ = await self._api.register_device(
            self._api.get_qualified_user_id(self.reaper_user)
        )

        return access_token
