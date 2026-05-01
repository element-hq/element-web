/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    _t,
    BaseViewModel,
    type UploadButtonViewActions,
    type UploadButtonViewSnapshot,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import type { ComposerApiFileUploadOption } from "@element-hq/element-web-module-api";
import { AttachmentIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
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
import { ModuleApi } from "../../modules/Api";
import { ModuleComposerApiEvents } from "../../modules/ComposerApi";

const logger = rootLogger.getChild("RoomUploadViewModel");

export class RoomUploadViewModel
    extends BaseViewModel<UploadButtonViewSnapshot, Record<string, never>>
    implements UploadButtonViewActions
{
    private readonly extraUploadSelectFns = new Map<string, ComposerApiFileUploadOption["onSelected"]>();
    public constructor(
        private readonly room: Room,
        private readonly client: MatrixClient,
        private readonly timelineRenderingType: TimelineRenderingType,
        private readonly dispatcher: MatrixDispatcher,
        private replyToEvent: MatrixEvent | undefined,
        private threadRelation: IEventRelation | undefined,
        public readonly openUploadDialog: () => void,
        moduleComposerApi = ModuleApi.instance.composer,
    ) {
        super(
            {},
            {
                mayUpload: room.maySendMessage(),
                options: [
                    {
                        type: "local",
                        label: _t("common|attachment"),
                        icon: AttachmentIcon,
                    },
                    ...moduleComposerApi.fileUploadOptions.map((option) => ({
                        type: option.type,
                        label: option.label,
                        icon: option.icon,
                    })),
                ],
            },
        );
        this.extraUploadSelectFns.set("local", this.openUploadDialog);
        for (const option of moduleComposerApi.fileUploadOptions) {
            this.extraUploadSelectFns.set(option.type, option.onSelected);
        }
        room.on(RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
        moduleComposerApi.on(ModuleComposerApiEvents.UploaderOptionsChanged, this.onUploaderOptionsChanged);
        this.disposables.track(() => {
            room.off(RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
            moduleComposerApi.off(ModuleComposerApiEvents.UploaderOptionsChanged, this.onUploaderOptionsChanged);
        });
    }

    private onRoomCurrentStateUpdated = (): void => {
        this.snapshot.merge({
            mayUpload: this.room.maySendMessage(),
        });
    };

    private onUploaderOptionsChanged = (option: ComposerApiFileUploadOption): void => {
        this.extraUploadSelectFns.set(option.type, option.onSelected);
        this.snapshot.merge({
            options: [
                ...this.snapshot.current.options,
                {
                    type: option.type,
                    label: option.label,
                    icon: option.icon,
                },
            ],
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

    public onUploadOptionSelected = (type: ComposerApiFileUploadOption["type"]): void => {
        const fn = this.extraUploadSelectFns.get(type);
        if (!fn) {
            throw Error("Unexpectedly called onUploadOptionSelected with an unknown type");
        }
        fn(this.room.roomId, {
            inReplyToEventId: this.replyToEvent?.getId(),
            relType: this.threadRelation?.rel_type,
        });
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
        console.log("Reply to event!", replyToEvent);
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
