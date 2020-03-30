# ScrollPanel

## Updates

During an onscroll event, we check whether we're getting close to the top or bottom edge of the loaded content. If close enough, we fire a request to load more through the callback passed in the `onFillRequest` prop. This returns a promise is passed down from `TimelinePanel`, where it will call paginate on the `TimelineWindow` and once the events are received back, update its state with the new events. This update trickles down to the `MessagePanel`, which rerenders all tiles and passed that to `ScrollPanel`. ScrollPanels `componentDidUpdate` method gets called, and we do the scroll housekeeping there (read below). Once the rerender has completed, the `setState` callback is called and we resolve the promise returned by `onFillRequest`. Now we check the DOM to see if we need more fill requests.

## Prevent Shrinking

ScrollPanel supports a mode to prevent it shrinking. This is used to prevent a jump when at the bottom of the timeline and people start and stop typing. It gets cleared automatically when 200px above the bottom of the timeline.


## BACAT (Bottom-Aligned, Clipped-At-Top) scrolling

BACAT scrolling implements a different way of restoring the scroll position in the timeline while tiles out of view are changing height or tiles are being added or removed. It was added in https://github.com/matrix-org/matrix-react-sdk/pull/2842.

The motivation for the changes is having noticed that setting scrollTop while scrolling tends to not work well, with it interrupting ongoing scrolling and also querying scrollTop reporting outdated values and consecutive scroll adjustments cancelling each out previous ones. This seems to be worse on macOS than other platforms, presumably because of a higher resolution in scroll events there. Also see https://github.com/vector-im/riot-web/issues/528. The BACAT approach allows to only have to change the scroll offset when adding or removing tiles.

The approach taken instead is to vertically align the timeline tiles to the bottom of the scroll container (using flexbox) and give the timeline inside the scroll container an explicit height, initially set to a multiple of the PAGE_SIZE (400px at time of writing) as needed by the content. When scrolled up, we can compensate for anything that grew below the viewport by changing the height of the timeline to maintain what's currently visible in the viewport without adjusting the scrollTop and hence without jumping.

For anything above the viewport growing or shrinking, we don't need to do anything as the timeline is bottom-aligned. We do need to update the height manually to keep all content visible as more is loaded. To maintain scroll position after the portion above the viewport changes height, we need to set the scrollTop, as we cannot balance it out with more height changes. We do this 100ms after the user has stopped scrolling, so setting scrollTop has not nasty side-effects.

As of https://github.com/matrix-org/matrix-react-sdk/pull/4166, we are scrolling to compensate for height changes by calling `scrollBy(0, x)` rather than reading and than setting `scrollTop`, as reading `scrollTop` can (again, especially on macOS) easily return values that are out of sync with what is on the screen, probably because scrolling can be done [off the main thread](https://wiki.mozilla.org/Platform/GFX/APZ) in some circumstances. This seems to further prevent jumps.

### How does it work?

`componentDidUpdate` is called when a tile in the timeline is updated (as we rerender the whole timeline) or tiles are added or removed (see Updates section before). From here, `checkScroll` is called, which calls `_restoreSavedScrollState`. Now, we increase the timeline height if something below the viewport grew by adjusting `this._bottomGrowth`. `bottomGrowth` is the height added to the timeline (on top of the height from the number of pages calculated at the last `_updateHeight` run) to compensate for growth below the viewport. This is cleared during the next run of `_updateHeight`. Remember that the tiles in the timeline are aligned to the bottom.

From `_restoreSavedScrollState` we also call `_updateHeight` which waits until the user stops scrolling for 100ms and then recalculates the amount of pages of 400px the timeline should be sized to, to be able to show all of its (newly added) content. We have to adjust the scroll offset (which is why we wait until scrolling has stopped) now because the space above the viewport has likely changed.
