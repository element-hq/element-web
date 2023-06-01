/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { MsgType } from "matrix-js-sdk/src/@types/event";
import encrypt from "matrix-encrypt-attachment";
import extractPngChunks from "png-chunks-extract";
import { IImageInfo } from "matrix-js-sdk/src/@types/partials";
import { logger } from "matrix-js-sdk/src/logger";
import {
    HTTPError,
    IEventRelation,
    ISendEventResponse,
    MatrixEvent,
    UploadOpts,
    UploadProgress,
} from "matrix-js-sdk/src/matrix";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";
import { removeElement } from "matrix-js-sdk/src/utils";

import { IEncryptedFile, IMediaEventContent, IMediaEventInfo } from "./customisations/models/IMediaEventContent";
import dis from "./dispatcher/dispatcher";
import { _t } from "./languageHandler";
import Modal from "./Modal";
import Spinner from "./components/views/elements/Spinner";
import { Action } from "./dispatcher/actions";
import {
    UploadCanceledPayload,
    UploadErrorPayload,
    UploadFinishedPayload,
    UploadProgressPayload,
    UploadStartedPayload,
} from "./dispatcher/payloads/UploadPayload";
import { RoomUpload } from "./models/RoomUpload";
import SettingsStore from "./settings/SettingsStore";
import { decorateStartSendingTime, sendRoundTripMetric } from "./sendTimePerformanceMetrics";
import { TimelineRenderingType } from "./contexts/RoomContext";
import { addReplyToMessageContent } from "./utils/Reply";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import UploadFailureDialog from "./components/views/dialogs/UploadFailureDialog";
import UploadConfirmDialog from "./components/views/dialogs/UploadConfirmDialog";
import { createThumbnail } from "./utils/image-media";
import { attachMentions, attachRelation } from "./components/views/rooms/SendMessageComposer";
import { doMaybeLocalRoomAction } from "./utils/local-room";
import { SdkContextClass } from "./contexts/SDKContext";

// scraped out of a macOS hidpi (5660ppm) screenshot png
//                  5669 px (x-axis)      , 5669 px (y-axis)      , per metre
const PHYS_HIDPI = [0x00, 0x00, 0x16, 0x25, 0x00, 0x00, 0x16, 0x25, 0x01];

export class UploadCanceledError extends Error {}

interface IMediaConfig {
    "m.upload.size"?: number;
}

/**
 * Load a file into a newly created image element.
 *
 * @param {File} imageFile The file to load in an image element.
 * @return {Promise} A promise that resolves with the html image element.
 */
