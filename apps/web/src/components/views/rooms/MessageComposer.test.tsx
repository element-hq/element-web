/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { EventType, type MatrixEvent, RoomMember, THREAD_RELATION_TYPE } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { initOnce } from "@vector-im/matrix-wysiwyg";
import {
    clearAllModals,
    createTestClient,
    flushPromises,
    mkEvent,
    mkStubRoom,
    mockPlatformPeg,
    stubClient,
} from "test-utils";
import { addTextToComposerRTL } from "./__mocks__/composer.ts";

import MessageComposer from "./MessageComposer";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { LocalRoom } from "../../../models/LocalRoom";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import dis from "../../../dispatcher/dispatcher";
import { E2EStatus } from "../../../utils/ShieldUtils";
import UIStore, { UI_EVENTS } from "../../../stores/UIStore";
import { Action } from "../../../dispatcher/actions";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";
import { TimelineRenderingType, type RoomContextType } from "../../../contexts/RoomContext.ts";
import {
    RoomUploadContextProvider,
    type RoomUploadViewModel,
    useRoomUploadViewModel,
} from "../../../viewmodels/room/RoomUploadViewModel.tsx";
import { SDKContext } from "../../../contexts/SDKContext.ts";
import { SDKContextClass } from "../../../contexts/SDKContextClass.ts";
import { sendMessage as sendWysiwygMessage } from "./wysiwyg_composer/utils/message";
import { createMessageContent as createWysiwygMessageContent } from "./wysiwyg_composer/utils/createMessageContent";
import { captionFromMessageContent, type GalleryItem } from "../../../utils/gallery";
import { type EditorActions } from "./EditorActions";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { GalleryComposerViewModel } from "../../../viewmodels/composer/GalleryComposerViewModel";

// Wrapped rather than replaced, so the composer behaves as it always does in the other tests while
// the attachment tests can tell which of the two ways of sending was taken.
vi.mock("./wysiwyg_composer/utils/message", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./wysiwyg_composer/utils/message")>();
    return { ...actual, sendMessage: vi.fn(actual.sendMessage) };
});
/** What the composer gives the editor of a message being edited. */
interface EditorProps {
    editState: EditorStateTransfer;
    inComposer?: boolean;
    className?: string;
    showUrlPreview?: boolean;
    onAttachmentsChange: (attachments?: GalleryComposerViewModel) => void;
    actionsRef: { current: EditorActions | null };
}

// The editor of a message being edited, which has tests of its own. Records what the composer gives it.
const { editorProps } = vi.hoisted(() => ({ editorProps: [] as EditorProps[] }));
vi.mock("./EditMessageComposerWrapper", () => ({
    EditMessageComposerWrapper: (props: EditorProps) => {
        editorProps.push(props);
        return <div role="textbox" aria-label="Edit message" />;
    },
}));
vi.mock("./wysiwyg_composer/utils/createMessageContent", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./wysiwyg_composer/utils/createMessageContent")>();
    return { ...actual, createMessageContent: vi.fn(actual.createMessageContent) };
});

const openStickerPicker = async (): Promise<void> => {
    await userEvent.click(screen.getByLabelText("More options"));
    await userEvent.click(screen.getByLabelText("Sticker"));
};

const startVoiceMessage = async (): Promise<void> => {
    await userEvent.click(screen.getByLabelText("More options"));
    await userEvent.click(screen.getByLabelText("Voice Message"));
};

const expectVoiceMessageRecordingTriggered = (): void => {
    // Checking for the voice message dialog text, if no mic can be found.
    // By this we know at least that starting a voice message was triggered.
    expect(screen.getByText("No microphone found")).toBeInTheDocument();
};

beforeAll(initOnce, 10000);

