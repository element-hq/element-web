/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, findByRole, getByRole, queryByRole, render, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import {
    ThreepidMedium,
    type IPushRules,
    type MatrixClient,
    NotificationCountType,
    PushRuleKind,
    Room,
    RuleId,
} from "matrix-js-sdk/src/matrix";
import React from "react";

import NotificationSettings2 from "../../../../../../src/components/views/settings/notifications/NotificationSettings2";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { StandardActions } from "../../../../../../src/notifications/StandardActions";
import { mkMessage, stubClient } from "../../../../../test-utils";
import Mock = jest.Mock;

const waitForUpdate = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

const labelGlobalMute = "Enable notifications for this account";
const labelLevelAllMessage = "All messages";
const labelLevelMentionsOnly = "Mentions and Keywords only";
const labelSoundPeople = "People";
const labelSoundMentions = "Mentions and Keywords";
const labelSoundCalls = "Audio and Video calls";
const labelActivityInvites = "Invited to a room";
const labelActivityStatus = "New room activity, upgrades and status messages occur";
const labelActivityBots = "Messages sent by bots";
const labelMentionUser = "Notify when someone mentions using @displayname or @mxid";
const labelMentionRoom = "Notify when someone mentions using @room";
const labelMentionKeyword = "Notify when someone uses a keyword";
const labelResetDefault = "Reset to default settings";

const keywords = ["justjann3", "justj4nn3", "justj4nne", "Janne", "J4nne", "Jann3", "jann3", "j4nne", "janne"];

