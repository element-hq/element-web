/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";
import userEvent from "@testing-library/user-event";

import { MediaPreviewAccountSettings } from "../../../../../../../src/components/views/settings/tabs/user/MediaPreviewAccountSettings";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../../../test-utils";
import MatrixClientBackedController from "../../../../../../../src/settings/controllers/MatrixClientBackedController";
import MatrixClientBackedSettingsHandler from "../../../../../../../src/settings/handlers/MatrixClientBackedSettingsHandler";
import type { MockedObject } from "jest-mock";
import type { MatrixClient } from "matrix-js-sdk/src/client";
import { MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, MediaPreviewValue } from "../../../../../../../src/@types/media_preview";

describe("MediaPreviewAccountSettings", () => {
    let client: MockedObject<MatrixClient>;
    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            ...mockClientMethodsUser(),
            getRoom: jest.fn(),
            setAccountData: jest.fn(),
            isVersionSupported: jest.fn().mockResolvedValue(true),
        });
        MatrixClientBackedController.matrixClient = client;
        MatrixClientBackedSettingsHandler.matrixClient = client;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should render", () => {
        const { getByLabelText } = render(<MediaPreviewAccountSettings />);
        // Defaults
        expect(getByLabelText("Hide avatars of room and inviter")).not.toBeChecked();
        expect(getByLabelText("Always hide")).not.toBeChecked();
        expect(getByLabelText("In private rooms")).not.toBeChecked();
        expect(getByLabelText("Always show")).toBeChecked();
    });

    it("should be able to toggle hide avatar", async () => {
        const { getByLabelText } = render(<MediaPreviewAccountSettings />);
        // Defaults
        const element = getByLabelText("Hide avatars of room and inviter");
        await userEvent.click(element);
        expect(client.setAccountData).toHaveBeenCalledWith(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, {
            invite_avatars: MediaPreviewValue.Off,
            media_previews: MediaPreviewValue.On,
        });
    });

    // Skip the default.
    it.each([
        ["Always hide", MediaPreviewValue.Off],
        ["In private rooms", MediaPreviewValue.Private],
    ])("should be able to toggle media preview %s", async (key, value) => {
        const { getByLabelText } = render(<MediaPreviewAccountSettings />);
        // Defaults
        const element = getByLabelText(key);
        await userEvent.click(element);
        expect(client.setAccountData).toHaveBeenCalledWith(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, {
            invite_avatars: MediaPreviewValue.On,
            media_previews: value,
        });
    });
});
