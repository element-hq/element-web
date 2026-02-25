/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { SETTINGS } from "../../../../src/settings/Settings";
import { stubClient } from "../../../test-utils";
import MatrixClientBackedController from "../../../../src/settings/controllers/MatrixClientBackedController";
import { SettingLevel } from "../../../../src/settings/SettingLevel.ts";

describe("BlockInvitesConfigController", () => {
    describe("When server does not support MSC4380", () => {
        let cli: MatrixClient;
        beforeEach(() => {
            cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async () => false);
            MatrixClientBackedController.matrixClient = cli;
        });

        test("settingDisabled() should give a message", () => {
            const controller = SETTINGS.blockInvites.controller!;
            expect(controller.settingDisabled).toEqual("Your server does not implement this feature.");
        });
    });

    describe("When server supports MSC4380", () => {
        let cli: MatrixClient;
        beforeEach(async () => {
            cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async (feature) => {
                return feature == "org.matrix.msc4380";
            });
            MatrixClientBackedController.matrixClient = cli;
        });

        test("settingDisabled() should be false", () => {
            const controller = SETTINGS.blockInvites.controller!;
            expect(controller.settingDisabled).toEqual(false);
        });

        describe("getValueOverride()", () => {
            it("should return true when invites are blocked", async () => {
                const controller = SETTINGS.blockInvites.controller!;

                mockAccountData(cli, { default_action: "block" });
                expect(controller.getValueOverride(SettingLevel.DEVICE, null, null, null)).toEqual(true);
            });

            it("should return false when invites are not blocked", async () => {
                const controller = SETTINGS.blockInvites.controller!;

                mockAccountData(cli, { default_action: {} });
                expect(controller.getValueOverride(SettingLevel.DEVICE, null, null, null)).toEqual(false);
            });
        });

        describe("beforeChange()", () => {
            it("should set the account data when the value is enabled", async () => {
                const controller = SETTINGS.blockInvites.controller!;
                await controller.beforeChange(SettingLevel.DEVICE, null, true);
                expect(cli.setAccountData).toHaveBeenCalledTimes(1);
                expect(cli.setAccountData).toHaveBeenCalledWith("org.matrix.msc4380.invite_permission_config", {
                    default_action: "block",
                });
            });

            it("should set the account data when the value is disabled", async () => {
                const controller = SETTINGS.blockInvites.controller!;
                await controller.beforeChange(SettingLevel.DEVICE, null, false);
                expect(cli.setAccountData).toHaveBeenCalledTimes(1);
                expect(cli.setAccountData).toHaveBeenCalledWith("org.matrix.msc4380.invite_permission_config", {
                    default_action: "allow",
                });
            });
        });
    });
});

/**
 * Add a mock implementation for {@link MatrixClient.getAccountData} which will return the given data
 * in respomsnse to any request for `org.matrix.msc4380.invite_permission_config`.
 */
function mockAccountData(cli: MatrixClient, mockAccountData: object) {
    mocked(cli.getAccountData).mockImplementation((eventType) => {
        if (eventType == "org.matrix.msc4380.invite_permission_config") {
            return new MatrixEvent({
                type: "org.matrix.msc4380.invite_permission_config",
                content: mockAccountData,
            });
        } else {
            return undefined;
        }
    });
}