describe("<Notifications />", () => {
    let cli: MatrixClient;
    let pushRules: IPushRules;

    beforeAll(async () => {
        pushRules = (await import("../../../../models/notificationsettings/pushrules_sample.json")) as IPushRules;
    });

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.getPushRules = jest.fn(cli.getPushRules).mockResolvedValue(pushRules);
        cli.supportsIntentionalMentions = jest.fn(cli.supportsIntentionalMentions).mockReturnValue(false);
        cli.setPushRuleEnabled = jest.fn(cli.setPushRuleEnabled);
        cli.setPushRuleActions = jest.fn(cli.setPushRuleActions);
        cli.addPushRule = jest.fn(cli.addPushRule).mockResolvedValue({});
        cli.deletePushRule = jest.fn(cli.deletePushRule).mockResolvedValue({});
        cli.removePusher = jest.fn(cli.removePusher).mockResolvedValue({});
        cli.setPusher = jest.fn(cli.setPusher).mockResolvedValue({});
    });

    it("matches the snapshot", async () => {
        cli.getPushers = jest.fn(cli.getPushers).mockResolvedValue({
            pushers: [
                {
                    app_display_name: "Element",
                    app_id: "im.vector.app",
                    data: {},
                    device_display_name: "My EyeFon",
                    kind: "http",
                    lang: "en",
                    pushkey: "",
                    enabled: true,
                },
            ],
        });
        cli.getThreePids = jest.fn(cli.getThreePids).mockResolvedValue({
            threepids: [
                {
                    medium: ThreepidMedium.Email,
                    address: "test@example.tld",
                    validated_at: 1656633600,
                    added_at: 1656633600,
                },
            ],
        });

        const screen = render(
            <MatrixClientContext.Provider value={cli}>
                <NotificationSettings2 />
            </MatrixClientContext.Provider>,
        );
        await act(waitForUpdate);
        expect(screen.container).toMatchSnapshot();
    });

    it("correctly handles the loading/disabled state", async () => {
        (cli.getPushRules as Mock).mockReturnValue(new Promise<IPushRules>(() => {}));

        const user = userEvent.setup();
        const screen = render(
            <MatrixClientContext.Provider value={cli}>
                <NotificationSettings2 />
            </MatrixClientContext.Provider>,
        );
        await act(async () => {
            await waitForUpdate();
            expect(screen.container).toMatchSnapshot();

            const globalMute = screen.getByLabelText(labelGlobalMute);
            expect(globalMute).toHaveAttribute("aria-disabled", "true");

            const levelAllMessages = screen.getByLabelText(labelLevelAllMessage);
            expect(levelAllMessages).toBeDisabled();

            const soundPeople = screen.getByLabelText(labelSoundPeople);
            expect(soundPeople).toBeDisabled();
            const soundMentions = screen.getByLabelText(labelSoundMentions);
            expect(soundMentions).toBeDisabled();
            const soundCalls = screen.getByLabelText(labelSoundCalls);
            expect(soundCalls).toBeDisabled();

            const activityInvites = screen.getByLabelText(labelActivityInvites);
            expect(activityInvites).toBeDisabled();
            const activityStatus = screen.getByLabelText(labelActivityStatus);
            expect(activityStatus).toBeDisabled();
            const activityBots = screen.getByLabelText(labelActivityBots);
            expect(activityBots).toBeDisabled();

            const mentionUser = screen.getByLabelText(labelMentionUser.replace("@mxid", cli.getUserId()!));
            expect(mentionUser).toBeDisabled();
            const mentionRoom = screen.getByLabelText(labelMentionRoom);
            expect(mentionRoom).toBeDisabled();
            const mentionKeyword = screen.getByLabelText(labelMentionKeyword);
            expect(mentionKeyword).toBeDisabled();
            await Promise.all([
                user.click(globalMute),
                user.click(levelAllMessages),
                user.click(soundPeople),
                user.click(soundMentions),
                user.click(soundCalls),
                user.click(activityInvites),
                user.click(activityStatus),
                user.click(activityBots),
                user.click(mentionUser),
                user.click(mentionRoom),
                user.click(mentionKeyword),
            ]);
        });

        expect(cli.setPushRuleActions).not.toHaveBeenCalled();
        expect(cli.setPushRuleEnabled).not.toHaveBeenCalled();
        expect(cli.addPushRule).not.toHaveBeenCalled();
        expect(cli.deletePushRule).not.toHaveBeenCalled();
    });

    describe("form elements actually toggle the model value", () => {
        it("global mute", async () => {
            const label = labelGlobalMute;

            const user = userEvent.setup();
            const screen = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await act(waitForUpdate);
            expect(screen.getByLabelText(label)).not.toBeDisabled();
            await act(async () => {
                await user.click(screen.getByLabelText(label));
                await waitForUpdate();
            });
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Override, RuleId.Master, true);
        });

        it("notification level", async () => {
            const user = userEvent.setup();
            const screen = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await act(waitForUpdate);
            expect(screen.getByLabelText(labelLevelAllMessage)).not.toBeDisabled();
            await act(async () => {
                await user.click(screen.getByLabelText(labelLevelAllMessage));
                await waitForUpdate();
            });
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.EncryptedMessage,
                true,
            );
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.Message, true);
            (cli.setPushRuleEnabled as Mock).mockClear();
            expect(screen.getByLabelText(labelLevelMentionsOnly)).not.toBeDisabled();
            await act(async () => {
                await user.click(screen.getByLabelText(labelLevelMentionsOnly));
                await waitForUpdate();
            });
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.EncryptedDM,
                true,
            );
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.DM, true);
        });

        describe("play a sound for", () => {
            it("people", async () => {
                const label = labelSoundPeople;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Underride,
                    RuleId.EncryptedDM,
                    StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
                );
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Underride,
                    RuleId.DM,
                    StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
                );
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.InviteToSelf,
                    StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
                );
            });

            it("mentions", async () => {
                const label = labelSoundMentions;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.ContainsDisplayName,
                    StandardActions.ACTION_HIGHLIGHT,
                );
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.ContentSpecific,
                    RuleId.ContainsUserName,
                    StandardActions.ACTION_HIGHLIGHT,
                );
            });

            it("calls", async () => {
                const label = labelSoundCalls;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Underride,
                    RuleId.IncomingCall,
                    StandardActions.ACTION_NOTIFY,
                );
            });
        });

        describe("activity", () => {
            it("invite", async () => {
                const label = labelActivityInvites;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.InviteToSelf,
                    StandardActions.ACTION_NOTIFY,
                );
            });
            it("status messages", async () => {
                const label = labelActivityStatus;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.MemberEvent,
                    StandardActions.ACTION_NOTIFY,
                );
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.Tombstone,
                    StandardActions.ACTION_HIGHLIGHT,
                );
            });
            it("notices", async () => {
                const label = labelActivityBots;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.SuppressNotices,
                    StandardActions.ACTION_DONT_NOTIFY,
                );
            });
        });
        describe("mentions", () => {
            it("room mentions", async () => {
                const label = labelMentionRoom;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.AtRoomNotification,
                    StandardActions.ACTION_DONT_NOTIFY,
                );
            });
            it("user mentions", async () => {
                const label = labelMentionUser.replace("@mxid", cli.getUserId()!);

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.Override,
                    RuleId.ContainsDisplayName,
                    StandardActions.ACTION_DONT_NOTIFY,
                );
                expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                    "global",
                    PushRuleKind.ContentSpecific,
                    RuleId.ContainsUserName,
                    StandardActions.ACTION_DONT_NOTIFY,
                );
            });
            it("keywords", async () => {
                const label = labelMentionKeyword;

                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                expect(screen.getByLabelText(label)).not.toBeDisabled();
                await act(async () => {
                    await user.click(screen.getByLabelText(label));
                    await waitForUpdate();
                });
                for (const pattern of keywords) {
                    expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                        "global",
                        PushRuleKind.ContentSpecific,
                        pattern,
                        false,
                    );
                }
            });
        });
        describe("keywords", () => {
            it("allows adding keywords", async () => {
                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                const inputField = screen.getByRole("textbox", { name: "Keyword" });
                const addButton = screen.getByRole("button", { name: "Add" });
                expect(inputField).not.toBeDisabled();
                expect(addButton).not.toBeDisabled();
                await act(async () => {
                    await user.type(inputField, "testkeyword");
                    await user.click(addButton);
                    await waitForUpdate();
                });
                expect(cli.addPushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "testkeyword", {
                    kind: PushRuleKind.ContentSpecific,
                    rule_id: "testkeyword",
                    enabled: true,
                    default: false,
                    actions: StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
                    pattern: "testkeyword",
                });
            });

            it("allows deleting keywords", async () => {
                const user = userEvent.setup();
                const screen = render(
                    <MatrixClientContext.Provider value={cli}>
                        <NotificationSettings2 />
                    </MatrixClientContext.Provider>,
                );
                await act(waitForUpdate);
                const tag = screen.getByText("justj4nn3");
                const deleteButton = getByRole(tag, "button", { name: "Remove" });
                expect(deleteButton).not.toBeDisabled();
                await act(async () => {
                    await user.click(deleteButton);
                    await waitForUpdate();
                });
                expect(cli.deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "justj4nn3");
            });
        });

        it("resets the model correctly", async () => {
            const user = userEvent.setup();
            const screen = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await act(waitForUpdate);
            const button = screen.getByText(labelResetDefault);
            expect(button).not.toBeDisabled();
            await act(async () => {
                await user.click(button);
                await waitForUpdate();
            });
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.EncryptedMessage,
                true,
            );
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.Message, true);
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.EncryptedDM,
                true,
            );
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.DM, true);
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Override,
                RuleId.SuppressNotices,
                false,
            );
            expect(cli.setPushRuleEnabled).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Override,
                RuleId.InviteToSelf,
                true,
            );

            expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.EncryptedMessage,
                StandardActions.ACTION_NOTIFY,
            );
            expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.Message,
                StandardActions.ACTION_NOTIFY,
            );
            expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.EncryptedDM,
                StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            );
            expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Underride,
                RuleId.DM,
                StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            );
            expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Override,
                RuleId.SuppressNotices,
                StandardActions.ACTION_DONT_NOTIFY,
            );
            expect(cli.setPushRuleActions).toHaveBeenCalledWith(
                "global",
                PushRuleKind.Override,
                RuleId.InviteToSelf,
                StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            );

            for (const pattern of keywords) {
                expect(cli.deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, pattern);
            }
        });
    });

    describe("pusher settings", () => {
        it("can create email pushers", async () => {
            cli.getPushers = jest.fn(cli.getPushers).mockResolvedValue({
                pushers: [
                    {
                        app_display_name: "Element",
                        app_id: "im.vector.app",
                        data: {},
                        device_display_name: "My EyeFon",
                        kind: "http",
                        lang: "en",
                        pushkey: "",
                        enabled: true,
                    },
                ],
            });
            cli.getThreePids = jest.fn(cli.getThreePids).mockResolvedValue({
                threepids: [
                    {
                        medium: ThreepidMedium.Email,
                        address: "test@example.tld",
                        validated_at: 1656633600,
                        added_at: 1656633600,
                    },
                ],
            });

            const label = "test@example.tld";
            const user = userEvent.setup();
            const screen = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await act(waitForUpdate);
            expect(screen.getByLabelText(label)).not.toBeDisabled();
            await act(async () => {
                await user.click(screen.getByLabelText(label));
                await waitForUpdate();
            });
            expect(cli.setPusher).toHaveBeenCalledWith({
                app_display_name: "Email Notifications",
                app_id: "m.email",
                append: true,
                data: { brand: "Element" },
                device_display_name: "test@example.tld",
                kind: "email",
                lang: "en-US",
                pushkey: "test@example.tld",
            });
        });

        it("can remove email pushers", async () => {
            cli.getPushers = jest.fn(cli.getPushers).mockResolvedValue({
                pushers: [
                    {
                        app_display_name: "Element",
                        app_id: "im.vector.app",
                        data: {},
                        device_display_name: "My EyeFon",
                        kind: "http",
                        lang: "en",
                        pushkey: "abctest",
                    },
                    {
                        app_display_name: "Email Notifications",
                        app_id: "m.email",
                        data: { brand: "Element" },
                        device_display_name: "test@example.tld",
                        kind: "email",
                        lang: "en-US",
                        pushkey: "test@example.tld",
                    },
                ],
            });
            cli.getThreePids = jest.fn(cli.getThreePids).mockResolvedValue({
                threepids: [
                    {
                        medium: ThreepidMedium.Email,
                        address: "test@example.tld",
                        validated_at: 1656633600,
                        added_at: 1656633600,
                    },
                ],
            });

            const label = "test@example.tld";
            const user = userEvent.setup();
            const screen = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await act(waitForUpdate);
            expect(screen.getByLabelText(label)).not.toBeDisabled();
            await act(async () => {
                await user.click(screen.getByLabelText(label));
                await waitForUpdate();
            });
            expect(cli.removePusher).toHaveBeenCalledWith("test@example.tld", "m.email");
        });
    });

    describe("clear all notifications", () => {
        it("is hidden when no notifications exist", async () => {
            const room = new Room("room123", cli, "@alice:example.org");
            cli.getRooms = jest.fn(cli.getRooms).mockReturnValue([room]);

            const { container } = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await waitForUpdate();
            expect(
                queryByRole(container, "button", {
                    name: "Mark all messages as read",
                }),
            ).not.toBeInTheDocument();
        });

        it("clears all notifications", async () => {
            const room = new Room("room123", cli, "@alice:example.org");
            cli.getRooms = jest.fn(cli.getRooms).mockReturnValue([room]);

            const message = mkMessage({
                event: true,
                room: "room123",
                user: "@alice:example.org",
                ts: 1,
            });
            room.addLiveEvents([message], { addToState: true });
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);

            const user = userEvent.setup();
            const { container } = render(
                <MatrixClientContext.Provider value={cli}>
                    <NotificationSettings2 />
                </MatrixClientContext.Provider>,
            );
            await waitForUpdate();
            const clearNotificationEl = await findByRole(container, "button", {
                name: "Mark all messages as read",
            });

            await act(async () => {
                await user.click(clearNotificationEl);
                await waitForUpdate();
            });
            expect(cli.sendReadReceipt).toHaveBeenCalled();

            await waitFor(() => {
                expect(clearNotificationEl).not.toBeInTheDocument();
            });
        });
    });
});
