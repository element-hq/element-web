# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.
#
# Originally licensed under the Apache License, Version 2.0:
# <http://www.apache.org/licenses/LICENSE-2.0>.

import io
from typing import cast
from unittest.mock import ANY

import aiounittest
from twisted.web.server import Request
from twisted.web.test.requesthelper import DummyRequest

from tests import create_module, make_awaitable


class GuestUserReaperTest(aiounittest.AsyncTestCase):
    async def test_async_render_POST_missing_displayname(self) -> None:
        module, _, _ = create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b"{}")

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 400)
        self.assertEqual(
            response, {"msg": "You must provide a 'displayname' as a string"}
        )

    async def test_async_render_POST_empty_displayname(self) -> None:
        module, _, _ = create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b'{"displayname":"  "}')

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 400)
        self.assertEqual(
            response, {"msg": "You must provide a 'displayname' as a string"}
        )

    async def test_async_render_POST_no_free_username(self) -> None:
        module, module_api, _ = create_module()

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
        module, module_api, _ = create_module()

        request = cast(Request, DummyRequest([]))
        request.content = io.BytesIO(b'{"displayname":"My Name "}')

        status, response = await module.registration_servlet._async_render_POST(request)

        self.assertEqual(status, 201)

        self.assertRegex(response.pop("userId"), r"^@guest-[A-Za-z0-9]+:matrix.local$")
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
