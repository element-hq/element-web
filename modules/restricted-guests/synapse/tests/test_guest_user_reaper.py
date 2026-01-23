# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.
#
# Originally licensed under the Apache License, Version 2.0:
# <http://www.apache.org/licenses/LICENSE-2.0>.

import time
from unittest.mock import call

import aiounittest

from tests import create_module, make_awaitable


class GuestUserReaperTest(aiounittest.AsyncTestCase):
    async def test_get_admin_token_register(self) -> None:
        module, module_api, _ = create_module()

        token = await module.reaper.get_admin_token()

        module_api.check_user_exists.assert_called_with("guest-reaper")
        module_api.register_user.assert_called_with("guest-reaper", admin=True)
        module_api.register_device.assert_called_with("@guest-reaper:matrix.local")

        self.assertEqual(token, "syn_registered_token")

    async def test_get_admin_token_create_device(self) -> None:
        module, module_api, _ = create_module()

        module_api.check_user_exists.return_value = make_awaitable(True)

        token = await module.reaper.get_admin_token()

        module_api.check_user_exists.assert_called_with("guest-reaper")
        module_api.register_user.assert_not_called()
        module_api.register_device.assert_called_with("@guest-reaper:matrix.local")

        self.assertEqual(token, "syn_registered_token")

    async def test_get_admin_token_read_from_db(self) -> None:
        module, module_api, store = create_module()

        store.conn.execute(
            "INSERT INTO access_tokens VALUES ('@guest-reaper:matrix.local', 'syn_db_token')"
        )

        module_api.check_user_exists.return_value = make_awaitable(True)

        token = await module.reaper.get_admin_token()

        module_api.check_user_exists.assert_not_called()
        module_api.register_user.assert_not_called()
        module_api.register_device.assert_not_called()

        self.assertEqual(token, "syn_db_token")

    async def test_deactivate_expired_guest_users_success(self) -> None:
        module, module_api, store = create_module()

        now = int(time.time())
        store.conn.executemany(
            "INSERT INTO users VALUES (?, ?, ?)",
            [
                ["@user-1:matrix.local", 0, 0],
                ["@guest-reaper:matrix.local", 0, 0],
                ["@guest-active:matrix.local", 0, now],
                ["@guest-deactivated:matrix.local", 1, 0],
                ["@guest-old-1:matrix.local", 0, 0],
                ["@guest-old-2:matrix.local", 0, 0],
            ],
        )

        await module.reaper.deactivate_expired_guest_users()

        self.assertEqual(module_api.http_client.post_json_get_json.await_count, 2)

        module_api.http_client.post_json_get_json.assert_has_awaits(
            [
                call(
                    uri="http://localhost:8008/_synapse/admin/v1/deactivate/@guest-old-1:matrix.local",
                    post_json={},
                    headers={"Authorization": ["Bearer syn_registered_token"]},
                ),
                call(
                    uri="http://localhost:8008/_synapse/admin/v1/deactivate/@guest-old-2:matrix.local",
                    post_json={},
                    headers={"Authorization": ["Bearer syn_registered_token"]},
                ),
            ]
        )

    async def test_deactivate_expired_guest_users_with_failure(self) -> None:
        module, module_api, store = create_module()

        store.conn.executemany(
            "INSERT INTO users VALUES (?, ?, ?)",
            [
                ["@guest-old-1:matrix.local", 0, 0],
                ["@guest-old-2:matrix.local", 0, 0],
            ],
        )

        module_api.http_client.post_json_get_json.side_effect = Exception("")

        await module.reaper.deactivate_expired_guest_users()

        module_api.http_client.post_json_get_json.assert_has_awaits(
            [
                call(
                    uri="http://localhost:8008/_synapse/admin/v1/deactivate/@guest-old-1:matrix.local",
                    post_json={},
                    headers={"Authorization": ["Bearer syn_registered_token"]},
                ),
                call(
                    uri="http://localhost:8008/_synapse/admin/v1/deactivate/@guest-old-2:matrix.local",
                    post_json={},
                    headers={"Authorization": ["Bearer syn_registered_token"]},
                ),
            ]
        )

    async def test_deactivate_expired_mas_users_success(self) -> None:
        module, module_api, store = create_module(
            {
                "mas": {
                    "admin_api_base_url": "https://mas.example.org",
                    "oauth_base_url": "https://oauth.mas.example.org",
                    "client_id": "client-id",
                    "client_secret": "client-secret",
                },
            }
        )

        now = int(time.time())
        store.conn.executemany(
            "INSERT INTO guest_module_mas_users VALUES (?, ?, ?)",
            [
                ["mas-old-1", "@old-1:localhost", 0],
                ["mas-active", "@active:localhost", now],
            ],
        )

        # These two methods are `AsyncMock`s, so no need to use `make_awaitable`.`
        token_response = {"access_token": "mas_admin_token"}
        module_api.http_client.post_urlencoded_get_json.return_value = token_response
        module_api.http_client.post_json_get_json.return_value = {}

        await module.reaper.deactivate_expired_guest_users()

        deactivate_call = call(
            uri="https://mas.example.org/api/admin/v1/users/mas-old-1/deactivate",
            post_json={"skip_erase": True},
            headers={"Authorization": ["Bearer mas_admin_token"]},
        )
        self.assertIn(
            deactivate_call,
            module_api.http_client.post_json_get_json.await_args_list,
        )

        remaining_users = store.conn.execute(
            "SELECT mas_user_id, user_id FROM guest_module_mas_users"
        ).fetchall()
        self.assertEqual(remaining_users, [("mas-active", "@active:localhost")])
