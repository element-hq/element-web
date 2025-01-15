/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Utility code for registering with a homeserver
 * Note that this is currently *not* used by the actual
 * registration code.
 */

import React from "react";

import dis from "./dispatcher/dispatcher";
import Modal from "./Modal";
import { _t } from "./languageHandler";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import { Action } from "./dispatcher/actions";
import SettingsStore from "./settings/SettingsStore";
import { UIFeature } from "./settings/UIFeature";

// Regex for what a "safe" or "Matrix-looking" localpart would be.
// TODO: Update as needed for https://github.com/matrix-org/matrix-doc/issues/1514
export const SAFE_LOCALPART_REGEX = /^[a-z0-9=_\-./]+$/;

/**
 * Starts either the ILAG or full registration flow, depending
 * on what the HS supports
 *
 * @param {object} options
 * @param {bool} options.go_home_on_cancel
 *     If true, goes to the home page if the user cancels the action
 * @param {bool} options.go_welcome_on_cancel
 *     If true, goes to the welcome page if the user cancels the action
 * @param {bool} options.screen_after
 *     If present the screen to redirect to after a successful login or register.
 */
export async function startAnyRegistrationFlow(
    // eslint-disable-next-line camelcase
    options: { go_home_on_cancel?: boolean; go_welcome_on_cancel?: boolean; screen_after?: boolean } = {},
): Promise<void> {
    const modal = Modal.createDialog(QuestionDialog, {
        hasCancelButton: true,
        quitOnly: true,
        title: SettingsStore.getValue(UIFeature.Registration) ? _t("auth|sign_in_or_register") : _t("action|sign_in"),
        description: SettingsStore.getValue(UIFeature.Registration)
            ? _t("auth|sign_in_or_register_description")
            : _t("auth|sign_in_description"),
        button: _t("action|sign_in"),
        extraButtons: SettingsStore.getValue(UIFeature.Registration)
            ? [
                  <button
                      key="register"
                      onClick={() => {
                          modal.close();
                          dis.dispatch({ action: "start_registration", screenAfterLogin: options.screen_after });
                      }}
                  >
                      {_t("auth|register_action")}
                  </button>,
              ]
            : [],
        onFinished: (proceed) => {
            if (proceed) {
                dis.dispatch({ action: "start_login", screenAfterLogin: options.screen_after });
            } else if (options.go_home_on_cancel) {
                dis.dispatch({ action: Action.ViewHomePage });
            } else if (options.go_welcome_on_cancel) {
                dis.dispatch({ action: "view_welcome_page" });
            }
        },
    });
}
