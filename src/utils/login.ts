/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import type MatrixChat from "../components/structures/MatrixChat";
import Views from "../Views";

export function isLoggedIn(): boolean {
    // JRS: Maybe we should move the step that writes this to the window out of
    // `element-web` and into this file? Better yet, we should probably create a
    // store to hold this state.
    // See also https://github.com/vector-im/element-web/issues/15034.
    const app = window.matrixChat;
    return (app as MatrixChat)?.state.view === Views.LOGGED_IN;
}
