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

import sqlite3
from asyncio import Future
from typing import Any, Awaitable, Callable, Tuple, TypeVar
from unittest.mock import Mock

from synapse.http.client import SimpleHttpClient
from synapse.module_api import ModuleApi

from synapse_guest_module import GuestModule

RV = TypeVar("RV")
TV = TypeVar("TV")


class SQLiteStore:
    """In-memory SQLite store. We can't just use a run_db_interaction function that opens
    its own connection, since we need to use the same connection for all queries in a
    test.
    """

    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:")

    async def run_db_interaction(
        self, desc: str, f: Callable[..., RV], *args: Any, **kwargs: Any
    ) -> RV:
        cur = CursorWrapper(self.conn.cursor())
        try:
            res = f(cur, *args, **kwargs)
            self.conn.commit()
            return res
        except Exception:
            self.conn.rollback()
            raise


class CursorWrapper:
    """Wrapper around a SQLite cursor."""

    def __init__(self, cursor: sqlite3.Cursor) -> None:
        self.cur = cursor

    def execute(self, sql: str, args: Any) -> None:
        self.cur.execute(sql, args)

    @property
    def rowcount(self) -> Any:
        return self.cur.rowcount

    def fetchone(self) -> Any:
        return self.cur.fetchone()

    def fetchall(self) -> Any:
        return self.cur.fetchall()

    def __iter__(self) -> Any:
        return self.cur.__iter__()

    def __next__(self) -> Any:
        return self.cur.__next__()


def make_awaitable(result: TV) -> Awaitable[TV]:
    """
    Makes an awaitable, suitable for mocking an `async` function.
    This uses Futures as they can be awaited multiple times so can be returned
    to multiple callers.
    This function has been copied directly from Synapse's tests code.
    """
    future = Future()  # type: ignore
    future.set_result(result)
    return future


def get_qualified_user_id(username: str) -> str:
    return f"@{username}:matrix.local"


async def register_user(localpart: str, admin: bool = False) -> str:
    return f"@{localpart}:matrix.local"


def create_module() -> Tuple[GuestModule, Mock, SQLiteStore]:
    store = SQLiteStore()
    _setup_db(store.conn)

    client = Mock(spec=SimpleHttpClient)
    client.post_json_get_json.return_value = make_awaitable(None)

    # Create a mock based on the ModuleApi spec, but override some mocked functions
    # because some capabilities are needed for running the tests.
    module_api = Mock(spec=ModuleApi)
    module_api.http_client = client
    module_api.server_name = "matrix.local"
    module_api.public_baseurl = "https://matrix.local:1234/"
    module_api.run_db_interaction.side_effect = store.run_db_interaction
    module_api.get_qualified_user_id.side_effect = get_qualified_user_id
    module_api.check_user_exists.return_value = make_awaitable(False)
    module_api.register_user.side_effect = register_user
    module_api.register_device.return_value = make_awaitable(
        ("DEVICEID", "syn_registered_token", None, None)
    )

    # If necessary, give parse_config some configuration to parse.
    config = GuestModule.parse_config(
        {
            "enable_user_reaper": False,
        }
    )

    module = GuestModule(config, module_api)

    return module, module_api, store


def _setup_db(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE access_tokens(user_id text, token text)")
    conn.execute(
        "CREATE TABLE users(name text, deactivated smallint, creation_ts bigint)"
    )
