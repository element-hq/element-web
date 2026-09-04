/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { type IEventRelation, type MatrixClient, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { vi, describe, it, expect, beforeEach, afterAll, type MockedObject } from "vitest";
import { getRoomContext, mkEvent, mkStubRoom, stubClient } from "test-utils";

import { RoomUploadContextProvider, RoomUploadViewModel } from "./RoomUploadViewModel";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import defaultDispatcher, { MatrixDispatcher } from "../../dispatcher/dispatcher";
import ContentMessages from "../../ContentMessages";
import { ComposerApi } from "../../modules/ComposerApi";
import type { ComposerInsertFilesPayload } from "../../dispatcher/payloads/ComposerInsertFilePayload";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext";
import { Action } from "../../dispatcher/actions";
import MatrixClientContext from "../../contexts/MatrixClientContext";

const sendContentListToRoomSpy = vi.spyOn(ContentMessages.sharedInstance(), "sendContentListToRoom");

describe("RoomUploadViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let room: MockedObject<Room>;
    let dis: MockedObject<MatrixDispatcher>;
    beforeEach(() => {
        vi.clearAllMocks();
        client = stubClient() as MockedObject<MatrixClient>;
        room = mkStubRoom("!room", undefined, undefined) as MockedObject<Room>;
        dis = {
            dispatch: vi.fn(),
        } as Partial<MatrixDispatcher> as MockedObject<MatrixDispatcher>;
    });
    afterAll(() => {
        vi.restoreAllMocks();
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
        const onSelected = vi.fn();
        const icon = { myicon: 5 } as any;
        compApi.addFileUploadOption({
            type: "org.example.test",
            label: "My uploader",
            icon,
            onSelected,
        });
        // The module option must appear exactly once, alongside the built-in local option.
        expect(vm.getSnapshot().options).toEqual([
            expect.objectContaining({ type: "local" }),
            { type: "org.example.test", label: "My uploader", icon },
        ]);
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
        it("uploads with correct context", async () => {
            sendContentListToRoomSpy.mockResolvedValue(undefined);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
            const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            vm.setReplyToEvent(replyEvent);
            const threadRelation: IEventRelation = { key: "foo" };
            vm.setThreadRelation(threadRelation);
            const fileList = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as unknown as FileList;
            await vm.initiateViaInputFiles(fileList);
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                fileList,
                room.roomId,
                threadRelation,
                replyEvent,
                client,
                TimelineRenderingType.Thread,
            );
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
        it("uploads with correct context", async () => {
            sendContentListToRoomSpy.mockResolvedValue(undefined);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
            const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            vm.setReplyToEvent(replyEvent);
            const threadRelation: IEventRelation = { key: "foo" };
            vm.setThreadRelation(threadRelation);
            const files = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as unknown as FileList;
            await vm.initiateViaDataTransfer({ files } as DataTransfer);
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                files,
                room.roomId,
                threadRelation,
                replyEvent,
                client,
                TimelineRenderingType.Thread,
            );
        });
    });

    describe("RoomUploadContextProvider", () => {
        it("uploads when called via module API", async () => {
            sendContentListToRoomSpy.mockResolvedValue(undefined);
            render(
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                        <RoomUploadContextProvider>
                            <p>Any child</p>
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
            defaultDispatcher.dispatch(
                {
                    action: Action.ComposerFileInsert,
                    files,
                    timelineRenderingType: TimelineRenderingType.Room,
                } satisfies ComposerInsertFilesPayload,
                true,
            );
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                files,
                room.roomId,
                undefined,
                undefined,
                client,
                TimelineRenderingType.Room,
            );
        });
    });
});
