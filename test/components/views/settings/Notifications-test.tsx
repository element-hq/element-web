/*
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import {
    IPushRule,
    IPushRules,
    RuleId,
    IPusher,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MatrixEvent,
    Room,
    NotificationCountType,
    PushRuleActionName,
    TweakName,
    ConditionKind,
    IPushRuleCondition,
    PushRuleKind,
} from "matrix-js-sdk/src/matrix";
import { randomString } from "matrix-js-sdk/src/randomstring";
import { IThreepid, ThreepidMedium } from "matrix-js-sdk/src/@types/threepids";
import { act, fireEvent, getByTestId, render, screen, waitFor, within } from "@testing-library/react";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import Notifications from "../../../../src/components/views/settings/Notifications";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { StandardActions } from "../../../../src/notifications/StandardActions";
import { clearAllModals, getMockClientWithEventEmitter, mkMessage, mockClientMethodsUser } from "../../../test-utils";

// don't pollute test output with error logs from mock rejections
jest.mock("matrix-js-sdk/src/logger");

// Avoid indirectly importing any eagerly created stores that would require extra setup
jest.mock("../../../../src/Notifier");

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: jest.fn(),
}));

const masterRule: IPushRule = {
    actions: [PushRuleActionName.DontNotify],
    conditions: [],
    default: true,
    enabled: false,
    rule_id: RuleId.Master,
};
const oneToOneRule: IPushRule = {
    conditions: [
        { kind: ConditionKind.RoomMemberCount, is: "2" },
        { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.message" },
    ],
    actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
    rule_id: ".m.rule.room_one_to_one",
    default: true,
    enabled: true,
} as IPushRule;
const encryptedOneToOneRule: IPushRule = {
    conditions: [
        { kind: ConditionKind.RoomMemberCount, is: "2" },
        { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.encrypted" },
    ],
    actions: [
        PushRuleActionName.Notify,
        { set_tweak: TweakName.Sound, value: "default" },
        { set_tweak: TweakName.Highlight, value: false },
    ],
    rule_id: ".m.rule.encrypted_room_one_to_one",
    default: true,
    enabled: true,
} as IPushRule;
const groupRule = {
    conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.message" }],
    actions: [
        PushRuleActionName.Notify,
        { set_tweak: TweakName.Sound, value: "default" },
        { set_tweak: TweakName.Highlight, value: false },
    ],
    rule_id: ".m.rule.message",
    default: true,
    enabled: true,
};
const encryptedGroupRule: IPushRule = {
    conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.encrypted" }],
    actions: [PushRuleActionName.DontNotify],
    rule_id: ".m.rule.encrypted",
    default: true,
    enabled: true,
} as IPushRule;

const bananaRule = {
    actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
    pattern: "banana",
    rule_id: "banana",
    default: false,
    enabled: true,
} as IPushRule;

const pushRules: IPushRules = {
    global: {
        underride: [
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.call.invite" }],
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "ring" },
                    { set_tweak: TweakName.Highlight, value: false },
                ],
                rule_id: ".m.rule.call",
                default: true,
                enabled: true,
            },
            oneToOneRule,
            encryptedOneToOneRule,
            groupRule,
            encryptedGroupRule,
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "type", pattern: "im.vector.modular.widgets" },
                    { kind: ConditionKind.EventMatch, key: "content.type", pattern: "jitsi" },
                    { kind: ConditionKind.EventMatch, key: "state_key", pattern: "*" },
                ],
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
                rule_id: ".im.vector.jitsi",
                default: true,
                enabled: true,
            },
        ],
        sender: [],
        room: [
            {
                actions: [PushRuleActionName.DontNotify],
                rule_id: "!zJPyWqpMorfCcWObge:matrix.org",
                default: false,
                enabled: true,
            },
        ],
        content: [
            bananaRule,
            {
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "default" },
                    { set_tweak: TweakName.Highlight },
                ],
                pattern: "kadev1",
                rule_id: ".m.rule.contains_user_name",
                default: true,
                enabled: true,
            },
        ],
        override: [
            {
                conditions: [],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.master",
                default: true,
                enabled: false,
            },
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "content.msgtype", pattern: "m.notice" }],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.suppress_notices",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.member" },
                    { kind: ConditionKind.EventMatch, key: "content.membership", pattern: "invite" },
                    { kind: ConditionKind.EventMatch, key: "state_key", pattern: "@kadev1:matrix.org" },
                ],
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "default" },
                    { set_tweak: TweakName.Highlight, value: false },
                ],
                rule_id: ".m.rule.invite_for_me",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.member" }],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.member_event",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "contains_display_name" }],
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "default" },
                    { set_tweak: TweakName.Highlight },
                ],
                rule_id: ".m.rule.contains_display_name",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "content.body", pattern: "@room" },
                    { kind: "sender_notification_permission", key: "room" },
                ],
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }],
                rule_id: ".m.rule.roomnotif",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.tombstone" },
                    { kind: ConditionKind.EventMatch, key: "state_key", pattern: "" },
                ],
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }],
                rule_id: ".m.rule.tombstone",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.reaction" }],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.reaction",
                default: true,
                enabled: true,
            },
        ],
    },
    device: {},
} as IPushRules;

const flushPromises = async () => await new Promise((resolve) => window.setTimeout(resolve));

describe("<Notifications />", () => {
    const getComponent = () => render(<Notifications />);

    // get component, wait for async data and force a render
    const getComponentAndWait = async () => {
        const component = getComponent();
        await flushPromises();
        return component;
    };

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
        getPushRules: jest.fn(),
        getPushers: jest.fn(),
        getThreePids: jest.fn(),
        setPusher: jest.fn(),
        removePusher: jest.fn(),
        setPushRuleEnabled: jest.fn(),
        setPushRuleActions: jest.fn(),
        getRooms: jest.fn().mockReturnValue([]),
        getAccountData: jest.fn().mockImplementation((eventType) => {
            if (eventType.startsWith(LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
                return new MatrixEvent({
                    type: eventType,
                    content: {
                        is_silenced: false,
                    },
                });
            }
        }),
        setAccountData: jest.fn(),
        sendReadReceipt: jest.fn(),
        supportsThreads: jest.fn().mockReturnValue(true),
        isInitialSyncComplete: jest.fn().mockReturnValue(false),
        addPushRule: jest.fn().mockResolvedValue({}),
        deletePushRule: jest.fn().mockResolvedValue({}),
    });
    mockClient.getPushRules.mockResolvedValue(pushRules);

    beforeEach(async () => {
        let i = 0;
        mocked(randomString).mockImplementation(() => {
            return "testid_" + i++;
        });

        mockClient.getPushRules.mockClear().mockResolvedValue(pushRules);
        mockClient.getPushers.mockClear().mockResolvedValue({ pushers: [] });
        mockClient.getThreePids.mockClear().mockResolvedValue({ threepids: [] });
        mockClient.setPusher.mockReset().mockResolvedValue({});
        mockClient.removePusher.mockClear().mockResolvedValue({});
        mockClient.setPushRuleActions.mockReset().mockResolvedValue({});
        mockClient.pushRules = pushRules;
        mockClient.getPushRules.mockClear().mockResolvedValue(pushRules);
        mockClient.addPushRule.mockClear();
        mockClient.deletePushRule.mockClear();

        userEvent.setup();

        await clearAllModals();
    });

    it("renders spinner while loading", async () => {
        getComponent();
        expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("renders error message when fetching push rules fails", async () => {
        mockClient.getPushRules.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });
    it("renders error message when fetching pushers fails", async () => {
        mockClient.getPushers.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });
    it("renders error message when fetching threepids fails", async () => {
        mockClient.getThreePids.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });

    describe("main notification switches", () => {
        it("renders only enable notifications switch when notifications are disabled", async () => {
            const disableNotificationsPushRules = {
                global: {
                    ...pushRules.global,
                    override: [{ ...masterRule, enabled: true }],
                },
            } as unknown as IPushRules;
            mockClient.getPushRules.mockClear().mockResolvedValue(disableNotificationsPushRules);
            const { container } = await getComponentAndWait();

            expect(container).toMatchSnapshot();
        });
        it("renders switches correctly", async () => {
            await getComponentAndWait();

            expect(screen.getByTestId("notif-master-switch")).toBeInTheDocument();
            expect(screen.getByTestId("notif-device-switch")).toBeInTheDocument();
            expect(screen.getByTestId("notif-setting-notificationsEnabled")).toBeInTheDocument();
            expect(screen.getByTestId("notif-setting-notificationBodyEnabled")).toBeInTheDocument();
            expect(screen.getByTestId("notif-setting-audioNotificationsEnabled")).toBeInTheDocument();
        });

        describe("email switches", () => {
            const testEmail = "tester@test.com";
            beforeEach(() => {
                mockClient.getThreePids.mockResolvedValue({
                    threepids: [
                        // should render switch bc pushKey and address match
                        {
                            medium: ThreepidMedium.Email,
                            address: testEmail,
                        } as unknown as IThreepid,
                    ],
                });
            });

            it("renders email switches correctly when email 3pids exist", async () => {
                await getComponentAndWait();
                expect(screen.getByTestId("notif-email-switch")).toBeInTheDocument();
            });

            it("renders email switches correctly when notifications are on for email", async () => {
                mockClient.getPushers.mockResolvedValue({
                    pushers: [{ kind: "email", pushkey: testEmail } as unknown as IPusher],
                });
                await getComponentAndWait();

                const emailSwitch = screen.getByTestId("notif-email-switch");
                expect(emailSwitch.querySelector('[aria-checked="true"]')).toBeInTheDocument();
            });

            it("enables email notification when toggling on", async () => {
                await getComponentAndWait();

                const emailToggle = screen.getByTestId("notif-email-switch").querySelector('div[role="switch"]')!;
                fireEvent.click(emailToggle);

                expect(mockClient.setPusher).toHaveBeenCalledWith(
                    expect.objectContaining({
                        kind: "email",
                        app_id: "m.email",
                        pushkey: testEmail,
                        app_display_name: "Email Notifications",
                        device_display_name: testEmail,
                        append: true,
                    }),
                );
            });

            it("displays error when pusher update fails", async () => {
                mockClient.setPusher.mockRejectedValue({});
                await getComponentAndWait();

                const emailToggle = screen.getByTestId("notif-email-switch").querySelector('div[role="switch"]')!;
                fireEvent.click(emailToggle);

                // force render
                await flushPromises();

                const dialog = await screen.findByRole("dialog");

                expect(
                    within(dialog).getByText("An error occurred whilst saving your notification preferences."),
                ).toBeInTheDocument();

                // dismiss the dialog
                fireEvent.click(within(dialog).getByText("OK"));
                expect(screen.getByTestId("error-message")).toBeInTheDocument();
            });

            it("enables email notification when toggling off", async () => {
                const testPusher = {
                    kind: "email",
                    pushkey: "tester@test.com",
                    app_id: "testtest",
                } as unknown as IPusher;
                mockClient.getPushers.mockResolvedValue({ pushers: [testPusher] });
                await getComponentAndWait();

                const emailToggle = screen.getByTestId("notif-email-switch").querySelector('div[role="switch"]')!;
                fireEvent.click(emailToggle);

                expect(mockClient.removePusher).toHaveBeenCalledWith(testPusher.pushkey, testPusher.app_id);
            });
        });

        it("toggles master switch correctly", async () => {
            await getComponentAndWait();

            // master switch is on
            expect(screen.getByLabelText("Enable notifications for this account")).toBeChecked();
            fireEvent.click(screen.getByLabelText("Enable notifications for this account"));

            await flushPromises();

            expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith("global", "override", ".m.rule.master", true);
        });

        it("toggles and sets settings correctly", async () => {
            await getComponentAndWait();
            let audioNotifsToggle!: HTMLDivElement;

            const update = () => {
                audioNotifsToggle = screen
                    .getByTestId("notif-setting-audioNotificationsEnabled")
                    .querySelector('div[role="switch"]')!;
            };
            update();

            expect(audioNotifsToggle.getAttribute("aria-checked")).toEqual("true");
            expect(SettingsStore.getValue("audioNotificationsEnabled")).toEqual(true);

            fireEvent.click(audioNotifsToggle);
            update();

            expect(audioNotifsToggle.getAttribute("aria-checked")).toEqual("false");
            expect(SettingsStore.getValue("audioNotificationsEnabled")).toEqual(false);
        });
    });

    describe("individual notification level settings", () => {
        it("renders categories correctly", async () => {
            await getComponentAndWait();

            expect(screen.getByTestId("notif-section-vector_global")).toBeInTheDocument();
            expect(screen.getByTestId("notif-section-vector_mentions")).toBeInTheDocument();
            expect(screen.getByTestId("notif-section-vector_other")).toBeInTheDocument();
        });

        it("renders radios correctly", async () => {
            await getComponentAndWait();
            const section = "vector_global";

            const globalSection = screen.getByTestId(`notif-section-${section}`);
            // 4 notification rules with class 'global'
            expect(globalSection.querySelectorAll("fieldset").length).toEqual(4);
            // oneToOneRule is set to 'on'
            const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);
            expect(oneToOneRuleElement.querySelector("[aria-label='On']")).toBeInTheDocument();
            // encryptedOneToOneRule is set to 'loud'
            const encryptedOneToOneElement = screen.getByTestId(section + encryptedOneToOneRule.rule_id);
            expect(encryptedOneToOneElement.querySelector("[aria-label='Noisy']")).toBeInTheDocument();
            // encryptedGroupRule is set to 'off'
            const encryptedGroupElement = screen.getByTestId(section + encryptedGroupRule.rule_id);
            expect(encryptedGroupElement.querySelector("[aria-label='Off']")).toBeInTheDocument();
        });

        it("updates notification level when changed", async () => {
            await getComponentAndWait();
            const section = "vector_global";

            // oneToOneRule is set to 'on'
            // and is kind: 'underride'
            const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);

            await act(async () => {
                const offToggle = oneToOneRuleElement.querySelector('input[type="radio"]')!;
                fireEvent.click(offToggle);
            });

            expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                "underride",
                oneToOneRule.rule_id,
                true,
            );

            // actions for '.m.rule.room_one_to_one' state is ACTION_DONT_NOTIFY
            expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                "underride",
                oneToOneRule.rule_id,
                StandardActions.ACTION_DONT_NOTIFY,
            );
        });

        it("adds an error message when updating notification level fails", async () => {
            await getComponentAndWait();
            const section = "vector_global";

            const error = new Error("oups");
            mockClient.setPushRuleEnabled.mockRejectedValue(error);

            // oneToOneRule is set to 'on'
            // and is kind: 'underride'
            const offToggle = screen.getByTestId(section + oneToOneRule.rule_id).querySelector('input[type="radio"]')!;
            fireEvent.click(offToggle);

            await flushPromises();

            // error message attached to oneToOne rule
            const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);
            // old value still shown as selected
            expect(within(oneToOneRuleElement).getByLabelText("On")).toBeChecked();
            expect(
                within(oneToOneRuleElement).getByText(
                    "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                ),
            ).toBeInTheDocument();
        });

        it("clears error message for notification rule on retry", async () => {
            await getComponentAndWait();
            const section = "vector_global";

            const error = new Error("oups");
            mockClient.setPushRuleEnabled.mockRejectedValueOnce(error).mockResolvedValue({});

            // oneToOneRule is set to 'on'
            // and is kind: 'underride'
            const offToggle = screen.getByTestId(section + oneToOneRule.rule_id).querySelector('input[type="radio"]')!;
            fireEvent.click(offToggle);

            await flushPromises();

            // error message attached to oneToOne rule
            const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);
            expect(
                within(oneToOneRuleElement).getByText(
                    "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                ),
            ).toBeInTheDocument();

            // retry
            fireEvent.click(offToggle);

            // error removed as soon as we start request
            expect(
                within(oneToOneRuleElement).queryByText(
                    "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                ),
            ).not.toBeInTheDocument();

            await flushPromises();

            // no error after after successful change
            expect(
                within(oneToOneRuleElement).queryByText(
                    "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                ),
            ).not.toBeInTheDocument();
        });

        describe("synced rules", () => {
            const pollStartOneToOne = {
                conditions: [
                    {
                        kind: ConditionKind.RoomMemberCount,
                        is: "2",
                    } as IPushRuleCondition<ConditionKind.RoomMemberCount>,
                    {
                        kind: ConditionKind.EventMatch,
                        key: "type",
                        pattern: "org.matrix.msc3381.poll.start",
                    } as IPushRuleCondition<ConditionKind.EventMatch>,
                ],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".org.matrix.msc3930.rule.poll_start_one_to_one",
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
                actions: [PushRuleActionName.Notify],
                rule_id: ".org.matrix.msc3930.rule.poll_start",
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
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Highlight, value: false },
                    { set_tweak: TweakName.Sound, value: "default" },
                ],
                rule_id: ".org.matrix.msc3930.rule.poll_end_one_to_one",
                default: true,
                enabled: true,
            } as IPushRule;

            const setPushRuleMock = (rules: IPushRule[] = []): void => {
                const combinedRules = {
                    ...pushRules,
                    global: {
                        ...pushRules.global,
                        underride: [...pushRules.global.underride!, ...rules],
                    },
                };
                mockClient.getPushRules.mockClear().mockResolvedValue(combinedRules);
                mockClient.pushRules = combinedRules;
            };

            // ".m.rule.room_one_to_one" and ".m.rule.message" have synced rules
            it("succeeds when no synced rules exist for user", async () => {
                await getComponentAndWait();
                const section = "vector_global";

                const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);

                const offToggle = oneToOneRuleElement.querySelector('input[type="radio"]')!;
                fireEvent.click(offToggle);

                await flushPromises();

                // didnt attempt to update any non-existant rules
                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(1);

                // no error
                expect(
                    within(oneToOneRuleElement).queryByText(
                        "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                    ),
                ).not.toBeInTheDocument();
            });

            it("updates synced rules when they exist for user", async () => {
                setPushRuleMock([pollStartOneToOne, pollStartGroup]);
                await getComponentAndWait();
                const section = "vector_global";
                const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);

                const offToggle = oneToOneRuleElement.querySelector('input[type="radio"]')!;
                fireEvent.click(offToggle);

                await flushPromises();

                // updated synced rule
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    oneToOneRule.rule_id,
                    [PushRuleActionName.DontNotify],
                );
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollStartOneToOne.rule_id,
                    [PushRuleActionName.DontNotify],
                );
                // only called for parent rule and one existing synced rule
                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(2);

                // no error
                expect(
                    within(oneToOneRuleElement).queryByText(
                        "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                    ),
                ).not.toBeInTheDocument();
            });

            it("does not update synced rules when main rule update fails", async () => {
                setPushRuleMock([pollStartOneToOne]);
                await getComponentAndWait();
                const section = "vector_global";
                const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);
                // have main rule update fail
                mockClient.setPushRuleActions.mockRejectedValue("oups");

                const offToggle = oneToOneRuleElement.querySelector('input[type="radio"]')!;
                fireEvent.click(offToggle);

                await flushPromises();

                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    oneToOneRule.rule_id,
                    [PushRuleActionName.DontNotify],
                );
                // only called for parent rule
                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(1);

                expect(
                    within(oneToOneRuleElement).getByText(
                        "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                    ),
                ).toBeInTheDocument();
            });

            it("sets the UI toggle to rule value when no synced rule exist for the user", async () => {
                setPushRuleMock([]);
                await getComponentAndWait();
                const section = "vector_global";
                const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);

                // loudest state of synced rules should be the toggle value
                expect(oneToOneRuleElement.querySelector('input[aria-label="On"]')).toBeChecked();
            });

            it("sets the UI toggle to the loudest synced rule value", async () => {
                // oneToOneRule is set to 'On'
                // pollEndOneToOne is set to 'Loud'
                setPushRuleMock([pollStartOneToOne, pollEndOneToOne]);
                await getComponentAndWait();
                const section = "vector_global";
                const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);

                // loudest state of synced rules should be the toggle value
                expect(oneToOneRuleElement.querySelector('input[aria-label="Noisy"]')).toBeChecked();

                const onToggle = oneToOneRuleElement.querySelector('input[aria-label="On"]')!;
                fireEvent.click(onToggle);

                await flushPromises();

                // called for all 3 rules
                expect(mockClient.setPushRuleActions).toHaveBeenCalledTimes(3);
                const expectedActions = [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }];
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    oneToOneRule.rule_id,
                    expectedActions,
                );
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollStartOneToOne.rule_id,
                    expectedActions,
                );
                expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    "underride",
                    pollEndOneToOne.rule_id,
                    expectedActions,
                );
            });
        });
    });

    describe("keywords", () => {
        // keywords rule is not a real rule, but controls actions on keywords content rules
        const keywordsRuleId = "_keywords";
        it("updates individual keywords content rules when keywords rule is toggled", async () => {
            await getComponentAndWait();
            const section = "vector_mentions";

            fireEvent.click(within(screen.getByTestId(section + keywordsRuleId)).getByLabelText("Off"));

            expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith("global", "content", bananaRule.rule_id, false);

            fireEvent.click(within(screen.getByTestId(section + keywordsRuleId)).getByLabelText("Noisy"));

            expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                "content",
                bananaRule.rule_id,
                StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
            );
        });

        it("renders an error when updating keywords fails", async () => {
            await getComponentAndWait();
            const section = "vector_mentions";

            mockClient.setPushRuleEnabled.mockRejectedValueOnce("oups");

            fireEvent.click(within(screen.getByTestId(section + keywordsRuleId)).getByLabelText("Off"));

            await flushPromises();

            const rule = screen.getByTestId(section + keywordsRuleId);

            expect(
                within(rule).getByText(
                    "An error occurred when updating your notification preferences. Please try to toggle your option again.",
                ),
            ).toBeInTheDocument();
        });

        it("adds a new keyword", async () => {
            await getComponentAndWait();

            await userEvent.type(screen.getByLabelText("Keyword"), "jest");
            expect(screen.getByLabelText("Keyword")).toHaveValue("jest");

            fireEvent.click(screen.getByText("Add"));

            expect(mockClient.addPushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "jest", {
                actions: [PushRuleActionName.Notify, { set_tweak: "highlight", value: false }],
                pattern: "jest",
            });
        });

        it("adds a new keyword with same actions as existing rules when keywords rule is off", async () => {
            const offContentRule = {
                ...bananaRule,
                enabled: false,
                actions: [PushRuleActionName.Notify],
            };
            const pushRulesWithContentOff = {
                global: {
                    ...pushRules.global,
                    content: [offContentRule],
                },
            };
            mockClient.pushRules = pushRulesWithContentOff;
            mockClient.getPushRules.mockClear().mockResolvedValue(pushRulesWithContentOff);

            await getComponentAndWait();

            const keywords = screen.getByTestId("vector_mentions_keywords");

            expect(within(keywords).getByLabelText("Off")).toBeChecked();

            await userEvent.type(screen.getByLabelText("Keyword"), "jest");
            expect(screen.getByLabelText("Keyword")).toHaveValue("jest");

            fireEvent.click(screen.getByText("Add"));

            expect(mockClient.addPushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "jest", {
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
                pattern: "jest",
            });
        });

        it("removes keyword", async () => {
            await getComponentAndWait();

            await userEvent.type(screen.getByLabelText("Keyword"), "jest");

            const keyword = screen.getByText("banana");

            fireEvent.click(within(keyword.parentElement!).getByLabelText("Remove"));

            expect(mockClient.deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "banana");

            await flushPromises();
        });
    });

    describe("clear all notifications", () => {
        it("clears all notifications", async () => {
            const room = new Room("room123", mockClient, "@alice:example.org");
            mockClient.getRooms.mockReset().mockReturnValue([room]);

            const message = mkMessage({
                event: true,
                room: "room123",
                user: "@alice:example.org",
                ts: 1,
            });
            room.addLiveEvents([message]);
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);

            const { container } = await getComponentAndWait();
            const clearNotificationEl = getByTestId(container, "clear-notifications");

            fireEvent.click(clearNotificationEl);

            expect(clearNotificationEl.className).toContain("mx_AccessibleButton_disabled");
            expect(mockClient.sendReadReceipt).toHaveBeenCalled();

            await waitFor(() => {
                expect(clearNotificationEl).not.toBeInTheDocument();
            });
        });
    });
});
