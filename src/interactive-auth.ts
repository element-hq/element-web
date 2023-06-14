/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
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

import { logger } from "./logger";
import { MatrixClient } from "./client";
import { defer, IDeferred } from "./utils";
import { MatrixError } from "./http-api";
import { UIAResponse } from "./@types/uia";

const EMAIL_STAGE_TYPE = "m.login.email.identity";
const MSISDN_STAGE_TYPE = "m.login.msisdn";

export interface UIAFlow {
    stages: Array<AuthType | string>;
}

export interface IInputs {
    // An email address. If supplied, a flow using email verification will be chosen.
    emailAddress?: string;
    // An ISO two letter country code. Gives the country that opts.phoneNumber should be resolved relative to.
    phoneCountry?: string;
    // A phone number. If supplied, a flow using phone number validation will be chosen.
    phoneNumber?: string;
    registrationToken?: string;
}

export interface IStageStatus {
    emailSid?: string;
    errcode?: string;
    error?: string;
}

/**
 * Data returned in the body of a 401 response from a UIA endpoint.
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#user-interactive-api-in-the-rest-api
 */
export interface IAuthData {
    // XXX: many of the fields here (`type`, `available_flows`, `required_stages`, etc) look like they
    // shouldn't be here. They aren't in the spec and it's unclear what they are supposed to do. Be wary of using them.
    session?: string;
    type?: string;
    completed?: string[];
    flows?: UIAFlow[];
    available_flows?: UIAFlow[];
    stages?: string[];
    required_stages?: AuthType[];
    params?: Record<string, Record<string, any>>;
    data?: Record<string, string>;
    errcode?: string;
    error?: string;
    user_id?: string;
    device_id?: string;
    access_token?: string;
}

export enum AuthType {
    Password = "m.login.password",
    Recaptcha = "m.login.recaptcha",
    Terms = "m.login.terms",
    Email = "m.login.email.identity",
    Msisdn = "m.login.msisdn",
    Sso = "m.login.sso",
    SsoUnstable = "org.matrix.login.sso",
    Dummy = "m.login.dummy",
    RegistrationToken = "m.login.registration_token",
    // For backwards compatability with servers that have not yet updated to
    // use the stable "m.login.registration_token" type.
    // The authentication flow is the same in both cases.
    UnstableRegistrationToken = "org.matrix.msc3231.login.registration_token",
}

/**
 * The parameters which are submitted as the `auth` dict in a UIA request
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#authentication-types
 */
export interface IAuthDict {
    // [key: string]: any;
    type?: string;
    session?: string;
    // TODO: Remove `user` once servers support proper UIA
    // See https://github.com/vector-im/element-web/issues/10312
    user?: string;
    identifier?: any;
    password?: string;
    response?: string;
    // TODO: Remove `threepid_creds` once servers support proper UIA
    // See https://github.com/vector-im/element-web/issues/10312
    // See https://github.com/matrix-org/matrix-doc/issues/2220
    // eslint-disable-next-line camelcase
    threepid_creds?: any;
    threepidCreds?: any;
    // For m.login.registration_token type
    token?: string;
}

export class NoAuthFlowFoundError extends Error {
    public name = "NoAuthFlowFoundError";

    // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
    public constructor(m: string, public readonly required_stages: string[], public readonly flows: UIAFlow[]) {
        super(m);
    }
}

/**
 * The type of an application callback to perform the user-interactive bit of UIA.
 *
 * It is called with a single parameter, `makeRequest`, which is a function which takes the UIA parameters and
 * makes the HTTP request.
 *
 * The generic parameter `T` is the type of the response of the endpoint, once it is eventually successful.
 */
export type UIAuthCallback<T> = (makeRequest: (authData: IAuthDict) => Promise<UIAResponse<T>>) => Promise<T>;

interface IOpts {
    /**
     * A matrix client to use for the auth process
     */
    matrixClient: MatrixClient;
    /**
     * Error response from the last request. If null, a request will be made with no auth before starting.
     */
    authData?: IAuthData;
    /**
     * Inputs provided by the user and used by different stages of the auto process.
     * The inputs provided will affect what flow is chosen.
     */
    inputs?: IInputs;
    /**
     * If resuming an existing interactive auth session, the sessionId of that session.
     */
    sessionId?: string;
    /**
     * If resuming an existing interactive auth session, the client secret for that session
     */
    clientSecret?: string;
    /**
     * If returning from having completed m.login.email.identity auth, the sid for the email verification session.
     */
    emailSid?: string;

