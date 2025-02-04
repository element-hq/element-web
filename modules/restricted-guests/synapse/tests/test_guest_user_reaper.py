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
