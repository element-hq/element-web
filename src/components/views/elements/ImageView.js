/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React from 'react';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {formatDate} from '../../../DateUtils';
import { _t } from '../../../languageHandler';
import filesize from "filesize";
import AccessibleButton from "./AccessibleButton";
import Modal from "../../../Modal";
import * as sdk from "../../../index";
import {Key} from "../../../Keyboard";
import FocusLock from "react-focus-lock";

export default class ImageView extends React.Component {
    static propTypes = {
        src: PropTypes.string.isRequired, // the source of the image being displayed
        name: PropTypes.string, // the main title ('name') for the image
        link: PropTypes.string, // the link (if any) applied to the name of the image
        width: PropTypes.number, // width of the image src in pixels
        height: PropTypes.number, // height of the image src in pixels
        fileSize: PropTypes.number, // size of the image src in bytes
        onFinished: PropTypes.func.isRequired, // callback when the lightbox is dismissed

        // the event (if any) that the Image is displaying. Used for event-specific stuff like
        // redactions, senders, timestamps etc.  Other descriptors are taken from the explicit
        // properties above, which let us use lightboxes to display images which aren't associated
        // with events.
        mxEvent: PropTypes.object,
    };

    constructor(props) {
        super(props);
        this.state = {
            rotation: 0,
            zoom: 100,
            translationX: 0,
            translationY: 0,
            moving: false,
        };
    }

    initX = 0;
    initY = 0;
    lastX = 0;
    lastY = 0;
    minZoom = 100;
    maxZoom = 300;

    componentDidMount() {
        /* We have to use addEventListener() because the listener
         * needs to be passive in order to work with Chromium */
        this.focusLock.addEventListener('wheel', this.onWheel, { passive: false });
    }

    componentWillUnmount() {
        this.focusLock.removeEventListener('wheel', this.onWheel);
    }

    onKeyDown = (ev) => {
        if (ev.key === Key.ESCAPE) {
            ev.stopPropagation();
            ev.preventDefault();
            this.props.onFinished();
        }
    };

    onWheel = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const newZoom =this.state.zoom - ev.deltaY;

        if (newZoom <= this.minZoom) {
            this.setState({
                zoom: this.minZoom,
                translationX: 0,
                translationY: 0,
            });
            return;
        }
        if (newZoom >= this.maxZoom) {
            this.setState({zoom: this.maxZoom});
            return;
        }