    /**
     * If specified, will prefer flows which entirely consist of listed stages.
     * These should normally be of type AuthTypes but can be string when supporting custom auth stages.
     *
     * This can be used to avoid needing the fallback mechanism.
     */
    supportedStages?: Array<AuthType | string>;

    /**
     * Called with the new auth dict to submit the request.
     * Also passes a second deprecated arg which is a flag set to true if this request is a background request.
     * The busyChanged callback should be used instead of the background flag.
     * Should return a promise which resolves to the successful response or rejects with a MatrixError.
     */
    doRequest(auth: IAuthDict | null, background: boolean): Promise<IAuthData>;
    /**
     * Called when the status of the UI auth changes,
     * ie. when the state of an auth stage changes of when the auth flow moves to a new stage.
     * The arguments are: the login type (eg m.login.password); and an object which is either an error or an
     * informational object specific to the login type.
     * If the 'errcode' key is defined, the object is an error, and has keys:
     *     errcode: string, the textual error code, eg. M_UNKNOWN
     *     error: string, human readable string describing the error
     *
     * The login type specific objects are as follows:
     *     m.login.email.identity:
     *         * emailSid: string, the sid of the active email auth session
     */
    stateUpdated(nextStage: AuthType | string, status: IStageStatus): void;

    /**
     * A function that takes the email address (string), clientSecret (string), attempt number (int) and
     * sessionId (string) and calls the relevant requestToken function and returns the promise returned by that
     * function.
     * If the resulting promise rejects, the rejection will propagate through to the attemptAuth promise.
     */
    requestEmailToken(email: string, secret: string, attempt: number, session: string): Promise<{ sid: string }>;
    /**
     * Called whenever the interactive auth logic becomes busy submitting information provided by the user or finishes.
     * After this has been called with true the UI should indicate that a request is in progress
     * until it is called again with false.
     */
    busyChanged?(busy: boolean): void;
    startAuthStage?(nextStage: string): Promise<void>; // LEGACY
}

/**
 * Abstracts the logic used to drive the interactive auth process.
 *
 * <p>Components implementing an interactive auth flow should instantiate one of
 * these, passing in the necessary callbacks to the constructor. They should
 * then call attemptAuth, which will return a promise which will resolve or
 * reject when the interactive-auth process completes.
 *
 * <p>Meanwhile, calls will be made to the startAuthStage and doRequest
 * callbacks, and information gathered from the user can be submitted with
 * submitAuthDict.
 *
 * @param opts - options object
 */
export class InteractiveAuth {
    private readonly matrixClient: MatrixClient;
    private readonly inputs: IInputs;
    private readonly clientSecret: string;
    private readonly requestCallback: IOpts["doRequest"];
    private readonly busyChangedCallback?: IOpts["busyChanged"];
    private readonly stateUpdatedCallback: IOpts["stateUpdated"];
    private readonly requestEmailTokenCallback: IOpts["requestEmailToken"];
    private readonly supportedStages?: Set<string>;

    private data: IAuthData;
    private emailSid?: string;
    private requestingEmailToken = false;
    private attemptAuthDeferred: IDeferred<IAuthData> | null = null;
    private chosenFlow: UIAFlow | null = null;
    private currentStage: string | null = null;

    private emailAttempt = 1;

    // if we are currently trying to submit an auth dict (which includes polling)
    // the promise the will resolve/reject when it completes
    private submitPromise: Promise<void> | null = null;

    public constructor(opts: IOpts) {
        this.matrixClient = opts.matrixClient;
        this.data = opts.authData || {};
        this.requestCallback = opts.doRequest;
        this.busyChangedCallback = opts.busyChanged;
        // startAuthStage included for backwards compat
        this.stateUpdatedCallback = opts.stateUpdated || opts.startAuthStage;
        this.requestEmailTokenCallback = opts.requestEmailToken;
        this.inputs = opts.inputs || {};

        if (opts.sessionId) this.data.session = opts.sessionId;
        this.clientSecret = opts.clientSecret || this.matrixClient.generateClientSecret();
        this.emailSid = opts.emailSid;
        if (opts.supportedStages !== undefined) this.supportedStages = new Set(opts.supportedStages);
    }