async function loadImageElement(imageFile: File): Promise<{
    width: number;
    height: number;
    img: HTMLImageElement;
}> {
    // Load the file into an html element
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    const imgPromise = new Promise((resolve, reject) => {
        img.onload = function (): void {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = function (e): void {
            reject(e);
        };
    });
    img.src = objectUrl;

    // check for hi-dpi PNGs and fudge display resolution as needed.
    // this is mainly needed for macOS screencaps
    let parsePromise = Promise.resolve(false);
    if (imageFile.type === "image/png") {
        // in practice macOS happens to order the chunks so they fall in
        // the first 0x1000 bytes (thanks to a massive ICC header).
        // Thus we could slice the file down to only sniff the first 0x1000
        // bytes (but this makes extractPngChunks choke on the corrupt file)
        const headers = imageFile; //.slice(0, 0x1000);
        parsePromise = readFileAsArrayBuffer(headers)
            .then((arrayBuffer) => {
                const buffer = new Uint8Array(arrayBuffer);
                const chunks = extractPngChunks(buffer);
                for (const chunk of chunks) {
                    if (chunk.name === "pHYs") {
                        if (chunk.data.byteLength !== PHYS_HIDPI.length) return false;
                        return chunk.data.every((val, i) => val === PHYS_HIDPI[i]);
                    }
                }
                return false;
            })
            .catch((e) => {
                console.error("Failed to parse PNG", e);
                return false;
            });
    }

    const [hidpi] = await Promise.all([parsePromise, imgPromise]);
    const width = hidpi ? img.width >> 1 : img.width;
    const height = hidpi ? img.height >> 1 : img.height;
    return { width, height, img };
}

// Minimum size for image files before we generate a thumbnail for them.
const IMAGE_SIZE_THRESHOLD_THUMBNAIL = 1 << 15; // 32KB
// Minimum size improvement for image thumbnails, if both are not met then don't bother uploading thumbnail.
const IMAGE_THUMBNAIL_MIN_REDUCTION_SIZE = 1 << 16; // 1MB
const IMAGE_THUMBNAIL_MIN_REDUCTION_PERCENT = 0.1; // 10%
// We don't apply these thresholds to video thumbnails as a poster image is always useful
// and videos tend to be much larger.

// Image mime types for which to always include a thumbnail for even if it is larger than the input for wider support.
const ALWAYS_INCLUDE_THUMBNAIL = ["image/avif", "image/webp"];

/**
 * Read the metadata for an image file and create and upload a thumbnail of the image.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the image will be uploaded in.
 * @param {File} imageFile The image to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
async function infoForImageFile(
    matrixClient: MatrixClient,
    roomId: string,
    imageFile: File,
): Promise<Partial<IMediaEventInfo>> {
    let thumbnailType = "image/png";
    if (imageFile.type === "image/jpeg") {
        thumbnailType = "image/jpeg";
    }

    const imageElement = await loadImageElement(imageFile);

    const result = await createThumbnail(imageElement.img, imageElement.width, imageElement.height, thumbnailType);
    const imageInfo = result.info;

    // For lesser supported image types, always include the thumbnail even if it is larger
    if (!ALWAYS_INCLUDE_THUMBNAIL.includes(imageFile.type)) {
        // we do all sizing checks here because we still rely on thumbnail generation for making a blurhash from.
        const sizeDifference = imageFile.size - imageInfo.thumbnail_info!.size;
        if (
            // image is small enough already
            imageFile.size <= IMAGE_SIZE_THRESHOLD_THUMBNAIL ||
            // thumbnail is not sufficiently smaller than original
            (sizeDifference <= IMAGE_THUMBNAIL_MIN_REDUCTION_SIZE &&
                sizeDifference <= imageFile.size * IMAGE_THUMBNAIL_MIN_REDUCTION_PERCENT)
        ) {
            delete imageInfo["thumbnail_info"];
            return imageInfo;
        }
    }

    const uploadResult = await uploadFile(matrixClient, roomId, result.thumbnail);

    imageInfo["thumbnail_url"] = uploadResult.url;
    imageInfo["thumbnail_file"] = uploadResult.file;
    return imageInfo;
}

/**
 * Load a file into a newly created video element and pull some strings
 * in an attempt to guarantee the first frame will be showing.
 *
 * @param {File} videoFile The file to load in an video element.
 * @return {Promise} A promise that resolves with the video image element.
 */
function loadVideoElement(videoFile: File): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        // Load the file into an html element
        const video = document.createElement("video");
        video.preload = "metadata";
        video.playsInline = true;
        video.muted = true;

        const reader = new FileReader();

        reader.onload = function (ev): void {
            // Wait until we have enough data to thumbnail the first frame.
            video.onloadeddata = async function (): Promise<void> {
                resolve(video);
                video.pause();
            };
            video.onerror = function (e): void {
                reject(e);
            };

            let dataUrl = ev.target?.result as string;
            // Chrome chokes on quicktime but likes mp4, and `file.type` is
            // read only, so do this horrible hack to unbreak quicktime
            if (dataUrl?.startsWith("data:video/quicktime;")) {
                dataUrl = dataUrl.replace("data:video/quicktime;", "data:video/mp4;");
            }

            video.src = dataUrl;
            video.load();
            video.play();
        };
        reader.onerror = function (e): void {
            reject(e);
        };
        reader.readAsDataURL(videoFile);
    });
}

