/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

export const KIND_DM = "dm";
export const KIND_INVITE = "invite";
// NB. This dialog needs the 'mx_InviteDialog_transferWrapper' wrapper class to have the correct
// padding on the bottom (because all modals have 24px padding on all sides), so this needs to
// be passed when creating the modal
export const KIND_CALL_TRANSFER = "call_transfer";

export type AnyInviteKind = typeof KIND_INVITE | typeof KIND_DM | typeof KIND_CALL_TRANSFER;
