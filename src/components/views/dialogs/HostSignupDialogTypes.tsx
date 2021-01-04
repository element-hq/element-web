export enum PostmessageAction {
    CloseDialog = "close_dialog",
    HostSignupAccountDetails = "host_signup_account_details",
    HostSignupAccountDetailsRequest = "host_signup_account_details_request",
    SetupComplete = "setup_complete",
}

interface IAccountData {
    accessToken: string;
    name: string;
    openIdToken: string;
    serverName: string;
    userLocalpart: string;
}

export interface IPostmessageRequestData {
    action: PostmessageAction;
}

export interface IPostmessageResponseData {
    action: PostmessageAction;
    account: IAccountData;
}

export interface IPostmessage {
    data: IPostmessageRequestData;
    origin: string;
}
