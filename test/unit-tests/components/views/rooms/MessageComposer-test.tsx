/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";
import { EventType, MatrixEvent, Room, RoomMember, THREAD_RELATION_TYPE } from "matrix-js-sdk/src/matrix";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import {
    clearAllModals,
    createTestClient,
    flushPromises,
    mkEvent,
    mkStubRoom,
    mockPlatformPeg,
    stubClient,
    waitEnoughCyclesForModal,
} from "../../../../test-utils";
import MessageComposer from "../../../../../src/components/views/rooms/MessageComposer";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import RoomContext from "../../../../../src/contexts/RoomContext";
import { IRoomState } from "../../../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../../../src/utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { LocalRoom } from "../../../../../src/models/LocalRoom";
import { Features } from "../../../../../src/settings/Settings";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import dis from "../../../../../src/dispatcher/dispatcher";
import { E2EStatus } from "../../../../../src/utils/ShieldUtils";
import { addTextToComposerRTL } from "../../../../test-utils/composer";
import UIStore, { UI_EVENTS } from "../../../../../src/stores/UIStore";
import { Action } from "../../../../../src/dispatcher/actions";
import { VoiceBroadcastInfoState, VoiceBroadcastRecording } from "../../../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";

const openStickerPicker = async (): Promise<void> => {
    await act(async () => {
        await userEvent.click(screen.getByLabelText("More options"));
        await userEvent.click(screen.getByLabelText("Sticker"));
    });
};

const startVoiceMessage = async (): Promise<void> => {
    await act(async () => {
        await userEvent.click(screen.getByLabelText("More options"));
        await userEvent.click(screen.getByLabelText("Voice Message"));
    });
};

const setCurrentBroadcastRecording = (room: Room, state: VoiceBroadcastInfoState): void => {
    const recording = new VoiceBroadcastRecording(
        mkVoiceBroadcastInfoStateEvent(room.roomId, state, "@user:example.com", "ABC123"),
        MatrixClientPeg.safeGet(),
        state,
    );
    SdkContextClass.instance.voiceBroadcastRecordingsStore.setCurrent(recording);
};

const expectVoiceMessageRecordingTriggered = (): void => {
    // Checking for the voice message dialog text, if no mic can be found.
    // By this we know at least that starting a voice message was triggered.
    expect(screen.getByText("No microphone found")).toBeInTheDocument();
};