/**
 * Read the metadata for a video file and create and upload a thumbnail of the video.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the video will be uploaded to.
 * @param {File} videoFile The video to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
function infoForVideoFile(
    matrixClient: MatrixClient,
    roomId: string,
    videoFile: File,
): Promise<Partial<IMediaEventInfo>> {
    const thumbnailType = "image/jpeg";

    let videoInfo: Partial<IMediaEventInfo>;
    return loadVideoElement(videoFile)
        .then((video) => {
            return createThumbnail(video, video.videoWidth, video.videoHeight, thumbnailType);
        })
        .then((result) => {
            videoInfo = result.info;
            return uploadFile(matrixClient, roomId, result.thumbnail);
        })
        .then((result) => {
            videoInfo.thumbnail_url = result.url;
            videoInfo.thumbnail_file = result.file;
            return videoInfo;
        });
}

/**
 * Read the file as an ArrayBuffer.
 * @param {File} file The file to read
 * @return {Promise} A promise that resolves with an ArrayBuffer when the file
 *   is read.
 */
function readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e): void {
            resolve(e.target?.result as ArrayBuffer);
        };
        reader.onerror = function (e): void {
            reject(e);
        };
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Upload the file to the content repository.
 * If the room is encrypted then encrypt the file before uploading.
 *
 * @param {MatrixClient} matrixClient The matrix client to upload the file with.
 * @param {String} roomId The ID of the room being uploaded to.
 * @param {File} file The file to upload.
 * @param {Function?} progressHandler optional callback to be called when a chunk of
 *    data is uploaded.
 * @param {AbortController?} controller optional abortController to use for this upload.
 * @return {Promise} A promise that resolves with an object.
 *  If the file is unencrypted then the object will have a "url" key.
 *  If the file is encrypted then the object will have a "file" key.
 */
export async function uploadFile(
    matrixClient: MatrixClient,
    roomId: string,
    file: File | Blob,
    progressHandler?: UploadOpts["progressHandler"],
    controller?: AbortController,
): Promise<{ url?: string; file?: IEncryptedFile }> {
    const abortController = controller ?? new AbortController();

    // If the room is encrypted then encrypt the file before uploading it.
    if (matrixClient.isRoomEncrypted(roomId)) {
        // First read the file into memory.
        const data = await readFileAsArrayBuffer(file);
        if (abortController.signal.aborted) throw new UploadCanceledError();

        // Then encrypt the file.
        const encryptResult = await encrypt.encryptAttachment(data);
        if (abortController.signal.aborted) throw new UploadCanceledError();

        // Pass the encrypted data as a Blob to the uploader.
        const blob = new Blob([encryptResult.data]);

        const { content_uri: url } = await matrixClient.uploadContent(blob, {
            progressHandler,
            abortController,
            includeFilename: false,
            type: "application/octet-stream",
        });
        if (abortController.signal.aborted) throw new UploadCanceledError();

        // If the attachment is encrypted then bundle the URL along with the information
        // needed to decrypt the attachment and add it under a file key.
        return {
            file: {
                ...encryptResult.info,
                url,
            } as IEncryptedFile,
        };
    } else {
        const { content_uri: url } = await matrixClient.uploadContent(file, { progressHandler, abortController });
        if (abortController.signal.aborted) throw new UploadCanceledError();
        // If the attachment isn't encrypted then include the URL directly.
        return { url };
    }
}

export default class ContentMessages {
    private inprogress: RoomUpload[] = [];
    private mediaConfig: IMediaConfig | null = null;

    public sendStickerContentToRoom(
        url: string,
        roomId: string,
        threadId: string | null,
        info: IImageInfo,
        text: string,
        matrixClient: MatrixClient,
    ): Promise<ISendEventResponse> {
        return doMaybeLocalRoomAction(
            roomId,
            (actualRoomId: string) => matrixClient.sendStickerMessage(actualRoomId, threadId, url, info, text),
            matrixClient,
        ).catch((e) => {
            logger.warn(`Failed to send content with URL ${url} to room ${roomId}`, e);
            throw e;
        });
    }

    public getUploadLimit(): number | null {
        if (this.mediaConfig !== null && this.mediaConfig["m.upload.size"] !== undefined) {
            return this.mediaConfig["m.upload.size"];
        } else {
            return null;
        }
    }

