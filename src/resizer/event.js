import {Sizer} from "./sizer";

/*
classNames:
    // class on resize-handle
    handle: string
    // class on resize-handle
    reverse: string
    // class on resize-handle
    vertical: string
    // class on container
    resizing: string
*/

function makeResizeable(container, classNames, distributorCtor, distributorCfg = undefined, sizerCtor = Sizer) {

    function isResizeHandle(el) {
        return el && el.classList.contains(classNames.handle);
    }

    function handleMouseDown(event) {
        const target = event.target;
        if (!isResizeHandle(target) || target.parentElement !== container) {
            return;
        }
        // prevent starting a drag operation
        event.preventDefault();
        // mark as currently resizing
        if (classNames.resizing) {
            container.classList.add(classNames.resizing);
        }

        const resizeHandle = event.target;
        const vertical = resizeHandle.classList.contains(classNames.vertical);
        const reverse = resizeHandle.classList.contains(classNames.reverse);
        const direction = reverse ? 0 : -1;

        const sizer = new sizerCtor(container, vertical, reverse);

        const items = Array.from(container.children).filter(el => {
            return !isResizeHandle(el) && (
                isResizeHandle(el.previousElementSibling) ||
                isResizeHandle(el.nextElementSibling));
        });
        const prevItem = resizeHandle.previousElementSibling;
        const handleIndex = items.indexOf(prevItem) + 1;
        const distributor = new distributorCtor(
            container, items, handleIndex,
            direction, sizer, distributorCfg);

        const onMouseMove = (event) => {
            const offset = sizer.offsetFromEvent(event);
            distributor.resize(offset);
        };

        const body = document.body;
        const onMouseUp = (event) => {
            if (classNames.resizing) {
                container.classList.remove(classNames.resizing);
            }
            const offset = sizer.offsetFromEvent(event);
            distributor.finish(offset);
            body.removeEventListener("mouseup", onMouseUp, false);
            body.removeEventListener("mousemove", onMouseMove, false);
        };
        body.addEventListener("mouseup", onMouseUp, false);
        body.addEventListener("mousemove", onMouseMove, false);
    }
    container.addEventListener("mousedown", handleMouseDown, false);
}

module.exports = {makeResizeable};
