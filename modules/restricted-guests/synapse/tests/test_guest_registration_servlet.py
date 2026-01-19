# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.
#
# Originally licensed under the Apache License, Version 2.0:
# <http://www.apache.org/licenses/LICENSE-2.0>.

import io
from typing import Tuple, cast
from unittest.mock import ANY, Mock

import aiounittest
from parameterized import parameterized_class  # type: ignore[import-untyped]
from twisted.web.server import Request
from twisted.web.test.requesthelper import DummyRequest

from synapse_guest_module import GuestModule
from synapse_guest_module.mas_admin_client import MasAdminClient
from tests import (
    SQLiteStore,
    create_module,
    make_awaitable,
    mas_config_override,
    set_async_return_value,
    set_async_side_effect,
)


@parameterized_class(
    ("variant", "config_override"),
    [
        ("synapse", None),
        ("mas", mas_config_override()),
    ],
)
class GuestUserReaperTest(aiounittest.AsyncTestCase):
    def create_module(self) -> Tuple[GuestModule, Mock, SQLiteStore]:
        return create_module(self.config_override)

    async def test_async_render_POST_missing_displayname(self) -> None:
        module, _, _ = self.create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b"{}")

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 400)
        self.assertEqual(
            response, {"msg": "You must provide a 'displayname' as a string"}
        )

    async def test_async_render_POST_empty_displayname(self) -> None:
        module, _, _ = self.create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b'{"displayname":"  "}')

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 400)
        self.assertEqual(
            response, {"msg": "You must provide a 'displayname' as a string"}
        )

    async def test_async_render_POST_no_free_username(self) -> None:
        module, module_api, _ = self.create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b'{"displayname":"My Name"}')

        module_api.check_user_exists.return_value = make_awaitable(True)

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 500)
        self.assertEqual(
            response, {"msg": "Internal error: Could not find a free username"}
        )

        self.assertEqual(module_api.check_user_exists.call_count, 10)

    async def test_async_render_POST_success(self) -> None:
        module, module_api, _ = self.create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b'{"displayname":"My Name "}')

        if self.config_override is not None:
            module.registration_servlet._mas_admin_client._generate_device_id = (  # type: ignore[method-assign,union-attr]
                lambda: "MASDEVICE123"
            )
            set_async_return_value(
                module_api.http_client.post_urlencoded_get_json,
                {"access_token": "mas_admin_token"},
            )
            set_async_side_effect(
                module_api.http_client.post_json_get_json,
                [
                    {"data": {"id": "mas-user-id"}},
                    {
                        "data": {
                            "id": "MASDEVICE123",
                            "attributes": {"access_token": "mas_access_token"},
                        }
                    },
                ],
            )

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 201)

        self.assertRegex(response.pop("userId"), r"^@guest-[A-Za-z0-9]+:matrix.local$")
        if self.config_override is None:
            self.assertDictEqual(
                response,
                {
                    "accessToken": "syn_registered_token",
                    "deviceId": "DEVICEID",
                    "homeserverUrl": "https://matrix.local:1234/",
                    # "userId" was already checked by self.assertRegex and was removed from the object
                },
            )
            module_api.register_user.assert_called_with(ANY, "My Name (Guest)")
        else:
            self.assertDictEqual(
                response,
                {
                    "accessToken": "mas_access_token",
                    "deviceId": "MASDEVICE123",
                    "homeserverUrl": "https://matrix.local:1234/",
                    # "userId" was already checked by self.assertRegex and was removed from the object
                },
            )


class MasAdminClientTest(aiounittest.AsyncTestCase):
    async def test_generate_device_id_format(self) -> None:
        device_id = MasAdminClient._generate_device_id()

        self.assertGreaterEqual(len(device_id), 10)
        self.assertRegex(device_id, r"^[A-Za-z0-9-]+$")
