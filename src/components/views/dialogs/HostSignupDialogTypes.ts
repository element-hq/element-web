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

export enum PostmessageAction {
    CloseDialog = "close_dialog",
    HostSignupAccountDetails = "host_signup_account_details",
    HostSignupAccountDetailsRequest = "host_signup_account_details_request",
    Minimize = "host_signup_minimize",
    Maximize = "host_signup_maximize",
    SetupComplete = "setup_complete",
}

interface IAccountData {
    accessToken: string;
    name: string;
    openIdToken: string;
    serverName: string;
    userLocalpart: string;
    termsAccepted: boolean;
}

export interface IPostmessageRequestData {
    action: PostmessageAction;
}

export interface IPostmessageResponseData {
    action: PostmessageAction;
    account?: IAccountData;
}

export interface IPostmessage {
    data: IPostmessageRequestData;
    origin: string;
}

export interface IHostSignupConfig {
    brand: string;
    cookiePolicyUrl: string;
    domains: Array<string>;
    privacyPolicyUrl: string;
    termsOfServiceUrl: string;
    url: string;
}