    /**
     * begin the authentication process.
     *
     * @returns which resolves to the response on success,
     * or rejects with the error on failure. Rejects with NoAuthFlowFoundError if
     *     no suitable authentication flow can be found
     */
    public attemptAuth(): Promise<IAuthData> {
        // This promise will be quite long-lived and will resolve when the
        // request is authenticated and completes successfully.
        this.attemptAuthDeferred = defer();
        // pluck the promise out now, as doRequest may clear before we return
        const promise = this.attemptAuthDeferred.promise;

        // if we have no flows, try a request to acquire the flows
        if (!this.data?.flows) {
            this.busyChangedCallback?.(true);
            // use the existing sessionId, if one is present.
            const auth = this.data.session ? { session: this.data.session } : null;
            this.doRequest(auth).finally(() => {
                this.busyChangedCallback?.(false);
            });
        } else {
            this.startNextAuthStage();
        }

        return promise;
    }

    /**
     * Poll to check if the auth session or current stage has been
     * completed out-of-band. If so, the attemptAuth promise will
     * be resolved.
     */
    public async poll(): Promise<void> {
        if (!this.data.session) return;
        // likewise don't poll if there is no auth session in progress
        if (!this.attemptAuthDeferred) return;
        // if we currently have a request in flight, there's no point making
        // another just to check what the status is
        if (this.submitPromise) return;

        let authDict: IAuthDict = {};
        if (this.currentStage == EMAIL_STAGE_TYPE) {
            // The email can be validated out-of-band, but we need to provide the
            // creds so the HS can go & check it.
            if (this.emailSid) {
                const creds: Record<string, string> = {
                    sid: this.emailSid,
                    client_secret: this.clientSecret,
                };
                if (await this.matrixClient.doesServerRequireIdServerParam()) {
                    const idServerParsedUrl = new URL(this.matrixClient.getIdentityServerUrl()!);
                    creds.id_server = idServerParsedUrl.host;
                }
                authDict = {
                    type: EMAIL_STAGE_TYPE,
                    // TODO: Remove `threepid_creds` once servers support proper UIA
                    // See https://github.com/matrix-org/synapse/issues/5665
                    // See https://github.com/matrix-org/matrix-doc/issues/2220
                    threepid_creds: creds,
                    threepidCreds: creds,
                };
            }
        }

        this.submitAuthDict(authDict, true);
    }

    /**
     * get the auth session ID
     *
     * @returns session id
     */
    public getSessionId(): string | undefined {
        return this.data?.session;
    }

    /**
     * get the client secret used for validation sessions
     * with the identity server.
     *
     * @returns client secret
     */
    public getClientSecret(): string {
        return this.clientSecret;
    }

    /**
     * get the server params for a given stage
     *
     * @param loginType - login type for the stage
     * @returns any parameters from the server for this stage
     */
    public getStageParams(loginType: string): Record<string, any> | undefined {
        return this.data.params?.[loginType];
    }

    public getChosenFlow(): UIAFlow | null {
        return this.chosenFlow;
    }

    /**
     * submit a new auth dict and fire off the request. This will either
     * make attemptAuth resolve/reject, or cause the startAuthStage callback
     * to be called for a new stage.
     *
     * @param authData - new auth dict to send to the server. Should
     *    include a `type` property denoting the login type, as well as any
     *    other params for that stage.
     * @param background - If true, this request failing will not result
     *    in the attemptAuth promise being rejected. This can be set to true
     *    for requests that just poll to see if auth has been completed elsewhere.
     */
    public async submitAuthDict(authData: IAuthDict, background = false): Promise<void> {
        if (!this.attemptAuthDeferred) {
            throw new Error("submitAuthDict() called before attemptAuth()");
        }

        if (!background) {
            this.busyChangedCallback?.(true);
        }

        // if we're currently trying a request, wait for it to finish
        // as otherwise we can get multiple 200 responses which can mean
        // things like multiple logins for register requests.
        // (but discard any exceptions as we only care when its done,
        // not whether it worked or not)
        while (this.submitPromise) {
            try {
                await this.submitPromise;
            } catch (e) {}
        }

        // use the sessionid from the last request, if one is present.
        let auth: IAuthDict;
        if (this.data.session) {
            auth = {
                session: this.data.session,
            };
            Object.assign(auth, authData);
        } else {
            auth = authData;
        }

        try {
            // NB. the 'background' flag is deprecated by the busyChanged
            // callback and is here for backwards compat
            this.submitPromise = this.doRequest(auth, background);
            await this.submitPromise;
        } finally {
            this.submitPromise = null;
            if (!background) {
                this.busyChangedCallback?.(false);
            }
        }
    }

