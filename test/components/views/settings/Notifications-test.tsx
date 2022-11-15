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

import React from 'react';
import {
    IPushRule,
    IPushRules,
    RuleId,
    IPusher,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MatrixEvent,
    Room,
    NotificationCountType,
} from 'matrix-js-sdk/src/matrix';
import { IThreepid, ThreepidMedium } from 'matrix-js-sdk/src/@types/threepids';
import { act } from 'react-dom/test-utils';
import { fireEvent, getByTestId, render, screen, waitFor } from '@testing-library/react';

import Notifications from '../../../../src/components/views/settings/Notifications';
import SettingsStore from "../../../../src/settings/SettingsStore";
import { StandardActions } from '../../../../src/notifications/StandardActions';
import { getMockClientWithEventEmitter, mkMessage } from '../../../test-utils';

// don't pollute test output with error logs from mock rejections
jest.mock("matrix-js-sdk/src/logger");

// Avoid indirectly importing any eagerly created stores that would require extra setup
jest.mock("../../../../src/Notifier");

const masterRule = {
    actions: ["dont_notify"],
    conditions: [],
    default: true,
    enabled: false,
    rule_id: RuleId.Master,
};
// eslint-disable-next-line max-len
const oneToOneRule = { "conditions": [{ "kind": "room_member_count", "is": "2" }, { "kind": "event_match", "key": "type", "pattern": "m.room.message" }], "actions": ["notify", { "set_tweak": "highlight", "value": false }], "rule_id": ".m.rule.room_one_to_one", "default": true, "enabled": true } as IPushRule;
// eslint-disable-next-line max-len
const encryptedOneToOneRule = { "conditions": [{ "kind": "room_member_count", "is": "2" }, { "kind": "event_match", "key": "type", "pattern": "m.room.encrypted" }], "actions": ["notify", { "set_tweak": "sound", "value": "default" }, { "set_tweak": "highlight", "value": false }], "rule_id": ".m.rule.encrypted_room_one_to_one", "default": true, "enabled": true } as IPushRule;
// eslint-disable-next-line max-len
const encryptedGroupRule = { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.room.encrypted" }], "actions": ["dont_notify"], "rule_id": ".m.rule.encrypted", "default": true, "enabled": true } as IPushRule;
// eslint-disable-next-line max-len
const pushRules: IPushRules = { "global": { "underride": [{ "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.call.invite" }], "actions": ["notify", { "set_tweak": "sound", "value": "ring" }, { "set_tweak": "highlight", "value": false }], "rule_id": ".m.rule.call", "default": true, "enabled": true }, oneToOneRule, encryptedOneToOneRule, { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.room.message" }], "actions": ["notify", { "set_tweak": "sound", "value": "default" }, { "set_tweak": "highlight", "value": false }], "rule_id": ".m.rule.message", "default": true, "enabled": true }, encryptedGroupRule, { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "im.vector.modular.widgets" }, { "kind": "event_match", "key": "content.type", "pattern": "jitsi" }, { "kind": "event_match", "key": "state_key", "pattern": "*" }], "actions": ["notify", { "set_tweak": "highlight", "value": false }], "rule_id": ".im.vector.jitsi", "default": true, "enabled": true }], "sender": [], "room": [{ "actions": ["dont_notify"], "rule_id": "!zJPyWqpMorfCcWObge:matrix.org", "default": false, "enabled": true }], "content": [{ "actions": ["notify", { "set_tweak": "highlight", "value": false }], "pattern": "banana", "rule_id": "banana", "default": false, "enabled": true }, { "actions": ["notify", { "set_tweak": "sound", "value": "default" }, { "set_tweak": "highlight" }], "pattern": "kadev1", "rule_id": ".m.rule.contains_user_name", "default": true, "enabled": true }], "override": [{ "conditions": [], "actions": ["dont_notify"], "rule_id": ".m.rule.master", "default": true, "enabled": false }, { "conditions": [{ "kind": "event_match", "key": "content.msgtype", "pattern": "m.notice" }], "actions": ["dont_notify"], "rule_id": ".m.rule.suppress_notices", "default": true, "enabled": true }, { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.room.member" }, { "kind": "event_match", "key": "content.membership", "pattern": "invite" }, { "kind": "event_match", "key": "state_key", "pattern": "@kadev1:matrix.org" }], "actions": ["notify", { "set_tweak": "sound", "value": "default" }, { "set_tweak": "highlight", "value": false }], "rule_id": ".m.rule.invite_for_me", "default": true, "enabled": true }, { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.room.member" }], "actions": ["dont_notify"], "rule_id": ".m.rule.member_event", "default": true, "enabled": true }, { "conditions": [{ "kind": "contains_display_name" }], "actions": ["notify", { "set_tweak": "sound", "value": "default" }, { "set_tweak": "highlight" }], "rule_id": ".m.rule.contains_display_name", "default": true, "enabled": true }, { "conditions": [{ "kind": "event_match", "key": "content.body", "pattern": "@room" }, { "kind": "sender_notification_permission", "key": "room" }], "actions": ["notify", { "set_tweak": "highlight", "value": true }], "rule_id": ".m.rule.roomnotif", "default": true, "enabled": true }, { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.room.tombstone" }, { "kind": "event_match", "key": "state_key", "pattern": "" }], "actions": ["notify", { "set_tweak": "highlight", "value": true }], "rule_id": ".m.rule.tombstone", "default": true, "enabled": true }, { "conditions": [{ "kind": "event_match", "key": "type", "pattern": "m.reaction" }], "actions": ["dont_notify"], "rule_id": ".m.rule.reaction", "default": true, "enabled": true }] }, "device": {} } as IPushRules;

