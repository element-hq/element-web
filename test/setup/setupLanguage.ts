/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import _ from "lodash";
import { setupLanguageMock as reactSetupLanguageMock } from "matrix-react-sdk/test/setup/setupLanguage";

import en from "../../src/i18n/strings/en_EN.json";
import reactEn from "../../src/i18n/strings/en_EN.json";

fetchMock.config.overwriteRoutes = false;

export function setupLanguageMock() {
    reactSetupLanguageMock();
    fetchMock.get("end:en_EN.json", _.merge({}, en, reactEn), { overwriteRoutes: true });
}
setupLanguageMock();