    public async sendContentListToRoom(
        files: File[],
        roomId: string,
        relation: IEventRelation | undefined,
        matrixClient: MatrixClient,
        context = TimelineRenderingType.Room,
    ): Promise<void> {
        if (matrixClient.isGuest()) {
            dis.dispatch({ action: "require_registration" });
            return;
        }

        const replyToEvent = SdkContextClass.instance.roomViewStore.getQuotingEvent();
        if (!this.mediaConfig) {
            // hot-path optimization to not flash a spinner if we don't need to
            const modal = Modal.createDialog(Spinner, undefined, "mx_Dialog_spinner");
            await Promise.race([this.ensureMediaConfigFetched(matrixClient), modal.finished]);
            if (!this.mediaConfig) {
                // User cancelled by clicking away on the spinner
                return;
            } else {
                modal.close();
            }
        }

        const tooBigFiles: File[] = [];
        const okFiles: File[] = [];

        for (const file of files) {
            if (this.isFileSizeAcceptable(file)) {
                okFiles.push(file);
            } else {
                tooBigFiles.push(file);
            }
        }

        if (tooBigFiles.length > 0) {
            const { finished } = Modal.createDialog(UploadFailureDialog, {
                badFiles: tooBigFiles,
                totalFiles: files.length,
                contentMessages: this,
            });
            const [shouldContinue] = await finished;
            if (!shouldContinue) return;
        }

        let uploadAll = false;
        // Promise to complete before sending next file into room, used for synchronisation of file-sending
        // to match the order the files were specified in
        let promBefore: Promise<any> = Promise.resolve();
        for (let i = 0; i < okFiles.length; ++i) {
            const file = okFiles[i];
            const loopPromiseBefore = promBefore;

            if (!uploadAll) {
                const { finished } = Modal.createDialog(UploadConfirmDialog, {
                    file,
                    currentIndex: i,
                    totalFiles: okFiles.length,
                });
                const [shouldContinue, shouldUploadAll] = await finished;
                if (!shouldContinue) break;
                if (shouldUploadAll) {
                    uploadAll = true;
                }
            }

            promBefore = doMaybeLocalRoomAction(
                roomId,
                (actualRoomId) =>
                    this.sendContentToRoom(
                        file,
                        actualRoomId,
                        relation,
                        matrixClient,
                        replyToEvent ?? undefined,
                        loopPromiseBefore,
                    ),
                matrixClient,
            );
        }

        if (replyToEvent) {
            // Clear event being replied to
            dis.dispatch({
                action: "reply_to_event",
                event: null,
                context,
            });
        }

        // Focus the correct composer
        dis.dispatch({
            action: Action.FocusSendMessageComposer,
            context,
        });
    }

    public getCurrentUploads(relation?: IEventRelation): RoomUpload[] {
        return this.inprogress.filter((roomUpload) => {
            const noRelation = !relation && !roomUpload.relation;
            const matchingRelation =
                relation &&
                roomUpload.relation &&
                relation.rel_type === roomUpload.relation.rel_type &&
                relation.event_id === roomUpload.relation.event_id;

            return (noRelation || matchingRelation) && !roomUpload.cancelled;
        });
    }

    public cancelUpload(upload: RoomUpload): void {
        upload.abort();
        dis.dispatch<UploadCanceledPayload>({ action: Action.UploadCanceled, upload });
    }

    public async sendContentToRoom(
        file: File,
        roomId: string,
        relation: IEventRelation | undefined,
        matrixClient: MatrixClient,
        replyToEvent: MatrixEvent | undefined,
        promBefore?: Promise<any>,
    ): Promise<void> {
        const fileName = file.name || _t("Attachment");
        const content: Omit<IMediaEventContent, "info"> & { info: Partial<IMediaEventInfo> } = {
            body: fileName,
            info: {
                size: file.size,
            },
            msgtype: MsgType.File, // set more specifically later
        };

        // Attach mentions, which really only applies if there's a replyToEvent.
        attachMentions(matrixClient.getSafeUserId(), content, null, replyToEvent);
        attachRelation(content, relation);
        if (replyToEvent) {
            addReplyToMessageContent(content, replyToEvent, {
                includeLegacyFallback: false,
            });
        }

        if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
            decorateStartSendingTime(content);
        }

        // if we have a mime type for the file, add it to the message metadata
        if (file.type) {
            content.info.mimetype = file.type;
        }

        const upload = new RoomUpload(roomId, fileName, relation, file.size);
        this.inprogress.push(upload);
        dis.dispatch<UploadStartedPayload>({ action: Action.UploadStarted, upload });

