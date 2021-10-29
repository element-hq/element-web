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

declare module "browser-encrypt-attachment" {
    interface IInfo {
        v: string;
        key: {
            alg: string;
            key_ops: string[]; // eslint-disable-line camelcase
            kty: string;
            k: string;
            ext: boolean;
        };
        iv: string;
        hashes: {[alg: string]: string};
    }

    interface IEncryptedAttachment {
        data: ArrayBuffer;
        info: IInfo;
    }

    export function encryptAttachment(plaintextBuffer: ArrayBuffer): Promise<IEncryptedAttachment>;
    export function decryptAttachment(ciphertextBuffer: ArrayBuffer, info: IInfo): Promise<ArrayBuffer>;
}
