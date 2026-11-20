/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { initOnce } from "@vector-im/matrix-wysiwyg";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import { flushPromises, mkEvent } from "test-utils";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { EditWysiwygComposer } from ".";
import EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import { Emoji } from "./components/Emoji";
import { ChevronFace } from "../../../structures/ContextMenu";
import { type ComposerInsertPayload, ComposerType } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { type ActionPayload } from "../../../../dispatcher/payloads";
import * as EmojiButton from "../EmojiButton";
import { createMocks } from "./__mocks__";
import { ScopedRoomContextProvider } from "../../../../contexts/ScopedRoomContext.tsx";
import { RoomUploadContextProvider } from "../../../../viewmodels/room/RoomUploadViewModel.tsx";
import ContentMessages from "../../../../ContentMessages";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { GalleryComposerViewModel } from "../../../../viewmodels/composer/GalleryComposerViewModel";
import { parseEditorStateTransfer } from "./hooks/useInitialContent";
import SettingsStore from "../../../../settings/SettingsStore";
import { type EditorActions } from "../EditorActions";

beforeAll(initOnce, 10000);

describe("EditWysiwygComposer", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    const { editorStateTransfer, defaultRoomContext, mockClient, mockEvent } = createMocks();

    const customRender = (
        disabled = false,
        _editorStateTransfer = editorStateTransfer,
        client = mockClient,
        roomContext = defaultRoomContext,
    ) => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...roomContext}>
                    <RoomUploadContextProvider>
                        <EditWysiwygComposer disabled={disabled} editorStateTransfer={_editorStateTransfer} />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    };

    it("Should not render the component when not ready", async () => {
        // When
        const { rerender } = customRender(false);
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"), {
            timeout: 2000,
        });

        rerender(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext} room={undefined}>
                    <RoomUploadContextProvider>
                        <EditWysiwygComposer disabled={false} editorStateTransfer={editorStateTransfer} />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );

        // Then
        await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    });

    describe("Initialize with content", () => {
        it("Should initialize useWysiwyg with html content", async () => {
            // When
            customRender(false, editorStateTransfer);

            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"), {
                timeout: 2000,
            });

            await waitFor(() =>
                expect(screen.getByRole("textbox")).toContainHTML(mockEvent.getContent()["formatted_body"]),
            );
        });

        it("Should initialize useWysiwyg with plain text content", async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: {
                    msgtype: "m.text",
                    body: "Replying to this",
                },
                event: true,
            });
            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toContainHTML(mockEvent.getContent()["body"]));
        });

        it("Should ignore when formatted_body is not filled", async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: {
                    msgtype: "m.text",
                    body: "Replying to this",
                    format: "org.matrix.custom.html",
                },
                event: true,
            });

            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);

            // Then
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        it("Should strip <mx-reply> tag from initial content", async () => {
            // When
            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: {
                    msgtype: "m.text",
                    body: "Replying to this",
                    format: "org.matrix.custom.html",
                    formatted_body: "<mx-reply>Reply</mx-reply>My content",
                },
                event: true,
            });

            const editorStateTransfer = new EditorStateTransfer(mockEvent);
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            // Then
            await waitFor(() => {
                expect(screen.getByRole("textbox")).not.toContainHTML("<mx-reply>Reply</mx-reply>");
                expect(screen.getByRole("textbox")).toContainHTML("My content");
            });
        });
    });

    describe("Edit and save actions", () => {
        let spyDispatcher: MockInstance<(payload: ActionPayload, sync?: boolean) => void>;

        const blankMockEvent = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: { msgtype: "m.text", body: "" },
            event: true,
        });
        const blankEditorStateTransfer = new EditorStateTransfer(blankMockEvent);

        beforeEach(async () => {
            spyDispatcher = vi.spyOn(defaultDispatcher, "dispatch");
            customRender(false, blankEditorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
        });

        afterEach(() => {
            spyDispatcher.mockRestore();
        });

        it("Should cancel edit on cancel button click", async () => {
            // When
            screen.getByText("Cancel").click();

            // Then
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: Action.EditEvent,
                event: null,
                timelineRenderingType: defaultRoomContext.timelineRenderingType,
            });
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: Action.FocusSendMessageComposer,
                context: defaultRoomContext.timelineRenderingType,
            });
        });

        it("Should send message on save button click", async () => {
            // When
            fireEvent.input(screen.getByRole("textbox"), {
                data: "foo bar",
                inputType: "insertText",
            });
            await waitFor(() => expect(screen.getByText("Save")).not.toHaveAttribute("disabled"));

            // Then
            screen.getByText("Save").click();
            const expectedContent = {
                "body": `* foo bar`,
                "format": "org.matrix.custom.html",
                "formatted_body": `* foo bar`,
                "m.new_content": {
                    body: "foo bar",
                    format: "org.matrix.custom.html",
                    formatted_body: "foo bar",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    event_id: blankMockEvent.getId(),
                    rel_type: "m.replace",
                },
                "msgtype": "m.text",
            };
            await waitFor(() =>
                expect(mockClient.sendMessage).toHaveBeenCalledWith(blankMockEvent.getRoomId(), null, expectedContent),
            );

            expect(spyDispatcher).toHaveBeenCalledWith({ action: "message_sent" });
        });
    });

    describe("URL previews", () => {
        let spyDispatcher: MockInstance<(payload: ActionPayload, sync?: boolean) => void>;

        const renderWithPreviewProps = (props: {
            updateUrlPreviews?: (content: string) => void;
            attachBundles?: (content: RoomMessageEventContent) => Promise<boolean>;
            isUrlPreviewsModified?: boolean;
        }) =>
            render(
                <MatrixClientContext.Provider value={mockClient}>
                    <ScopedRoomContextProvider {...defaultRoomContext}>
                        <RoomUploadContextProvider>
                            <EditWysiwygComposer editorStateTransfer={editorStateTransfer} {...props} />
                        </RoomUploadContextProvider>
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );

        beforeEach(() => {
            spyDispatcher = vi.spyOn(defaultDispatcher, "dispatch");
        });

        afterEach(() => {
            spyDispatcher.mockRestore();
        });

        // The composer owns the text, so the preview view model has to be told about every change
        // to keep its list of links in step.
        it("Should report the composer content as it changes", async () => {
            const updateUrlPreviews = vi.fn();
            renderWithPreviewProps({ updateUrlPreviews });
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            fireEvent.input(screen.getByRole("textbox"), {
                data: "https://example.org",
                inputType: "insertText",
            });

            await waitFor(() => expect(updateUrlPreviews).toHaveBeenCalledWith(expect.stringContaining("example.org")));
        });

        // Removing a preview is an edit, even though the text is untouched, so Save has to be
        // available without the user typing anything.
        it("Should enable Save when only the preview list is modified", async () => {
            renderWithPreviewProps({ isUrlPreviewsModified: true });
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            expect(screen.getByText("Save")).not.toHaveAttribute("disabled");
        });

        it("Should keep Save disabled when nothing is modified", async () => {
            renderWithPreviewProps({});
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            expect(screen.getByText("Save")).toHaveAttribute("disabled");
        });

        it("Should attach the bundle when saving an otherwise unmodified message", async () => {
            const attachBundles = vi.fn().mockResolvedValue(false);
            renderWithPreviewProps({ isUrlPreviewsModified: true, attachBundles });
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            screen.getByText("Save").click();

            await waitFor(() => expect(attachBundles).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
        });

        it("Should not send the edit when attaching reports a cancellation", async () => {
            const attachBundles = vi.fn().mockResolvedValue(true);
            renderWithPreviewProps({ isUrlPreviewsModified: true, attachBundles });
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            screen.getByText("Save").click();

            await waitFor(() => expect(attachBundles).toHaveBeenCalledTimes(1));
            await flushPromises();
            expect(mockClient.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe("Messages with images or videos", () => {
        const first = { itemtype: "m.image", body: "one.png", url: "mxc://server/one" };
        const second = { itemtype: "m.video", body: "two.mp4", url: "mxc://server/two" };

        const mkMediaEvent = (content: Record<string, unknown>) =>
            mkEvent({ type: "m.room.message", room: "myfakeroom", user: "myfakeuser", content, event: true });
        const mkGalleryEvent = (content: Record<string, unknown> = {}) =>
            mkMediaEvent({ msgtype: "dm.filament.gallery", body: "Before", itemtypes: [first, second], ...content });
        const mkImageEvent = (content: Record<string, unknown> = {}) =>
            mkMediaEvent({ msgtype: "m.image", body: "one.png", url: "mxc://server/one", ...content });

        const editMediaMessage = vi.fn();
        const fetchUploadLimit = vi.fn();
        let spyDispatcher: MockInstance<(payload: ActionPayload, sync?: boolean) => void>;

        /** Render the composer for an event, and wait for the editor and the attachments to be shown. */
        const editMedia = async (event: ReturnType<typeof mkEvent>, items: number) => {
            const result = customRender(false, new EditorStateTransfer(event));
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
            await screen.findByRole("list", { name: `${items} of 60 ${items === 1 ? "item" : "items"}` });
            return result;
        };

        beforeEach(() => {
            // The mocks of the client are reset after every test, and the media of the items needs it.
            vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
            vi.spyOn(mockClient, "mxcUrlToHttp").mockImplementation((mxc: string) =>
                mxc.replace("mxc://", "http://this.is.a.url/"),
            );
            editMediaMessage.mockResolvedValue(undefined);
            fetchUploadLimit.mockResolvedValue(null);
            vi.spyOn(ContentMessages, "sharedInstance").mockReturnValue({
                editMediaMessage,
                fetchUploadLimit,
            } as unknown as ContentMessages);
            spyDispatcher = vi.spyOn(defaultDispatcher, "dispatch");
        });

        afterEach(() => {
            spyDispatcher.mockRestore();
            vi.mocked(ContentMessages.sharedInstance).mockRestore();
            vi.mocked(MatrixClientPeg.safeGet).mockRestore();
        });

        it("Should not show attachments for a text message", async () => {
            customRender(false, editorStateTransfer);
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            expect(screen.queryByRole("list")).not.toBeInTheDocument();
            expect(screen.queryByTestId("gallery-composer-file-input")).not.toBeInTheDocument();
            expect(fetchUploadLimit).not.toHaveBeenCalled();
        });

        it("Should show the items of a gallery beside its caption", async () => {
            await editMedia(
                mkGalleryEvent({ format: "org.matrix.custom.html", formatted_body: "<strong>Before</strong>" }),
                2,
            );

            await waitFor(() => expect(screen.getByRole("textbox")).toContainHTML("<strong>Before</strong>"));
            expect(screen.getByRole("button", { name: "Remove one.png" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Remove two.mp4" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeInTheDocument();
        });

        it("Should start with an empty editor for an image without a caption", async () => {
            await editMedia(mkImageEvent(), 1);

            // The body of the event is the file name, which is not text to edit.
            expect(screen.getByRole("textbox")).not.toHaveTextContent("one.png");
            expect(screen.getByRole("button", { name: "Remove one.png" })).toBeInTheDocument();
        });

        it("Should start with the caption of an image which has one", async () => {
            await editMedia(mkImageEvent({ body: "Look at this", filename: "one.png" }), 1);

            await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Look at this"));
        });

        it("Should work out the text to start with from the caption alone", () => {
            const room = defaultRoomContext.room!;
            const parse = (event: ReturnType<typeof mkEvent>): string =>
                parseEditorStateTransfer(new EditorStateTransfer(event), room, mockClient);

            expect(parse(mkImageEvent())).toBe("");
            expect(parse(mkMediaEvent({ msgtype: "m.video", body: "clip.mp4", url: "mxc://server/clip" }))).toBe("");
            expect(parse(mkGalleryEvent({ body: "" }))).toBe("");
            expect(parse(mkImageEvent({ body: "Look at this", filename: "one.png" }))).toBe("Look at this");
            expect(parse(mkGalleryEvent())).toBe("Before");
            expect(
                parse(mkGalleryEvent({ format: "org.matrix.custom.html", formatted_body: "<strong>Before</strong>" })),
            ).toBe("<strong>Before</strong>");
            // The body of a file is not left out: it is the text of that message.
            expect(parse(mkMediaEvent({ msgtype: "m.file", body: "notes.pdf", url: "mxc://server/notes" }))).toBe(
                "notes.pdf",
            );
        });

        it("Should enable Save when an item is removed, and save what is left through the media edit", async () => {
            const event = mkGalleryEvent();
            await editMedia(event, 2);

            fireEvent.click(screen.getByRole("button", { name: "Remove one.png" }));
            await screen.findByRole("list", { name: "1 of 60 item" });
            await waitFor(() => expect(screen.getByText("Save")).not.toHaveAttribute("disabled"));
            screen.getByText("Save").click();

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage).toHaveBeenCalledWith(
                event,
                mockClient,
                [second],
                expect.objectContaining({ body: "Before" }),
                undefined,
            );
            // The media edit sends the event itself.
            expect(mockClient.sendMessage).not.toHaveBeenCalled();
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: Action.EditEvent,
                event: null,
                timelineRenderingType: defaultRoomContext.timelineRenderingType,
            });
        });

        it("Should save the text which was typed as the caption", async () => {
            const event = mkImageEvent();
            await editMedia(event, 1);

            fireEvent.input(screen.getByRole("textbox"), { data: "A caption", inputType: "insertText" });
            await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("A caption"));
            screen.getByText("Save").click();

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage).toHaveBeenCalledWith(
                event,
                mockClient,
                [{ itemtype: "m.image", body: "one.png", url: "mxc://server/one" }],
                { body: "A caption", format: "org.matrix.custom.html", formatted_body: "A caption" },
                undefined,
            );
        });

        it("Should save the files which were added after the items which are left", async () => {
            const event = mkGalleryEvent();
            await editMedia(event, 2);
            const added = new File(["image"], "three.png", { type: "image/png" });

            fireEvent.change(screen.getByTestId("gallery-composer-file-input"), { target: { files: [added] } });
            await screen.findByRole("button", { name: "Remove three.png" });
            screen.getByText("Save").click();

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage.mock.calls[0][2]).toEqual([first, second, added]);
        });

        it("Should turn away added files which are larger than the upload limit", async () => {
            fetchUploadLimit.mockResolvedValue(5);
            const setMaxFileSize = vi.spyOn(GalleryComposerViewModel.prototype, "setMaxFileSize");
            await editMedia(mkGalleryEvent(), 2);

            expect(fetchUploadLimit).toHaveBeenCalledWith(mockClient);
            await waitFor(() => expect(setMaxFileSize).toHaveBeenCalledWith(5));

            const tooLarge = new File(["0123456789"], "large.png", { type: "image/png" });
            fireEvent.change(screen.getByTestId("gallery-composer-file-input"), { target: { files: [tooLarge] } });

            expect(await screen.findByRole("status")).toHaveTextContent("larger than the upload limit");
            expect(screen.queryByRole("button", { name: "Remove large.png" })).not.toBeInTheDocument();
        });

        describe("In the message composer", () => {
            const renderInComposer = (
                event: ReturnType<typeof mkEvent>,
                props: Partial<React.ComponentProps<typeof EditWysiwygComposer>> = {},
            ) =>
                render(
                    <MatrixClientContext.Provider value={mockClient}>
                        <ScopedRoomContextProvider {...defaultRoomContext}>
                            <RoomUploadContextProvider>
                                <EditWysiwygComposer
                                    editorStateTransfer={new EditorStateTransfer(event)}
                                    inComposer
                                    {...props}
                                />
                            </RoomUploadContextProvider>
                        </ScopedRoomContextProvider>
                    </MatrixClientContext.Provider>,
                );

            const waitForEditor = () =>
                waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

            it("Should keep the formatting buttons but leave Save, Cancel and the attachments to the composer", async () => {
                const onAttachmentsChange = vi.fn();
                renderInComposer(mkGalleryEvent(), { onAttachmentsChange });
                await waitForEditor();
                await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled());

                expect(screen.getByLabelText("Bold")).toBeInTheDocument();
                expect(screen.queryByText("Save")).not.toBeInTheDocument();
                expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
                expect(screen.queryByRole("list")).not.toBeInTheDocument();
                expect(document.querySelector(".mx_EditWysiwygComposer_inComposer")).not.toBeNull();
            });

            it("Should hand the attachments of the message to the composer, and take them back", async () => {
                const onAttachmentsChange = vi.fn();
                const { unmount } = renderInComposer(mkGalleryEvent(), { onAttachmentsChange });
                await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled());

                const attachments = onAttachmentsChange.mock.calls[0][0] as GalleryComposerViewModel;
                expect(attachments).toBeInstanceOf(GalleryComposerViewModel);
                expect(attachments.getItems()).toEqual([first, second]);

                unmount();
                expect(onAttachmentsChange).toHaveBeenLastCalledWith(undefined);
            });

            it("Should let the composer save the items which are left through the media edit", async () => {
                const onAttachmentsChange = vi.fn();
                const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                const event = mkGalleryEvent();
                const { unmount } = renderInComposer(event, { onAttachmentsChange, actionsRef });
                await waitForEditor();
                await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled());
                const attachments = onAttachmentsChange.mock.calls[0][0] as GalleryComposerViewModel;

                act(() => attachments.onRemoveItem(attachments.getSnapshot().items[0].id));
                act(() => actionsRef.current!.save());

                await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
                expect(editMediaMessage).toHaveBeenCalledWith(
                    event,
                    mockClient,
                    [second],
                    expect.objectContaining({ body: "Before" }),
                    undefined,
                );

                unmount();
                expect(actionsRef.current).toBeNull();
            });

            it("Should let the composer cancel the edit", async () => {
                const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                renderInComposer(mkGalleryEvent(), { actionsRef });
                await waitForEditor();

                act(() => actionsRef.current!.cancel());

                expect(spyDispatcher).toHaveBeenCalledWith({
                    action: Action.EditEvent,
                    event: null,
                    timelineRenderingType: defaultRoomContext.timelineRenderingType,
                });
                expect(editMediaMessage).not.toHaveBeenCalled();
            });

            describe("for a text message, with gallery messages enabled", () => {
                const textEvent = () => mkMediaEvent({ msgtype: "m.text", body: "Hello" });
                let galleryEnabled: boolean;

                beforeEach(() => {
                    galleryEnabled = true;
                    const getValue = SettingsStore.getValue.bind(SettingsStore);
                    vi.spyOn(SettingsStore, "getValue").mockImplementation(((name: string, ...rest: unknown[]) =>
                        name === "feature_gallery_messages"
                            ? galleryEnabled
                            : (getValue as (...args: unknown[]) => unknown)(
                                  name,
                                  ...rest,
                              )) as typeof SettingsStore.getValue);
                });

                afterEach(() => {
                    vi.mocked(SettingsStore.getValue).mockRestore();
                });

                it("Should hand the composer empty attachments, to which images and videos can be added", async () => {
                    const onAttachmentsChange = vi.fn();
                    renderInComposer(textEvent(), { onAttachmentsChange });
                    await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled());

                    expect((onAttachmentsChange.mock.calls[0][0] as GalleryComposerViewModel).getItems()).toEqual([]);
                });

                it("Should hand the composer no attachments while gallery messages are disabled", async () => {
                    galleryEnabled = false;
                    const onAttachmentsChange = vi.fn();
                    renderInComposer(textEvent(), { onAttachmentsChange });
                    await waitForEditor();

                    expect(onAttachmentsChange).not.toHaveBeenCalled();
                });

                it("Should save the text message with the files which were added through the media edit", async () => {
                    const onAttachmentsChange = vi.fn();
                    const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                    const event = textEvent();
                    renderInComposer(event, { onAttachmentsChange, actionsRef });
                    await waitForEditor();
                    await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled());
                    const attachments = onAttachmentsChange.mock.calls[0][0] as GalleryComposerViewModel;
                    const photo = new File(["image"], "photo.png", { type: "image/png" });

                    act(() => attachments.onAddFiles([photo]));
                    act(() => actionsRef.current!.save());

                    await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
                    expect(editMediaMessage).toHaveBeenCalledWith(
                        event,
                        mockClient,
                        [photo],
                        expect.objectContaining({ body: "Hello" }),
                        undefined,
                    );
                    expect(mockClient.sendMessage).not.toHaveBeenCalled();
                });

                it("Should save a change of text alone as a text edit", async () => {
                    const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                    const event = textEvent();
                    renderInComposer(event, { actionsRef });
                    await waitForEditor();

                    fireEvent.input(screen.getByRole("textbox"), { data: " there", inputType: "insertText" });
                    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("there"));
                    act(() => actionsRef.current!.save());

                    await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
                    expect(vi.mocked(mockClient.sendMessage).mock.calls[0][2]).toEqual(
                        expect.objectContaining({
                            "m.new_content": expect.objectContaining({ msgtype: "m.text" }),
                            "m.relates_to": { event_id: event.getId(), rel_type: "m.replace" },
                        }),
                    );
                    expect(editMediaMessage).not.toHaveBeenCalled();
                });

                it("Should not show the empty attachments of a text message when edited in place", async () => {
                    customRender(false, new EditorStateTransfer(textEvent()));
                    await waitForEditor();
                    await waitFor(() => expect(fetchUploadLimit).toHaveBeenCalled());

                    expect(screen.queryByRole("list")).not.toBeInTheDocument();
                    expect(screen.getByText("Save")).toBeInTheDocument();
                });
            });
        });

        it("Should not limit the size of added files when the server has no limit", async () => {
            const setMaxFileSize = vi.spyOn(GalleryComposerViewModel.prototype, "setMaxFileSize");
            await editMedia(mkGalleryEvent(), 2);

            await waitFor(() => expect(setMaxFileSize).toHaveBeenCalledWith(undefined));
        });
    });

    it("Should focus when receiving an Action.FocusEditMessageComposer action", async () => {
        // Given we don't have focus
        customRender();
        screen.getByLabelText("Bold").focus();
        expect(screen.getByRole("textbox")).not.toHaveFocus();

        // When we send the right action
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });

        // Then the component gets the focus
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    });

    it("Should not focus when disabled", async () => {
        // Given we don't have focus and we are disabled
        customRender(true);
        screen.getByLabelText("Bold").focus();
        expect(screen.getByRole("textbox")).not.toHaveFocus();

        // When we send an action that would cause us to get focus
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });
        // (Send a second event to exercise the clearTimeout logic)
        defaultDispatcher.dispatch({
            action: Action.FocusEditMessageComposer,
            context: null,
        });

        // Wait for event dispatch to happen
        await flushPromises();

        // Then we don't get it because we are disabled
        expect(screen.getByRole("textbox")).not.toHaveFocus();
    });

    it("Should add emoji", async () => {
        // When

        // We are not testing here the emoji button (open modal, select emoji ...)
        // Instead we are directly firing an emoji to make the test easier to write
        vi.spyOn(EmojiButton, "EmojiButton").mockImplementation(
            ({ addEmoji }: { addEmoji: (emoji: string) => void }) => {
                return (
                    <button aria-label="Emoji" type="button" onClick={() => addEmoji("🦫")}>
                        Emoji
                    </button>
                );
            },
        );
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext}>
                    <RoomUploadContextProvider>
                        <EditWysiwygComposer editorStateTransfer={editorStateTransfer} />
                    </RoomUploadContextProvider>
                    <Emoji menuPosition={{ chevronFace: ChevronFace.Top }} />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
        // Same behavior as in RoomView.tsx
        // RoomView is re-dispatching the composer messages.
        // It adds the composerType fields where the value refers if the composer is in editing or not
        // The listeners in the RTE ignore the message if the composerType is missing in the payload
        const dispatcherRef = defaultDispatcher.register((payload: ActionPayload) => {
            const insertPayload = payload as ComposerInsertPayload;
            defaultDispatcher.dispatch<ComposerInsertPayload>({
                ...insertPayload,
                timelineRenderingType: insertPayload.timelineRenderingType!,
                composerType: ComposerType.Edit,
            });
        });

        screen.getByLabelText("Emoji").click();

        // Then
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(/🦫/));
        defaultDispatcher.unregister(dispatcherRef);
    });
});