        function onProgress(progress: UploadProgress): void {
            upload.onProgress(progress);
            dis.dispatch<UploadProgressPayload>({ action: Action.UploadProgress, upload });
        }

        try {
            if (file.type.startsWith("image/")) {
                content.msgtype = MsgType.Image;
                try {
                    const imageInfo = await infoForImageFile(matrixClient, roomId, file);
                    Object.assign(content.info, imageInfo);
                } catch (e) {
                    if (e instanceof HTTPError) {
                        // re-throw to main upload error handler
                        throw e;
                    }
                    // Otherwise we failed to thumbnail, fall back to uploading an m.file
                    logger.error(e);
                    content.msgtype = MsgType.File;
                }
            } else if (file.type.indexOf("audio/") === 0) {
                content.msgtype = MsgType.Audio;
            } else if (file.type.indexOf("video/") === 0) {
                content.msgtype = MsgType.Video;
                try {
                    const videoInfo = await infoForVideoFile(matrixClient, roomId, file);
                    Object.assign(content.info, videoInfo);
                } catch (e) {
                    // Failed to thumbnail, fall back to uploading an m.file
                    logger.error(e);
                    content.msgtype = MsgType.File;
                }
            } else {
                content.msgtype = MsgType.File;
            }

            if (upload.cancelled) throw new UploadCanceledError();
            const result = await uploadFile(matrixClient, roomId, file, onProgress, upload.abortController);
            content.file = result.file;
            content.url = result.url;

            if (upload.cancelled) throw new UploadCanceledError();
            // Await previous message being sent into the room
            if (promBefore) await promBefore;

            if (upload.cancelled) throw new UploadCanceledError();
            const threadId = relation?.rel_type === THREAD_RELATION_TYPE.name ? relation.event_id : null;

            const response = await matrixClient.sendMessage(roomId, threadId ?? null, content);

            if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
                sendRoundTripMetric(matrixClient, roomId, response.event_id);
            }

            dis.dispatch<UploadFinishedPayload>({ action: Action.UploadFinished, upload });
            dis.dispatch({ action: "message_sent" });
        } catch (error) {
            // 413: File was too big or upset the server in some way:
            // clear the media size limit so we fetch it again next time we try to upload
            if (error instanceof HTTPError && error.httpStatus === 413) {
                this.mediaConfig = null;
            }

            if (!upload.cancelled) {
                let desc = _t("The file '%(fileName)s' failed to upload.", { fileName: upload.fileName });
                if (error instanceof HTTPError && error.httpStatus === 413) {
                    desc = _t("The file '%(fileName)s' exceeds this homeserver's size limit for uploads", {
                        fileName: upload.fileName,
                    });
                }
                Modal.createDialog(ErrorDialog, {
                    title: _t("Upload Failed"),
                    description: desc,
                });
                dis.dispatch<UploadErrorPayload>({ action: Action.UploadFailed, upload, error });
            }
        } finally {
            removeElement(this.inprogress, (e) => e.promise === upload.promise);
        }
    }

    private isFileSizeAcceptable(file: File): boolean {
        if (
            this.mediaConfig !== null &&
            this.mediaConfig["m.upload.size"] !== undefined &&
            file.size > this.mediaConfig["m.upload.size"]
        ) {
            return false;
        }
        return true;
    }

    private ensureMediaConfigFetched(matrixClient: MatrixClient): Promise<void> {
        if (this.mediaConfig !== null) return Promise.resolve();

        logger.log("[Media Config] Fetching");
        return matrixClient
            .getMediaConfig()
            .then((config) => {
                logger.log("[Media Config] Fetched config:", config);
                return config;
            })
            .catch(() => {
                // Media repo can't or won't report limits, so provide an empty object (no limits).
                logger.log("[Media Config] Could not fetch config, so not limiting uploads.");
                return {};
            })
            .then((config) => {
                this.mediaConfig = config;
            });
    }

    public static sharedInstance(): ContentMessages {
        if (window.mxContentMessages === undefined) {
            window.mxContentMessages = new ContentMessages();
        }
        return window.mxContentMessages;
    }
}
