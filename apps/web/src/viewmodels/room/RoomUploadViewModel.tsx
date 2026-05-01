/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import React, {
    type ChangeEventHandler,
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from "react";
import {
    type MatrixClient,
    type Room,
    type IEventRelation,
    type MatrixEvent,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";

import { useScopedRoomContext } from "../../contexts/ScopedRoomContext";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import ContentMessages from "../../ContentMessages";
import type { TimelineRenderingType } from "../../contexts/RoomContext";
import { chromeFileInputFix } from "../../utils/BrowserWorkarounds";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import defaultDispatcher from "../../dispatcher/dispatcher";

const logger = rootLogger.getChild("RoomUploadViewModel");

export interface RoomUploadViewSnapshot {
    mayUpload: boolean;
}

export interface RoomUploadViewActions {
    initiateViaInputFiles(files: FileList | null): Promise<void>;
    initiateViaDataTransfer(dataTransfer: DataTransfer): Promise<void>;
    openUploadDialog(): void;
}

export class RoomUploadViewModel
    extends BaseViewModel<RoomUploadViewSnapshot, Record<string, never>>
    implements RoomUploadViewActions
{
    public constructor(
        private readonly room: Room,
        private readonly client: MatrixClient,
        private readonly timelineRenderingType: TimelineRenderingType,
        private readonly dispatcher: MatrixDispatcher,
        private replyToEvent: MatrixEvent | undefined,
        private threadRelation: IEventRelation | undefined,
        public readonly openUploadDialog: () => void,
    ) {
        super(
            {},
            {
                mayUpload: room.maySendMessage(),
            },
        );
        room.on(RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
        this.disposables.track(() => {
            room.off(RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
        });
    }

    private onRoomCurrentStateUpdated = (): void => {
        this.snapshot.merge({
            mayUpload: this.room.maySendMessage(),
        });
    };

    public setReplyToEvent = (replyToEvent?: MatrixEvent): void => {
        this.replyToEvent = replyToEvent;
    };

    public setThreadRelation = (threadRelation?: IEventRelation): void => {
        this.threadRelation = threadRelation;
    };

    public initiateViaInputFiles = async (files: FileList | File[] | null): Promise<void> => {
        if (!this.checkCanUpload()) {
            return;
        }
        const { roomId } = this.room;
        logger.info("initiateViaInputFiles for", roomId);
        if (!files?.length) return;

        try {
            await ContentMessages.sharedInstance().sendContentListToRoom(
                Array.from(files),
                roomId,
                this.threadRelation,
                this.replyToEvent,
                this.client,
                this.timelineRenderingType,
            );
        } catch (ex) {
            logger.warn("Failed to handle file upload transfer", ex);
        }
    };

    public initiateViaDataTransfer = async (dataTransfer: DataTransfer): Promise<void> => {
        if (!this.checkCanUpload()) {
            return;
        }
        const { roomId } = this.room;
        logger.info("initiateViaDataTransfer for", roomId);
        if (!dataTransfer.files?.length) return;

        try {
            await ContentMessages.sharedInstance().sendContentListToRoom(
                Array.from(dataTransfer.files),
                roomId,
                this.threadRelation,
                this.replyToEvent,
                this.client,
                this.timelineRenderingType,
            );
        } catch (ex) {
            logger.warn("Failed to handle drag and drop data transfer", ex);
        }
    };

    private checkCanUpload(): boolean {
        if (this.client.isGuest()) {
            this.dispatcher.dispatch({ action: "require_registration" });
            return false;
        }
        return true;
    }
}

export const RoomUploadContext = createContext<RoomUploadViewModel | null>(null);

export function useRoomUploadViewModel(): RoomUploadViewModel {
    const ctx = useContext(RoomUploadContext);
    if (!ctx) {
        throw Error("RoomFileUploadProvider is not present");
    }
    return ctx;
}

export function RoomUploadContextProvider({
    children,
    threadRelation,
}: {
    children: ReactNode;
    threadRelation?: IEventRelation;
}): ReactNode {
    const { room } = useScopedRoomContext("room");
    const { timelineRenderingType } = useScopedRoomContext("timelineRenderingType");
    const { replyToEvent } = useScopedRoomContext("replyToEvent");
    const client = useMatrixClientContext();
    const uploadInput = useRef<HTMLInputElement>(null);

    const openFilePicker = useCallback((): void => {
        if (!uploadInput.current) {
            throw Error("Input not ready");
        }
        uploadInput.current.click();
    }, [uploadInput]);

    const vm = useCreateAutoDisposedViewModel(() => {
        if (!room) {
            throw Error("RoomUploadContextProvider must have a room");
        }
        return new RoomUploadViewModel(
            room,
            client,
            timelineRenderingType,
            defaultDispatcher,
            replyToEvent,
            threadRelation,
            openFilePicker,
        );
    });

    useEffect(() => {
        vm.setReplyToEvent(replyToEvent);
    }, [vm, replyToEvent]);

    useEffect(() => {
        vm.setThreadRelation(threadRelation);
    }, [vm, threadRelation]);

    const onInputChange: ChangeEventHandler<HTMLInputElement> = useCallback(
        (ev) => {
            void (async () => {
                try {
                    await vm.initiateViaInputFiles(ev.target.files);
                } finally {
                    // This is the onChange handler for a file form control, but we're
                    // not keeping any state, so reset the value of the form control
                    // to empty.
                    // NB. we need to set 'value': the 'files' property is immutable.
                    ev.target.value = "";
                }
            })();
        },
        [vm],
    );

    // Note, while this logic could be largely replaced with https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
    // it does not enjoy support across all our target platforms.
    // Therefore, we use the invisible input element trick.

    return (
        <RoomUploadContext.Provider value={vm}>
            <>
                {children}
                <input
                    ref={uploadInput}
                    type="file"
                    data-testid="room-upload-context-input"
                    style={{ display: "none" }}
                    multiple
                    onClick={chromeFileInputFix}
                    onChange={onInputChange}
                />
            </>
        </RoomUploadContext.Provider>
    );
}
