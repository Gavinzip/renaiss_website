# Community Hub classification language

## Source Role

Who published the source. Every card has exactly one role: `official`,
`official_community`, or `other`. Source Role controls which source-based view a
card can enter; it is not a content topic.

## Card Type

What kind of post this is. Every card has exactly one type: `event`,
`product_progress`, `announcement`, `market`, `report`, `guide`, or `insight`.

## Topic

What the post is about, independent of its source and format. Topics are
optional and multi-select. The only supported topics are `collectibles` and
`sbt`; a card may have no topic.

## Product Progress

An official post that identifies a concrete product, feature, protocol, or
platform capability; proves that its state changed; explains a user or platform
impact; and contains enough source evidence for that change. If any of those
four tests is missing, the post is an `announcement`, not `product_progress`.

## Product Source Filter

A browsing filter that narrows Product Progress by the official account that
canonically owns a product. A verified change published by another official
account may still support that product's timeline without changing ownership.
Official posts that do not belong to a product remain visible as standalone
account updates.

## Plan Status

The lifecycle state of a product-progress item: `upcoming`, `in_progress`,
`completed`, `cancelled`, `not_plan`, or `needs_review`. Plan Status does not
make a post Product Progress by itself.

## View

A website presentation assembled from Source Role, Card Type, Topic, and local
product grouping. A view is not a stored Topic. Official Updates is the
`official` Source Role view. Product Progress keeps strict `product_progress`
cards as evidence while also presenting related official product updates and
standalone account posts without rewriting their stored Card Type.

## Retired terms

`alpha` and `feature` are retired classification terms. `pokemon`, `official`,
`community`, `events`, `guides`, and `other` are not Topics. Pokemon content is
classified by its actual type and, when applicable, the `collectibles` Topic.
