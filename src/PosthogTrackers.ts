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

import { PureComponent, SyntheticEvent } from "react";
import { WebScreen as ScreenEvent } from "@matrix-org/analytics-events/types/typescript/WebScreen";
import { Interaction as InteractionEvent } from "@matrix-org/analytics-events/types/typescript/Interaction";

import PageType from "./PageTypes";
import Views from "./Views";
import { PosthogAnalytics } from "./PosthogAnalytics";

export type ScreenName = ScreenEvent["$current_url"];
export type InteractionName = InteractionEvent["name"];

const notLoggedInMap: Record<Exclude<Views, Views.LOGGED_IN>, ScreenName> = {
    [Views.LOADING]: "Loading",
    [Views.WELCOME]: "Welcome",
    [Views.LOGIN]: "Login",
    [Views.REGISTER]: "Register",
    [Views.USE_CASE_SELECTION]: "UseCaseSelection",
    [Views.FORGOT_PASSWORD]: "ForgotPassword",
    [Views.COMPLETE_SECURITY]: "CompleteSecurity",
    [Views.E2E_SETUP]: "E2ESetup",
    [Views.SOFT_LOGOUT]: "SoftLogout",
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

    public static trackInteraction(name: InteractionName, ev?: SyntheticEvent, index?: number): void {
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
