/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createContext } from "react";

/**
 * React context whose value is whether the local device has been verified.
 *
 * (Specifically, this is true if we have done enough verification to confirm that the published public cross-signing
 * keys are genuine -- which normally means that we or another device will have published a signature of this device.)
 *
 * This context is available to all components under {@link LoggedInView}, via {@link MatrixClientContextProvider}.
 */
export const LocalDeviceVerificationStateContext = createContext(false);
