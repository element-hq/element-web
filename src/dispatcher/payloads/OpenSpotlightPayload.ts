/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Action } from "../actions";
import { ActionPayload } from "../payloads";
import { Filter } from "../../components/views/dialogs/spotlight/Filter";

export interface OpenSpotlightPayload extends ActionPayload {
    action: Action.OpenSpotlight;

    initialFilter?: Filter;
    initialText?: string;
}
