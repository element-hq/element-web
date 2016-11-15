/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

var q = require('q');
var extend = require('./extend');
var dis = require('./dispatcher');
var MatrixClientPeg = require('./MatrixClientPeg');
var sdk = require('./index');
var Modal = require('./Modal');

var encrypt = require("browser-encrypt-attachment");

// Polyfill for Canvas.toBlob API using Canvas.toDataURL
require("blueimp-canvas-to-blob");

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;


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
 * @param {integer} inputWidth The width of the image in the input element.
 * @param {integer} inputHeight the width of the image in the input element.
 * @param {String} mimeType The mimeType to save the blob as.
 * @return {Promise} A promise that resolves with an object with an info key
 *  and a thumbnail key.
 */
function createThumbnail(element, inputWidth, inputHeight, mimeType) {
    const deferred = q.defer();

    var targetWidth = inputWidth;
    var targetHeight = inputHeight;
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
        deferred.resolve({
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
            thumbnail: thumbnail
        });
    }, mimeType);

    return deferred.promise;
}

/**
 * Load a file into a newly created image element.
 *
 * @param {File} file The file to load in an image element.
 * @return {Promise} A promise that resolves with the html image element.
 */
function loadImageElement(imageFile) {
    const deferred = q.defer();

    // Load the file into an html element
    const img = document.createElement("img");

    const reader = new FileReader();
    reader.onload = function(e) {
        img.src = e.target.result;

        // Once ready, create a thumbnail
        img.onload = function() {
            deferred.resolve(img);
        };
        img.onerror = function(e) {
            deferred.reject(e);
        };
    };
    reader.onerror = function(e) {
        deferred.reject(e);
    };
    reader.readAsDataURL(imageFile);

    return deferred.promise;
}

/**
 * Read the metadata for an image file and create and upload a thumbnail of the image.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the image will be uploaded in.
 * @param {File} The image to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
function infoForImageFile(matrixClient, roomId, imageFile) {
    var thumbnailType = "image/png";
    if (imageFile.type == "image/jpeg") {
        thumbnailType = "image/jpeg";
    }

    var imageInfo;
    return loadImageElement(imageFile).then(function(img) {
        return createThumbnail(img, img.width, img.height, thumbnailType);
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
 * @param {File} file The file to load in an video element.
 * @return {Promise} A promise that resolves with the video image element.
 */
function loadVideoElement(videoFile) {
    const deferred = q.defer();

    // Load the file into an html element
    const video = document.createElement("video");

    const reader = new FileReader();
    reader.onload = function(e) {
        video.src = e.target.result;

        // Once ready, returns its size
        // Wait until we have enough data to thumbnail the first frame.
        video.onloadeddata = function() {
            deferred.resolve(video);
        };
        video.onerror = function(e) {
            deferred.reject(e);
        };
    };
    reader.onerror = function(e) {
        deferred.reject(e);
    };
    reader.readAsDataURL(videoFile);

    return deferred.promise;
}

/**
 * Read the metadata for a video file and create and upload a thumbnail of the video.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the video will be uploaded to.
 * @param {File} The video to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
function infoForVideoFile(matrixClient, roomId, videoFile) {
    const thumbnailType = "image/jpeg";

    var videoInfo;
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
 * @return {Promise} A promise that resolves with an ArrayBuffer when the file
 *   is read.
 */
function readFileAsArrayBuffer(file) {
    const deferred = q.defer();
    const reader = new FileReader();
    reader.onload = function(e) {
        deferred.resolve(e.target.result);
    };
    reader.onerror = function(e) {
        deferred.reject(e);
    };
    reader.readAsArrayBuffer(file);
    return deferred.promise;
}

/**
 * Upload the file to the content repository.
 * If the room is encrypted then encrypt the file before uploading.
 *
 * @param {MatrixClient} matrixClient The matrix client to upload the file with.
 * @param {String} roomId The ID of the room being uploaded to.
 * @param {File} file The file to upload.
 * @return {Promise} A promise that resolves with an object.
 *  If the file is unencrypted then the object will have a "url" key.
 *  If the file is encrypted then the object will have a "file" key.
 */
