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

import { MatrixEvent } from "../../../models/event";
import { VerificationRequest } from "./VerificationRequest";

export interface IVerificationChannel {
    request?: VerificationRequest;
    readonly userId?: string;
    readonly roomId?: string;
    readonly deviceId?: string;
    readonly transactionId?: string;
    readonly receiveStartFromOtherDevices?: boolean;
    getTimestamp(event: MatrixEvent): number;
    send(type: string, uncompletedContent: Record<string, any>): Promise<void>;
    completeContent(type: string, content: Record<string, any>): Record<string, any>;
    sendCompleted(type: string, content: Record<string, any>): Promise<void>;
    completedContentFromEvent(event: MatrixEvent): Record<string, any>;
    canCreateRequest(type: string): boolean;
    handleEvent(event: MatrixEvent, request: VerificationRequest, isLiveEvent: boolean): Promise<void>;
}
