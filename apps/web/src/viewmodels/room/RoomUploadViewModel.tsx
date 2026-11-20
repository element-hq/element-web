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

import type { ComposerApiFileUploadOption } from "@element-hq/element-web-module-api";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import ContentMessages from "../../ContentMessages";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { chromeFileInputFix } from "../../utils/BrowserWorkarounds";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ModuleApi } from "../../modules/Api";
import { ModuleComposerApiEvents } from "../../modules/ComposerApi";
import { Action } from "../../dispatcher/actions";
import type { ComposerInsertFilesPayload } from "../../dispatcher/payloads/ComposerInsertFilePayload";
import { useDispatcher } from "../../hooks/useDispatcher";
import type { ActionPayload } from "../../dispatcher/payloads";
import { type AttachmentOpen } from "@matrix-org/analytics-events/types/typescript/AttachmentOpen";
import { PosthogAnalytics } from "../../PosthogAnalytics";
import type { AttachmentCancel } from "@matrix-org/analytics-events/types/typescript/AttachmentCancel";
import type { AttachmentSend } from "@matrix-org/analytics-events/types/typescript/AttachmentSend";
import SettingsStore from "../../settings/SettingsStore";
import { isGalleryFile, type MediaCaption } from "../../utils/gallery";
import { doMaybeLocalRoomAction } from "../../utils/local-room";
import { GalleryComposerViewModel } from "../composer/GalleryComposerViewModel";

const logger = rootLogger.getChild("RoomUploadViewModel");

interface RoomUploadViewSnapshot extends UploadButtonViewSnapshot {
    mayDragAndDropFile: boolean;
}

