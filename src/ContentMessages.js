/*
Copyright 2015 OpenMarket Ltd

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

function infoForImageFile(imageFile) {
    var deferred = q.defer();

    // Load the file into an html element
    var img = document.createElement("img");

    var reader = new FileReader();
    reader.onload = function(e) {
        img.src = e.target.result;

        // Once ready, returns its size
        img.onload = function() {
            deferred.resolve({
                w: img.width,
                h: img.height
            });
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

class ContentMessages {
    constructor() {
        this.inprogress = [];
        this.nextId = 0;
    }

    sendContentToRoom(file, roomId, matrixClient) {
        var content = {
            body: file.name,
            info: {
                size: file.size,
            }
        };

        // if we have a mime type for the file, add it to the message metadata
        if (file.type) {
            content.info.mimetype = file.type;
        }

        var def = q.defer();
        if (file.type.indexOf('image/') == 0) {
            content.msgtype = 'm.image';
            infoForImageFile(file).then(function(imageInfo) {
                extend(content.info, imageInfo);
                def.resolve();
            });
        } else {
            content.msgtype = 'm.file';
            def.resolve();
        }

        var upload = {
            fileName: file.name,
            roomId: roomId,
            total: 0,
            loaded: 0
        };
        this.inprogress.push(upload);
        dis.dispatch({action: 'upload_started'});

        var self = this;
        return def.promise.then(function() {
            upload.promise = matrixClient.uploadContent(file);
            return upload.promise;
        }).then(function(url) {
            content.url = url;
            return matrixClient.sendMessage(roomId, content);
        }).progress(function(ev) {
            if (ev) {
                upload.total = ev.total;
                upload.loaded = ev.loaded;
                dis.dispatch({action: 'upload_progress', upload: upload});
            }
        }).then(function() {
            dis.dispatch({action: 'upload_finished', upload: upload});
        }, function(err) {
            dis.dispatch({action: 'upload_failed', upload: upload});
        }).finally(function() {
            var inprogressKeys = Object.keys(self.inprogress);
            for (var i = 0; i < self.inprogress.length; ++i) {
                var k = inprogressKeys[i];
                if (self.inprogress[k].promise === upload_promise) {
                    delete self.inprogress[k];
                    break;
                }
            }
        });
    }

    getCurrentUploads() {
        return this.inprogress;
    }

    cancelUpload(promise) {
        var inprogressKeys = Object.keys(self.inprogress);
        for (var i = 0; i < self.inprogress.length; ++i) {
            var k = inprogressKeys[i];
            if (self.inprogress[k].promise === promise) {
                self.inprogress[k].canceled = true;
                break;
            }
        }
        MatrixClientPeg.get().cancelUpload(promise);
    }
}

if (global.mx_ContentMessage === undefined) {
    global.mx_ContentMessage = new ContentMessages();
}

module.exports = global.mx_ContentMessage;
