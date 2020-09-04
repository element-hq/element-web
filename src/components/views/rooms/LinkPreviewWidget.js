/*
Copyright 2016 OpenMarket Ltd
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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import { AllHtmlEntities } from 'html-entities';
import {linkifyElement} from '../../../HtmlUtils';
import SettingsStore from "../../../settings/SettingsStore";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import * as sdk from "../../../index";
import Modal from "../../../Modal";
import * as ImageUtils from "../../../ImageUtils";
import { _t } from "../../../languageHandler";

export default class LinkPreviewWidget extends React.Component {
    static propTypes = {
        link: PropTypes.string.isRequired, // the URL being previewed
        mxEvent: PropTypes.object.isRequired, // the Event associated with the preview
        onCancelClick: PropTypes.func, // called when the preview's cancel ('hide') button is clicked
        onHeightChanged: PropTypes.func, // called when the preview's contents has loaded
    };

    constructor(props) {
        super(props);

        this.state = {
            preview: null,
        };

        this.unmounted = false;
        MatrixClientPeg.get().getUrlPreview(this.props.link, this.props.mxEvent.getTs()).then((res)=>{
            if (this.unmounted) {
                return;
            }
            this.setState(
                { preview: res },
                this.props.onHeightChanged,
            );
        }, (error)=>{
            console.error("Failed to get URL preview: " + error);
        });

        this._description = createRef();
    }

    componentDidMount() {
        if (this._description.current) {
            linkifyElement(this._description.current);
        }
    }

    componentDidUpdate() {
        if (this._description.current) {
            linkifyElement(this._description.current);
        }
    }

    componentWillUnmount() {
        this.unmounted = true;
    }

    onImageClick = ev => {
        const p = this.state.preview;
        if (ev.button != 0 || ev.metaKey) return;
        ev.preventDefault();
        const ImageView = sdk.getComponent("elements.ImageView");

        let src = p["og:image"];
        if (src && src.startsWith("mxc://")) {
            src = MatrixClientPeg.get().mxcUrlToHttp(src);
        }

        const params = {
            src: src,
            width: p["og:image:width"],
            height: p["og:image:height"],
            name: p["og:title"] || p["og:description"] || this.props.link,
            fileSize: p["matrix:image:size"],
            link: this.props.link,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    };

    render() {
        const p = this.state.preview;
        if (!p || Object.keys(p).length === 0) {
            return <div />;
        }

        // FIXME: do we want to factor out all image displaying between this and MImageBody - especially for lightboxing?
        let image = p["og:image"];
        if (!SettingsStore.getValue("showImages")) {
            image = null; // Don't render a button to show the image, just hide it outright
        }
        const imageMaxWidth = 100; const imageMaxHeight = 100;
        if (image && image.startsWith("mxc://")) {
            image = MatrixClientPeg.get().mxcUrlToHttp(image, imageMaxWidth, imageMaxHeight);
        }

        let thumbHeight = imageMaxHeight;
        if (p["og:image:width"] && p["og:image:height"]) {
            thumbHeight = ImageUtils.thumbHeight(p["og:image:width"], p["og:image:height"], imageMaxWidth, imageMaxHeight);
        }

        let img;
        if (image) {
            img = <div className="mx_LinkPreviewWidget_image" style={{ height: thumbHeight }}>
                    <img style={{ maxWidth: imageMaxWidth, maxHeight: imageMaxHeight }} src={image} onClick={this.onImageClick} />
                  </div>;
        }

        // The description includes &-encoded HTML entities, we decode those as React treats the thing as an
        // opaque string. This does not allow any HTML to be injected into the DOM.
        const description = AllHtmlEntities.decode(p["og:description"] || "");

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (
            <div className="mx_LinkPreviewWidget">
                { img }
                <div className="mx_LinkPreviewWidget_caption">
                    <div className="mx_LinkPreviewWidget_title"><a href={this.props.link} target="_blank" rel="noreferrer noopener">{ p["og:title"] }</a></div>
                    <div className="mx_LinkPreviewWidget_siteName">{ p["og:site_name"] ? (" - " + p["og:site_name"]) : null }</div>
                    <div className="mx_LinkPreviewWidget_description" ref={this._description}>
                        { description }
                    </div>
                </div>
                <AccessibleButton className="mx_LinkPreviewWidget_cancel" onClick={this.props.onCancelClick} aria-label={_t("Close preview")}>
                    <img className="mx_filterFlipColor" alt="" role="presentation"
                        src={require("../../../../res/img/cancel.svg")} width="18" height="18" />
                </AccessibleButton>
            </div>
        );
    }
}
