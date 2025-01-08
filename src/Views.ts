/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/** constants for MatrixChat.state.view */
enum Views {
    // a special initial state which is only used at startup, while we are
    // trying to re-animate a matrix client or register as a guest.
    LOADING,

    // Another tab holds the lock.
    CONFIRM_LOCK_THEFT,

    // we are showing the welcome view
    WELCOME,

    // we are showing the login view
    LOGIN,

    // we are showing the registration view
    REGISTER,

    // showing the 'forgot password' view
    FORGOT_PASSWORD,

    // showing flow to trust this new device with cross-signing
    COMPLETE_SECURITY,

    // flow to setup SSSS / cross-signing on this account
    E2E_SETUP,

    // we are logged in with an active matrix client. The logged_in state also
    // includes guests users as they too are logged in at the client level.
    LOGGED_IN,

    // We are logged out (invalid token) but have our local state again. The user
    // should log back in to rehydrate the client.
    SOFT_LOGOUT,

    // Another instance of the application has started up. We just show an error page.
    LOCK_STOLEN,
}

export default Views;
