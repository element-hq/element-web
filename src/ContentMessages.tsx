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

import React from "react";
import extend from './extend';
import dis from './dispatcher/dispatcher';
import {MatrixClientPeg} from './MatrixClientPeg';
import {MatrixClient} from "matrix-js-sdk/src/client";
import * as sdk from './index';
import { _t } from './languageHandler';
import Modal from './Modal';
import RoomViewStore from './stores/RoomViewStore';
import encrypt from "browser-encrypt-attachment";
import extractPngChunks from "png-chunks-extract";
import Spinner from "./components/views/elements/Spinner";

// Polyfill for Canvas.toBlob API using Canvas.toDataURL
import "blueimp-canvas-to-blob";
import { Action } from "./dispatcher/actions";

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;

// scraped out of a macOS hidpi (5660ppm) screenshot png
//                  5669 px (x-axis)      , 5669 px (y-axis)      , per metre
const PHYS_HIDPI = [0x00, 0x00, 0x16, 0x25, 0x00, 0x00, 0x16, 0x25, 0x01];

export class UploadCanceledError extends Error {}

type ThumbnailableElement = HTMLImageElement | HTMLVideoElement;

interface IUpload {
    fileName: string;
    roomId: string;
    total: number;
    loaded: number;
    promise: Promise<any>;
    canceled?: boolean;
}

interface IMediaConfig {
    "m.upload.size"?: number;
}

interface IContent {
    body: string;
    msgtype: string;
    info: {
        size: number;
        mimetype?: string;
    };
    file?: string;
    url?: string;
}

interface IThumbnail {
    info: {
        // eslint-disable-next-line camelcase
        thumbnail_info: {
            w: number;
            h: number;
            mimetype: string;
            size: number;
        };
        w: number;
        h: number;
    };
    thumbnail: Blob;
}

interface IAbortablePromise<T> extends Promise<T> {
    abort(): void;
}

/**
 * Create a thumbnail for a image DOM element.
 * The image will be smaller than MAX_WIDTH and MAX_HEIGHT.
 * The thumbnail will have the same aspect ratio as the original.
 * Draws the element into a canvas using CanvasRenderingContext2D.drawImage
 * Then calls Canvas.toBlob to get a blob object for the image data.
 *
 * Since it needs to calculate the dimensions of the source image and the
 * thumbnailed image it returns an info object filled out with information
 * about the original image and the thumbnail.
 *
 * @param {HTMLElement} element The element to thumbnail.
 * @param {number} inputWidth The width of the image in the input element.
 * @param {number} inputHeight the width of the image in the input element.
 * @param {String} mimeType The mimeType to save the blob as.
 * @return {Promise} A promise that resolves with an object with an info key
 *  and a thumbnail key.
 */
