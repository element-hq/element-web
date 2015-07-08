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

function sendContentToRoom(file, roomId, matrixClient) {
    var content = {
        body: file.name,
        info: {
            size: file.size,
            mimetype: file.type
        }
    };

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

    return def.promise.then(function() {
        return matrixClient.uploadContent(file);
    }).then(function(url) {
        content.url = url;
        return matrixClient.sendMessage(roomId, content);
    });
}

module.exports = {
    sendContentToRoom: sendContentToRoom
};
