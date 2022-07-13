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
import { IUploadOpts } from "matrix-js-sdk/src/@types/requests";
import { MsgType } from "matrix-js-sdk/src/@types/event";
import encrypt from "matrix-encrypt-attachment";
import extractPngChunks from "png-chunks-extract";
import { IAbortablePromise, IImageInfo } from "matrix-js-sdk/src/@types/partials";
import { logger } from "matrix-js-sdk/src/logger";
import { IEventRelation, ISendEventResponse, MatrixError, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";

import { IEncryptedFile, IMediaEventInfo } from "./customisations/models/IMediaEventContent";
import dis from './dispatcher/dispatcher';
import { _t } from './languageHandler';
import Modal from './Modal';
import Spinner from "./components/views/elements/Spinner";
import { Action } from "./dispatcher/actions";
import {
    UploadCanceledPayload,
    UploadErrorPayload,
    UploadFinishedPayload,
    UploadProgressPayload,
    UploadStartedPayload,
} from "./dispatcher/payloads/UploadPayload";
import { IUpload } from "./models/IUpload";
import SettingsStore from "./settings/SettingsStore";
import { decorateStartSendingTime, sendRoundTripMetric } from "./sendTimePerformanceMetrics";
import { TimelineRenderingType } from "./contexts/RoomContext";
import { RoomViewStore } from "./stores/RoomViewStore";
import { addReplyToMessageContent } from "./utils/Reply";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import UploadFailureDialog from "./components/views/dialogs/UploadFailureDialog";
import UploadConfirmDialog from "./components/views/dialogs/UploadConfirmDialog";
import { createThumbnail } from "./utils/image-media";
import { attachRelation } from "./components/views/rooms/SendMessageComposer";
import { doMaybeLocalRoomAction } from "./utils/local-room";

// scraped out of a macOS hidpi (5660ppm) screenshot png
//                  5669 px (x-axis)      , 5669 px (y-axis)      , per metre
const PHYS_HIDPI = [0x00, 0x00, 0x16, 0x25, 0x00, 0x00, 0x16, 0x25, 0x01];

export class UploadCanceledError extends Error {}

interface IMediaConfig {
    "m.upload.size"?: number;
}

interface IContent {
    body: string;
    msgtype: string;
    info: IMediaEventInfo;
    file?: string;
    url?: string;
}

/**
 * Load a file into a newly created image element.
 *
 * @param {File} imageFile The file to load in an image element.
 * @return {Promise} A promise that resolves with the html image element.
 */
async function loadImageElement(imageFile: File) {
    // Load the file into an html element
    const img = document.createElement("img");
    const objectUrl = URL.createObjectURL(imageFile);
    const imgPromise = new Promise((resolve, reject) => {
        img.onload = function() {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = function(e) {
            reject(e);
        };
    });
    img.src = objectUrl;

    // check for hi-dpi PNGs and fudge display resolution as needed.
    // this is mainly needed for macOS screencaps
    let parsePromise;
    if (imageFile.type === "image/png") {
        // in practice macOS happens to order the chunks so they fall in
        // the first 0x1000 bytes (thanks to a massive ICC header).
        // Thus we could slice the file down to only sniff the first 0x1000
        // bytes (but this makes extractPngChunks choke on the corrupt file)
        const headers = imageFile; //.slice(0, 0x1000);
        parsePromise = readFileAsArrayBuffer(headers).then(arrayBuffer => {
            const buffer = new Uint8Array(arrayBuffer);
            const chunks = extractPngChunks(buffer);
            for (const chunk of chunks) {
                if (chunk.name === 'pHYs') {
                    if (chunk.data.byteLength !== PHYS_HIDPI.length) return;
                    return chunk.data.every((val, i) => val === PHYS_HIDPI[i]);
                }
            }
            return false;
        });
    }

    const [hidpi] = await Promise.all([parsePromise, imgPromise]);
    const width = hidpi ? (img.width >> 1) : img.width;
    const height = hidpi ? (img.height >> 1) : img.height;
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
        const sizeDifference = imageFile.size - imageInfo.thumbnail_info.size;
        if (
            // image is small enough already
            imageFile.size <= IMAGE_SIZE_THRESHOLD_THUMBNAIL ||
            // thumbnail is not sufficiently smaller than original
            (sizeDifference <= IMAGE_THUMBNAIL_MIN_REDUCTION_SIZE &&
                sizeDifference <= (imageFile.size * IMAGE_THUMBNAIL_MIN_REDUCTION_PERCENT))
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

        reader.onload = function(ev) {
            // Wait until we have enough data to thumbnail the first frame.
            video.onloadeddata = async function() {
                resolve(video);
                video.pause();
            };
            video.onerror = function(e) {
                reject(e);
            };

            let dataUrl = ev.target.result as string;
            // Chrome chokes on quicktime but likes mp4, and `file.type` is
            // read only, so do this horrible hack to unbreak quicktime
            if (dataUrl.startsWith("data:video/quicktime;")) {
                dataUrl = dataUrl.replace("data:video/quicktime;", "data:video/mp4;");
            }

            video.src = dataUrl;
            video.load();
            video.play();
        };
        reader.onerror = function(e) {
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
    return loadVideoElement(videoFile).then((video) => {
        return createThumbnail(video, video.videoWidth, video.videoHeight, thumbnailType);
    }).then((result) => {
        videoInfo = result.info;
        return uploadFile(matrixClient, roomId, result.thumbnail);
    }).then((result) => {
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
        reader.onload = function(e) {
            resolve(e.target.result as ArrayBuffer);
        };
        reader.onerror = function(e) {
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
 * @return {Promise} A promise that resolves with an object.
 *  If the file is unencrypted then the object will have a "url" key.
 *  If the file is encrypted then the object will have a "file" key.
 */
export function uploadFile(
    matrixClient: MatrixClient,
    roomId: string,
    file: File | Blob,
    progressHandler?: IUploadOpts["progressHandler"],
): IAbortablePromise<{ url?: string, file?: IEncryptedFile }> {
    let canceled = false;
    if (matrixClient.isRoomEncrypted(roomId)) {
        // If the room is encrypted then encrypt the file before uploading it.
        // First read the file into memory.
        let uploadPromise: IAbortablePromise<string>;
        const prom = readFileAsArrayBuffer(file).then(function(data) {
            if (canceled) throw new UploadCanceledError();
            // Then encrypt the file.
            return encrypt.encryptAttachment(data);
        }).then(function(encryptResult) {
            if (canceled) throw new UploadCanceledError();

            // Pass the encrypted data as a Blob to the uploader.
            const blob = new Blob([encryptResult.data]);
            uploadPromise = matrixClient.uploadContent(blob, {
                progressHandler,
                includeFilename: false,
            });

            return uploadPromise.then(url => {
                if (canceled) throw new UploadCanceledError();

                // If the attachment is encrypted then bundle the URL along
                // with the information needed to decrypt the attachment and
                // add it under a file key.
                return {
                    file: {
                        ...encryptResult.info,
                        url,
                    },
                };
            });
        }) as IAbortablePromise<{ file: IEncryptedFile }>;
        prom.abort = () => {
            canceled = true;
            if (uploadPromise) matrixClient.cancelUpload(uploadPromise);
        };
        return prom;
    } else {
        const basePromise = matrixClient.uploadContent(file, { progressHandler });
        const promise1 = basePromise.then(function(url) {
            if (canceled) throw new UploadCanceledError();
            // If the attachment isn't encrypted then include the URL directly.
            return { url };
        }) as IAbortablePromise<{ url: string }>;
        promise1.abort = () => {
            canceled = true;
            matrixClient.cancelUpload(basePromise);
        };
        return promise1;
    }
}

export default class ContentMessages {
    private inprogress: IUpload[] = [];
    private mediaConfig: IMediaConfig = null;

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
            dis.dispatch({ action: 'require_registration' });
            return;
        }

        const replyToEvent = RoomViewStore.instance.getQuotingEvent();
        if (!this.mediaConfig) { // hot-path optimization to not flash a spinner if we don't need to
            const modal = Modal.createDialog(Spinner, null, 'mx_Dialog_spinner');
            await this.ensureMediaConfigFetched(matrixClient);
            modal.close();
        }

        const tooBigFiles = [];
        const okFiles = [];

        for (const file of files) {
            if (this.isFileSizeAcceptable(file)) {
                okFiles.push(file);
            } else {
                tooBigFiles.push(file);
            }
        }

        if (tooBigFiles.length > 0) {
            const { finished } = Modal.createDialog<[boolean]>(UploadFailureDialog, {
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
                const { finished } = Modal.createDialog<[boolean, boolean]>(UploadConfirmDialog, {
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
                (actualRoomId) => this.sendContentToRoom(
                    file,
                    actualRoomId,
                    relation,
                    matrixClient,
                    replyToEvent,
                    loopPromiseBefore,
                ),
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

    public getCurrentUploads(relation?: IEventRelation): IUpload[] {
        return this.inprogress.filter(upload => {
            const noRelation = !relation && !upload.relation;
            const matchingRelation = relation && upload.relation
                && relation.rel_type === upload.relation.rel_type
                && relation.event_id === upload.relation.event_id;

            return (noRelation || matchingRelation) && !upload.canceled;
        });
    }

    public cancelUpload(promise: IAbortablePromise<any>, matrixClient: MatrixClient): void {
        const upload = this.inprogress.find(item => item.promise === promise);
        if (upload) {
            upload.canceled = true;
            matrixClient.cancelUpload(upload.promise);
            dis.dispatch<UploadCanceledPayload>({ action: Action.UploadCanceled, upload });
        }
    }

    private sendContentToRoom(
        file: File,
        roomId: string,
        relation: IEventRelation | undefined,
        matrixClient: MatrixClient,
        replyToEvent: MatrixEvent | undefined,
        promBefore: Promise<any>,
    ) {
        const content: Omit<IContent, "info"> & { info: Partial<IMediaEventInfo> } = {
            body: file.name || 'Attachment',
            info: {
                size: file.size,
            },
            msgtype: MsgType.File, // set more specifically later
        };

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

        const prom = new Promise<void>((resolve) => {
            if (file.type.indexOf('image/') === 0) {
                content.msgtype = MsgType.Image;
                infoForImageFile(matrixClient, roomId, file).then((imageInfo) => {
                    Object.assign(content.info, imageInfo);
                    resolve();
                }, (e) => {
                    // Failed to thumbnail, fall back to uploading an m.file
                    logger.error(e);
                    content.msgtype = MsgType.File;
                    resolve();
                });
            } else if (file.type.indexOf('audio/') === 0) {
                content.msgtype = MsgType.Audio;
                resolve();
            } else if (file.type.indexOf('video/') === 0) {
                content.msgtype = MsgType.Video;
                infoForVideoFile(matrixClient, roomId, file).then((videoInfo) => {
                    Object.assign(content.info, videoInfo);
                    resolve();
                }, (e) => {
                    // Failed to thumbnail, fall back to uploading an m.file
                    logger.error(e);
                    content.msgtype = MsgType.File;
                    resolve();
                });
            } else {
                content.msgtype = MsgType.File;
                resolve();
            }
        }) as IAbortablePromise<void>;

        // create temporary abort handler for before the actual upload gets passed off to js-sdk
        prom.abort = () => {
            upload.canceled = true;
        };

        const upload: IUpload = {
            fileName: file.name || 'Attachment',
            roomId,
            relation,
            total: file.size,
            loaded: 0,
            promise: prom,
        };
        this.inprogress.push(upload);
        dis.dispatch<UploadStartedPayload>({ action: Action.UploadStarted, upload });

        function onProgress(ev) {
            upload.total = ev.total;
            upload.loaded = ev.loaded;
            dis.dispatch<UploadProgressPayload>({ action: Action.UploadProgress, upload });
        }

        let error: MatrixError;
        return prom.then(() => {
            if (upload.canceled) throw new UploadCanceledError();
            // XXX: upload.promise must be the promise that
            // is returned by uploadFile as it has an abort()
            // method hacked onto it.
            upload.promise = uploadFile(matrixClient, roomId, file, onProgress);
            return upload.promise.then(function(result) {
                content.file = result.file;
                content.url = result.url;
            });
        }).then(() => {
            // Await previous message being sent into the room
            return promBefore;
        }).then(function() {
            if (upload.canceled) throw new UploadCanceledError();
            const threadId = relation?.rel_type === THREAD_RELATION_TYPE.name
                ? relation.event_id
                : null;
            const prom = matrixClient.sendMessage(roomId, threadId, content);
            if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
                prom.then(resp => {
                    sendRoundTripMetric(matrixClient, roomId, resp.event_id);
                });
            }
            return prom;
        }, function(err: MatrixError) {
            error = err;
            if (!upload.canceled) {
                let desc = _t("The file '%(fileName)s' failed to upload.", { fileName: upload.fileName });
                if (err.httpStatus === 413) {
                    desc = _t(
                        "The file '%(fileName)s' exceeds this homeserver's size limit for uploads",
                        { fileName: upload.fileName },
                    );
                }
                Modal.createDialog(ErrorDialog, {
                    title: _t('Upload Failed'),
                    description: desc,
                });
            }
        }).finally(() => {
            for (let i = 0; i < this.inprogress.length; ++i) {
                if (this.inprogress[i].promise === upload.promise) {
                    this.inprogress.splice(i, 1);
                    break;
                }
            }
            if (error) {
                // 413: File was too big or upset the server in some way:
                // clear the media size limit so we fetch it again next time
                // we try to upload
                if (error?.httpStatus === 413) {
                    this.mediaConfig = null;
                }
                dis.dispatch<UploadErrorPayload>({ action: Action.UploadFailed, upload, error });
            } else {
                dis.dispatch<UploadFinishedPayload>({ action: Action.UploadFinished, upload });
                dis.dispatch({ action: 'message_sent' });
            }
        });
    }

    private isFileSizeAcceptable(file: File) {
        if (this.mediaConfig !== null &&
            this.mediaConfig["m.upload.size"] !== undefined &&
            file.size > this.mediaConfig["m.upload.size"]) {
            return false;
        }
        return true;
    }

    private ensureMediaConfigFetched(matrixClient: MatrixClient): Promise<void> {
        if (this.mediaConfig !== null) return;

        logger.log("[Media Config] Fetching");
        return matrixClient.getMediaConfig().then((config) => {
            logger.log("[Media Config] Fetched config:", config);
            return config;
        }).catch(() => {
            // Media repo can't or won't report limits, so provide an empty object (no limits).
            logger.log("[Media Config] Could not fetch config, so not limiting uploads.");
            return {};
        }).then((config) => {
            this.mediaConfig = config;
        });
    }

    static sharedInstance() {
        if (window.mxContentMessages === undefined) {
            window.mxContentMessages = new ContentMessages();
        }
        return window.mxContentMessages;
    }
}
