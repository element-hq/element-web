/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as ModernizrStatic from "modernizr";
import ContentMessages from "../ContentMessages";
import { IMatrixClientPeg } from "../MatrixClientPeg";
import ToastStore from "../stores/ToastStore";
import DeviceListener from "../DeviceListener";
import RebrandListener from "../RebrandListener";
import { RoomListStore2 } from "../stores/room-list/RoomListStore2";
import { PlatformPeg } from "../PlatformPeg";
import RoomListLayoutStore from "../stores/room-list/RoomListLayoutStore";

declare global {
    interface Window {
        Modernizr: ModernizrStatic;
        mxMatrixClientPeg: IMatrixClientPeg;
        Olm: {
            init: () => Promise<void>;
        };

        mx_ContentMessages: ContentMessages;
        mx_ToastStore: ToastStore;
        mx_DeviceListener: DeviceListener;
        mx_RebrandListener: RebrandListener;
        mx_RoomListStore2: RoomListStore2;
        mx_RoomListLayoutStore: RoomListLayoutStore;
        mxPlatformPeg: PlatformPeg;

        // TODO: Remove flag before launch: https://github.com/vector-im/riot-web/issues/14231
        mx_LoudRoomListLogging: boolean;
    }

    // workaround for https://github.com/microsoft/TypeScript/issues/30933
    interface ObjectConstructor {
        fromEntries?(xs: [string|number|symbol, any][]): object
    }

    interface Document {
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/hasStorageAccess
        hasStorageAccess?: () => Promise<boolean>;
    }

    interface Navigator {
        userLanguage?: string;
    }

    interface StorageEstimate {
        usageDetails?: {[key: string]: number};
    }

    export interface ISettledFulfilled<T> {
        status: "fulfilled";
        value: T;
    }
    export interface ISettledRejected {
        status: "rejected";
        reason: any;
    }

    interface PromiseConstructor {
        allSettled<T>(promises: Promise<T>[]): Promise<Array<ISettledFulfilled<T> | ISettledRejected>>;
    }
}
