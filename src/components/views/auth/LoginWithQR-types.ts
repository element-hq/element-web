/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

/**
 * The intention of this enum is to have a mode that scans a QR code instead of generating one.
 */
export enum Mode {
    /**
     * A QR code with be generated and shown
     */
    Show = "show",
}

export enum Phase {
    Loading,
    ShowingQR,
    // The following are specific to MSC4108
    OutOfBandConfirmation,
    WaitingForDevice,
    Verifying,
    Error,
    /**
     * @deprecated the MSC3906 implementation is deprecated in favour of MSC4108.
     */
    LegacyConnected,
}

export enum Click {
    Cancel,
    Decline,
    Approve,
    Back,
    ShowQr,
}
