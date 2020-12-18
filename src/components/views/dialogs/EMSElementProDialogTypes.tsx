export enum PostmessageAction {
    CloseDialog = "close_dialog",
    ElementProAccountDetails = "element_pro_account_details",
    ElementProAccountDetailsRequest = "element_pro_account_details_request",
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
