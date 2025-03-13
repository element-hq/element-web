/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PureComponent, type SyntheticEvent } from "react";
import { type WebScreen as ScreenEvent } from "@matrix-org/analytics-events/types/typescript/WebScreen";
import { type Interaction as InteractionEvent } from "@matrix-org/analytics-events/types/typescript/Interaction";
import { type PinUnpinAction } from "@matrix-org/analytics-events/types/typescript/PinUnpinAction";

import PageType from "./PageTypes";
import Views from "./Views";
import { PosthogAnalytics } from "./PosthogAnalytics";

export type ScreenName = ScreenEvent["$current_url"];
export type InteractionName = InteractionEvent["name"];

const notLoggedInMap: Record<Exclude<Views, Views.LOGGED_IN>, ScreenName> = {
    [Views.LOADING]: "Loading",
    [Views.CONFIRM_LOCK_THEFT]: "ConfirmStartup",
    [Views.WELCOME]: "Welcome",
    [Views.LOGIN]: "Login",
    [Views.REGISTER]: "Register",
    [Views.FORGOT_PASSWORD]: "ForgotPassword",
    [Views.COMPLETE_SECURITY]: "CompleteSecurity",
    [Views.E2E_SETUP]: "E2ESetup",
    [Views.SOFT_LOGOUT]: "SoftLogout",
    [Views.LOCK_STOLEN]: "SessionLockStolen",
};

const loggedInPageTypeMap: Record<PageType, ScreenName> = {
    [PageType.HomePage]: "Home",
    [PageType.RoomView]: "Room",
    [PageType.UserView]: "User",
};

export default class PosthogTrackers {
    private static internalInstance: PosthogTrackers;

    public static get instance(): PosthogTrackers {
        if (!PosthogTrackers.internalInstance) {
            PosthogTrackers.internalInstance = new PosthogTrackers();
        }
        return PosthogTrackers.internalInstance;
    }

    private view: Views = Views.LOADING;
    private pageType?: PageType;
    private override?: ScreenName;

    public trackPageChange(view: Views, pageType: PageType | undefined, durationMs: number): void {
        this.view = view;
        this.pageType = pageType;
        if (this.override) return;
        this.trackPage(durationMs);
    }

    private trackPage(durationMs?: number): void {
        const screenName =
            this.view === Views.LOGGED_IN ? loggedInPageTypeMap[this.pageType!] : notLoggedInMap[this.view];
        PosthogAnalytics.instance.trackEvent<ScreenEvent>({
            eventName: "$pageview",
            $current_url: screenName,
            durationMs,
        });
    }

    public trackOverride(screenName: ScreenName): void {
        if (!screenName) return;
        this.override = screenName;
        PosthogAnalytics.instance.trackEvent<ScreenEvent>({
            eventName: "$pageview",
            $current_url: screenName,
        });
    }

    public clearOverride(screenName: ScreenName): void {
        if (screenName !== this.override) return;
        this.override = undefined;
        this.trackPage();
    }

    public static trackInteraction(name: InteractionName, ev?: SyntheticEvent | Event, index?: number): void {
        let interactionType: InteractionEvent["interactionType"];
        if (ev?.type === "click") {
            interactionType = "Pointer";
        } else if (ev?.type.startsWith("key")) {
            interactionType = "Keyboard";
        }

        PosthogAnalytics.instance.trackEvent<InteractionEvent>({
            eventName: "Interaction",
            interactionType,
            index,
            name,
        });
    }

    /**
     * Track a pin or unpin action on a message.
     * @param kind - Is pin or unpin.
     * @param from - From where the action is triggered.
     */
    public static trackPinUnpinMessage(kind: PinUnpinAction["kind"], from: PinUnpinAction["from"]): void {
        PosthogAnalytics.instance.trackEvent<PinUnpinAction>({
            eventName: "PinUnpinAction",
            kind,
            from,
        });
    }
}

export class PosthogScreenTracker extends PureComponent<{ screenName: ScreenName }> {
    public componentDidMount(): void {
        PosthogTrackers.instance.trackOverride(this.props.screenName);
    }

    public componentDidUpdate(): void {
        // We do not clear the old override here so that we do not send the non-override screen as a transition
        PosthogTrackers.instance.trackOverride(this.props.screenName);
    }

    public componentWillUnmount(): void {
        PosthogTrackers.instance.clearOverride(this.props.screenName);
    }

    public render(): React.ReactNode {
        return null; // no need to render anything, we just need to hook into the React lifecycle
    }
}
