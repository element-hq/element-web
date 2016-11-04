/*
Copyright 2016 OpenMarket Ltd

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

'use struct';

// Pull in the encryption lib so that we can decrypt attachments.
var encrypt = require("browser-encrypt-attachment");
// Pull in a fetch polyfill so we can download encrypted attachments.
require("isomorphic-fetch");
// Grab the client so that we can turn mxc:// URLs into https:// URLS.
var MatrixClientPeg = require('../MatrixClientPeg');
var q = require('q');


/**
 * Read blob as a data:// URI.
 * @return {Promise} A promise that resolves with the data:// URI.
 */

function readBlobAsDataUri(file) {
    var deferred = q.defer();
    var reader = new FileReader();
    reader.onload = function(e) {
        deferred.resolve(e.target.result);
    };
    reader.onerror = function(e) {
        deferred.reject(e);
    };
    reader.readAsDataURL(file);
    return deferred.promise;
}


export function decryptFile(file) {
    var url = MatrixClientPeg.get().mxcUrlToHttp(file.url);
    var self = this;
    // Download the encrypted file as an array buffer.
    return fetch(url).then(function (response) {
        return response.arrayBuffer();
    }).then(function (responseData) {
        // Decrypt the array buffer using the information taken from
        // the event content.
        return encrypt.decryptAttachment(responseData, file);
    }).then(function(dataArray) {
        // Turn the array into a Blob and give it the correct MIME-type.
        var blob = new Blob([dataArray], {type: file.mimetype});
        return readBlobAsDataUri(blob);
    });
}
