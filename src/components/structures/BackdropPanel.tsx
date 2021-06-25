import React, { createRef } from "react";
import "context-filter-polyfill";

interface IProps {
    width?: number;
    height?: number;
    backgroundImage?: CanvasImageSource;
    blur?: string;
}


export default class BackdropPanel extends React.PureComponent<IProps> {
    private canvasRef: React.RefObject<HTMLCanvasElement> = createRef();
    private ctx: CanvasRenderingContext2D;

    static defaultProps = {
        blur: "60px",
    }

    public componentDidMount() {
        this.ctx = this.canvasRef.current.getContext("2d");
    }

    public componentDidUpdate() {
        if (this.props.backgroundImage) {
            requestAnimationFrame(this.refreshBackdropImage);
        }
    }

    private refreshBackdropImage = (): void => {
        const { width, height, backgroundImage } = this.props;
        this.canvasRef.current.width = width;
        this.canvasRef.current.height = height;

        const imageWidth = (backgroundImage as ImageBitmap).width
            || (backgroundImage as HTMLImageElement).naturalWidth;
        const imageHeight = (backgroundImage as ImageBitmap).height
                || (backgroundImage as HTMLImageElement).naturalHeight;

        const destinationX = width - imageWidth;
        const destinationY = height - imageHeight;

        this.ctx.filter = `blur(${this.props.blur})`;
        this.ctx.drawImage(
            backgroundImage,
            Math.min(destinationX, 0),
            Math.min(destinationY, 0),
            Math.max(width, imageWidth),
            Math.max(height, imageHeight),
        );
    }

    public render() {
        return <canvas
            ref={this.canvasRef}
            className="mx_BackdropPanel"
        />;
    }
}