export class RoomUploadViewModel
    extends BaseViewModel<RoomUploadViewSnapshot, Record<string, never>>
    implements UploadButtonViewActions
{
    private readonly uploadSelectFns = new Map<string, ComposerApiFileUploadOption["onSelected"]>();

    /**
     * The images and videos waiting in the composer to be sent with the next message.
     */
    public readonly attachments = this.disposables.track(new GalleryComposerViewModel({ items: [] }));

    public constructor(
        private readonly room: Room,
        private readonly client: MatrixClient,
        private readonly timelineRenderingType: TimelineRenderingType,
        private readonly dispatcher: MatrixDispatcher,
        private replyToEvent: MatrixEvent | undefined,
        private threadRelation: IEventRelation | undefined,
        public readonly openUploadDialog: () => void,
        private readonly moduleComposerApi = ModuleApi.instance.composer,
    ) {
        super(
            {},
            {
                options: [],
                mayDragAndDropFile: false,
            },
        );
        // Initial check.
        this.updateOptions();
        // Configure upload functions
        for (const option of moduleComposerApi.fileUploadOptions) {
            this.uploadSelectFns.set(option.type, option.onSelected);
        }
        this.uploadSelectFns.set("local", this.openUploadDialog);
        this.disposables.trackListener(room, RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
        this.disposables.trackListener(
            moduleComposerApi,
            ModuleComposerApiEvents.UploaderOptionsChanged,
            // Types issue.
            this.onUploaderOptionsChanged as any,
        );
    }

    private onRoomCurrentStateUpdated = (): void => {
        this.updateOptions();
    };

    private updateOptions(): void {
        const maySendMessage = this.room.maySendMessage();
        this.snapshot.set({
            mayDragAndDropFile: maySendMessage,
            options: maySendMessage
                ? [
                      {
                          type: "local",
                          label: _t("common|attachment"),
                          icon: AttachmentIcon,
                      },
                      ...this.moduleComposerApi.fileUploadOptions.map((option) => ({
                          type: option.type,
                          label: option.label,
                          icon: option.icon,
                      })),
                  ]
                : [],
        });
    }

    private readonly onUploaderOptionsChanged = (option: ComposerApiFileUploadOption): void => {
        this.uploadSelectFns.set(option.type, option.onSelected);
        this.updateOptions();
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
            const otherFiles = await this.attachMedia(Array.from(files));
            if (otherFiles.length === 0) return;
            await ContentMessages.sharedInstance().sendContentListToRoom(
                otherFiles,
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
            const otherFiles = await this.attachMedia(Array.from(dataTransfer.files));
            if (otherFiles.length === 0) return;
            await ContentMessages.sharedInstance().sendContentListToRoom(
                otherFiles,
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

    /**
     * Keep the images and videos among some files in the composer, to be sent as one message
     * together with the text the user writes there. Only when gallery messages are enabled.
     *
     * @param files - The files the user picked, dropped or pasted.
     * @returns The files which are not kept, and are to be sent the way they always were.
     */
    private async attachMedia(files: File[]): Promise<File[]> {
        if (!SettingsStore.getValue("feature_gallery_messages")) return files;

        const media = files.filter(isGalleryFile);
        if (media.length === 0) return files;

        const uploadLimit = await ContentMessages.sharedInstance().fetchUploadLimit(this.client);
        if (this.isDisposed) return [];
        this.attachments.setMaxFileSize(uploadLimit ?? undefined);
        this.attachments.onAddFiles(media);
        // The user carries on writing the message the attachments go with.
        this.dispatcher.dispatch({ action: Action.FocusSendMessageComposer, context: this.timelineRenderingType });

        return files.filter((file) => !media.includes(file));
    }

    /**
     * Whether there are images or videos waiting in the composer.
     */
    public get hasAttachments(): boolean {
        return this.attachments.getItems().length > 0;
    }

    /**
     * Send the images and videos waiting in the composer as one message, with the text of the
     * composer as their caption.
     *
     * @param caption - The text to send with them, taken from the composer. Its body may be empty.
     * @returns False if nothing was waiting, in which case nothing is sent.
     */
    public sendAttachments = (caption: MediaCaption): boolean => {
        const files = this.attachments.getItems().filter((item): item is File => item instanceof File);
        if (files.length === 0) return false;
        this.attachments.clear();

        const { threadRelation: relation, replyToEvent } = this;
        const types = files.map((file) => file.type.split("/")[0]);
        PosthogAnalytics.instance.trackEvent<AttachmentSend>({
            eventName: "AttachmentSend",
            isReply: !!replyToEvent,
            inThread: relation?.rel_type === "m.thread",
            count: files.length,
            kind: "local",
            // The most common type
            type: types.sort((a, b) => types.filter((v) => v === b).length - types.filter((v) => v === a).length)[0],
        });

        doMaybeLocalRoomAction(
            this.room.roomId,
            (actualRoomId) =>
                ContentMessages.sharedInstance().sendGalleryToRoom(
                    files,
                    caption,
                    actualRoomId,
                    relation,
                    this.client,
                    replyToEvent,
                ),
            this.client,
        ).catch((ex) => logger.warn("Failed to send attachments", ex));
        return true;
    };

    public onUploadOptionSelected = (type: ComposerApiFileUploadOption["type"]): void => {
        const fn = this.uploadSelectFns.get(type);
        if (!fn) {
            throw new Error("Unexpectedly called onUploadOptionSelected with an unknown type");
        }
        // At the point of this function being called, we should be in a state that is either rendering a room
        // or timeline.
        if (![TimelineRenderingType.Room, TimelineRenderingType.Thread].includes(this.timelineRenderingType)) {
            throw new Error("TimelineRenderingType must be Room or Thread");
        }
        PosthogAnalytics.instance.trackEvent<AttachmentOpen>({
            eventName: "AttachmentOpen",
            isReply: !!this.replyToEvent,
            inThread: !!this.threadRelation,
            kind: type,
        });
        void fn(
            this.room.roomId,
            {
                view: this.timelineRenderingType === TimelineRenderingType.Room ? "room" : "thread",
            },
            {
                inReplyToEventId: this.replyToEvent?.getId(),
                relType: this.threadRelation?.rel_type,
            },
        );
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
        throw new Error("RoomFileUploadProvider is not present");
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
    const { room, timelineRenderingType, replyToEvent } = useScopedRoomContext(
        "room",
        "timelineRenderingType",
        "replyToEvent",
    );
    const client = useMatrixClientContext();
    const uploadInput = useRef<HTMLInputElement>(null);

    const openFilePicker = useCallback((): void => {
        if (!uploadInput.current) {
            throw new Error("Input not ready");
        }
        uploadInput.current.click();
    }, [uploadInput]);

    const vm = useCreateAutoDisposedViewModel(() => {
        if (!room) {
            throw new Error("RoomUploadContextProvider must have a room");
        }
        return new RoomUploadViewModel(
            room,
            client,
            // Checked earlier
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

    useEffect(() => {
        const input = uploadInput.current;
        if (!input) {
            return;
        }
        const fn = (): void => {
            PosthogAnalytics.instance.trackEvent<AttachmentCancel>({
                eventName: "AttachmentCancel",
                stage: "Picker",
                isReply: !!replyToEvent,
                inThread: !!threadRelation,
                kind: "local",
            });
        };
        input.addEventListener("cancel", fn);
        return () => input.removeEventListener("cancel", fn);
    });

    useDispatcher(defaultDispatcher, (payload: ActionPayload) => {
        if (payload.action !== Action.ComposerFileInsert) {
            return;
        }
        const fileInsert = payload as ComposerInsertFilesPayload;
        if (fileInsert.timelineRenderingType === timelineRenderingType) {
            logger.info(
                `Got ComposerFileInsert with ${fileInsert.files.length} files`,
                timelineRenderingType,
                threadRelation,
            );
            void vm.initiateViaInputFiles(fileInsert.files);
        }
    });

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