function createThumbnail(
    element: ThumbnailableElement,
    inputWidth: number,
    inputHeight: number,
    mimeType: string,
): Promise<IThumbnail> {
    return new Promise((resolve) => {
        let targetWidth = inputWidth;
        let targetHeight = inputHeight;
        if (targetHeight > MAX_HEIGHT) {
            targetWidth = Math.floor(targetWidth * (MAX_HEIGHT / targetHeight));
            targetHeight = MAX_HEIGHT;
        }
        if (targetWidth > MAX_WIDTH) {
            targetHeight = Math.floor(targetHeight * (MAX_WIDTH / targetWidth));
            targetWidth = MAX_WIDTH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.getContext("2d").drawImage(element, 0, 0, targetWidth, targetHeight);
        canvas.toBlob(function(thumbnail) {
            resolve({
                info: {
                    thumbnail_info: {
                        w: targetWidth,
                        h: targetHeight,
                        mimetype: thumbnail.type,
                        size: thumbnail.size,
                    },
                    w: inputWidth,
                    h: inputHeight,
                },
                thumbnail: thumbnail,
            });
        }, mimeType);
    });
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
    return {width, height, img};
}

/**
 * Read the metadata for an image file and create and upload a thumbnail of the image.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the image will be uploaded in.
 * @param {File} imageFile The image to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
function infoForImageFile(matrixClient, roomId, imageFile) {
    let thumbnailType = "image/png";
    if (imageFile.type === "image/jpeg") {
        thumbnailType = "image/jpeg";
    }

    let imageInfo;
    return loadImageElement(imageFile).then(function(r) {
        return createThumbnail(r.img, r.width, r.height, thumbnailType);
    }).then(function(result) {
        imageInfo = result.info;
        return uploadFile(matrixClient, roomId, result.thumbnail);
    }).then(function(result) {
        imageInfo.thumbnail_url = result.url;
        imageInfo.thumbnail_file = result.file;
        return imageInfo;
    });
}

/**
 * Load a file into a newly created video element.
 *
 * @param {File} videoFile The file to load in an video element.
 * @return {Promise} A promise that resolves with the video image element.
 */
function loadVideoElement(videoFile): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        // Load the file into an html element
        const video = document.createElement("video");

        const reader = new FileReader();

        reader.onload = function(ev) {
            video.src = ev.target.result as string;

            // Once ready, returns its size
            // Wait until we have enough data to thumbnail the first frame.
            video.onloadeddata = function() {
                resolve(video);
            };
            video.onerror = function(e) {
                reject(e);
            };
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
function infoForVideoFile(matrixClient, roomId, videoFile) {
    const thumbnailType = "image/jpeg";

    let videoInfo;
    return loadVideoElement(videoFile).then(function(video) {
        return createThumbnail(video, video.videoWidth, video.videoHeight, thumbnailType);
    }).then(function(result) {
        videoInfo = result.info;
        return uploadFile(matrixClient, roomId, result.thumbnail);
    }).then(function(result) {
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
function uploadFile(matrixClient: MatrixClient, roomId: string, file: File | Blob, progressHandler?: any) {
    let canceled = false;
    if (matrixClient.isRoomEncrypted(roomId)) {
        // If the room is encrypted then encrypt the file before uploading it.
        // First read the file into memory.
        let uploadPromise;
        let encryptInfo;
        const prom = readFileAsArrayBuffer(file).then(function(data) {
            if (canceled) throw new UploadCanceledError();
            // Then encrypt the file.
            return encrypt.encryptAttachment(data);
        }).then(function(encryptResult) {
            if (canceled) throw new UploadCanceledError();
            // Record the information needed to decrypt the attachment.
            encryptInfo = encryptResult.info;
            // Pass the encrypted data as a Blob to the uploader.
            const blob = new Blob([encryptResult.data]);
            uploadPromise = matrixClient.uploadContent(blob, {
                progressHandler: progressHandler,
                includeFilename: false,
            });
            return uploadPromise;
        }).then(function(url) {
            if (canceled) throw new UploadCanceledError();
            // If the attachment is encrypted then bundle the URL along
            // with the information needed to decrypt the attachment and
            // add it under a file key.
            encryptInfo.url = url;
            if (file.type) {
                encryptInfo.mimetype = file.type;
            }
            return {"file": encryptInfo};
        });
        (prom as IAbortablePromise<any>).abort = () => {
            canceled = true;
            if (uploadPromise) MatrixClientPeg.get().cancelUpload(uploadPromise);
        };
        return prom;
    } else {
        const basePromise = matrixClient.uploadContent(file, {
            progressHandler: progressHandler,
        });
        const promise1 = basePromise.then(function(url) {
            if (canceled) throw new UploadCanceledError();
            // If the attachment isn't encrypted then include the URL directly.
            return {"url": url};
        });
        promise1.abort = () => {
            canceled = true;
            MatrixClientPeg.get().cancelUpload(basePromise);
        };
        return promise1;
    }
}

export default class ContentMessages {
    private inprogress: IUpload[] = [];
    private mediaConfig: IMediaConfig = null;

    sendStickerContentToRoom(url: string, roomId: string, info: string, text: string, matrixClient: MatrixClient) {
        return MatrixClientPeg.get().sendStickerMessage(roomId, url, info, text).catch((e) => {
            console.warn(`Failed to send content with URL ${url} to room ${roomId}`, e);
            throw e;
        });
    }

    getUploadLimit() {
        if (this.mediaConfig !== null && this.mediaConfig["m.upload.size"] !== undefined) {
            return this.mediaConfig["m.upload.size"];
        } else {
            return null;
        }
    }

    async sendContentListToRoom(files: File[], roomId: string, matrixClient: MatrixClient) {
        if (matrixClient.isGuest()) {
            dis.dispatch({action: 'require_registration'});
            return;
        }

        const isQuoting = Boolean(RoomViewStore.getQuotingEvent());
        if (isQuoting) {
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            const {finished} = Modal.createTrackedDialog<[boolean]>('Upload Reply Warning', '', QuestionDialog, {
                title: _t('Replying With Files'),
                description: (
                    <div>{_t(
                        'At this time it is not possible to reply with a file. ' +
                        'Would you like to upload this file without replying?',
                    )}</div>
                ),
                hasCancelButton: true,
                button: _t("Continue"),
            });
            const [shouldUpload] = await finished;
            if (!shouldUpload) return;
        }

        if (!this.mediaConfig) { // hot-path optimization to not flash a spinner if we don't need to
            const modal = Modal.createDialog(Spinner, null, 'mx_Dialog_spinner');
            await this.ensureMediaConfigFetched();
            modal.close();
        }

        const tooBigFiles = [];
        const okFiles = [];

        for (let i = 0; i < files.length; ++i) {
            if (this.isFileSizeAcceptable(files[i])) {
                okFiles.push(files[i]);
            } else {
                tooBigFiles.push(files[i]);
            }
        }

        if (tooBigFiles.length > 0) {
            const UploadFailureDialog = sdk.getComponent("dialogs.UploadFailureDialog");
            const {finished} = Modal.createTrackedDialog<[boolean]>('Upload Failure', '', UploadFailureDialog, {
                badFiles: tooBigFiles,
                totalFiles: files.length,
                contentMessages: this,
            });
            const [shouldContinue] = await finished;
            if (!shouldContinue) return;
        }

        const UploadConfirmDialog = sdk.getComponent("dialogs.UploadConfirmDialog");
        let uploadAll = false;
        // Promise to complete before sending next file into room, used for synchronisation of file-sending
        // to match the order the files were specified in
        let promBefore = Promise.resolve();
        for (let i = 0; i < okFiles.length; ++i) {
            const file = okFiles[i];
            if (!uploadAll) {
                const {finished} = Modal.createTrackedDialog<[boolean, boolean]>('Upload Files confirmation',
                    '', UploadConfirmDialog, {
                        file,
                        currentIndex: i,
                        totalFiles: okFiles.length,
                    },
                );
                const [shouldContinue, shouldUploadAll] = await finished;
                if (!shouldContinue) break;
                if (shouldUploadAll) {
                    uploadAll = true;
                }
            }
            promBefore = this.sendContentToRoom(file, roomId, matrixClient, promBefore);
        }
    }

    getCurrentUploads() {
        return this.inprogress.filter(u => !u.canceled);
    }

    cancelUpload(promise: Promise<any>) {
        let upload: IUpload;
        for (let i = 0; i < this.inprogress.length; ++i) {
            if (this.inprogress[i].promise === promise) {
                upload = this.inprogress[i];
                break;
            }
        }
        if (upload) {
            upload.canceled = true;
            MatrixClientPeg.get().cancelUpload(upload.promise);
            dis.dispatch({action: 'upload_canceled', upload});
        }
    }

    private sendContentToRoom(file: File, roomId: string, matrixClient: MatrixClient, promBefore: Promise<any>) {
        const content: IContent = {
            body: file.name || 'Attachment',
            info: {
                size: file.size,
            },
            msgtype: "", // set later
        };

        // if we have a mime type for the file, add it to the message metadata
        if (file.type) {
            content.info.mimetype = file.type;
        }

        const prom = new Promise((resolve) => {
            if (file.type.indexOf('image/') === 0) {
                content.msgtype = 'm.image';
                infoForImageFile(matrixClient, roomId, file).then((imageInfo) => {
                    extend(content.info, imageInfo);
                    resolve();
                }, (e) => {
                    console.error(e);
                    content.msgtype = 'm.file';
                    resolve();
                });
            } else if (file.type.indexOf('audio/') === 0) {
                content.msgtype = 'm.audio';
                resolve();
            } else if (file.type.indexOf('video/') === 0) {
                content.msgtype = 'm.video';
                infoForVideoFile(matrixClient, roomId, file).then((videoInfo) => {
                    extend(content.info, videoInfo);
                    resolve();
                }, (e) => {
                    content.msgtype = 'm.file';
                    resolve();
                });
            } else {
                content.msgtype = 'm.file';
                resolve();
            }
        });

        // create temporary abort handler for before the actual upload gets passed off to js-sdk
        (prom as IAbortablePromise<any>).abort = () => {
            upload.canceled = true;
        };

        const upload: IUpload = {
            fileName: file.name || 'Attachment',
            roomId: roomId,
            total: file.size,
            loaded: 0,
            promise: prom,
        };
        this.inprogress.push(upload);
        dis.dispatch({action: 'upload_started'});

        // Focus the composer view
        dis.fire(Action.FocusComposer);

        function onProgress(ev) {
            upload.total = ev.total;
            upload.loaded = ev.loaded;
            dis.dispatch({action: 'upload_progress', upload: upload});
        }

        let error;
        return prom.then(function() {
            if (upload.canceled) throw new UploadCanceledError();
            // XXX: upload.promise must be the promise that
            // is returned by uploadFile as it has an abort()
            // method hacked onto it.
            upload.promise = uploadFile(
                matrixClient, roomId, file, onProgress,
            );
            return upload.promise.then(function(result) {
                content.file = result.file;
                content.url = result.url;
            });
        }).then(() => {
            // Await previous message being sent into the room
            return promBefore;
        }).then(function() {
            if (upload.canceled) throw new UploadCanceledError();
            return matrixClient.sendMessage(roomId, content);
        }, function(err) {
            error = err;
            if (!upload.canceled) {
                let desc = _t("The file '%(fileName)s' failed to upload.", {fileName: upload.fileName});
                if (err.http_status === 413) {
                    desc = _t(
                        "The file '%(fileName)s' exceeds this homeserver's size limit for uploads",
                        {fileName: upload.fileName},
                    );
                }
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Upload failed', '', ErrorDialog, {
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
                if (error && error.http_status === 413) {
                    this.mediaConfig = null;
                }
                dis.dispatch({action: 'upload_failed', upload, error});
            } else {
                dis.dispatch({action: 'upload_finished', upload});
                dis.dispatch({action: 'message_sent'});
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

    private ensureMediaConfigFetched() {
        if (this.mediaConfig !== null) return;

        console.log("[Media Config] Fetching");
        return MatrixClientPeg.get().getMediaConfig().then((config) => {
            console.log("[Media Config] Fetched config:", config);
            return config;
        }).catch(() => {
            // Media repo can't or won't report limits, so provide an empty object (no limits).
            console.log("[Media Config] Could not fetch config, so not limiting uploads.");
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
