# HogWare Art Direction

**Status:** Historical planning document

**Updated:** July 18, 2026

This file preserves the pre-ship art plan. The visual system and application package have shipped, so it is not the current roadmap.

## Shipped direction

HogWare now uses one consistent lost-shareware visual language:

- a beige HOGWARE 3000 CRT and black page background
- Windows 95-style desktop, program windows, controls, and disabled chrome
- a restrained PostHog-inspired palette with scanlines and flat shapes
- one dominant interaction per scene
- immediate success and failure feedback
- touch, keyboard, and reduced-motion support
- no live third-party art requests at runtime

The title, boot sequence, verb cards, games, boss, and game-over desktop all use this same shell. The social image is derived from the shipped title screen rather than introducing a separate style.

## Deferred character pass

The only deferred art item is the original HogWare hedgehog. Chris plans to hand-draw the character for AIM and a small desktop buddy. The current placeholder is acceptable for the application launch and does not block gameplay, instructions, scoring, touch input, or accessibility.

When the drawing is ready:

1. replace the AIM placeholder without changing its hitbox or timing
2. add a small desktop pose only if it remains readable at icon size
3. verify AIM success, miss, and ledge results at desktop and phone widths
4. rerun the full 32-check smoke suite

## Brand boundary

- Keep official PostHog logos and press assets unmodified.
- Do not generate or redraw Max with AI.
- Max is currently used only for the three life icons and is credited on the page.
- Game-world props, effects, and the future playable hedgehog should remain original HogWare assets.
- HogWare must continue to identify itself as a fan tribute, not an official PostHog product.
