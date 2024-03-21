/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// WARNING: We have to be very careful about what mime-types we allow into blobs,
// as for performance reasons these are now rendered via URL.createObjectURL()
// rather than by converting into data: URIs.
//
// This means that the content is rendered using the origin of the script which
// called createObjectURL(), and so if the content contains any scripting then it
// will pose a XSS vulnerability when the browser renders it.  This is particularly
// bad if the user right-clicks the URI and pastes it into a new window or tab,
// as the blob will then execute with access to Element's full JS environment(!)
//
// See https://github.com/matrix-org/matrix-react-sdk/pull/1820#issuecomment-385210647
// for details.
//
// We mitigate this by only allowing mime-types into blobs which we know don't
// contain any scripting, and instantiate all others as application/octet-stream
// regardless of what mime-type the event claimed.  Even if the payload itself
// is some malicious HTML, the fact we instantiate it with a media mimetype or
// application/octet-stream means the browser doesn't try to render it as such.
//
// One interesting edge case is image/svg+xml, which empirically *is* rendered
// correctly if the blob is set to the src attribute of an img tag (for thumbnails)
// *even if the mimetype is application/octet-stream*.  However, empirically JS
// in the SVG isn't executed in this scenario, so we seem to be okay.
//
// Tested on Chrome 65 and Firefox 60
//
// The list below is taken mainly from
// https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
// N.B. Matrix doesn't currently specify which mimetypes are valid in given
// events, so we pick the ones which HTML5 browsers should be able to display
//
// For the record, mime-types which must NEVER enter this list below include:
//   text/html, text/xhtml, image/svg, image/svg+xml, image/pdf, and similar.

const ALLOWED_BLOB_MIMETYPES = [
    "image/jpeg",
    "image/gif",
    "image/png",
    "image/apng",
    "image/webp",
    "image/avif",

    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",

    "audio/mp4",
    "audio/webm",
    "audio/aac",
    "audio/mpeg",
    "audio/ogg",
    "audio/wave",
    "audio/wav",
    "audio/x-wav",
    "audio/x-pn-wav",
    "audio/flac",
    "audio/x-flac",
];

export function getBlobSafeMimeType(mimetype: string): string {
    if (!ALLOWED_BLOB_MIMETYPES.includes(mimetype)) {
        return "application/octet-stream";
    }
    return mimetype;
}
