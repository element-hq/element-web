# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright (C) 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the repository root for full details.
#
# Originally licensed under the Apache License, Version 2.0:
# <http://www.apache.org/licenses/LICENSE-2.0>.

import attr


@attr.s(frozen=True, auto_attribs=True)
class GuestModuleConfig:
    user_id_prefix: str
    display_name_suffix: str
    enable_user_reaper: bool
    user_expiration_seconds: int
