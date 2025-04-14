/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MediaPreviewAccountSettings } from "../../../../../../../src/components/views/settings/tabs/user/MediaPreviewAccountSettings";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../../../test-utils";
import MatrixClientBackedController from "../../../../../../../src/settings/controllers/MatrixClientBackedController";
import MatrixClientBackedSettingsHandler from "../../../../../../../src/settings/handlers/MatrixClientBackedSettingsHandler";
import type { MockedObject } from "jest-mock";
import {
    MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
    type MediaPreviewConfig,
    MediaPreviewValue,
} from "../../../../../../../src/@types/media_preview";
import MediaPreviewConfigController from "../../../../../../../src/settings/controllers/MediaPreviewConfigController";

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
        // Ensure we don't double set the account data.
        expect(client.setAccountData).toHaveBeenCalledTimes(1);
    });

    // Skip the default.
    it.each([
        ["Always hide", MediaPreviewValue.Off],
        ["In private rooms", MediaPreviewValue.Private],
        ["Always show", MediaPreviewValue.On],
    ])("should be able to toggle media preview option %s", async (key, value) => {
        if (value === MediaPreviewConfigController.default.media_previews) {
            // This is the default, so switch away first.
            client.getAccountData.mockImplementation((type) => {
                if (type === MEDIA_PREVIEW_ACCOUNT_DATA_TYPE) {
                    return new MatrixEvent({
                        content: {
                            media_previews: MediaPreviewValue.Off,
                        } satisfies Partial<MediaPreviewConfig>,
                    });
                }
                return undefined;
            });
        }
        const { getByLabelText } = render(<MediaPreviewAccountSettings />);

        const element = getByLabelText(key);
        await userEvent.click(element);
        expect(client.setAccountData).toHaveBeenCalledWith(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, {
            invite_avatars: MediaPreviewValue.On,
            media_previews: value,
        });
        // Ensure we don't double set the account data.
        expect(client.setAccountData).toHaveBeenCalledTimes(1);
    });
});
