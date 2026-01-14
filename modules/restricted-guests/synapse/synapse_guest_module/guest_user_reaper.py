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
import time
from typing import List

from synapse.module_api import DatabasePool, LoggingTransaction, ModuleApi

from synapse_guest_module.config import GuestModuleConfig
from synapse_guest_module.mas_admin_client import MasAdminClient

logger = logging.getLogger("synapse.contrib." + __name__)


class GuestUserReaper:
    def __init__(
        self,
        api: ModuleApi,
        config: GuestModuleConfig,
        mas_admin_client: MasAdminClient | None = None,
        mas_tables_ready: asyncio.Event | None = None,
    ):
        self._api = api
        self._config = config
        self._mas_admin_client = mas_admin_client
        self._mas_tables_ready = mas_tables_ready
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
        if self._mas_admin_client is not None:
            await self._deactivate_expired_mas_users()
            return

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

    async def _deactivate_expired_mas_users(self) -> None:
        if self._mas_tables_ready is not None:
            await self._mas_tables_ready.wait()

        def get_expired_users(txn: LoggingTransaction) -> List[str]:
            expire_ts_seconds = int(time.time() - self._config.user_expiration_seconds)
            txn.execute(
                """
                SELECT mas_user_id
                FROM guest_module_mas_users
                WHERE created_at < ?
                """,
                (expire_ts_seconds,),
            )
            expired_users_rows = txn.fetchall()

            return [row[0] for row in expired_users_rows]

        expired_users: List[str] = await self._api.run_db_interaction(
            "guest_module_get_expired_mas_users",
            get_expired_users,
        )

        if len(expired_users) == 0:
            return

        logger.info("Deactivating %d expired MAS users", len(expired_users))

        token = await self._mas_admin_client.request_admin_token()

        for mas_user_id in expired_users:
            try:
                await self._mas_admin_client.deactivate_user(mas_user_id, token)
                await self._remove_mas_user(mas_user_id)
            except Exception as e:
                logger.error('Failed to deactivate MAS user "%s": %s', mas_user_id, e)

    async def _remove_mas_user(self, mas_user_id: str) -> None:
        def delete_user(txn: LoggingTransaction) -> None:
            txn.execute(
                "DELETE FROM guest_module_mas_users WHERE mas_user_id = ?",
                (mas_user_id,),
            )

        await self._api.run_db_interaction(
            "guest_module_delete_mas_user",
            delete_user,
        )

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