    /**
     * Gets the sid for the email validation session
     * Specific to m.login.email.identity
     *
     * @returns The sid of the email auth session
     */
    public getEmailSid(): string | undefined {
        return this.emailSid;
    }

    /**
     * Sets the sid for the email validation session
     * This must be set in order to successfully poll for completion
     * of the email validation.
     * Specific to m.login.email.identity
     *
     * @param sid - The sid for the email validation session
     */
    public setEmailSid(sid: string): void {
        this.emailSid = sid;
    }

    /**
     * Requests a new email token and sets the email sid for the validation session
     */
    public requestEmailToken = async (): Promise<void> => {
        if (!this.requestingEmailToken) {
            logger.trace("Requesting email token. Attempt: " + this.emailAttempt);
            // If we've picked a flow with email auth, we send the email
            // now because we want the request to fail as soon as possible
            // if the email address is not valid (ie. already taken or not
            // registered, depending on what the operation is).
            this.requestingEmailToken = true;
            try {
                const requestTokenResult = await this.requestEmailTokenCallback(
                    this.inputs.emailAddress!,
                    this.clientSecret,
                    this.emailAttempt++,
                    this.data.session!,
                );
                this.emailSid = requestTokenResult.sid;
                logger.trace("Email token request succeeded");
            } finally {
                this.requestingEmailToken = false;
            }
        } else {
            logger.warn("Could not request email token: Already requesting");
        }
    };

    /**
     * Fire off a request, and either resolve the promise, or call
     * startAuthStage.
     *
     * @internal
     * @param auth - new auth dict, including session id
     * @param background - If true, this request is a background poll, so it
     *    failing will not result in the attemptAuth promise being rejected.
     *    This can be set to true for requests that just poll to see if auth has
     *    been completed elsewhere.
     */
    private async doRequest(auth: IAuthDict | null, background = false): Promise<void> {
        try {
            const result = await this.requestCallback(auth, background);
            this.attemptAuthDeferred!.resolve(result);
            this.attemptAuthDeferred = null;
        } catch (error) {
            // sometimes UI auth errors don't come with flows
            const errorFlows = (<MatrixError>error).data?.flows ?? null;
            const haveFlows = this.data.flows || Boolean(errorFlows);
            if ((<MatrixError>error).httpStatus !== 401 || !(<MatrixError>error).data || !haveFlows) {
                // doesn't look like an interactive-auth failure.
                if (!background) {
                    this.attemptAuthDeferred?.reject(error);
                } else {
                    // We ignore all failures here (even non-UI auth related ones)
                    // since we don't want to suddenly fail if the internet connection
                    // had a blip whilst we were polling
                    logger.log("Background poll request failed doing UI auth: ignoring", error);
                }
            }
            if (!(<MatrixError>error).data) {
                (<MatrixError>error).data = {};
            }
            // if the error didn't come with flows, completed flows or session ID,
            // copy over the ones we have. Synapse sometimes sends responses without
            // any UI auth data (eg. when polling for email validation, if the email
            // has not yet been validated). This appears to be a Synapse bug, which
            // we workaround here.
            if (
                !(<MatrixError>error).data.flows &&
                !(<MatrixError>error).data.completed &&
                !(<MatrixError>error).data.session
            ) {
                (<MatrixError>error).data.flows = this.data.flows;
                (<MatrixError>error).data.completed = this.data.completed;
                (<MatrixError>error).data.session = this.data.session;
            }
            this.data = (<MatrixError>error).data;
            try {
                this.startNextAuthStage();
            } catch (e) {
                this.attemptAuthDeferred!.reject(e);
                this.attemptAuthDeferred = null;
                return;
            }

            if (!this.emailSid && this.chosenFlow?.stages.includes(AuthType.Email)) {
                try {
                    await this.requestEmailToken();
                    // NB. promise is not resolved here - at some point, doRequest
                    // will be called again and if the user has jumped through all
                    // the hoops correctly, auth will be complete and the request
                    // will succeed.
                    // Also, we should expose the fact that this request has compledted
                    // so clients can know that the email has actually been sent.
                } catch (e) {
                    // we failed to request an email token, so fail the request.
                    // This could be due to the email already beeing registered
                    // (or not being registered, depending on what we're trying
                    // to do) or it could be a network failure. Either way, pass
                    // the failure up as the user can't complete auth if we can't
                    // send the email, for whatever reason.
                    this.attemptAuthDeferred!.reject(e);
                    this.attemptAuthDeferred = null;
                }
            }
        }
    }

