/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Options } from "../../../services.ts";

export const isDendrite = ({ homeserverType }: Options): boolean => {
    return homeserverType === "dendrite" || homeserverType === "pinecone";
};
