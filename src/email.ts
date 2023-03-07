/*
Copyright 2016 OpenMarket Ltd
Copyright 2023 The Matrix.org Foundation C.I.C.

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

// Regexp based on Simpler Version from https://gist.github.com/gregseth/5582254 - matches RFC2822
const EMAIL_ADDRESS_REGEX = new RegExp(
    "^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*" + // localpart
        "@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$",
    "i",
);

export function looksValid(email: string): boolean {
    // short circuit regex with this basic check
    if (email.indexOf("@") < 1) return false;

    return EMAIL_ADDRESS_REGEX.test(email);
}
