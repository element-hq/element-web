/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import request from "request";

import * as matrixcs from "./matrix";
import * as utils from "./utils";
import { logger } from './logger';

matrixcs.request(request);

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    utils.setCrypto(crypto);
} catch (err) {
    logger.log('nodejs was compiled without crypto support');
}

export * from "./matrix";
export default matrixcs;

