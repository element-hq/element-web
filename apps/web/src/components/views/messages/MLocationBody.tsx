/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo, useRef, useState, useEffect } from "react";
import { type MatrixEvent, ClientEvent, type ClientEventHandlerMap } from "matrix-js-sdk/src/matrix";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import {
    hide,
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    arrow,
    useHover,
    useFocus,
    useDismiss,
    useRole,
    useInteractions,
    FloatingPortal,
    FloatingArrow,
} from "@floating-ui/react";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import {
    locationEventGeoUri,
    getLocationShareErrorMessage,
    LocationShareError,
    isSelfLocation,
} from "../../../utils/location";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { SmartMarker, Map, LocationViewDialog } from "../location";
import { type IBodyProps } from "./IBodyProps";
import { createReconnectedListener } from "../../../utils/connection";

interface IState {
    error?: Error;
}

export default class MLocationBody extends React.Component<IBodyProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    private unmounted = false;
    private mapId: string;
    private reconnectedListener: ClientEventHandlerMap[ClientEvent.Sync];

    public constructor(props: IBodyProps) {
        super(props);

        // multiple instances of same map might be in document
        // eg thread and main timeline, reply
        const idSuffix = `${props.mxEvent.getId()}_${secureRandomString(8)}`;
        this.mapId = `mx_MLocationBody_${idSuffix}`;

        this.reconnectedListener = createReconnectedListener(this.clearError);

        this.state = {};
    }

    private onClick = (): void => {
        Modal.createDialog(
            LocationViewDialog,
            {
                matrixClient: this.context,
                mxEvent: this.props.mxEvent,
            },
            "mx_LocationViewDialog_wrapper",
            false, // isPriority
            true, // isStatic
        );
    };

    private clearError = (): void => {
        this.context.off(ClientEvent.Sync, this.reconnectedListener);
        this.setState({ error: undefined });
    };

    private onError = (error: Error): void => {
        if (this.unmounted) return;
        this.setState({ error });
        // Unregister first in case we already had it registered
        this.context.off(ClientEvent.Sync, this.reconnectedListener);
        this.context.on(ClientEvent.Sync, this.reconnectedListener);
    };

    public componentDidMount(): void {
        this.unmounted = false;
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        this.context.off(ClientEvent.Sync, this.reconnectedListener);
    }

    public render(): React.ReactElement<HTMLDivElement> {
        return this.state.error ? (
            <LocationBodyFallbackContent error={this.state.error} event={this.props.mxEvent} />
        ) : (
            <LocationBodyContent
                mxEvent={this.props.mxEvent}
                mapId={this.mapId}
                onError={this.onError}
                tooltip={_t("location_sharing|expand_map")}
                onClick={this.onClick}
            />
        );
    }
}

export const LocationBodyFallbackContent: React.FC<{ event: MatrixEvent; error: Error }> = ({ error, event }) => {
    const errorType = error?.message as LocationShareError;
    const message = `${_t("location_sharing|failed_load_map")}: ${getLocationShareErrorMessage(errorType)}`;

    const locationFallback = isSelfLocation(event.getContent())
        ? _t("timeline|m.location|self_location") + event.getContent()?.body
        : _t("timeline|m.location|location") + event.getContent()?.body;

    return (
        <div className="mx_EventTile_body mx_MLocationBody">
            <span className={errorType !== LocationShareError.MapStyleUrlNotConfigured ? "mx_EventTile_tileError" : ""}>
                {message}
            </span>
            <br />
            {locationFallback}
        </div>
    );
};

const BoundaryAwareTooltip: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const arrowRef = useRef<SVGSVGElement>(null);
    const [boundaryEl, setBoundaryEl] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setBoundaryEl(document.querySelector(".mx_RoomView_messagePanel"));
    }, []);

    const middleware = useMemo(
        () => [
            offset(6),
            flip({
                boundary: boundaryEl ? [boundaryEl] : undefined,
                fallbackAxisSideDirection: "start",
                padding: 5,
            }),
            shift({ padding: 5 }),
            hide({ strategy: "escaped", padding: 6, boundary: boundaryEl ? [boundaryEl] : undefined }),
            arrow({ element: arrowRef }),
        ],
        [boundaryEl],
    );

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom",
        middleware,
        whileElementsMounted: autoUpdate,
    });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        useHover(context, { move: false, delay: { open: 300, close: 0 }, mouseOnly: true }),
        useFocus(context),
        useDismiss(context),
        useRole(context, { role: "tooltip" }),
    ]);

    const escaped = context.middlewareData?.hide?.escaped ?? false;

    return (
        <>
            {React.cloneElement(children, getReferenceProps({ ref: refs.setReference }))}
            <FloatingPortal>
                {isOpen && (
                    <div
                        ref={refs.setFloating}
                        style={{
                            ...floatingStyles,
                            font: "var(--cpd-font-body-xs-medium)",
                            padding: "var(--cpd-space-1-5x) var(--cpd-space-3x)",
                            background: "var(--cpd-color-alpha-gray-1400)",
                            color: "var(--cpd-color-text-on-solid-primary)",
                            borderRadius: 4,
                            cursor: "pointer",
                            ...(escaped ? { visibility: "hidden" as const } : {}),
                        }}
                        {...getFloatingProps()}
                    >
                        <FloatingArrow
                            ref={arrowRef}
                            context={context}
                            width={10}
                            height={6}
                            style={{ fill: "var(--cpd-color-alpha-gray-1400)" }}
                        />
                        {label}
                    </div>
                )}
            </FloatingPortal>
        </>
    );
};

interface LocationBodyContentProps {
    mxEvent: MatrixEvent;
    mapId: string;
    tooltip: string;
    onError: (error: Error) => void;
    onClick?: () => void;
}
export const LocationBodyContent: React.FC<LocationBodyContentProps> = ({
    mxEvent,
    mapId,
    tooltip,
    onError,
    onClick,
}) => {
    // only pass member to marker when should render avatar marker
    const markerRoomMember = isSelfLocation(mxEvent.getContent()) ? mxEvent.sender : undefined;
    const geoUri = locationEventGeoUri(mxEvent);

    const mapElement = (
        <Map id={mapId} centerGeoUri={geoUri} onClick={onClick} onError={onError} className="mx_MLocationBody_map">
            {({ map }) => (
                <SmartMarker
                    map={map}
                    id={`${mapId}-marker`}
                    geoUri={geoUri}
                    roomMember={markerRoomMember ?? undefined}
                />
            )}
        </Map>
    );

    return (
        <div className="mx_MLocationBody">
            <BoundaryAwareTooltip label={tooltip}>
                <div className="mx_MLocationBody_map">{mapElement}</div>
            </BoundaryAwareTooltip>
        </div>
    );
};
