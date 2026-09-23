/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX, type JSXElementConstructor } from "react";

export type { NonEmptyArray, XOR, Writeable } from "matrix-js-sdk/src/matrix";

export type * from "shared-types/lib/utils";

export type ComponentClass = keyof JSX.IntrinsicElements | JSXElementConstructor<any>;

export type { Leaves } from "matrix-web-i18n";
