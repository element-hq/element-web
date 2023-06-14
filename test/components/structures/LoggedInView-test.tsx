/*
Copyright 2015 - 2023 The Matrix.org Foundation C.I.C.

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
import { render, RenderResult } from "@testing-library/react";
import { ConditionKind, EventType, IPushRule, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";
import { logger } from "matrix-js-sdk/src/logger";

import LoggedInView from "../../../src/components/structures/LoggedInView";
import { SDKContext } from "../../../src/contexts/SDKContext";
import { StandardActions } from "../../../src/notifications/StandardActions";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../test-utils";
import { TestSdkContext } from "../../TestSdkContext";

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
});
