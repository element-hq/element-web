/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { decode } from "blurhash";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import InlineSpinner from "../elements/InlineSpinner";
import { mediaFromContent } from "../../../customisations/Media";
import { BLURHASH_FIELD } from "../../../utils/image-media";
import { type IBodyProps } from "./IBodyProps";
import MFileBody from "./MFileBody";
import { type ImageSize, suggestedSize as suggestedVideoSize } from "../../../settings/enums/ImageSize";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import MediaProcessingError from "./shared/MediaProcessingError";

interface IState {
    decryptedUrl: string | null;
    decryptedThumbnailUrl: string | null;
    decryptedBlob: Blob | null;
    error?: any;
    fetchingData: boolean;
    posterLoading: boolean;
    blurhashUrl: string | null;
}

export default class MVideoBody extends React.PureComponent<IBodyProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private videoRef = React.createRef<HTMLVideoElement>();
    private sizeWatcher?: string;

    public state = {
        fetchingData: false,
        decryptedUrl: null,
        decryptedThumbnailUrl: null,
        decryptedBlob: null,
        error: null,
        posterLoading: false,
        blurhashUrl: null,
    };

    private getContentUrl(): string | undefined {
        const content = this.props.mxEvent.getContent<MediaEventContent>();
        // During export, the content url will point to the MSC, which will later point to a local url
        if (this.props.forExport) return content.file?.url ?? content.url;
        const media = mediaFromContent(content);
        if (media.isEncrypted) {
            return this.state.decryptedUrl ?? undefined;
        } else {
            return media.srcHttp ?? undefined;
        }
    }

    private hasContentUrl(): boolean {
        const url = this.getContentUrl();
        return !!url && !url.startsWith("data:");
    }

    private getThumbUrl(): string | null {
        // there's no need of thumbnail when the content is local
        if (this.props.forExport) return null;

        const content = this.props.mxEvent.getContent<MediaEventContent>();
        const media = mediaFromContent(content);

        if (media.isEncrypted && this.state.decryptedThumbnailUrl) {
            return this.state.decryptedThumbnailUrl;
        } else if (this.state.posterLoading) {
            return this.state.blurhashUrl;
        } else if (media.hasThumbnail) {
            return media.thumbnailHttp;
        } else {
            return null;
        }
    }

    private loadBlurhash(): void {
        const info = this.props.mxEvent.getContent()?.info;
        if (!info[BLURHASH_FIELD]) return;

        const canvas = document.createElement("canvas");

        const { w: width, h: height } = suggestedVideoSize(SettingsStore.getValue("Images.size") as ImageSize, {
            w: info.w,
            h: info.h,
        });

        canvas.width = width;
        canvas.height = height;

        const pixels = decode(info[BLURHASH_FIELD], width, height);
        const ctx = canvas.getContext("2d")!;
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(pixels);
        ctx.putImageData(imgData, 0, 0);

        this.setState({
            blurhashUrl: canvas.toDataURL(),
            posterLoading: true,
        });

        const content = this.props.mxEvent.getContent<MediaEventContent>();
        const media = mediaFromContent(content);
        if (media.hasThumbnail) {
            const image = new Image();
            image.onload = () => {
                this.setState({ posterLoading: false });
            };
            image.src = media.thumbnailHttp!;
        }
    }

    public async componentDidMount(): Promise<void> {
        this.sizeWatcher = SettingsStore.watchSetting("Images.size", null, () => {
            this.forceUpdate(); // we don't really have a reliable thing to update, so just update the whole thing
        });

        try {
            this.loadBlurhash();
        } catch (e) {
            logger.error("Failed to load blurhash", e);
        }

        if (this.props.mediaEventHelper?.media.isEncrypted && this.state.decryptedUrl === null) {
            try {
                const autoplay = SettingsStore.getValue("autoplayVideo") as boolean;
                const thumbnailUrl = await this.props.mediaEventHelper.thumbnailUrl.value;
                if (autoplay) {
                    logger.log("Preloading video");
                    this.setState({
                        decryptedUrl: await this.props.mediaEventHelper.sourceUrl.value,
                        decryptedThumbnailUrl: thumbnailUrl,
                        decryptedBlob: await this.props.mediaEventHelper.sourceBlob.value,
                    });
                    this.props.onHeightChanged?.();
                } else {
                    logger.log("NOT preloading video");
                    const content = this.props.mxEvent.getContent<MediaEventContent>();

                    let mimetype = content?.info?.mimetype;

                    // clobber quicktime muxed files to be considered MP4 so browsers
                    // are willing to play them
                    if (mimetype == "video/quicktime") {
                        mimetype = "video/mp4";
                    }

                    this.setState({
                        // For Chrome and Electron, we need to set some non-empty `src` to
                        // enable the play button. Firefox does not seem to care either
                        // way, so it's fine to do for all browsers.
                        decryptedUrl: `data:${mimetype},`,
                        decryptedThumbnailUrl: thumbnailUrl || `data:${mimetype},`,
                        decryptedBlob: null,
                    });
                }
            } catch (err) {
                logger.warn("Unable to decrypt attachment: ", err);
                // Set a placeholder image when we can't decrypt the image.
                this.setState({
                    error: err,
                });
            }
        }
    }

    public componentWillUnmount(): void {
        SettingsStore.unwatchSetting(this.sizeWatcher);
    }

    private videoOnPlay = async (): Promise<void> => {
        if (this.hasContentUrl() || this.state.fetchingData || this.state.error) {
            // We have the file, we are fetching the file, or there is an error.
            return;
        }
        this.setState({
            // To stop subsequent download attempts
            fetchingData: true,
        });
        if (!this.props.mediaEventHelper!.media.isEncrypted) {
            this.setState({
                error: "No file given in content",
            });
            return;
        }
        this.setState(
            {
                decryptedUrl: await this.props.mediaEventHelper!.sourceUrl.value,
                decryptedBlob: await this.props.mediaEventHelper!.sourceBlob.value,
                fetchingData: false,
            },
            () => {
                if (!this.videoRef.current) return;
                this.videoRef.current.play();
            },
        );
        this.props.onHeightChanged?.();
    };

    protected get showFileBody(): boolean {
        return (
            this.context.timelineRenderingType !== TimelineRenderingType.Room &&
            this.context.timelineRenderingType !== TimelineRenderingType.Pinned &&
            this.context.timelineRenderingType !== TimelineRenderingType.Search
        );
    }

    private getFileBody = (): ReactNode => {
        if (this.props.forExport) return null;
        return this.showFileBody && <MFileBody {...this.props} showGenericPlaceholder={false} />;
    };

    public render(): React.ReactNode {
        const content = this.props.mxEvent.getContent();
        const autoplay = !this.props.inhibitInteraction && SettingsStore.getValue("autoplayVideo");

        let aspectRatio;
        if (content.info?.w && content.info?.h) {
            aspectRatio = `${content.info.w}/${content.info.h}`;
        }
        const { w: maxWidth, h: maxHeight } = suggestedVideoSize(SettingsStore.getValue("Images.size") as ImageSize, {
            w: content.info?.w,
            h: content.info?.h,
        });

        // HACK: This div fills out space while the video loads, to prevent scroll jumps
        const spaceFiller = <div style={{ width: maxWidth, height: maxHeight }} />;

        if (this.state.error !== null) {
            return (
                <MediaProcessingError className="mx_MVideoBody">
                    {_t("timeline|m.video|error_decrypting")}
                </MediaProcessingError>
            );
        }

        // Important: If we aren't autoplaying and we haven't decrypted it yet, show a video with a poster.
        if (!this.props.forExport && content.file !== undefined && this.state.decryptedUrl === null && autoplay) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now show a spinner.
            return (
                <span className="mx_MVideoBody">
                    <div className="mx_MVideoBody_container" style={{ maxWidth, maxHeight, aspectRatio }}>
                        <InlineSpinner />
                    </div>
                    {spaceFiller}
                </span>
            );
        }

        const contentUrl = this.getContentUrl();
        const thumbUrl = this.getThumbUrl();
        let poster: string | undefined;
        let preload = "metadata";
        if (content.info && thumbUrl) {
            poster = thumbUrl;
            preload = "none";
        }

        const fileBody = this.getFileBody();
        return (
            <span className="mx_MVideoBody">
                <div className="mx_MVideoBody_container" style={{ maxWidth, maxHeight, aspectRatio }}>
                    <video
                        className="mx_MVideoBody"
                        ref={this.videoRef}
                        src={contentUrl}
                        title={content.body}
                        controls={!this.props.inhibitInteraction}
                        // Disable downloading as it doesn't work with e2ee video,
                        // users should use the dedicated Download button in the Message Action Bar
                        controlsList="nodownload"
                        preload={preload}
                        muted={autoplay}
                        autoPlay={autoplay}
                        poster={poster}
                        onPlay={this.videoOnPlay}
                    />
                    {spaceFiller}
                </div>
                {fileBody}
            </span>
        );
    }
}