describe("MessageComposer", () => {
    stubClient();
    const cli = createTestClient();

    beforeEach(() => {
        mockPlatformPeg();
    });

    afterEach(async () => {
        await clearAllModals();
        vi.useRealTimers();

        // restore settings
        await act(async () => {
            await Promise.all(
                (
                    [
                        "MessageComposerInput.showStickersButton",
                        "MessageComposerInput.showPollsButton",
                        "feature_wysiwyg_composer",
                    ] as const
                ).map((setting) =>
                    SettingsStore.setValue(setting, null, SettingLevel.DEVICE, SettingsStore.getDefaultValue(setting)),
                ),
            );
        });
    });

    it("wysiwyg correctly persists state to and from localStorage", async () => {
        const room = mkStubRoom("!roomId:server", "Room 1", cli);
        const messageText = "Test Text";
        await SettingsStore.setValue("feature_wysiwyg_composer", null, SettingLevel.DEVICE, true);
        const { renderResult, rawComponent } = wrapAndRender({ room });
        const { unmount } = renderResult;

        await flushPromises();

        const key = `mx_wysiwyg_state_${room.roomId}`;

        await userEvent.click(await screen.findByRole("textbox"));
        fireEvent.input(screen.getByRole("textbox"), {
            data: messageText,
            inputType: "insertText",
        });

        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(messageText));

        // Wait for event dispatch to happen
        await flushPromises();

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
        render(rawComponent);
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(messageText));
    }, 10000);

    describe("for a Room", () => {
        const room = mkStubRoom("!roomId:server", "Room 1", cli);

        it("Renders a SendMessageComposer and MessageComposerButtons by default", () => {
            wrapAndRender({ room });
            expect(screen.getByLabelText("Send an unencrypted message…")).toBeInTheDocument();
        });

        it("Does not render a SendMessageComposer or MessageComposerButtons when user has no permission", () => {
            wrapAndRender({ room }, false);
            expect(screen.queryByLabelText("Send an unencrypted message…")).not.toBeInTheDocument();
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

            expect(screen.queryByLabelText("Send an unencrypted message…")).not.toBeInTheDocument();
            expect(screen.getByText("This room has been replaced and is no longer active.")).toBeInTheDocument();
        });

        describe("when receiving a »reply_to_event«", () => {
            let roomContext: RoomContextType;
            let resizeNotifier: ResizeNotifier;

            beforeEach(() => {
                vi.useFakeTimers();
                resizeNotifier = {
                    notifyTimelineHeightChanged: vi.fn(),
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

                vi.advanceTimersByTime(150);
                expect(resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalled();
            });

            it("should not call notifyTimelineHeightChanged() for a different context", () => {
                dis.dispatch({
                    action: "reply_to_event",
                    context: "test",
                });

                vi.advanceTimersByTime(150);
                expect(resizeNotifier.notifyTimelineHeightChanged).not.toHaveBeenCalled();
            });
        });

        // test button display depending on settings
        [
            {
                setting: "MessageComposerInput.showStickersButton" as const,
                buttonLabel: "Sticker",
            },
            {
                setting: "MessageComposerInput.showPollsButton" as const,
                buttonLabel: "Poll",
            },
        ].forEach(({ setting, buttonLabel }) => {
            [true, false].forEach((value: boolean) => {
                describe(`when ${setting} = ${value}`, () => {
                    beforeEach(async () => {
                        await act(() => SettingsStore.setValue(setting, null, SettingLevel.DEVICE, value));
                        wrapAndRender({ room });
                        await userEvent.click(screen.getByLabelText("More options"));
                    });

                    it(`should${value ? "" : " not"} display the button`, () => {
                        if (value) {
                            expect(screen.getByLabelText(buttonLabel)).toBeInTheDocument();
                        } else {
                            expect(screen.queryByLabelText(buttonLabel)).not.toBeInTheDocument();
                        }
                    });

                    describe(`and setting ${setting} to ${!value}`, () => {
                        beforeEach(async () => {
                            // simulate settings update
                            await act(async () => {
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
                        });

                        it(`should${!value || "not"} display the button`, () => {
                            if (!value) {
                                expect(screen.getByLabelText(buttonLabel)).toBeInTheDocument();
                            } else {
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
                vi.spyOn(UIStore.instance, "on").mockImplementation(
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
                    act(() => resizeCallback(UI_EVENTS.Resize, {}));
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
                    act(() => resizeCallback(UI_EVENTS.Resize, {}));
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
                expect(screen.getByLabelText("Send an unencrypted message…")).toBeInTheDocument();
            });

            it("and an e2e status it should pass the expected placeholder to SendMessageComposer", () => {
                wrapAndRender({
                    room,
                    e2eStatus: E2EStatus.Normal,
                });
                expect(screen.getByLabelText("Send a message…")).toBeInTheDocument();
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
                checkPlaceholder("Send an unencrypted reply…");
            });

            describe("with encryption", () => {
                setEncrypted();
                checkPlaceholder("Send a reply…");
            });

            describe("with a non-thread relation", () => {
                beforeEach(() => {
                    props.relation = { rel_type: "test" };
                });

                checkPlaceholder("Send an unencrypted reply…");
            });

            describe("that is a thread", () => {
                beforeEach(() => {
                    props.relation = { rel_type: THREAD_RELATION_TYPE.name };
                });

                checkPlaceholder("Reply to unencrypted thread…");

                describe("with encryption", () => {
                    setEncrypted();
                    checkPlaceholder("Reply to thread…");
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
    });

    describe("with attachments waiting in the composer", () => {
        const room = mkStubRoom("!attachments:server", "Room with attachments", cli);
        const image = new File(["image"], "photo.png", { type: "image/png" });
        const video = new File(["video"], "clip.mp4", { type: "video/mp4" });

        let uploadVm: RoomUploadViewModel;
        let sendAttachments: ReturnType<typeof vi.spyOn>;

        // Gives the test the view model which the composer gets from the upload context.
        const CaptureUploadVm = (): null => {
            uploadVm = useRoomUploadViewModel();
            return null;
        };

        const renderComposer = (props: Partial<React.ComponentProps<typeof MessageComposer>> = {}) => {
            const client = MatrixClientPeg.safeGet();
            const roomContext = {
                room,
                canSendMessages: true,
                narrow: false,
                timelineRenderingType: TimelineRenderingType.Room,
            } satisfies Partial<RoomContextType> as RoomContextType;
            const result = render(
                <SDKContext.Provider value={SDKContextClass.instance}>
                    <MatrixClientContext.Provider value={client}>
                        <ScopedRoomContextProvider {...roomContext}>
                            <RoomUploadContextProvider>
                                <CaptureUploadVm />
                                <MessageComposer
                                    room={room}
                                    resizeNotifier={new ResizeNotifier()}
                                    permalinkCreator={new RoomPermalinkCreator(room)}
                                    {...props}
                                />
                            </RoomUploadContextProvider>
                        </ScopedRoomContextProvider>
                    </MatrixClientContext.Provider>
                </SDKContext.Provider>,
            );
            // Sending is the view model's job, which has tests of its own.
            sendAttachments = vi.spyOn(uploadVm, "sendAttachments").mockReturnValue(true);
            return { ...result, client };
        };

        const attach = (...files: File[]): void => act(() => uploadVm.attachments.onAddFiles(files));
        const tray = (container: HTMLElement): HTMLElement | null =>
            container.querySelector<HTMLElement>(".mx_MessageComposer_attachments");

        beforeEach(() => {
            // Each test starts from an empty composer, not from the draft of the one before
            localStorage.clear();
            vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
            vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
            vi.mocked(sendWysiwygMessage).mockClear();
            vi.mocked(createWysiwygMessageContent).mockClear();
        });

        afterEach(() => {
            vi.mocked(URL.createObjectURL).mockRestore();
            vi.mocked(URL.revokeObjectURL).mockRestore();
        });

        it("shows no attachment tray while nothing is attached", () => {
            const { container } = renderComposer();

            expect(tray(container)).toBeNull();
            expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
        });

        it("shows the attachments in the composer, in a tray without a field for text", () => {
            const { container } = renderComposer();

            attach(image, video);

            const attachments = tray(container)!;
            expect(attachments).toBeInTheDocument();
            // Inside the composer, next to the message being written
            expect(screen.getByRole("region", { name: "Message composer" })).toContainElement(attachments);
            expect(attachments.querySelector("img")).toHaveAttribute("src", "blob:photo.png");
            expect(attachments.querySelector("video")).toHaveAttribute("src", "blob:clip.mp4");
            expect(screen.getByRole("button", { name: "Remove photo.png" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Remove clip.mp4" })).toBeInTheDocument();
            // The caption is the message itself, and the tray only has an icon to add more
            expect(attachments.querySelector("textarea")).toBeNull();
            expect(screen.getByRole("button", { name: "Add photos or videos" })).toHaveTextContent("");
        });

        it("takes the tray away again when every attachment has been removed", async () => {
            const { container } = renderComposer();
            attach(image, video);

            await userEvent.click(screen.getByRole("button", { name: "Remove photo.png" }));
            expect(tray(container)).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Remove photo.png" })).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole("button", { name: "Remove clip.mp4" }));
            expect(tray(container)).toBeNull();
            expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();
        });

        it("offers to send as soon as something is attached, without any text", () => {
            renderComposer();
            expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();

            attach(image);

            expect(screen.getByLabelText("Send message")).toBeInTheDocument();
        });

        it("sends the attachments from the send button when nothing was written", async () => {
            const { client } = renderComposer();
            vi.mocked(client.sendMessage).mockClear();
            attach(image);

            await userEvent.click(screen.getByLabelText("Send message"));

            await waitFor(() => expect(sendAttachments).toHaveBeenCalledTimes(1));
            expect(sendAttachments).toHaveBeenCalledWith({ "body": "", "m.mentions": {} });
            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("sends the message being written as the caption of the attachments", async () => {
            const { client, ...renderResult } = renderComposer();
            vi.mocked(client.sendMessage).mockClear();
            await addTextToComposerRTL(renderResult, "Hello");
            attach(image, video);

            await userEvent.click(screen.getByLabelText("Send message"));

            await waitFor(() => expect(sendAttachments).toHaveBeenCalledWith({ "body": "Hello", "m.mentions": {} }));
            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        describe("in the rich text composer", () => {
            beforeEach(async () => {
                await SettingsStore.setValue("feature_wysiwyg_composer", null, SettingLevel.DEVICE, true);
            });

            const typeInComposer = async (text: string): Promise<void> => {
                await userEvent.click(await screen.findByRole("textbox"));
                fireEvent.input(screen.getByRole("textbox"), { data: text, inputType: "insertText" });
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(text));
                // Wait for the composer to report its new content
                await flushPromises();
            };

            it("sends the message being written as the caption of the attachments", async () => {
                const replyToEvent = mkEvent({
                    event: true,
                    type: EventType.RoomMessage,
                    user: "@bob:test",
                    room: room.roomId,
                    content: { msgtype: "m.text", body: "Send me the photos" },
                });
                const dispatch = vi.spyOn(dis, "dispatch");
                renderComposer({ replyToEvent });
                await flushPromises();
                await typeInComposer("Here they are");
                attach(image, video);

                await userEvent.click(screen.getByLabelText("Send message"));

                await waitFor(() => expect(sendAttachments).toHaveBeenCalledTimes(1));
                // The caption is what the rich text composer would have sent as a message
                expect(createWysiwygMessageContent).toHaveBeenCalledWith("Here they are", true, {
                    relation: undefined,
                    replyToEvent,
                });
                const content = await vi.mocked(createWysiwygMessageContent).mock.results[0].value;
                expect(content.body).toBe("Here they are");
                expect(sendAttachments).toHaveBeenCalledWith(captionFromMessageContent(content));
                // It is not also sent as a message of its own
                expect(sendWysiwygMessage).not.toHaveBeenCalled();
                // The composer is emptied and the reply ended, as for any message
                expect(dispatch).toHaveBeenCalledWith({
                    action: Action.ClearAndFocusSendMessageComposer,
                    timelineRenderingType: TimelineRenderingType.Room,
                });
                expect(dispatch).toHaveBeenCalledWith({
                    action: "reply_to_event",
                    event: null,
                    context: TimelineRenderingType.Room,
                });
                dispatch.mockRestore();
            }, 10000);

            it("sends the attachments on their own when nothing was written", async () => {
                renderComposer();
                await flushPromises();
                await screen.findByRole("textbox");
                attach(image);

                await userEvent.click(screen.getByLabelText("Send message"));

                await waitFor(() => expect(sendAttachments).toHaveBeenCalledTimes(1));
                expect(sendAttachments.mock.calls[0][0]).toMatchObject({ body: "" });
                expect(sendWysiwygMessage).not.toHaveBeenCalled();
            }, 10000);

            it("runs a command as usual and leaves the attachments waiting", async () => {
                // The command itself is not what is being tested
                vi.mocked(sendWysiwygMessage).mockResolvedValueOnce(undefined);
                const { container } = renderComposer();
                await flushPromises();
                await typeInComposer("/shrug");
                attach(image);

                await userEvent.click(screen.getByLabelText("Send message"));

                await waitFor(() => expect(sendWysiwygMessage).toHaveBeenCalledTimes(1));
                expect(vi.mocked(sendWysiwygMessage).mock.calls[0][0]).toBe("/shrug");
                expect(sendAttachments).not.toHaveBeenCalled();
                expect(uploadVm.hasAttachments).toBe(true);
                expect(tray(container)).toBeInTheDocument();
            }, 10000);

            it("sends a message without attachments as usual", async () => {
                vi.mocked(sendWysiwygMessage).mockResolvedValueOnce(undefined);
                renderComposer();
                await flushPromises();
                await typeInComposer("Just text");

                await userEvent.click(screen.getByLabelText("Send message"));

                await waitFor(() => expect(sendWysiwygMessage).toHaveBeenCalledTimes(1));
                expect(vi.mocked(sendWysiwygMessage).mock.calls[0][0]).toBe("Just text");
                expect(sendAttachments).not.toHaveBeenCalled();
            }, 10000);
        });
    });

    describe("while a message is being edited in the composer", () => {
        const room = mkStubRoom("!editing:server", "Room with an edit", cli);
        const mkMessage = (id: string, content: Record<string, unknown>): MatrixEvent =>
            mkEvent({ event: true, type: EventType.RoomMessage, room: room.roomId, user: "@me:server", id, content });
        const textMessage = mkMessage("$text", { msgtype: "m.text", body: "Hello" });
        const otherMessage = mkMessage("$other", { msgtype: "m.text", body: "Another" });
        const galleryMessage = mkMessage("$gallery", {
            msgtype: "dm.filament.gallery",
            body: "",
            itemtypes: [{ itemtype: "m.image", body: "one.png", url: "mxc://server/one" }],
        });
        const draftImage = new File(["image"], "draft.png", { type: "image/png" });
        const keptItem = { itemtype: "m.image", body: "one.png", url: "mxc://server/one" } as GalleryItem;

        let uploadVm: RoomUploadViewModel;
        const CaptureUploadVm = (): null => {
            uploadVm = useRoomUploadViewModel();
            return null;
        };

        const tree = (props: Partial<React.ComponentProps<typeof MessageComposer>>): React.ReactElement => {
            const roomContext = {
                room,
                canSendMessages: true,
                narrow: false,
                timelineRenderingType: TimelineRenderingType.Room,
            } satisfies Partial<RoomContextType> as RoomContextType;
            return (
                <SDKContext.Provider value={SDKContextClass.instance}>
                    <MatrixClientContext.Provider value={MatrixClientPeg.safeGet()}>
                        <ScopedRoomContextProvider {...roomContext}>
                            <RoomUploadContextProvider>
                                <CaptureUploadVm />
                                <MessageComposer
                                    room={room}
                                    resizeNotifier={new ResizeNotifier()}
                                    permalinkCreator={new RoomPermalinkCreator(room)}
                                    {...props}
                                />
                            </RoomUploadContextProvider>
                        </ScopedRoomContextProvider>
                    </MatrixClientContext.Provider>
                </SDKContext.Provider>
            );
        };

        const renderComposer = (props: Partial<React.ComponentProps<typeof MessageComposer>> = {}) => {
            const result = render(tree(props));
            return {
                ...result,
                setProps: (newProps: Partial<React.ComponentProps<typeof MessageComposer>>) =>
                    result.rerender(tree(newProps)),
            };
        };

        const lastEditorProps = (): EditorProps => editorProps.at(-1)!;
        const tray = (container: HTMLElement): HTMLElement | null =>
            container.querySelector<HTMLElement>(".mx_MessageComposer_attachments");
        /** Hand the composer the attachments of the message being edited, as the editor does. */
        const reportAttachments = (attachments?: GalleryComposerViewModel): void => {
            act(() => {
                lastEditorProps().onAttachmentsChange(attachments);
            });
        };

        const createdVms: GalleryComposerViewModel[] = [];
        const createAttachments = (items: Array<File | GalleryItem>): GalleryComposerViewModel => {
            const vm = new GalleryComposerViewModel({ items });
            createdVms.push(vm);
            return vm;
        };

        beforeEach(async () => {
            localStorage.clear();
            editorProps.length = 0;
            vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
            vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
            await SettingsStore.setValue("feature_edit_in_composer", null, SettingLevel.DEVICE, true);
        });

        afterEach(async () => {
            while (createdVms.length) createdVms.pop()!.dispose();
            vi.mocked(URL.createObjectURL).mockRestore();
            vi.mocked(URL.revokeObjectURL).mockRestore();
            await SettingsStore.setValue("feature_edit_in_composer", null, SettingLevel.DEVICE, null);
        });

        it("edits in place in the timeline, not in the composer, while the lab is off", async () => {
            await SettingsStore.setValue("feature_edit_in_composer", null, SettingLevel.DEVICE, false);
            const { container } = renderComposer({ editState: new EditorStateTransfer(textMessage) });

            expect(editorProps).toHaveLength(0);
            expect(screen.queryByText("Editing message")).not.toBeInTheDocument();
            expect(container.querySelector(".mx_SendMessageComposer")).not.toBeNull();
        });

        it("holds the editor of the message in place of the message being written", () => {
            const editState = new EditorStateTransfer(textMessage);
            const { container } = renderComposer({ editState });

            expect(screen.getByRole("textbox", { name: "Edit message" })).toBeInTheDocument();
            expect(container.querySelector(".mx_SendMessageComposer")).toBeNull();
            expect(lastEditorProps()).toEqual(
                expect.objectContaining({
                    editState,
                    inComposer: true,
                    showUrlPreview: undefined,
                    className: "mx_MessageComposer_editor",
                    actionsRef: expect.objectContaining({ current: null }),
                }),
            );
        });

        it("shows that a message is being edited instead of the message being replied to", () => {
            const replyToEvent = mkMessage("$reply", { msgtype: "m.text", body: "Earlier" });
            const { setProps } = renderComposer({ replyToEvent });
            expect(screen.getByText("Replying")).toBeInTheDocument();

            setProps({ replyToEvent, editState: new EditorStateTransfer(textMessage) });

            expect(screen.getByText("Editing message")).toBeInTheDocument();
            expect(screen.queryByText("Replying")).not.toBeInTheDocument();
        });

        it("saves the edit from the send button, which shows even without any text", async () => {
            renderComposer({ editState: new EditorStateTransfer(textMessage) });
            const actions = { save: vi.fn(), cancel: vi.fn() };
            lastEditorProps().actionsRef.current = actions;

            await userEvent.click(screen.getByRole("button", { name: "Save" }));

            expect(actions.save).toHaveBeenCalledTimes(1);
            expect(actions.cancel).not.toHaveBeenCalled();
            expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
        });

        it("cancels the edit from the editing bar", async () => {
            renderComposer({ editState: new EditorStateTransfer(textMessage) });
            const actions = { save: vi.fn(), cancel: vi.fn() };
            lastEditorProps().actionsRef.current = actions;

            await userEvent.click(screen.getByRole("button", { name: "Cancel editing" }));

            expect(actions.cancel).toHaveBeenCalledTimes(1);
            expect(actions.save).not.toHaveBeenCalled();
        });

        it("does nothing from its buttons once the editor has gone", async () => {
            renderComposer({ editState: new EditorStateTransfer(textMessage) });

            // The editor clears its actions when it goes away
            await userEvent.click(screen.getByRole("button", { name: "Save" }));
            await userEvent.click(screen.getByRole("button", { name: "Cancel editing" }));

            expect(screen.getByText("Editing message")).toBeInTheDocument();
        });

        it("leaves out the buttons which would make a new message of their own", async () => {
            await SettingsStore.setValue("MessageComposerInput.showStickersButton", null, SettingLevel.DEVICE, true);
            const { setProps } = renderComposer();
            expect(screen.getByLabelText("More options")).toBeInTheDocument();

            setProps({ editState: new EditorStateTransfer(textMessage) });

            // Stickers, voice messages, polls and locations are all in that menu.
            expect(screen.queryByLabelText("More options")).not.toBeInTheDocument();
            expect(screen.getByLabelText("Emoji")).toBeInTheDocument();
            expect(screen.getByLabelText("Attachment")).toBeInTheDocument();
        });

        it("shows the attachments of the message being edited instead of those of the draft", () => {
            const { container } = renderComposer({ editState: new EditorStateTransfer(galleryMessage) });
            act(() => uploadVm.attachments.onAddFiles([draftImage]));
            const setEditAttachments = vi.spyOn(uploadVm, "setEditAttachments");
            const attachments = createAttachments([keptItem]);

            reportAttachments(attachments);

            expect(tray(container)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Remove one.png" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Remove draft.png" })).not.toBeInTheDocument();
            // Files picked while editing go to the message being edited.
            expect(setEditAttachments).toHaveBeenCalledWith(attachments);

            reportAttachments(undefined);
            expect(setEditAttachments).toHaveBeenLastCalledWith(undefined);
            expect(tray(container)).toBeNull();
        });

        it("keeps the strip of a message with media when every item is removed, so more can be added", () => {
            const { container } = renderComposer({ editState: new EditorStateTransfer(galleryMessage) });

            reportAttachments(createAttachments([]));

            expect(tray(container)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeInTheDocument();
        });

        it("shows no strip for a text message until images or videos are added", () => {
            const { container } = renderComposer({ editState: new EditorStateTransfer(textMessage) });
            const attachments = createAttachments([]);

            reportAttachments(attachments);
            expect(tray(container)).toBeNull();

            act(() => attachments.onAddFiles([draftImage]));
            expect(screen.getByRole("button", { name: "Remove draft.png" })).toBeInTheDocument();
        });

        it("brings the draft's attachments back once the edit is over", () => {
            const { container, setProps } = renderComposer();
            act(() => uploadVm.attachments.onAddFiles([draftImage]));

            setProps({ editState: new EditorStateTransfer(textMessage) });
            expect(tray(container)).toBeNull();

            setProps({});
            expect(screen.getByRole("button", { name: "Remove draft.png" })).toBeInTheDocument();
            expect(screen.queryByText("Editing message")).not.toBeInTheDocument();
        });

        it("moves the focus to the editor when an edit starts and when it moves to another message", () => {
            const dispatch = vi.spyOn(dis, "dispatch");
            const { setProps } = renderComposer();
            const focusEdits = () =>
                dispatch.mock.calls.filter(([payload]) => payload.action === Action.FocusEditMessageComposer);

            setProps({ editState: new EditorStateTransfer(textMessage) });
            expect(focusEdits()).toEqual([
                [{ action: Action.FocusEditMessageComposer, context: TimelineRenderingType.Room }],
            ]);

            // The same message, as when the composer is drawn again
            setProps({ editState: new EditorStateTransfer(textMessage) });
            expect(focusEdits()).toHaveLength(1);

            setProps({ editState: new EditorStateTransfer(otherMessage) });
            expect(focusEdits()).toHaveLength(2);
            // A fresh editor for the other message
            expect(lastEditorProps().editState.getEvent()).toBe(otherMessage);
            dispatch.mockRestore();
        });

        it("keeps what was being written with the rich text editor for after the edit", async () => {
            await SettingsStore.setValue("feature_wysiwyg_composer", null, SettingLevel.DEVICE, true);
            const { setProps } = renderComposer();
            await userEvent.click(await screen.findByRole("textbox"));
            fireEvent.input(screen.getByRole("textbox"), { data: "Half a thought", inputType: "insertText" });
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Half a thought"));

            setProps({ editState: new EditorStateTransfer(textMessage) });
            expect(screen.getByRole("textbox", { name: "Edit message" })).toBeInTheDocument();

            setProps({});
            await waitFor(() =>
                expect(screen.getByRole("textbox", { name: /^(?!Edit message)/ })).toHaveTextContent("Half a thought"),
            );
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
        timelineRenderingType: TimelineRenderingType.Room,
    } satisfies Partial<RoomContextType> as RoomContextType;

    const defaultProps = {
        room,
        resizeNotifier: new ResizeNotifier(),
        permalinkCreator: new RoomPermalinkCreator(room),
    };

    const getRawComponent = (props = {}, context = roomContext, client = mockClient) => (
        <SDKContext.Provider value={SDKContextClass.instance}>
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...context}>
                    <RoomUploadContextProvider>
                        <MessageComposer {...defaultProps} {...props} />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>
        </SDKContext.Provider>
    );
    return {
        rawComponent: getRawComponent(props, roomContext, mockClient),
        renderResult: render(getRawComponent(props, roomContext, mockClient)),
        roomContext,
    };
}