const flushPromises = async () => await new Promise(resolve => setTimeout(resolve));

describe('<Notifications />', () => {
    const getComponent = () => render(<Notifications />);

    // get component, wait for async data and force a render
    const getComponentAndWait = async () => {
        const component = getComponent();
        await flushPromises();
        return component;
    };

    const mockClient = getMockClientWithEventEmitter({
        getPushRules: jest.fn(),
        getPushers: jest.fn(),
        getThreePids: jest.fn(),
        setPusher: jest.fn(),
        setPushRuleEnabled: jest.fn(),
        setPushRuleActions: jest.fn(),
        getRooms: jest.fn().mockReturnValue([]),
        getAccountData: jest.fn().mockImplementation(eventType => {
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
        supportsExperimentalThreads: jest.fn().mockReturnValue(true),
    });
    mockClient.getPushRules.mockResolvedValue(pushRules);

    beforeEach(() => {
        mockClient.getPushRules.mockClear().mockResolvedValue(pushRules);
        mockClient.getPushers.mockClear().mockResolvedValue({ pushers: [] });
        mockClient.getThreePids.mockClear().mockResolvedValue({ threepids: [] });
        mockClient.setPusher.mockClear().mockResolvedValue({});
    });

    it('renders spinner while loading', async () => {
        getComponent();
        expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('renders error message when fetching push rules fails', async () => {
        mockClient.getPushRules.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    it('renders error message when fetching pushers fails', async () => {
        mockClient.getPushers.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    it('renders error message when fetching threepids fails', async () => {
        mockClient.getThreePids.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    describe('main notification switches', () => {
        it('renders only enable notifications switch when notifications are disabled', async () => {
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
        it('renders switches correctly', async () => {
            await getComponentAndWait();

            expect(screen.getByTestId('notif-master-switch')).toBeInTheDocument();
            expect(screen.getByTestId('notif-device-switch')).toBeInTheDocument();
            expect(screen.getByTestId('notif-setting-notificationsEnabled')).toBeInTheDocument();
            expect(screen.getByTestId('notif-setting-notificationBodyEnabled')).toBeInTheDocument();
            expect(screen.getByTestId('notif-setting-audioNotificationsEnabled')).toBeInTheDocument();
        });

        describe('email switches', () => {
            const testEmail = 'tester@test.com';
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

            it('renders email switches correctly when email 3pids exist', async () => {
                await getComponentAndWait();
                expect(screen.getByTestId('notif-email-switch')).toBeInTheDocument();
            });

            it('renders email switches correctly when notifications are on for email', async () => {
                mockClient.getPushers.mockResolvedValue({
                    pushers: [
                        { kind: 'email', pushkey: testEmail } as unknown as IPusher,
                    ],
                });
                await getComponentAndWait();

                const emailSwitch = screen.getByTestId('notif-email-switch');
                expect(emailSwitch.querySelector('[aria-checked="true"]')).toBeInTheDocument();
            });

            it('enables email notification when toggling on', async () => {
                await getComponentAndWait();

                const emailToggle = screen.getByTestId('notif-email-switch')
                    .querySelector('div[role="switch"]');

                await act(async () => {
                    fireEvent.click(emailToggle);
                });

                expect(mockClient.setPusher).toHaveBeenCalledWith(expect.objectContaining({
                    kind: "email",
                    app_id: "m.email",
                    pushkey: testEmail,
                    app_display_name: "Email Notifications",
                    device_display_name: testEmail,
                    append: true,
                }));
            });

            it('displays error when pusher update fails', async () => {
                mockClient.setPusher.mockRejectedValue({});
                await getComponentAndWait();

                const emailToggle = screen.getByTestId('notif-email-switch')
                    .querySelector('div[role="switch"]');

                await act(async () => {
                    fireEvent.click(emailToggle);
                });

                // force render
                await flushPromises();

                expect(screen.getByTestId('error-message')).toBeInTheDocument();
            });

            it('enables email notification when toggling off', async () => {
                const testPusher = { kind: 'email', pushkey: 'tester@test.com' } as unknown as IPusher;
                mockClient.getPushers.mockResolvedValue({ pushers: [testPusher] });
                await getComponentAndWait();

                const emailToggle = screen.getByTestId('notif-email-switch')
                    .querySelector('div[role="switch"]');

                await act(async () => {
                    fireEvent.click(emailToggle);
                });

                expect(mockClient.setPusher).toHaveBeenCalledWith({
                    ...testPusher, kind: null,
                });
            });
        });

        it('toggles and sets settings correctly', async () => {
            await getComponentAndWait();
            let audioNotifsToggle;

            const update = () => {
                audioNotifsToggle = screen.getByTestId('notif-setting-audioNotificationsEnabled')
                    .querySelector('div[role="switch"]');
            };
            update();

            expect(audioNotifsToggle.getAttribute("aria-checked")).toEqual("true");
            expect(SettingsStore.getValue("audioNotificationsEnabled")).toEqual(true);

            act(() => { fireEvent.click(audioNotifsToggle); });
            update();

            expect(audioNotifsToggle.getAttribute("aria-checked")).toEqual("false");
            expect(SettingsStore.getValue("audioNotificationsEnabled")).toEqual(false);
        });
    });

    describe('individual notification level settings', () => {
        it('renders categories correctly', async () => {
            await getComponentAndWait();

            expect(screen.getByTestId('notif-section-vector_global')).toBeInTheDocument();
            expect(screen.getByTestId('notif-section-vector_mentions')).toBeInTheDocument();
            expect(screen.getByTestId('notif-section-vector_other')).toBeInTheDocument();
        });

        it('renders radios correctly', async () => {
            await getComponentAndWait();
            const section = 'vector_global';

            const globalSection = screen.getByTestId(`notif-section-${section}`);
            // 4 notification rules with class 'global'
            expect(globalSection.querySelectorAll('fieldset').length).toEqual(4);
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

        it('updates notification level when changed', async () => {
            await getComponentAndWait();
            const section = 'vector_global';

            // oneToOneRule is set to 'on'
            // and is kind: 'underride'
            const oneToOneRuleElement = screen.getByTestId(section + oneToOneRule.rule_id);

            await act(async () => {
                const offToggle = oneToOneRuleElement.querySelector('input[type="radio"]');
                fireEvent.click(offToggle);
            });

            expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith(
                'global', 'underride', oneToOneRule.rule_id, true);

            // actions for '.m.rule.room_one_to_one' state is ACTION_DONT_NOTIFY
            expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                'global', 'underride', oneToOneRule.rule_id, StandardActions.ACTION_DONT_NOTIFY);
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
                expect(clearNotificationEl.className).not.toContain("mx_AccessibleButton_disabled");
            });
        });
    });
});
