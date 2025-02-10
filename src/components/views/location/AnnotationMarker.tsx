import React, { ReactNode, useState } from "react";
import classNames from "classnames";
import LocationIcon from "@vector-im/compound-design-tokens/assets/web/icons/location-pin-solid";




/**
 * Wrap with tooltip handlers when
 * tooltip is truthy
 */
const OptionalTooltip: React.FC<{
    tooltip?: React.ReactNode;
    annotationKey: string;
    children: React.ReactNode;
    onDelete: (key: string) => void; // Optional delete function
}> = ({ tooltip, children, onDelete, annotationKey }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ position: "relative" }} // Set position for proper tooltip alignment
        >
            {tooltip && (
                <div style={{ display: "flex", alignItems: "center" }}>
                    {tooltip}
                    {isHovered && (
                        <button
                            onClick={() => onDelete(annotationKey)}
                            style={{
                                marginLeft: "8px", // Space between tooltip and button
                                backgroundColor: "red", // Customize button style
                                color: "white",
                                border: "none",
                                borderRadius: "3px",
                                cursor: "pointer"
                            }}
                        >
                            X
                        </button>
                    )}
                </div>
            )}
            {children}
        </div>
    );
};

/**
 * Generic location marker
 */

interface Props {
    id: string;
    useColor?: string;
    tooltip?: ReactNode;
    onDelete: (annotationKey: string) => void;
}

const AnnotationMarker = React.forwardRef<HTMLDivElement, Props>(({ id, useColor, tooltip, onDelete}, ref) => {
    return (
        <div
            ref={ref}
            id={id}
            className={classNames("mx_Marker", useColor ? `mx_Marker_${useColor}` : "mx_Marker_defaultColor" )}
        >
            <OptionalTooltip tooltip={tooltip} annotationKey={id} onDelete={onDelete}>
                <div className="mx_AnnotationMarker_border">
                    <LocationIcon className="mx_Marker_icon" />
                </div>
            </OptionalTooltip>
        </div>
    );
});

export default AnnotationMarker;