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
import { mount } from 'enzyme';
import '../../../skinned-sdk';
import { IPushRule, IPushRules, RuleId } from 'matrix-js-sdk';
import { ThreepidMedium } from 'matrix-js-sdk/src/@types/threepids';
import { act } from 'react-dom/test-utils';

import { createTestClient } from '../../../test-utils';
import Notifications from '../../../../src/components/views/settings/Notifications';
import SettingsStore from "../../../../src/settings/SettingsStore";
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { StandardActions } from '../../../../src/notifications/StandardActions';

jest.mock('../../../../src/settings/SettingsStore', () => ({
    monitorSetting: jest.fn(),
    getValue: jest.fn(),
    setValue: jest.fn(),
}));

// don't pollute test output with error logs from mock rejections
jest.mock("matrix-js-sdk/src/logger");

jest.useFakeTimers();

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

const flushPromises = async () => await new Promise(process.nextTick);

describe('<Notifications />', () => {
    const getComponent = () => mount(<Notifications />);

    // get component, wait for async data and force a render
    const getComponentAndWait = async () => {
        const component = getComponent();
        await flushPromises();
        component.setProps({});
        return component;
    };

    const mockClient = createTestClient();
    mockClient.getPushRules.mockResolvedValue(pushRules);

    const findByTestId = (component, id) => component.find(`[data-test-id="${id}"]`);

    beforeAll(() => {
        MatrixClientPeg.get = () => mockClient;
    });

    beforeEach(() => {
        mockClient.getPushRules.mockClear().mockResolvedValue(pushRules);
        mockClient.getPushers.mockClear().mockResolvedValue({ pushers: [] });
        mockClient.getThreePids.mockClear().mockResolvedValue({ threepids: [] });
        mockClient.setPusher.mockClear().mockResolvedValue({});

        (SettingsStore.getValue as jest.Mock).mockClear().mockReturnValue(true);
        (SettingsStore.setValue as jest.Mock).mockClear().mockResolvedValue(true);
    });

    it('renders spinner while loading', () => {
        const component = getComponent();
        expect(component.find('.mx_Spinner').length).toBeTruthy();
    });

    it('renders error message when fetching push rules fails', async () => {
        mockClient.getPushRules.mockRejectedValue();
        const component = await getComponentAndWait();
        expect(findByTestId(component, 'error-message').length).toBeTruthy();
    });
    it('renders error message when fetching push rules fails', async () => {
        mockClient.getPushRules.mockRejectedValue();
        const component = await getComponentAndWait();
        expect(findByTestId(component, 'error-message').length).toBeTruthy();
    });
    it('renders error message when fetching pushers fails', async () => {
        mockClient.getPushers.mockRejectedValue();
        const component = await getComponentAndWait();
        expect(findByTestId(component, 'error-message').length).toBeTruthy();
    });
    it('renders error message when fetching threepids fails', async () => {
        mockClient.getThreePids.mockRejectedValue();
        const component = await getComponentAndWait();
        expect(findByTestId(component, 'error-message').length).toBeTruthy();
    });

    describe('main notification switches', () => {
        it('renders only enable notifications switch when notifications are disabled', async () => {
            const disableNotificationsPushRules = {
                global: {
                    ...pushRules.global,
                    override: [{ ...masterRule, enabled: true }],
                },
            };
            mockClient.getPushRules.mockClear().mockResolvedValue(disableNotificationsPushRules);
            const component = await getComponentAndWait();

            expect(component).toMatchSnapshot();
        });
        it('renders switches correctly', async () => {
            const component = await getComponentAndWait();

            expect(findByTestId(component, 'notif-master-switch').length).toBeTruthy();
            expect(findByTestId(component, 'notif-setting-notificationsEnabled').length).toBeTruthy();
            expect(findByTestId(component, 'notif-setting-notificationBodyEnabled').length).toBeTruthy();
            expect(findByTestId(component, 'notif-setting-audioNotificationsEnabled').length).toBeTruthy();
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
                        },
                    ],
                });
            });

            it('renders email switches correctly when email 3pids exist', async () => {
                const component = await getComponentAndWait();

                expect(findByTestId(component, 'notif-email-switch')).toMatchSnapshot();
            });

            it('renders email switches correctly when notifications are on for email', async () => {
                mockClient.getPushers.mockResolvedValue({ pushers: [{ kind: 'email', pushkey: testEmail }] });
                const component = await getComponentAndWait();

                expect(findByTestId(component, 'notif-email-switch').props().value).toEqual(true);
            });

            it('enables email notification when toggling on', async () => {
                const component = await getComponentAndWait();

                const emailToggle = findByTestId(component, 'notif-email-switch')
                    .find('div[role="switch"]');

                await act(async () => {
                    emailToggle.simulate('click');
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
                mockClient.setPusher.mockRejectedValue();
                const component = await getComponentAndWait();

                const emailToggle = findByTestId(component, 'notif-email-switch')
                    .find('div[role="switch"]');

                await act(async () => {
                    emailToggle.simulate('click');
                });

                // force render
                await flushPromises();
                await component.setProps({});

                expect(findByTestId(component, 'error-message').length).toBeTruthy();
            });

            it('enables email notification when toggling off', async () => {
                const testPusher = { kind: 'email', pushkey: 'tester@test.com' };
                mockClient.getPushers.mockResolvedValue({ pushers: [testPusher] });
                const component = await getComponentAndWait();

                const emailToggle = findByTestId(component, 'notif-email-switch')
                    .find('div[role="switch"]');

                await act(async () => {
                    emailToggle.simulate('click');
                });

                expect(mockClient.setPusher).toHaveBeenCalledWith({
                    ...testPusher, kind: null,
                });
            });
        });

        it('sets settings value on toggle click', async () => {
            const component = await getComponentAndWait();

            const audioNotifsToggle = findByTestId(component, 'notif-setting-audioNotificationsEnabled')
                .find('div[role="switch"]');

            await act(async () => {
                audioNotifsToggle.simulate('click');
            });

            expect(SettingsStore.setValue).toHaveBeenCalledWith('audioNotificationsEnabled', null, "device", false);
        });
    });

    describe('individual notification level settings', () => {
        const getCheckedRadioForRule = (ruleEl) =>
            ruleEl.find('input[type="radio"][checked=true]').props()['aria-label'];
        it('renders categories correctly', async () => {
            const component = await getComponentAndWait();

            expect(findByTestId(component, 'notif-section-vector_global').length).toBeTruthy();
            expect(findByTestId(component, 'notif-section-vector_mentions').length).toBeTruthy();
            expect(findByTestId(component, 'notif-section-vector_other').length).toBeTruthy();
        });

        it('renders radios correctly', async () => {
            const component = await getComponentAndWait();
            const section = 'vector_global';

            const globalSection = findByTestId(component, `notif-section-${section}`);
            // 4 notification rules with class 'global'
            expect(globalSection.find('fieldset').length).toEqual(4);
            // oneToOneRule is set to 'on'
            const oneToOneRuleElement = findByTestId(component, section + oneToOneRule.rule_id);
            expect(getCheckedRadioForRule(oneToOneRuleElement)).toEqual('On');
            // encryptedOneToOneRule is set to 'loud'
            const encryptedOneToOneElement = findByTestId(component, section + encryptedOneToOneRule.rule_id);
            expect(getCheckedRadioForRule(encryptedOneToOneElement)).toEqual('Noisy');
            // encryptedGroupRule is set to 'off'
            const encryptedGroupElement = findByTestId(component, section + encryptedGroupRule.rule_id);
            expect(getCheckedRadioForRule(encryptedGroupElement)).toEqual('Off');
        });

        it('updates notification level when changed', async () => {
            const component = await getComponentAndWait();
            const section = 'vector_global';

            // oneToOneRule is set to 'on'
            // and is kind: 'underride'
            const oneToOneRuleElement = findByTestId(component, section + oneToOneRule.rule_id);

            await act(async () => {
                // toggle at 0 is 'off'
                const offToggle = oneToOneRuleElement.find('input[type="radio"]').at(0);
                offToggle.simulate('change');
            });

            expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith(
                'global', 'underride', oneToOneRule.rule_id, true);

            // actions for '.m.rule.room_one_to_one' state is ACTION_DONT_NOTIFY
            expect(mockClient.setPushRuleActions).toHaveBeenCalledWith(
                'global', 'underride', oneToOneRule.rule_id, StandardActions.ACTION_DONT_NOTIFY);
        });
    });
});
