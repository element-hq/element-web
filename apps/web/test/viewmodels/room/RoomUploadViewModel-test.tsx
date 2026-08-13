/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React from "react";
import { type IEventRelation, type MatrixClient, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { act, render, screen } from "jest-matrix-react";
import { useViewModel } from "@element-hq/web-shared-components";

import type { MockedObject } from "jest-mock";
import {
    RoomUploadContextProvider,
    RoomUploadViewModel,
    useRoomUploadViewModel,
} from "../../../src/viewmodels/room/RoomUploadViewModel";
import { getRoomContext, mkEvent, mkStubRoom, stubClient } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import defaultDispatcher, { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import ContentMessages from "../../../src/ContentMessages";
import { ComposerApi } from "../../../src/modules/ComposerApi";
import type { ComposerInsertFilesPayload } from "../../../src/dispatcher/payloads/ComposerInsertFilePayload";
import { ScopedRoomContextProvider } from "../../../src/contexts/ScopedRoomContext";
import { Action } from "../../../src/dispatcher/actions";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
const sendContentListToRoomSpy = jest.spyOn(ContentMessages.sharedInstance(), "sendContentListToRoom");

function StagedAttachmentNames(): React.ReactNode {
    const { attachments } = useViewModel(useRoomUploadViewModel());
    return <p data-testid="staged">{attachments.map((attachment) => attachment.name).join(", ")}</p>;
}

describe("RoomUploadViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let room: MockedObject<Room>;
    let dis: MockedObject<MatrixDispatcher>;
    beforeEach(() => {
        jest.clearAllMocks();
        client = stubClient() as MockedObject<MatrixClient>;
        room = mkStubRoom("!room", undefined, undefined) as MockedObject<Room>;
        dis = {
            dispatch: jest.fn(),
        } as Partial<MatrixDispatcher> as MockedObject<MatrixDispatcher>;
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it.each([true, false])("handles state when room.maySendMessage = %s", (maySendMessage) => {
        room.maySendMessage.mockReturnValue(maySendMessage);
        const vm = new RoomUploadViewModel(
            room,
            client,
            TimelineRenderingType.Room,
            dis,
            undefined,
            undefined,
            () => {},
        );
        expect(vm.getSnapshot().options).toHaveLength(maySendMessage ? 1 : 0);
        room.maySendMessage.mockReturnValue(!maySendMessage);
        room.emit(RoomEvent.CurrentStateUpdated, room, null as any, null as any);
        expect(vm.getSnapshot().options).toHaveLength(maySendMessage ? 0 : 1);
    });

    it("handles custom upload option", async () => {
        const compApi = new ComposerApi(new MatrixDispatcher());
        const replyEv = mkEvent({ type: "fake", content: {}, user: "any", event: true });
        const vm = new RoomUploadViewModel(
            room,
            client,
            TimelineRenderingType.Room,
            dis,
            replyEv,
            {
                rel_type: "any_type",
            },
            () => {},
            compApi,
        );
        const onSelected = jest.fn();
        const icon = { myicon: 5 } as any;
        compApi.addFileUploadOption({
            type: "org.example.test",
            label: "My uploader",
            icon,
            onSelected,
        });
        expect(vm.getSnapshot().options).toContainEqual({ type: "org.example.test", label: "My uploader", icon });
        vm.onUploadOptionSelected("org.example.test");
        expect(onSelected).toHaveBeenCalledWith(
            room.roomId,
            { view: "room" },
            {
                inReplyToEventId: replyEv.getId(),
                relType: "any_type",
            },
        );
    });

    describe("uploads via input", () => {
        it("redirected if guest", async () => {
            client.isGuest.mockReturnValue(true);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            await vm.initiateViaInputFiles([] as unknown as FileList);
            expect(dis.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
        });
        it("skips empty files", async () => {
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            await vm.initiateViaInputFiles([] as unknown as FileList);
            expect(dis.dispatch).not.toHaveBeenCalled();
        });
        it("stages files rather than sending them immediately", async () => {
            sendContentListToRoomSpy.mockResolvedValue(true);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
            const fileList = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as unknown as FileList;
            await vm.initiateViaInputFiles(fileList);
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
            expect(vm.getSnapshot().attachments).toHaveLength(1);
            expect(vm.getSnapshot().attachments[0].name).toEqual("fake.png");
        });
    });

    describe("uploads via data transfer", () => {
        it("redirected if guest", async () => {
            client.isGuest.mockReturnValue(true);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            await vm.initiateViaDataTransfer({} as DataTransfer);
            expect(dis.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
        });
        it("skips empty files", async () => {
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            await vm.initiateViaDataTransfer({ files: [] as unknown as FileList } as DataTransfer);
            expect(dis.dispatch).not.toHaveBeenCalled();
        });
        it("stages files rather than sending them immediately", async () => {
            sendContentListToRoomSpy.mockResolvedValue(true);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
            const files = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as unknown as FileList;
            await vm.initiateViaDataTransfer({ files } as DataTransfer);
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
            expect(vm.getSnapshot().attachments).toHaveLength(1);
        });
    });

    describe("staged attachments", () => {
        const file = { name: "fake.png", size: 1024, type: "image/png" } as File;

        function mkViewModel(): RoomUploadViewModel {
            return new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
        }

        it("sends staged attachments with the correct context", async () => {
            sendContentListToRoomSpy.mockResolvedValue(true);
            const vm = mkViewModel();
            const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            vm.setReplyToEvent(replyEvent);
            const threadRelation: IEventRelation = { key: "foo" };
            vm.setThreadRelation(threadRelation);

            vm.stageFiles([file]);
            await vm.sendStagedAttachments();

            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                [file],
                room.roomId,
                threadRelation,
                replyEvent,
                client,
                TimelineRenderingType.Thread,
                { skipConfirmation: true },
            );
            expect(vm.getSnapshot().attachments).toHaveLength(0);
        });

        it("keeps the files staged when the send is abandoned", async () => {
            // e.g. the user cancelled the "file too big" dialog, so nothing was sent.
            sendContentListToRoomSpy.mockResolvedValue(false);
            const vm = mkViewModel();
            vm.stageFiles([file]);

            await expect(vm.sendStagedAttachments()).resolves.toBe(false);

            expect(vm.getSnapshot().attachments).toHaveLength(1);
            expect(vm.getSnapshot().attachments[0].name).toEqual("fake.png");
            // Still usable, so its preview must not have been revoked.
            expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        });

        it("keeps files staged when sending throws", async () => {
            sendContentListToRoomSpy.mockRejectedValue(new Error("boom"));
            const vm = mkViewModel();
            vm.stageFiles([file]);

            await expect(vm.sendStagedAttachments()).resolves.toBe(false);

            expect(vm.getSnapshot().attachments).toHaveLength(1);
        });

        it("puts restored files back ahead of anything staged since", async () => {
            sendContentListToRoomSpy.mockImplementation(async () => {
                // Something else lands in the composer while the send is in flight.
                vm.stageFiles([{ ...file, name: "later.png" } as File]);
                return false;
            });
            const vm = mkViewModel();
            vm.stageFiles([file]);

            await vm.sendStagedAttachments();

            expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["fake.png", "later.png"]);
        });

        it("omits the reply when the caller is sending its own message below", async () => {
            sendContentListToRoomSpy.mockResolvedValue(true);
            const vm = mkViewModel();
            vm.setReplyToEvent(mkEvent({ event: true, type: "anything", user: "anyone", content: {} }));
            vm.stageFiles([file]);

            await vm.sendStagedAttachments({ includeReply: false });

            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                [file],
                room.roomId,
                undefined,
                undefined,
                client,
                TimelineRenderingType.Thread,
                { skipConfirmation: true },
            );
        });

        it("appends to the existing staged files", () => {
            const vm = mkViewModel();
            vm.stageFiles([file]);
            vm.stageFiles([file]);
            expect(vm.getSnapshot().attachments).toHaveLength(2);
            expect(vm.hasAttachments).toBe(true);
        });

        it("removes a staged file and revokes its preview", () => {
            const vm = mkViewModel();
            vm.stageFiles([file, { ...file, name: "other.png" } as File]);
            const [first] = vm.getSnapshot().attachments;

            vm.removeAttachment(first.id);

            expect(vm.getSnapshot().attachments).toHaveLength(1);
            expect(vm.getSnapshot().attachments[0].name).toEqual("other.png");
            expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.previewUrl);
        });

        it("does nothing when there is nothing staged", async () => {
            const vm = mkViewModel();
            await vm.sendStagedAttachments();
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("revokes previews of files still staged on dispose", () => {
            const vm = mkViewModel();
            vm.stageFiles([file]);
            const [staged] = vm.getSnapshot().attachments;

            vm.dispose();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith(staged.previewUrl);
        });
    });

    describe("RoomUploadContextProvider", () => {
        it("stages files when called via module API", async () => {
            sendContentListToRoomSpy.mockResolvedValue(true);
            render(
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                        <RoomUploadContextProvider>
                            <StagedAttachmentNames />
                        </RoomUploadContextProvider>
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );
            const files = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as File[];
            act(() =>
                defaultDispatcher.dispatch(
                    {
                        action: Action.ComposerFileInsert,
                        files,
                        timelineRenderingType: TimelineRenderingType.Room,
                    } satisfies ComposerInsertFilesPayload,
                    true,
                ),
            );
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
            expect(await screen.findByTestId("staged")).toHaveTextContent("fake.png");
        });
    });
});