describe("MessageComposer", () => {
    stubClient();
    const cli = createTestClient();

    beforeEach(() => {
        mockPlatformPeg();
    });

    afterEach(async () => {
        await clearAllModals();
        jest.useRealTimers();

        SdkContextClass.instance.voiceBroadcastRecordingsStore.clearCurrent();

        // restore settings
        act(() => {
            [
                "MessageComposerInput.showStickersButton",
                "MessageComposerInput.showPollsButton",
                Features.VoiceBroadcast,
                "feature_wysiwyg_composer",
            ].forEach((setting: string): void => {
                SettingsStore.setValue(setting, null, SettingLevel.DEVICE, SettingsStore.getDefaultValue(setting));
            });
        });
    });

    describe("for a Room", () => {
        const room = mkStubRoom("!roomId:server", "Room 1", cli);

        it("Renders a SendMessageComposer and MessageComposerButtons by default", () => {
            wrapAndRender({ room });
            expect(screen.getByLabelText("Send a message…")).toBeInTheDocument();
        });

        it("Does not render a SendMessageComposer or MessageComposerButtons when user has no permission", () => {
            wrapAndRender({ room }, false);
            expect(screen.queryByLabelText("Send a message…")).not.toBeInTheDocument();
            expect(screen.getByText("You do not have permission to post to this room")).toBeInTheDocument();
        });

        it("Does not render a SendMessageComposer or MessageComposerButtons when room is tombstoned", () => {
            wrapAndRender(
                { room },
                true,
                false,
                mkEvent({
                    event: true,
                    type: "m.room.tombstone",
                    room: room.roomId,
                    user: "@user1:server",
                    skey: "",
                    content: {},
                    ts: Date.now(),
                }),
            );

            expect(screen.queryByLabelText("Send a message…")).not.toBeInTheDocument();
            expect(screen.getByText("This room has been replaced and is no longer active.")).toBeInTheDocument();
        });

        describe("when receiving a »reply_to_event«", () => {
            let roomContext: IRoomState;
            let resizeNotifier: ResizeNotifier;

            beforeEach(() => {
                jest.useFakeTimers();
                resizeNotifier = {
                    notifyTimelineHeightChanged: jest.fn(),
                } as unknown as ResizeNotifier;
                roomContext = wrapAndRender({
                    room,
                    resizeNotifier,
                }).roomContext;
            });

            it("should call notifyTimelineHeightChanged() for the same context", () => {
                dis.dispatch({
                    action: "reply_to_event",
                    context: roomContext.timelineRenderingType,
                });

                jest.advanceTimersByTime(150);
                expect(resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalled();
            });

            it("should not call notifyTimelineHeightChanged() for a different context", () => {
                dis.dispatch({
                    action: "reply_to_event",
                    context: "test",
                });

                jest.advanceTimersByTime(150);
                expect(resizeNotifier.notifyTimelineHeightChanged).not.toHaveBeenCalled();
            });
        });

        // test button display depending on settings
        [
            {
                setting: "MessageComposerInput.showStickersButton",
                buttonLabel: "Sticker",
            },
            {
                setting: "MessageComposerInput.showPollsButton",
                buttonLabel: "Poll",
            },
            {
                setting: Features.VoiceBroadcast,
                buttonLabel: "Voice broadcast",
            },
        ].forEach(({ setting, buttonLabel }) => {
            [true, false].forEach((value: boolean) => {
                describe(`when ${setting} = ${value}`, () => {
                    beforeEach(async () => {
                        SettingsStore.setValue(setting, null, SettingLevel.DEVICE, value);
                        wrapAndRender({ room });
                        await act(async () => {
                            await userEvent.click(screen.getByLabelText("More options"));
                        });
                    });

                    it(`should${value || "not"} display the button`, () => {
                        if (value) {
                            // eslint-disable-next-line jest/no-conditional-expect
                            expect(screen.getByLabelText(buttonLabel)).toBeInTheDocument();
                        } else {
                            // eslint-disable-next-line jest/no-conditional-expect
                            expect(screen.queryByLabelText(buttonLabel)).not.toBeInTheDocument();
                        }
                    });

                    describe(`and setting ${setting} to ${!value}`, () => {
                        beforeEach(async () => {
                            // simulate settings update
                            await SettingsStore.setValue(setting, null, SettingLevel.DEVICE, !value);
                            dis.dispatch(
                                {
                                    action: Action.SettingUpdated,
                                    settingName: setting,
                                    newValue: !value,
                                },
                                true,
                            );
                        });

                        it(`should${!value || "not"} display the button`, () => {
                            if (!value) {
                                // eslint-disable-next-line jest/no-conditional-expect
                                expect(screen.getByLabelText(buttonLabel)).toBeInTheDocument();
                            } else {
                                // eslint-disable-next-line jest/no-conditional-expect
                                expect(screen.queryByLabelText(buttonLabel)).not.toBeInTheDocument();
                            }
                        });
                    });
                });
            });
        });

        it("should not render the send button", () => {
            wrapAndRender({ room });
            expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();
        });

        describe("when a message has been entered", () => {
            beforeEach(async () => {
                const renderResult = wrapAndRender({ room }).renderResult;
                await addTextToComposerRTL(renderResult, "Hello");
            });

            it("should render the send button", () => {
                expect(screen.getByLabelText("Send message")).toBeInTheDocument();
            });
        });

        describe("UIStore interactions", () => {
            let resizeCallback: (key: string, data: object) => void;

            beforeEach(() => {
                jest.spyOn(UIStore.instance, "on").mockImplementation(
                    (_event: string | symbol, listener: (key: string, data: object) => void): any => {
                        resizeCallback = listener;
                    },
                );
            });

            describe("when a non-resize event occurred in UIStore", () => {
                beforeEach(async () => {
                    wrapAndRender({ room });
                    await openStickerPicker();
                    resizeCallback("test", {});
                });

                it("should still display the sticker picker", () => {
                    expect(screen.getByText("You don't currently have any stickerpacks enabled")).toBeInTheDocument();
                });
            });

            describe("when a resize to narrow event occurred in UIStore", () => {
                beforeEach(async () => {
                    wrapAndRender({ room }, true, true);
                    await openStickerPicker();
                    resizeCallback(UI_EVENTS.Resize, {});
                });

                it("should close the menu", () => {
                    expect(screen.queryByLabelText("Sticker")).not.toBeInTheDocument();
                });

                it("should not show the attachment button", () => {
                    expect(screen.queryByLabelText("Attachment")).not.toBeInTheDocument();
                });

                it("should close the sticker picker", () => {
                    expect(
                        screen.queryByText("You don't currently have any stickerpacks enabled"),
                    ).not.toBeInTheDocument();
                });
            });

            describe("when a resize to non-narrow event occurred in UIStore", () => {
                beforeEach(async () => {
                    wrapAndRender({ room }, true, false);
                    await openStickerPicker();
                    resizeCallback(UI_EVENTS.Resize, {});
                });

                it("should close the menu", () => {
                    expect(screen.queryByLabelText("Sticker")).not.toBeInTheDocument();
                });

                it("should show the attachment button", () => {
                    expect(screen.getByLabelText("Attachment")).toBeInTheDocument();
                });

                it("should close the sticker picker", () => {
                    expect(
                        screen.queryByText("You don't currently have any stickerpacks enabled"),
                    ).not.toBeInTheDocument();
                });
            });
        });

        describe("when not replying to an event", () => {
            it("should pass the expected placeholder to SendMessageComposer", () => {
                wrapAndRender({ room });
                expect(screen.getByLabelText("Send a message…")).toBeInTheDocument();
            });

            it("and an e2e status it should pass the expected placeholder to SendMessageComposer", () => {
                wrapAndRender({
                    room,
                    e2eStatus: E2EStatus.Normal,
                });
                expect(screen.getByLabelText("Send an encrypted message…")).toBeInTheDocument();
            });
        });

        describe("when replying to an event", () => {
            let replyToEvent: MatrixEvent;
            let props: Partial<React.ComponentProps<typeof MessageComposer>>;

            const checkPlaceholder = (expected: string) => {
                it("should pass the expected placeholder to SendMessageComposer", () => {
                    wrapAndRender(props);
                    expect(screen.getByLabelText(expected)).toBeInTheDocument();
                });
            };

            const setEncrypted = () => {
                beforeEach(() => {
                    props.e2eStatus = E2EStatus.Normal;
                });
            };

            beforeEach(() => {
                replyToEvent = mkEvent({
                    event: true,
                    type: EventType.RoomMessage,
                    user: cli.getUserId()!,
                    content: {},
                });

                props = {
                    room,
                    replyToEvent,
                };
            });

            describe("without encryption", () => {
                checkPlaceholder("Send a reply…");
            });

            describe("with encryption", () => {
                setEncrypted();
                checkPlaceholder("Send an encrypted reply…");
            });

            describe("with a non-thread relation", () => {
                beforeEach(() => {
                    props.relation = { rel_type: "test" };
                });

                checkPlaceholder("Send a reply…");
            });

            describe("that is a thread", () => {
                beforeEach(() => {
                    props.relation = { rel_type: THREAD_RELATION_TYPE.name };
                });

                checkPlaceholder("Reply to thread…");

                describe("with encryption", () => {
                    setEncrypted();
                    checkPlaceholder("Reply to encrypted thread…");
                });
            });
        });

        describe("when clicking start a voice message", () => {
            beforeEach(async () => {
                wrapAndRender({ room });
                await startVoiceMessage();
                await flushPromises();
            });

            it("should try to start a voice message", () => {
                expectVoiceMessageRecordingTriggered();
            });
        });

        describe("when recording a voice broadcast and trying to start a voice message", () => {
            beforeEach(async () => {
                setCurrentBroadcastRecording(room, VoiceBroadcastInfoState.Started);
                wrapAndRender({ room });
                await startVoiceMessage();
                await waitEnoughCyclesForModal();
            });

            it("should not start a voice message and display the info dialog", async () => {
                expect(screen.queryByLabelText("Stop recording")).not.toBeInTheDocument();
                expect(screen.getByText("Can't start voice message")).toBeInTheDocument();
            });
        });

        describe("when there is a stopped voice broadcast recording and trying to start a voice message", () => {
            beforeEach(async () => {
                setCurrentBroadcastRecording(room, VoiceBroadcastInfoState.Stopped);
                wrapAndRender({ room });
                await startVoiceMessage();
                await waitEnoughCyclesForModal();
            });

            it("should try to start a voice message and should not display the info dialog", async () => {
                expect(screen.queryByText("Can't start voice message")).not.toBeInTheDocument();
                expectVoiceMessageRecordingTriggered();
            });
        });
    });

    describe("for a LocalRoom", () => {
        const localRoom = new LocalRoom("!room:example.com", cli, cli.getUserId()!);

        it("should not show the stickers button", async () => {
            wrapAndRender({ room: localRoom });
            await act(async () => {
                await userEvent.click(screen.getByLabelText("More options"));
            });
            expect(screen.queryByLabelText("Sticker")).not.toBeInTheDocument();
        });
    });

    it("wysiwyg correctly persists state to and from localStorage", async () => {
        const room = mkStubRoom("!roomId:server", "Room 1", cli);
        const messageText = "Test Text";
        await SettingsStore.setValue("feature_wysiwyg_composer", null, SettingLevel.DEVICE, true);
        const { renderResult, rawComponent } = wrapAndRender({ room });
        const { unmount, rerender } = renderResult;

        await act(async () => {
            await flushPromises();
        });

        const key = `mx_wysiwyg_state_${room.roomId}`;

        await act(async () => {
            await userEvent.click(screen.getByRole("textbox"));
        });
        fireEvent.input(screen.getByRole("textbox"), {
            data: messageText,
            inputType: "insertText",
        });

        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(messageText));

        // Wait for event dispatch to happen
        await act(async () => {
            await flushPromises();
        });

        // assert there is state persisted
        expect(localStorage.getItem(key)).toBeNull();

        // ensure the right state was persisted to localStorage
        unmount();

        // assert the persisted state
        expect(JSON.parse(localStorage.getItem(key)!)).toStrictEqual({
            content: messageText,
            isRichText: true,
        });

        // ensure the correct state is re-loaded
        rerender(rawComponent);
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(messageText));
    }, 10000);
});

function wrapAndRender(
    props: Partial<React.ComponentProps<typeof MessageComposer>> = {},
    canSendMessages = true,
    narrow = false,
    tombstone?: MatrixEvent,
) {
    const mockClient = MatrixClientPeg.safeGet();
    const roomId = "myroomid";
    const room: any = props.room || {
        currentState: undefined,
        roomId,
        client: mockClient,
        getMember: function (userId: string): RoomMember {
            return new RoomMember(roomId, userId);
        },
    };

    const roomContext = {
        room,
        canSendMessages,
        tombstone,
        narrow,
    } as unknown as IRoomState;

    const defaultProps = {
        room,
        resizeNotifier: new ResizeNotifier(),
        permalinkCreator: new RoomPermalinkCreator(room),
    };

    const getRawComponent = (props = {}, context = roomContext, client = mockClient) => (
        <MatrixClientContext.Provider value={client}>
            <RoomContext.Provider value={context}>
                <MessageComposer {...defaultProps} {...props} />
            </RoomContext.Provider>
        </MatrixClientContext.Provider>
    );
    return {
        rawComponent: getRawComponent(props, roomContext, mockClient),
        renderResult: render(getRawComponent(props, roomContext, mockClient)),
        roomContext,
    };
}
