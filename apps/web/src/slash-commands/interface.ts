/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import { _td } from "../languageHandler";
import { type XOR } from "../@types/common";

export const CommandCategories = {
    messages: _td("slash_command|category_messages"),
    actions: _td("slash_command|category_actions"),
    admin: _td("slash_command|category_admin"),
    advanced: _td("slash_command|category_advanced"),
    effects: _td("slash_command|category_effects"),
    other: _td("slash_command|category_other"),
};

export type RunResult = XOR<{ error: Error }, { promise: Promise<RoomMessageEventContent | undefined> }>;
