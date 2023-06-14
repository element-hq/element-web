/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/** constants for MatrixChat.state.view */
enum Views {
    // a special initial state which is only used at startup, while we are
    // trying to re-animate a matrix client or register as a guest.
    LOADING,

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

    // screen that allows users to select which use case they’ll use matrix for
    USE_CASE_SELECTION,

    // we are logged in with an active matrix client. The logged_in state also
    // includes guests users as they too are logged in at the client level.
    LOGGED_IN,

    // We are logged out (invalid token) but have our local state again. The user
    // should log back in to rehydrate the client.
    SOFT_LOGOUT,
}

export default Views;