        this.setState({
            zoom: newZoom,
        });
    }

    onRedactClick = () => {
        const ConfirmRedactDialog = sdk.getComponent("dialogs.ConfirmRedactDialog");
        Modal.createTrackedDialog('Confirm Redact Dialog', 'Image View', ConfirmRedactDialog, {
            onFinished: (proceed) => {
                if (!proceed) return;
                this.props.onFinished();
                MatrixClientPeg.get().redactEvent(
                    this.props.mxEvent.getRoomId(), this.props.mxEvent.getId(),
                ).catch(function(e) {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    // display error message stating you couldn't delete this.
                    const code = e.errcode || e.statusCode;
                    Modal.createTrackedDialog('You cannot delete this image.', '', ErrorDialog, {
                        title: _t('Error'),
                        description: _t('You cannot delete this image. (%(code)s)', {code: code}),
                    });
                });
            },
        });
    };

    getName() {
        let name = this.props.name;
        if (name && this.props.link) {
            name = <a href={ this.props.link } target="_blank" rel="noreferrer noopener">{ name }</a>;
        }
        return name;
    }

    onRotateCounterClockwiseClick = () => {
        const cur = this.state.rotation;
        const rotationDegrees = (cur - 90) % 360;
        this.setState({ rotation: rotationDegrees });
    };

    onRotateClockwiseClick = () => {
        const cur = this.state.rotation;
        const rotationDegrees = (cur + 90) % 360;
        this.setState({ rotation: rotationDegrees });
    };

    onZoomInClick = () => {
        if (this.state.zoom >= this.maxZoom) {
            this.setState({zoom: this.maxZoom});
            return;
        }

        this.setState({
            zoom: this.state.zoom + 10,
        });
    };

    onZoomOutClick = () => {
        if (this.state.zoom <= this.minZoom) {
            this.setState({
                zoom: this.minZoom,
                translationX: 0,
                translationY: 0,
            });
            return;
        }
        this.setState({
            zoom: this.state.zoom - 10,
        });
    }

    onZoomClick = () => {
        if (this.state.zoom <= this.minZoom) {
            this.setState({zoom: this.maxZoom});
        } else {
            this.setState({
                zoom: this.minZoom,
                translationX: 0,
                translationY: 0,
            });
        }
    }

    onStartMoving = ev => {
        ev.stopPropagation();
        ev.preventDefault();

        this.setState({moving: true});
        this.initX = ev.pageX - this.lastX;
        this.initY = ev.pageY - this.lastY;
    }

    onMoving = ev => {
        ev.stopPropagation();
        ev.preventDefault();

        if (!this.state.moving) return false;

        this.lastX = ev.pageX - this.initX;
        this.lastY = ev.pageY - this.initY;
        this.setState({
            translationX: this.lastX,
            translationY: this.lastY,
        });
    }

    onEndMoving = ev => {
        this.setState({moving: false});
    }

    render() {
        let mayRedact = false;
        const showEventMeta = !!this.props.mxEvent;

        let res;
        if (this.props.width && this.props.height) {
            res = this.props.width + "x" + this.props.height + "px";
        }

        let size;
        if (this.props.fileSize) {
            size = filesize(this.props.fileSize);
        }

        let sizeRes;
        if (size && res) {
            sizeRes = size + ", " + res;
        } else {
            sizeRes = size || res;
        }

        let metadata;
        if (showEventMeta) {
            // Figure out the sender, defaulting to mxid
            let sender = this.props.mxEvent.getSender();
            const cli = MatrixClientPeg.get();
            const room = cli.getRoom(this.props.mxEvent.getRoomId());
            if (room) {
                mayRedact = room.currentState.maySendRedactionForEvent(this.props.mxEvent, cli.credentials.userId);
                const member = room.getMember(sender);
                if (member) sender = member.name;
            }

            metadata = (<div className="mx_ImageView_metadata">
                { _t('Uploaded on %(date)s by %(user)s', {
                    date: formatDate(new Date(this.props.mxEvent.getTs())),
                    user: sender,
                }) }
            </div>);
        }

        let redactButton;
        if (mayRedact) {
            redactButton = (
                <AccessibleButton className="mx_ImageView_button" title={_t("Remove")} onClick={ this.onRedactClick }>
                    <img src={require("../../../../res/img/trash-red.svg")} alt={ _t('Remove') } width="18" height="18" />
                </AccessibleButton>
            );
        }

        const rotationDegrees = this.state.rotation + "deg";
        const zoomPercentage = this.state.zoom/100;
        const translatePixelsX = this.state.translationX + "px";
        const translatePixelsY = this.state.translationY + "px";
        /* The order of the values is important!
         * First, we translate and only then we rotate, otherwise
         * we would apply the translation to an already rotated
         * image causing it translate in the wrong direction. */
        const style = {
            transform: `translateX(${translatePixelsX})
                        translateY(${translatePixelsY})
                        scale(${zoomPercentage})
                        rotate(${rotationDegrees})`,
        };

        return (
            <FocusLock
                returnFocus={true}
                lockProps={{
                    onKeyDown: this.onKeyDown,
                    role: "dialog",
                }}
                className="mx_ImageView"
                ref={ref => this.focusLock = ref}
            >
                <div className="mx_ImageView_content">
                    <div className="mx_ImageView_panel mx_ImageView_label">
                        <div className="mx_ImageView_name">
                            { this.getName() }
                        </div>
                        <span className="mx_ImageView_size">{ sizeRes }</span>
                        { metadata }
                    </div>
                    <div className="mx_ImageView_panel mx_ImageView_toolbar">
                        { redactButton }
                        <AccessibleButton className="mx_ImageView_button" title={_t("Zoom")} onClick={ this.onZoomClick }>
                            <img src={require("../../../../res/img/zoom-white.svg")} alt={ _t('Zoom') } width="18" height="18" />
                        </AccessibleButton>
                        <AccessibleButton className="mx_ImageView_button" title={_t("Zoom out")} onClick={ this.onZoomOutClick }>
                            <img src={require("../../../../res/img/minus-white.svg")} alt={ _t('Zoom out') } width="18" height="18" />
                        </AccessibleButton>
                        <AccessibleButton className="mx_ImageView_button" title={_t("Zoom in")} onClick={ this.onZoomInClick }>
                            <img src={require("../../../../res/img/plus-white.svg")} alt={ _t('Zoom in') } width="18" height="18" />
                        </AccessibleButton>
                        <AccessibleButton className="mx_ImageView_button" title={_t("Rotate Left")} onClick={ this.onRotateCounterClockwiseClick }>
                            <img src={require("../../../../res/img/rotate-ccw.svg")} alt={ _t('Rotate counter-clockwise') } width="18" height="18" />
                        </AccessibleButton>
                        <AccessibleButton className="mx_ImageView_button" title={_t("Rotate Right")} onClick={ this.onRotateClockwiseClick }>
                            <img src={require("../../../../res/img/rotate-cw.svg")} alt={ _t('Rotate clockwise') } width="18" height="18" />
                        </AccessibleButton>
                        <a className="mx_ImageView_button" href={ this.props.src } download={ this.props.name } title={_t("Download")} target="_blank" rel="noopener">
                            <img src={require("../../../../res/img/download-white.svg")} width="18" height="18" alt={ _t('Download') } />
                        </a>
                        <AccessibleButton className="mx_ImageView_button" title={_t("Close")} onClick={ this.props.onFinished }>
                            <img src={require("../../../../res/img/cancel-white.svg")} width="18" height="18" alt={ _t('Close') } />
                        </AccessibleButton>
                    </div>
                    <img
                        src={this.props.src}
                        title={this.props.name}
                        style={style}
                        className="mainImage"
                        draggable={true}
                        onMouseDown={this.onStartMoving}
                        onMouseMove={this.onMoving}
                        onMouseUp={this.onEndMoving}
                        onMouseLeave={this.onEndMoving}
                    />
                </div>
            </FocusLock>
        );
    }
}
