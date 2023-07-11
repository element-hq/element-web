/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020, 2023 The Matrix.org Foundation C.I.C.

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

import { IContent } from "matrix-js-sdk/src/matrix";

import { _td } from "../languageHandler";
import { XOR } from "../@types/common";

export const CommandCategories = {
    messages: _td("Messages"),
    actions: _td("Actions"),
    admin: _td("Admin"),
    advanced: _td("Advanced"),
    effects: _td("Effects"),
    other: _td("Other"),
};

export type RunResult = XOR<{ error: Error }, { promise: Promise<IContent | undefined> }>;
