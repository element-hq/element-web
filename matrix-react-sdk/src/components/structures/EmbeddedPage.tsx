/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd

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

import React from "react";
import sanitizeHtml from "sanitize-html";
import classnames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../languageHandler";
import dis from "../../dispatcher/dispatcher";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import AutoHideScrollbar from "./AutoHideScrollbar";
import { ActionPayload } from "../../dispatcher/payloads";

interface IProps {
    // URL to request embedded page content from
    url?: string;
    // Class name prefix to apply for a given instance
    className?: string;
    // Whether to wrap the page in a scrollbar
    scrollbar?: boolean;
    // Map of keys to replace with values, e.g {$placeholder: "value"}
    replaceMap?: Record<string, string>;
}

interface IState {
    page: string;
}

export default class EmbeddedPage extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    private unmounted = false;
    private dispatcherRef: string | null = null;

    public constructor(props: IProps, context: typeof MatrixClientContext) {
        super(props, context);

        this.state = {
            page: "",
        };
    }

    private translate(s: string): string {
        return sanitizeHtml(_t(s));
    }

    private async fetchEmbed(): Promise<void> {
        let res: Response;

        try {
            res = await fetch(this.props.url!, { method: "GET" });
        } catch (err) {
            if (this.unmounted) return;
            logger.warn(`Error loading page: ${err}`);
            this.setState({ page: _t("Couldn't load page") });
            return;
        }

        if (this.unmounted) return;

        if (!res.ok) {
            logger.warn(`Error loading page: ${res.status}`);
            this.setState({ page: _t("Couldn't load page") });
            return;
        }

        let body = (await res.text()).replace(/_t\(['"]([\s\S]*?)['"]\)/gm, (match, g1) => this.translate(g1));

        if (this.props.replaceMap) {
            Object.keys(this.props.replaceMap).forEach((key) => {
                body = body.split(key).join(this.props.replaceMap![key]);
            });
        }

        this.setState({ page: body });
    }

    public componentDidMount(): void {
        this.unmounted = false;

        if (!this.props.url) {
            return;
        }

        // We use fetch to inline the page into the react component
        // so that it can inherit CSS and theming easily rather than mess around
        // with iframes and trying to synchronise document.stylesheets.
        this.fetchEmbed();

        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        if (this.dispatcherRef !== null) dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        // HACK: Workaround for the context's MatrixClient not being set up at render time.
        if (payload.action === "client_started") {
            this.forceUpdate();
        }
    };

    public render(): React.ReactNode {
        // HACK: Workaround for the context's MatrixClient not updating.
        const client = this.context || MatrixClientPeg.get();
        const isGuest = client ? client.isGuest() : true;
        const className = this.props.className;
        const classes = classnames(className, {
            [`${className}_guest`]: isGuest,
            [`${className}_loggedIn`]: !!client,
        });

        const content = <div className={`${className}_body`} dangerouslySetInnerHTML={{ __html: this.state.page }} />;

        if (this.props.scrollbar) {
            return <AutoHideScrollbar className={classes}>{content}</AutoHideScrollbar>;
        } else {
            return <div className={classes}>{content}</div>;
        }
    }
}
