# Review Guidelines

The following summarises review guidelines that we follow for pull requests in
Element Web and other supporting repos. These are just guidelines (not strict
rules) and may be updated over time.

## Code Review

When reviewing code, here are some things we look for and also things we avoid:

### We review for

* Correctness
* Performance
* Accessibility
* Security
* Quality via automated and manual testing
* Comments and documentation where needed
* Sharing knowledge of different areas among the team
* Ensuring it's something we're comfortable maintaining for the long term
* Progress indicators and local echo where appropriate with network activity

### We should avoid

* Style nits that are already handled by the linter
* Dramatically increasing scope

### Good practices

* Use empathetic language
  * See also [Mindful Communication in Code
    Reviews](https://kickstarter.engineering/a-guide-to-mindful-communication-in-code-reviews-48aab5282e5e)
    and [How to Do Code Reviews Like a Human](https://mtlynch.io/human-code-reviews-1/)
* Authors should prefer smaller commits for easier reviewing and bisection
* Reviewers should be explicit about required versus optional changes
  * Reviews are conversations and the PR author should feel comfortable
    discussing and pushing back on changes before making them
* Reviewers are encouraged to ask for tests where they believe it is reasonable
* Core team should lead by example through their tone and language
* Take the time to thank and point out good code changes
* Using softer language like "please" and "what do you think?" goes a long way
  towards making others feel like colleagues working towards a common goal

### Workflow

* Authors should request review from the element-web team by default (if someone on
  the team is clearly the expert in an area, a direct review request to them may
  be more appropriate)
* Reviewers should remove the team review request and request review from
  themselves when starting a review to avoid double review
* If there are multiple related PRs authors should reference each of the PRs in
  the others before requesting review. Reviewers might start reviewing from
  different places and could miss other required PRs.
* Avoid force pushing to a PR after the first round of review
* Use the GitHub default of merge commits when landing (avoid alternate options
  like squash or rebase)
* PR author merges after review (assuming they have write access)
* Assign issues only when in progress to indicate to others what can be picked
  up

## Code Quality

In the past, we have occasionally written different kinds of tests for
Element and the SDKs, but it hasn't been a consistent focus. Going forward, we'd
like to change that.

* For new features, code reviewers will expect some form of automated testing to
  be included by default
* For bug fixes, regression tests are of course great to have, but we don't want
  to block fixes on this, so we won't require them at this time

The above policy is not a strict rule, but instead it's meant to be a
conversation between the author and reviewer. As an author, try to think about
writing a test when making your next change. As a reviewer, try to think about
how you might test the area of code you are reviewing. If the reviewer agrees
it would be quite difficult to test some new feature, then it's okay for them to
accept the change without tests for now, but we'd eventually like to be more
strict about this further down the road.

If you do spot areas that are quite hard to test today, please let us know in
[#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org). We can
work on improving the app architecture and testing helpers so that future tests
are easier for everyone to write, but we won't know which parts are difficult
unless people shout when stumbling through them.

We recognise that this testing policy will slow things down a bit, but overall
it should encourage better long-term health of the app and give everyone more
confidence when making changes as coverage increases over time.

For changes guarded by a feature flag, we currently lean towards prioritising
our ability to evolve quickly using such flags and thus we will not currently
require tests to appear at the same time as the initial landing of features
guarded by flags, as long as (for new flagged features going forward) the
feature author understands that they are effectively deferring part of their
work (adding tests) until later and tests are expected to appear before the
feature can be enabled by default.

## Design and Product Review

We want to ensure that all changes to Element fit with our design and product
vision. We often request review from those teams so they can provide their
perspective.

In more detail, our usual process for changes that affect the UI or alter user
functionality is:

* For changes that will go live when merged, always flag Design and Product
  teams as appropriate
* For changes guarded by a feature flag, Design and Product review is not
  required (though may still be useful) since we can continue tweaking

As it can be difficult to review design work from looking at just the changed
files in a PR, a [preview site](./pr-previews.md) that includes your changes
will be added automatically so that anyone who's interested can try them out
easily.

Before starting work on a feature, it's best to ensure your plan aligns well
with our vision for Element. Please chat with the team in
[#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org) before
you start so we can ensure it's something we'd be willing to merge.
