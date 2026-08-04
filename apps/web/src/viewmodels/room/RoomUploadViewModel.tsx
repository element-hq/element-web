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
import { ComposerAttachment } from "../../models/ComposerAttachment";

const logger = rootLogger.getChild("RoomUploadViewModel");

interface RoomUploadViewSnapshot extends UploadButtonViewSnapshot {
    mayDragAndDropFile: boolean;
    /** Files staged in the composer, not yet uploaded. */
    attachments: ComposerAttachment[];
}

export class RoomUploadViewModel
    extends BaseViewModel<RoomUploadViewSnapshot, Record<string, never>>
    implements UploadButtonViewActions
{
    private readonly uploadSelectFns = new Map<string, ComposerApiFileUploadOption["onSelected"]>();
    /** Serialises the file reads behind attachment descriptions. */
    private describeQueue: Promise<void> = Promise.resolve();
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
                attachments: [],
            },
        );
        // Initial check.
        this.onRoomCurrentStateUpdated();
        // Configure upload functions
        for (const option of moduleComposerApi.fileUploadOptions) {
            this.uploadSelectFns.set(option.type, option.onSelected);
        }
        this.uploadSelectFns.set("local", this.openUploadDialog);
        room.on(RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);
        this.disposables.trackListener(room, RoomEvent.CurrentStateUpdated, this.onRoomCurrentStateUpdated);

        moduleComposerApi.on(ModuleComposerApiEvents.UploaderOptionsChanged, this.onUploaderOptionsChanged);
        this.disposables.trackListener(
            moduleComposerApi,
            ModuleComposerApiEvents.UploaderOptionsChanged,
            // Types issue.
            this.onUploaderOptionsChanged as any,
        );
    }

    private onRoomCurrentStateUpdated = (): void => {
        const maySendMessage = this.room.maySendMessage();
        this.snapshot.merge({
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
    };

    private readonly onUploaderOptionsChanged = (option: ComposerApiFileUploadOption): void => {
        this.uploadSelectFns.set(option.type, option.onSelected);
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
        if (!files?.length) return;
        this.stageFiles(Array.from(files));
    };

    public initiateViaDataTransfer = async (dataTransfer: DataTransfer): Promise<void> => {
        if (!this.checkCanUpload()) {
            return;
        }
        if (!dataTransfer.files?.length) return;
        this.stageFiles(Array.from(dataTransfer.files));
    };

    /** Add files to the composer. They are not uploaded until the message is sent. */
    public stageFiles(files: File[]): void {
        logger.info(`Staging ${files.length} attachment(s) for`, this.room.roomId);
        const staged = files.map((file) => new ComposerAttachment(file));
        this.snapshot.merge({
            attachments: [...this.snapshot.current.attachments, ...staged],
        });
        // Warm the media config now so that sending does not stall behind a modal spinner.
        ContentMessages.sharedInstance().prefetchMediaConfig(this.client);
        this.queueDescriptions(staged);
        this.dispatcher.dispatch({
            action: Action.FocusSendMessageComposer,
            context: this.timelineRenderingType,
        });
    }

    /**
     * Describing an image reads the whole file, so run them one at a time rather than
     * holding a dropped folder of them in memory at once.
     */
    private queueDescriptions(staged: ComposerAttachment[]): void {
        this.describeQueue = staged.reduce(
            (queue, attachment) => queue.then(() => this.loadDescription(attachment)),
            this.describeQueue,
        );
    }

    private async loadDescription(attachment: ComposerAttachment): Promise<void> {
        // It may have been removed or sent while it sat in the queue.
        if (this.isDisposed || !this.snapshot.current.attachments.includes(attachment)) return;

        let changed = false;
        try {
            changed = await attachment.loadDescription();
        } catch (ex) {
            logger.warn("Failed to describe attachment", ex);
            return;
        }
        if (!changed || this.isDisposed || !this.snapshot.current.attachments.includes(attachment)) return;
        this.snapshot.merge({ attachments: [...this.snapshot.current.attachments] });
    }

    public moveAttachment = (id: string, toIndex: number): void => {
        const attachments = this.snapshot.current.attachments;
        const fromIndex = attachments.findIndex((attachment) => attachment.id === id);
        const clamped = Math.max(0, Math.min(toIndex, attachments.length - 1));
        if (fromIndex === -1 || fromIndex === clamped) return;

        const reordered = [...attachments];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(clamped, 0, moved);
        this.snapshot.merge({ attachments: reordered });
    };

    public removeAttachment = (id: string): void => {
        const remaining: ComposerAttachment[] = [];
        for (const attachment of this.snapshot.current.attachments) {
            if (attachment.id === id) {
                attachment.dispose();
            } else {
                remaining.push(attachment);
            }
        }
        this.snapshot.merge({ attachments: remaining });
    };

    public get hasAttachments(): boolean {
        return this.snapshot.current.attachments.length > 0;
    }

    /**
     * Upload and send every staged attachment as its own event, in order. Resolves once
     * they have all been sent, so a trailing text message lands beneath them.
     */
    public sendStagedAttachments = async (opts: { includeReply?: boolean } = {}): Promise<boolean> => {
        const attachments = this.snapshot.current.attachments;
        if (!attachments.length) return false;

        // Clear first so the composer empties immediately and the files cannot be sent twice.
        this.snapshot.merge({ attachments: [] });

        let sent = false;
        try {
            sent = await ContentMessages.sharedInstance().sendContentListToRoom(
                attachments.map((attachment) => attachment.file),
                this.room.roomId,
                this.threadRelation,
                opts.includeReply === false ? undefined : this.replyToEvent,
                this.client,
                this.timelineRenderingType,
                // The staging area already showed the user what they are about to send.
                { skipConfirmation: true },
            );
        } catch (ex) {
            logger.warn("Failed to send staged attachments", ex);
        }

        if (!sent) {
            // The user backed out or it failed, so put the files back rather than dropping
            // a selection they would have to pick from disk again.
            logger.info("Staged attachments were not sent; restoring them to the composer");
            this.snapshot.merge({ attachments: [...attachments, ...this.snapshot.current.attachments] });
            return false;
        }

        for (const attachment of attachments) {
            attachment.dispose();
        }
        return true;
    };

    public dispose(): void {
        for (const attachment of this.snapshot.current.attachments) {
            attachment.dispose();
        }
        super.dispose();
    }

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
        fn(
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
            vm.initiateViaInputFiles(fileInsert.files);
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
