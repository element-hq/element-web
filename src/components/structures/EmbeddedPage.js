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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import request from 'browser-request';
import { _t } from '../../languageHandler';
import sanitizeHtml from 'sanitize-html';
import dis from '../../dispatcher/dispatcher';
import {MatrixClientPeg} from '../../MatrixClientPeg';
import classnames from 'classnames';
import MatrixClientContext from "../../contexts/MatrixClientContext";
import AutoHideScrollbar from "./AutoHideScrollbar";

export default class EmbeddedPage extends React.PureComponent {
    static propTypes = {
        // URL to request embedded page content from
        url: PropTypes.string,
        // Class name prefix to apply for a given instance
        className: PropTypes.string,
        // Whether to wrap the page in a scrollbar
        scrollbar: PropTypes.bool,
        // Map of keys to replace with values, e.g {$placeholder: "value"}
        replaceMap: PropTypes.object,
    };

    static contextType = MatrixClientContext;

    constructor(props) {
        super(props);

        this._dispatcherRef = null;

        this.state = {
            page: '',
        };
    }

    translate(s) {
        // default implementation - skins may wish to extend this
        return sanitizeHtml(_t(s));
    }

    componentDidMount() {
        this._unmounted = false;

        if (!this.props.url) {
            return;
        }

        // we use request() to inline the page into the react component
        // so that it can inherit CSS and theming easily rather than mess around
        // with iframes and trying to synchronise document.stylesheets.

        request(
            { method: "GET", url: this.props.url },
            (err, response, body) => {
                if (this._unmounted) {
                    return;
                }

                if (err || response.status < 200 || response.status >= 300) {
                    console.warn(`Error loading page: ${err}`);
                    this.setState({ page: _t("Couldn't load page") });
                    return;
                }

                body = body.replace(/_t\(['"]([\s\S]*?)['"]\)/mg, (match, g1)=>this.translate(g1));

                if (this.props.replaceMap) {
                    Object.keys(this.props.replaceMap).forEach(key => {
                        body = body.split(key).join(this.props.replaceMap[key]);
                    });
                }

                this.setState({ page: body });
            },
        );

        this._dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount() {
        this._unmounted = true;
        if (this._dispatcherRef !== null) dis.unregister(this._dispatcherRef);
    }

    onAction = (payload) => {
        // HACK: Workaround for the context's MatrixClient not being set up at render time.
        if (payload.action === 'client_started') {
            this.forceUpdate();
        }
    };

    render() {
        // HACK: Workaround for the context's MatrixClient not updating.
        const client = this.context || MatrixClientPeg.get();
        const isGuest = client ? client.isGuest() : true;
        const className = this.props.className;
        const classes = classnames({
            [className]: true,
            [`${className}_guest`]: isGuest,
            [`${className}_loggedIn`]: !!client,
        });

        const content = <div className={`${className}_body`}
            dangerouslySetInnerHTML={{ __html: this.state.page }}
        >
        </div>;

        if (this.props.scrollbar) {
            return <AutoHideScrollbar className={classes}>
                {content}
            </AutoHideScrollbar>;
        } else {
            return <div className={classes}>
                {content}
            </div>;
        }
    }
}