    /**
     * Pick the next stage and call the callback
     *
     * @internal
     * @throws {@link NoAuthFlowFoundError} If no suitable authentication flow can be found
     */
    private startNextAuthStage(): void {
        const nextStage = this.chooseStage();
        if (!nextStage) {
            throw new Error("No incomplete flows from the server");
        }
        this.currentStage = nextStage;

        if (nextStage === AuthType.Dummy) {
            this.submitAuthDict({
                type: "m.login.dummy",
            });
            return;
        }

        if (this.data?.errcode || this.data?.error) {
            this.stateUpdatedCallback(nextStage, {
                errcode: this.data?.errcode || "",
                error: this.data?.error || "",
            });
            return;
        }

        this.stateUpdatedCallback(nextStage, nextStage === EMAIL_STAGE_TYPE ? { emailSid: this.emailSid } : {});
    }

    /**
     * Pick the next auth stage
     *
     * @internal
     * @returns login type
     * @throws {@link NoAuthFlowFoundError} If no suitable authentication flow can be found
     */
    private chooseStage(): AuthType | string | undefined {
        if (this.chosenFlow === null) {
            this.chosenFlow = this.chooseFlow();
        }
        logger.log("Active flow => %s", JSON.stringify(this.chosenFlow));
        const nextStage = this.firstUncompletedStage(this.chosenFlow);
        logger.log("Next stage: %s", nextStage);
        return nextStage;
    }

    // Returns a low number for flows we consider best. Counts increase for longer flows and even more so
    // for flows which contain stages not listed in `supportedStages`.
    private scoreFlow(flow: UIAFlow): number {
        let score = flow.stages.length;
        if (this.supportedStages !== undefined) {
            // Add 10 points to the score for each unsupported stage in the flow.
            score += flow.stages.filter((stage) => !this.supportedStages!.has(stage)).length * 10;
        }
        return score;
    }

    /**
     * Pick one of the flows from the returned list
     * If a flow using all of the inputs is found, it will
     * be returned, otherwise, null will be returned.
     *
     * Only flows using all given inputs are chosen because it
     * is likely to be surprising if the user provides a
     * credential and it is not used. For example, for registration,
     * this could result in the email not being used which would leave
     * the account with no means to reset a password.
     *
     * @internal
     * @returns flow
     * @throws {@link NoAuthFlowFoundError} If no suitable authentication flow can be found
     */
    private chooseFlow(): UIAFlow {
        const flows = this.data.flows || [];

        // we've been given an email or we've already done an email part
        const haveEmail = Boolean(this.inputs.emailAddress) || Boolean(this.emailSid);
        const haveMsisdn = Boolean(this.inputs.phoneCountry) && Boolean(this.inputs.phoneNumber);

        // Flows are not represented in a significant order, so we can choose any we support best
        // Sort flows based on how many unsupported stages they contain ascending
        flows.sort((a, b) => this.scoreFlow(a) - this.scoreFlow(b));

        for (const flow of flows) {
            let flowHasEmail = false;
            let flowHasMsisdn = false;
            for (const stage of flow.stages) {
                if (stage === EMAIL_STAGE_TYPE) {
                    flowHasEmail = true;
                } else if (stage == MSISDN_STAGE_TYPE) {
                    flowHasMsisdn = true;
                }
            }

            if (flowHasEmail == haveEmail && flowHasMsisdn == haveMsisdn) {
                return flow;
            }
        }

        const requiredStages: string[] = [];
        if (haveEmail) requiredStages.push(EMAIL_STAGE_TYPE);
        if (haveMsisdn) requiredStages.push(MSISDN_STAGE_TYPE);
        // Throw an error with a fairly generic description, but with more
        // information such that the app can give a better one if so desired.
        throw new NoAuthFlowFoundError("No appropriate authentication flow found", requiredStages, flows);
    }

    /**
     * Get the first uncompleted stage in the given flow
     *
     * @internal
     * @returns login type
     */
    private firstUncompletedStage(flow: UIAFlow): AuthType | string | undefined {
        const completed = this.data.completed || [];
        return flow.stages.find((stageType) => !completed.includes(stageType));
    }
}
