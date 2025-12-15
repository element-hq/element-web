/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Constants for MatrixChat.state.view.
 *
 * The `View` is the primary state machine of the application: it has different states for the various setup flows
 * that the user may find themselves in. Once we have a functioning client, we can transition to the `LOGGED_IN` state
 * which is the "normal" state of the application.
 *
 * An incomplete state transition diagram follows.
 *
 *                      (initial state)
 *                    ┌─────────────────┐ Lock held by other instance  ┌─────────────────┐
 *                    │    LOADING      │─────────────────────────────►│ CONFIRM_LOCK_   │
 *                    │                 │◄─────────────────────────────│     THEFT       │
 *                    └─────────────────┘ Lock theft confirmed         └─────────────────┘
 *     Session recovered │     │      │                                           Token/OIDC login succeeded
 *        ┌──────────────┘     │      └──────────────────────────────────────────────────────────────────┐
 *        │                    └───────────────────────────────────────────┐                             │
 *        │                                                                │ No previous session         │
 *        │                                                                ▼                             │
 *        │          (from all other states                        ┌─────────────────┐                   │
 *        │            except LOCK_STOLEN)                         │     WELCOME     │                   │
 *        │                  │                                     │                 │                   │
 *        │                  │ Client logged out                   └─────────────────┘                   │
 *        │                  │                                            │   │                          │
 *        │                  └──────────────────────────┐       "Sign in" │   │ "Create account"         │
 *        │                                             │    ┌────────────┘   └──────────────┐           │
 *        │                                             │    │                               │           │
 *        │                       "Forgot               ▼    ▼       "Create an              ▼           │
 *        │   ┌─────────────────┐  password"     ┌─────────────────┐   account"     ┌─────────────────┐  │
 *        │   │ FORGOT_PASSWORD │◄───────────────│      LOGIN      │───────────────►│     REGISTER    │  │
 *        │   │                 │───────────────►│                 │◄───────────────│                 │  │
 *        │   └─────────────────┘ Complete /     └─────────────────┘ "Sign in here" └─────────────────┘  │
 *        │            ▲        "Sign in instead"        │                                   │           │
 *        │            │                                 └──────────────────────┐  ┌─────────┘           │
 *        │            │"Forgotten your                                         │  │  ┌──────────────────┘
 *        │            │ password?"                                             │  │  │
 *        │            │                                                        │  │  │
 *        │   ┌─────────────────┐ Soft-logout error                             │  │  │
 *        │   │  SOFT_LOGOUT    │◄───────────── (from all other states          │  │  │
 *        │   │                 │                except LOCK_STOLEN)            │  │  │
 *        │   └─────────────────┘                                               │  │  │
 *        │         │ Re-authentication succeeded                               ▼  ▼  ▼
 *        │         │                                                    ┌──────────────────┐
 *        ▼         ▼                                                    │ (postLoginSetup) │
 *     ┌─────────────────┐                                               └──────────────────┘
 *     │ PENDING_CLIENT_ │                                      Account has │     │      │ Account lacks
 *     │     START       │                                    cross-signing │     │      │ cross-signing
 *     └─────────────────┘                                           keys   │     │      │ keys
 *        │          │                                                      │     │      │
 *        │          └───────────────────────────────┐                      │     │      │
 *        │            Client started,               │                      │     │      └──────┐
 *        │            force_verification pending    │                      │     │             │
 *        │                                          ▼                      │     │             │
 *        │ Client started,                 ┌─────────────────┐             │     │             │
 *        │ force_verification              │  COMPLETE_      │◄────────────┘     │             ▼
 *        │ not needed                      │      SECURITY   │                   │      ┌─────────────────┐
 *        │                                 └─────────────────┘                   │      │   E2E_SETUP     │
 *        │                                          │                            │      │                 │
 *        │    ┌─────────────────────────────────────┘           E2EE not enabled │      └─────────────────┘
 *        │    │    ┌─────────────────────────────────────────────────────────────┘              │
 *        │    │    │     ┌──────────────────────────────────────────────────────────────────────┘
 *        │    │    │     │
 *        │    │    │     │
 *        │    │    │     │
 *        │    │    │     │
 *        ▼    ▼    ▼     ▼
 *       ┌─────────────────┐
 *       │   LOGGED_IN     │
 *       │                 │
 *       └─────────────────┘
 *
 *       (from all other states)
 *                │
 *                │ Session lock stolen
 *                ▼
 *       ┌─────────────────┐
 *       │  LOCK_STOLEN    │
 *       │                 │
 *       └─────────────────┘
 */
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

    /**
     * We have successfully recovered a session from localstorage, but the client
     * has not yet been started.
     */
    PENDING_CLIENT_START,

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
