/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult } from "jest-matrix-react";
import {
    ConditionKind,
    EventType,
    type IPushRule,
    MatrixEvent,
    ClientEvent,
    PushRuleKind,
} from "matrix-js-sdk/src/matrix";
import { MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";
import { logger } from "matrix-js-sdk/src/logger";
import userEvent from "@testing-library/user-event";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import LoggedInView from "../../../../src/components/structures/LoggedInView";
import { SDKContext } from "../../../../src/contexts/SDKContext";
import { StandardActions } from "../../../../src/notifications/StandardActions";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";
import { TestSdkContext } from "../../TestSdkContext";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { Action } from "../../../../src/dispatcher/actions";
import Modal from "../../../../src/Modal";
import { SETTINGS } from "../../../../src/settings/Settings";

// Create a mock resizer instance that can be shared across tests
const mockResizerInstance = {
    attach: jest.fn(),
    detach: jest.fn(),
    forHandleWithId: jest.fn().mockReturnValue({ resize: jest.fn() }),
    setClassNames: jest.fn(),
};

// Mock the Resizer module
jest.mock("../../../../src/resizer", () => {
    const originalModule = jest.requireActual("../../../../src/resizer");
    return {
        ...originalModule,
        Resizer: jest.fn().mockImplementation((container, distributorBuilder, collapseConfig) => {
            // Store the callbacks globally for test access
            (global as any).__resizeCallbacks = collapseConfig;
            return mockResizerInstance;
        }),
    };
});

describe("<LoggedInView />", () => {
    const userId = "@alice:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getAccountData: jest.fn(),
        getRoom: jest.fn(),
        getSyncState: jest.fn().mockReturnValue(null),
        getSyncStateData: jest.fn().mockReturnValue(null),
        getMediaHandler: jest.fn(),
        setPushRuleEnabled: jest.fn(),
        setPushRuleActions: jest.fn(),
        getCrypto: jest.fn().mockReturnValue(undefined),
        setExtendedProfileProperty: jest.fn().mockResolvedValue(undefined),
        deleteExtendedProfileProperty: jest.fn().mockResolvedValue(undefined),
        doesServerSupportExtendedProfiles: jest.fn().mockResolvedValue(true),
    });
    const mediaHandler = new MediaHandler(mockClient);
    const mockSdkContext = new TestSdkContext();

    const defaultProps = {
        matrixClient: mockClient,
        onRegistered: jest.fn(),
        resizeNotifier: new ResizeNotifier(),
        collapseLhs: false,
        hideToSRUsers: false,
        config: {
            brand: "Test",
            element_call: {},
        },
        currentRoomId: "",
        currentUserId: "@bob:server",
    };

    const getComponent = (props = {}): RenderResult =>
        render(<LoggedInView {...defaultProps} {...props} />, {
            wrapper: ({ children }) => <SDKContext.Provider value={mockSdkContext}>{children}</SDKContext.Provider>,
        });

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.getMediaHandler.mockReturnValue(mediaHandler);
        mockClient.setPushRuleActions.mockReset().mockResolvedValue({});
        // @ts-expect-error
        mockClient.pushProcessor = new PushProcessor(mockClient);
    });

    describe("synced push rules", () => {
        const pushRulesEvent = new MatrixEvent({ type: EventType.PushRules });

        const oneToOneRule = {
            conditions: [
                { kind: ConditionKind.RoomMemberCount, is: "2" },
                { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.message" },
            ],
            actions: StandardActions.ACTION_NOTIFY,
            rule_id: ".m.rule.room_one_to_one",
            default: true,
            enabled: true,
        } as IPushRule;

        const oneToOneRuleDisabled = {
            ...oneToOneRule,
            enabled: false,
        };

        const groupRule = {
            conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.message" }],
            actions: StandardActions.ACTION_NOTIFY,
            rule_id: ".m.rule.message",
            default: true,
            enabled: true,
        } as IPushRule;

        const pollStartOneToOne = {
            conditions: [
                {
                    kind: ConditionKind.RoomMemberCount,
                    is: "2",
                },
                {
                    kind: ConditionKind.EventMatch,
                    key: "type",
                    pattern: "org.matrix.msc3381.poll.start",
                },
            ],
            actions: StandardActions.ACTION_NOTIFY,
            rule_id: ".org.matrix.msc3930.rule.poll_start_one_to_one",
            default: true,
            enabled: true,
        } as IPushRule;

        const pollEndOneToOne = {
            conditions: [
                {
                    kind: ConditionKind.RoomMemberCount,
                    is: "2",
                },
                {
                    kind: ConditionKind.EventMatch,
                    key: "type",
                    pattern: "org.matrix.msc3381.poll.end",
                },
            ],
            actions: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            rule_id: ".org.matrix.msc3930.rule.poll_end_one_to_one",
            default: true,
            enabled: true,
        } as IPushRule;

        const pollStartGroup = {
            conditions: [
                {
                    kind: ConditionKind.EventMatch,
                    key: "type",
                    pattern: "org.matrix.msc3381.poll.start",
                },
            ],
            actions: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            rule_id: ".org.matrix.msc3930.rule.poll_start",
            default: true,
            enabled: true,
        } as IPushRule;

        beforeEach(() => {
            mockClient.getAccountData.mockImplementation((eventType: string) =>
                eventType === EventType.PushRules ? pushRulesEvent : undefined,
            );
            setPushRules([]);
            // stub out error logger to avoid littering console
            jest.spyOn(logger, "error")
                .mockClear()
                .mockImplementation(() => {});

            mockClient.setPushRuleActions.mockClear();
            mockClient.setPushRuleEnabled.mockClear();
        });

        const setPushRules = (rules: IPushRule[] = []): void => {
            const pushRules = {
                global: {
                    underride: [...rules],
                },
            };

            mockClient.pushRules = pushRules;
        };

        describe("on mount", () => {
            it("handles when user has no push rules event in account data", () => {
                mockClient.getAccountData.mockReturnValue(undefined);
                getComponent();

                expect(mockClient.getAccountData).toHaveBeenCalledWith(EventType.PushRules);
                expect(logger.error).not.toHaveBeenCalled();
            });

            it("handles when user doesnt have a push rule defined in vector definitions", () => {
                // synced push rules uses VectorPushRulesDefinitions
                // rules defined there may not exist in m.push_rules
                // mock push rules with group rule, but missing oneToOne rule
                setPushRules([pollStartOneToOne, groupRule, pollStartGroup]);

                getComponent();

                // just called once for one-to-one
                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(1);
                // set to match primary rule (groupRule)
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollStartGroup.rule_id,
                    StandardActions.ACTION_NOTIFY,
                );
            });

            it("updates all mismatched rules from synced rules", () => {
                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRule, // on
                    pollStartOneToOne, // on
                    pollEndOneToOne, // loud
                    // poll group rules are synced with groupRule
                    groupRule, // on
                    pollStartGroup, // loud
                ]);

                getComponent();

                // only called for rules not in sync with their primary rule
                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(2);
                // set to match primary rule
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollStartGroup.rule_id,
                    StandardActions.ACTION_NOTIFY,
                );
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollEndOneToOne.rule_id,
                    StandardActions.ACTION_NOTIFY,
                );
            });

            it("updates all mismatched rules from synced rules when primary rule is disabled", async () => {
                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRuleDisabled, // off
                    pollStartOneToOne, // on
                    pollEndOneToOne, // loud
                    // poll group rules are synced with groupRule
                    groupRule, // on
                    pollStartGroup, // loud
                ]);

                getComponent();

                await flushPromises();

                // set to match primary rule
                expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Underride,
                    pollStartOneToOne.rule_id,
                    false,
                );
                expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Underride,
                    pollEndOneToOne.rule_id,
                    false,
                );
            });

            it("catches and logs errors while updating a rule", async () => {
                mockClient.setPushRuleActions.mockRejectedValueOnce("oups").mockResolvedValueOnce({});

                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRule, // on
                    pollStartOneToOne, // on
                    pollEndOneToOne, // loud
                    // poll group rules are synced with groupRule
                    groupRule, // on
                    pollStartGroup, // loud
                ]);

                getComponent();
                await flushPromises();

                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(2);
                // both calls made
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollStartGroup.rule_id,
                    StandardActions.ACTION_NOTIFY,
                );
                // second primary rule still updated after first rule failed
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollEndOneToOne.rule_id,
                    StandardActions.ACTION_NOTIFY,
                );
                expect(logger.error).toHaveBeenCalledWith(
                    "Failed to fully synchronise push rules for .m.rule.room_one_to_one",
                    "oups",
                );
            });
        });

        describe("on changes to account_data", () => {
            it("ignores other account data events", () => {
                // setup a push rule state with mismatched rules
                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRule, // on
                    pollEndOneToOne, // loud
                ]);

                getComponent();

                mockClient.setPushRuleActions.mockClear();

                const someOtherAccountData = new MatrixEvent({ type: "my-test-account-data " });
                mockClient.emit(ClientEvent.AccountData, someOtherAccountData);

                // didnt check rule sync
                expect(mockClient.setPushRuleActions).not.toHaveBeenCalled();
            });

            it("updates all mismatched rules from synced rules on a change to push rules account data", () => {
                // setup a push rule state with mismatched rules
                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRule, // on
                    pollEndOneToOne, // loud
                ]);

                getComponent();

                mockClient.setPushRuleActions.mockClear();

                mockClient.emit(ClientEvent.AccountData, pushRulesEvent);

                // set to match primary rule
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollEndOneToOne.rule_id,
                    StandardActions.ACTION_NOTIFY,
                );
            });

            it("updates all mismatched rules from synced rules on a change to push rules account data when primary rule is disabled", async () => {
                // setup a push rule state with mismatched rules
                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRuleDisabled, // off
                    pollEndOneToOne, // loud
                ]);

                getComponent();

                await flushPromises();

                mockClient.setPushRuleEnabled.mockClear();

                mockClient.emit(ClientEvent.AccountData, pushRulesEvent);

                // set to match primary rule
                expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollEndOneToOne.rule_id,
                    false,
                );
            });

            it("stops listening to account data events on unmount", () => {
                // setup a push rule state with mismatched rules
                setPushRules([
                    // poll 1-1 rules are synced with oneToOneRule
                    oneToOneRule, // on
                    pollEndOneToOne, // loud
                ]);

                const { unmount } = getComponent();

                mockClient.setPushRuleActions.mockClear();

                unmount();

                mockClient.emit(ClientEvent.AccountData, pushRulesEvent);

                // not called
                expect(mockClient.setPushRuleActions).not.toHaveBeenCalled();
            });
        });
    });

    it("should fire FocusMessageSearch on Ctrl+F when enabled", async () => {
        jest.spyOn(defaultDispatcher, "fire");
        await SettingsStore.setValue("ctrlFForSearch", null, SettingLevel.DEVICE, true);

        getComponent();
        await userEvent.keyboard("{Control>}f{/Control}");
        expect(defaultDispatcher.fire).toHaveBeenCalledWith(Action.FocusMessageSearch);
    });

    it("should go home on home shortcut", async () => {
        jest.spyOn(defaultDispatcher, "dispatch");

        getComponent();
        await userEvent.keyboard("{Control>}{Alt>}h</Alt>{/Control}");
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: Action.ViewHomePage });
    });

    it("should ignore home shortcut if dialogs are open", async () => {
        jest.spyOn(defaultDispatcher, "dispatch");
        jest.spyOn(Modal, "hasDialogs").mockReturnValue(true);

        getComponent();

        await userEvent.keyboard("{Control>}{Alt>}h</Alt>{/Control}");
        expect(defaultDispatcher.dispatch).not.toHaveBeenCalledWith({ action: Action.ViewHomePage });
    });

    it("should open spotlight when Ctrl+k is fired", async () => {
        jest.spyOn(defaultDispatcher, "fire");

        getComponent();
        await userEvent.keyboard("{Control>}k{/Control}");
        expect(defaultDispatcher.fire).toHaveBeenCalledWith(Action.OpenSpotlight);
    });

    describe("timezone updates", () => {
        const userTimezone = "Europe/London";
        const originalController = SETTINGS["userTimezonePublish"].controller;

        beforeEach(async () => {
            SETTINGS["userTimezonePublish"].controller = undefined;
            await SettingsStore.setValue("userTimezonePublish", null, SettingLevel.DEVICE, false);
            await SettingsStore.setValue("userTimezone", null, SettingLevel.DEVICE, userTimezone);
        });

        afterEach(() => {
            SETTINGS["userTimezonePublish"].controller = originalController;
        });

        it("does not update the timezone when userTimezonePublish is off", async () => {
            getComponent();
            await SettingsStore.setValue("userTimezonePublish", null, SettingLevel.DEVICE, false);
            expect(mockClient.deleteExtendedProfileProperty).toHaveBeenCalledWith("us.cloke.msc4175.tz");
            expect(mockClient.setExtendedProfileProperty).not.toHaveBeenCalled();
        });
        it("should set the user timezone when userTimezonePublish is enabled", async () => {
            getComponent();
            await SettingsStore.setValue("userTimezonePublish", null, SettingLevel.DEVICE, true);
            expect(mockClient.setExtendedProfileProperty).toHaveBeenCalledWith("us.cloke.msc4175.tz", userTimezone);
        });

        it("should set the user timezone when the timezone is changed", async () => {
            const newTimezone = "Europe/Paris";
            getComponent();
            await SettingsStore.setValue("userTimezonePublish", null, SettingLevel.DEVICE, true);
            expect(mockClient.setExtendedProfileProperty).toHaveBeenCalledWith("us.cloke.msc4175.tz", userTimezone);
            await SettingsStore.setValue("userTimezone", null, SettingLevel.DEVICE, newTimezone);
            expect(mockClient.setExtendedProfileProperty).toHaveBeenCalledWith("us.cloke.msc4175.tz", newTimezone);
        });

        it("should clear the timezone when the publish feature is turned off", async () => {
            getComponent();
            await SettingsStore.setValue("userTimezonePublish", null, SettingLevel.DEVICE, true);
            expect(mockClient.setExtendedProfileProperty).toHaveBeenCalledWith("us.cloke.msc4175.tz", userTimezone);
            await SettingsStore.setValue("userTimezonePublish", null, SettingLevel.DEVICE, false);
            expect(mockClient.deleteExtendedProfileProperty).toHaveBeenCalledWith("us.cloke.msc4175.tz");
        });
    });

    describe("resizer preferences", () => {
        let mockResize: jest.Mock;
        let mockForHandleWithId: jest.Mock;
        beforeEach(() => {
            // Clear localStorage before each test
            window.localStorage.clear();

            mockResize = jest.fn();
            mockForHandleWithId = jest.fn().mockReturnValue({ resize: mockResize });

            // Update the shared mock instance for this test
            mockResizerInstance.forHandleWithId = mockForHandleWithId;

            // Clear any global callback state
            delete (global as any).__resizeCallbacks;
        });

        it("should call resize with default size when localStorage contains NaN value", () => {
            // Set invalid value in localStorage that will result in NaN
            window.localStorage.setItem("mx_lhs_size", "not-a-number");

            getComponent();

            // Verify that when lhsSize is NaN, it defaults to 350 and calls resize
            expect(mockForHandleWithId).toHaveBeenCalledWith("lp-resizer");
            expect(mockResize).toHaveBeenCalledWith(350);
        });

        it("should use existing size when localStorage contains valid value", () => {
            // Set valid value in localStorage
            window.localStorage.setItem("mx_lhs_size", "400");

            getComponent();

            // Verify the resize method was called with the stored size (400)
            expect(mockResize).toHaveBeenCalledWith(400);
        });

        it("should enforce minimum width for new room list when stored size is zero", async () => {
            // Enable new room list feature
            await SettingsStore.setValue("feature_new_room_list", null, SettingLevel.DEVICE, true);

            // 0 represents the collapsed state for the old room list, which could have been set before the new room list was enabled
            window.localStorage.setItem("mx_lhs_size", "0");

            getComponent();

            // Verify the resize method was called with the default size (350) when stored size is below minimum
            expect(mockResize).toHaveBeenCalledWith(350);
        });

        it("should not set localStorage to 0 when resizing lp-resizer to minimum width for new room list", async () => {
            // Enable new room list feature and mock SettingsStore
            await SettingsStore.setValue("feature_new_room_list", null, SettingLevel.DEVICE, true);

            const minimumWidth = 224; // NEW_ROOM_LIST_MIN_WIDTH

            // Render the component
            getComponent();

            // Get the callbacks that were captured during resizer creation
            const callbacks = (global as any).__resizeCallbacks;

            // Create a mock DOM node for isItemCollapsed to check
            const domNode = {
                classList: {
                    contains: jest.fn().mockReturnValue(true), // Simulate the error where mx_LeftPanel_minimized is present
                },
            } as any;

            callbacks.onResized(minimumWidth);
            const isCollapsed = callbacks.isItemCollapsed(domNode);
            callbacks.onCollapsed(isCollapsed); // Not collapsed for new room list
            callbacks.onResizeStop();

            // Verify localStorage was set to the minimum width (224), not 0
            expect(window.localStorage.getItem("mx_lhs_size")).toBe("224");
        });
    });
});