function uploadFile(matrixClient, roomId, file) {
    if (matrixClient.isRoomEncrypted(roomId)) {
        // If the room is encrypted then encrypt the file before uploading it.
        // First read the file into memory.
        return readFileAsArrayBuffer(file).then(function(data) {
            // Then encrypt the file.
            return encrypt.encryptAttachment(data);
        }).then(function(encryptResult) {
            // Record the information needed to decrypt the attachment.
            const encryptInfo = encryptResult.info;
            // Pass the encrypted data as a Blob to the uploader.
            const blob = new Blob([encryptResult.data]);
            return matrixClient.uploadContent(blob).then(function(url) {
                // If the attachment is encrypted then bundle the URL along
                // with the information needed to decrypt the attachment and
                // add it under a file key.
                encryptInfo.url = url;
                if (file.type) {
                    encryptInfo.mimetype = file.type;
                }
                return {"file": encryptInfo};
            });
        });
    } else {
        return matrixClient.uploadContent(file).then(function(url) {
            // If the attachment isn't encrypted then include the URL directly.
            return {"url": url};
        });
    }
}


class ContentMessages {
    constructor() {
        this.inprogress = [];
        this.nextId = 0;
    }

    sendContentToRoom(file, roomId, matrixClient) {
        const content = {
            body: file.name,
            info: {
                size: file.size,
            }
        };

        // if we have a mime type for the file, add it to the message metadata
        if (file.type) {
            content.info.mimetype = file.type;
        }

        const def = q.defer();
        if (file.type.indexOf('image/') == 0) {
            content.msgtype = 'm.image';
            infoForImageFile(matrixClient, roomId, file).then(imageInfo=>{
                extend(content.info, imageInfo);
                def.resolve();
            }, error=>{
                console.error(error);
                content.msgtype = 'm.file';
                def.resolve();
            });
        } else if (file.type.indexOf('audio/') == 0) {
            content.msgtype = 'm.audio';
            def.resolve();
        } else if (file.type.indexOf('video/') == 0) {
            content.msgtype = 'm.video';
            infoForVideoFile(matrixClient, roomId, file).then(videoInfo=>{
                extend(content.info, videoInfo);
                def.resolve();
            }, error=>{
                content.msgtype = 'm.file';
                def.resolve();
            });
        } else {
            content.msgtype = 'm.file';
            def.resolve();
        }

        const upload = {
            fileName: file.name,
            roomId: roomId,
            total: 0,
            loaded: 0,
        };
        this.inprogress.push(upload);
        dis.dispatch({action: 'upload_started'});

        var error;
        return def.promise.then(function() {
            upload.promise = uploadFile(
                matrixClient, roomId, file
            ).then(function(result) {
                content.file = result.file;
                content.url = result.url;
            });
            return upload.promise;
        }).progress(function(ev) {
            if (ev) {
                upload.total = ev.total;
                upload.loaded = ev.loaded;
                dis.dispatch({action: 'upload_progress', upload: upload});
            }
        }).then(function(url) {
            return matrixClient.sendMessage(roomId, content);
        }, function(err) {
            error = err;
            if (!upload.canceled) {
                var desc = "The file '"+upload.fileName+"' failed to upload.";
                if (err.http_status == 413) {
                    desc = "The file '"+upload.fileName+"' exceeds this home server's size limit for uploads";
                }
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Upload Failed",
                    description: desc
                });
            }
        }).finally(() => {
            const inprogressKeys = Object.keys(this.inprogress);
            for (var i = 0; i < this.inprogress.length; ++i) {
                var k = inprogressKeys[i];
                if (this.inprogress[k].promise === upload.promise) {
                    this.inprogress.splice(k, 1);
                    break;
                }
            }
            if (error) {
                dis.dispatch({action: 'upload_failed', upload: upload});
            }
            else {
                dis.dispatch({action: 'upload_finished', upload: upload});
            }
        });
    }

    getCurrentUploads() {
        return this.inprogress;
    }

    cancelUpload(promise) {
        const inprogressKeys = Object.keys(this.inprogress);
        var upload;
        for (var i = 0; i < this.inprogress.length; ++i) {
            var k = inprogressKeys[i];
            if (this.inprogress[k].promise === promise) {
                upload = this.inprogress[k];
                break;
            }
        }
        if (upload) {
            upload.canceled = true;
            MatrixClientPeg.get().cancelUpload(upload.promise);
        }
    }
}

if (global.mx_ContentMessage === undefined) {
    global.mx_ContentMessage = new ContentMessages();
}

module.exports = global.mx_ContentMessage;
