/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import MatrixClientBackedController from "../../../../src/settings/controllers/MatrixClientBackedController";
import InviteRulesConfigController from "../../../../src/settings/controllers/InviteRulesConfigController";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { getMockClientWithEventEmitter, mockClientMethodsServer } from "../../../test-utils";
import { INVITE_RULES_ACCOUNT_DATA_TYPE, type InviteConfigAccountData } from "../../../../src/@types/invite-rules";

describe("InviteRulesConfigController", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("gets the default settings when none are specified.", () => {
        const controller = new InviteRulesConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: jest.fn().mockReturnValue(null),
        });

        const value = controller.getValueOverride(SettingLevel.ACCOUNT);
        expect(value).toEqual(InviteRulesConfigController.default);
    });

    it("gets the default settings when the setting is empty.", () => {
        const controller = new InviteRulesConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: jest
                .fn()
                .mockReturnValue(new MatrixEvent({ type: INVITE_RULES_ACCOUNT_DATA_TYPE, content: {} })),
        });

        const value = controller.getValueOverride(SettingLevel.ACCOUNT);
        expect(value).toEqual(InviteRulesConfigController.default);
    });

    it.each<InviteConfigAccountData>([{ blocked_users: ["foo_bar"] }, { blocked_users: [] }, {}])(
        "calculates blockAll to be false",
        (content: InviteConfigAccountData) => {
            const controller = new InviteRulesConfigController();

            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: jest.fn().mockReturnValue(
                    new MatrixEvent({
                        type: INVITE_RULES_ACCOUNT_DATA_TYPE,
                        content,
                    }),
                ),
            });

            const globalValue = controller.getValueOverride(SettingLevel.ACCOUNT);
            expect(globalValue.allBlocked).toEqual(false);
        },
    );

    it.each<InviteConfigAccountData>([
        { blocked_users: ["*"] },
        { blocked_users: ["*", "bob"] },
        { allowed_users: ["*"], blocked_users: ["*"] },
    ])("calculates blockAll to be true", (content: InviteConfigAccountData) => {
        const controller = new InviteRulesConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: jest.fn().mockReturnValue(
                new MatrixEvent({
                    type: INVITE_RULES_ACCOUNT_DATA_TYPE,
                    content,
                }),
            ),
        });

        const globalValue = controller.getValueOverride(SettingLevel.ACCOUNT);
        expect(globalValue.allBlocked).toEqual(true);
    });

    it("sets the account data correctly for blockAll = true", async () => {
        const controller = new InviteRulesConfigController();
        const client = (MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: jest.fn().mockReturnValue(
                new MatrixEvent({
                    type: INVITE_RULES_ACCOUNT_DATA_TYPE,
                    content: {
                        existing_content: {},
                        allowed_servers: ["*"],
                    },
                }),
            ),
            setAccountData: jest.fn(),
        }));

        expect(await controller.beforeChange(SettingLevel.ACCOUNT, null, { allBlocked: true })).toBe(true);
        expect(client.setAccountData).toHaveBeenCalledWith(INVITE_RULES_ACCOUNT_DATA_TYPE, {
            existing_content: {},
            allowed_servers: ["*"],
            blocked_users: ["*"],
        });
    });

    it("sets the account data correctly for blockAll = false", async () => {
        const controller = new InviteRulesConfigController();
        const client = (MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: jest.fn().mockReturnValue(
                new MatrixEvent({
                    type: INVITE_RULES_ACCOUNT_DATA_TYPE,
                    content: {
                        existing_content: {},
                        allowed_servers: ["*"],
                        blocked_users: ["extra_user", "*"],
                    },
                }),
            ),
            setAccountData: jest.fn(),
        }));

        expect(await controller.beforeChange(SettingLevel.ACCOUNT, null, { allBlocked: false })).toBe(true);
        expect(client.setAccountData).toHaveBeenCalledWith(INVITE_RULES_ACCOUNT_DATA_TYPE, {
            existing_content: {},
            allowed_servers: ["*"],
            blocked_users: ["extra_user"],
        });
    });
    it.each([true, false])("ignores a no-op when allBlocked = %s", async (allBlocked) => {
        const controller = new InviteRulesConfigController();
        const client = (MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: jest.fn().mockReturnValue(
                new MatrixEvent({
                    type: INVITE_RULES_ACCOUNT_DATA_TYPE,
                    content: {
                        existing_content: {},
                        allowed_servers: ["*"],
                        blocked_users: allBlocked ? ["*"] : [],
                    },
                }),
            ),
            setAccountData: jest.fn(),
        }));

        expect(await controller.beforeChange(SettingLevel.ACCOUNT, null, { allBlocked })).toBe(false);
        expect(client.setAccountData).not.toHaveBeenCalled();
    });
});
