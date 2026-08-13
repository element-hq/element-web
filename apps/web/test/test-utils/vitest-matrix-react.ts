/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "@testing-library/jest-dom/vitest";
// eslint-disable-next-line no-restricted-imports
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

export * from "./jest-matrix-react.tsx";
