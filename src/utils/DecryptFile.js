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

// Pull in the encryption lib so that we can decrypt attachments.
import encrypt from 'browser-encrypt-attachment';
// Pull in a fetch polyfill so we can download encrypted attachments.
import 'isomorphic-fetch';
// Grab the client so that we can turn mxc:// URLs into https:// URLS.
import MatrixClientPeg from '../MatrixClientPeg';
import q from 'q';


/**
 * Read blob as a data:// URI.
 * @return {Promise} A promise that resolves with the data:// URI.
 */
export function readBlobAsDataUri(file) {
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


/**
 * Decrypt a file attached to a matrix event.
 * @param file {Object} The json taken from the matrix event.
 *   This passed to [link]{@link https://github.com/matrix-org/browser-encrypt-attachments}
 *   as the encryption info object, so will also have the those keys in addition to
 *   the keys below.
 * @param file.url {string} An mxc:// URL for the encrypted file.
 * @param file.mimetype {string} The MIME-type of the plaintext file.
 */
export function decryptFile(file) {
    const url = MatrixClientPeg.get().mxcUrlToHttp(file.url);
    // Download the encrypted file as an array buffer.
    return q(fetch(url)).then(function(response) {
        return response.arrayBuffer();
    }).then(function(responseData) {
        // Decrypt the array buffer using the information taken from
        // the event content.
        return encrypt.decryptAttachment(responseData, file);
    }).then(function(dataArray) {
        // Turn the array into a Blob and give it the correct MIME-type.
        var blob = new Blob([dataArray], {type: file.mimetype});
        return blob;
    });
}
