/*
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

export enum ReceiptType {
    Read = "m.read",
    FullyRead = "m.fully_read",
    ReadPrivate = "m.read.private",
}

export const MAIN_ROOM_TIMELINE = "main";

export interface Receipt {
    ts: number;
    thread_id?: string;
}

export interface WrappedReceipt {
    eventId: string;
    data: Receipt;
}

export interface CachedReceipt {
    type: ReceiptType;
    userId: string;
    data: Receipt;
}

export type ReceiptCache = Map<string, CachedReceipt[]>;

export interface ReceiptContent {
    [eventId: string]: {
        [key in ReceiptType | string]: {
            [userId: string]: Receipt;
        };
    };
}

// We will only hold a synthetic receipt if we do not have a real receipt or the synthetic is newer.
// map: receipt type → user Id → receipt
export type Receipts = Map<string, Map<string, [real: WrappedReceipt | null, synthetic: WrappedReceipt | null]>>;

export type CachedReceiptStructure = {
    eventId: string;
    receiptType: string | ReceiptType;
    userId: string;
    receipt: Receipt;
    synthetic: boolean;
};
