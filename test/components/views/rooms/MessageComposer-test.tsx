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

import * as React from "react";
import { EventType, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";
import { act, render, screen } from "@testing-library/react";
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
} from "../../../test-utils";
import MessageComposer from "../../../../src/components/views/rooms/MessageComposer";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import RoomContext from "../../../../src/contexts/RoomContext";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { LocalRoom } from "../../../../src/models/LocalRoom";
import { Features } from "../../../../src/settings/Settings";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import dis from "../../../../src/dispatcher/dispatcher";
import { E2EStatus } from "../../../../src/utils/ShieldUtils";
import { addTextToComposerRTL } from "../../../test-utils/composer";
import UIStore, { UI_EVENTS } from "../../../../src/stores/UIStore";
import { Action } from "../../../../src/dispatcher/actions";
import { VoiceBroadcastInfoState, VoiceBroadcastRecording } from "../../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";

jest.mock("../../../../src/components/views/rooms/wysiwyg_composer", () => ({
    SendWysiwygComposer: jest.fn().mockImplementation(() => <div data-testid="wysiwyg-composer" />),
}));

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

const shouldClearModal = async (): Promise<void> => {
    afterEach(async () => {
        await clearAllModals();
    });
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

    afterEach(() => {
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
            let resizeCallback: Function;

            beforeEach(() => {
                jest.spyOn(UIStore.instance, "on").mockImplementation(
                    (_event: string | symbol, listener: Function): any => {
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

            shouldClearModal();

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

            shouldClearModal();

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

            shouldClearModal();

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

    it("should render SendWysiwygComposer when enabled", () => {
        const room = mkStubRoom("!roomId:server", "Room 1", cli);
        SettingsStore.setValue("feature_wysiwyg_composer", null, SettingLevel.DEVICE, true);

        wrapAndRender({ room });
        expect(screen.getByTestId("wysiwyg-composer")).toBeInTheDocument();
    });
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

    return {
        renderResult: render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={roomContext}>
                    <MessageComposer {...defaultProps} {...props} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        ),
        roomContext,
    };
}
