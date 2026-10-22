# Third-party notices

Native color-role table follows Spicetify CLI v2.46.2 (MIT).
Source: https://github.com/spicetify/cli/blob/v2.46.2/src/preprocess/preprocess.go
The mod applies roles through a reversible CSSOM adapter, without modifying
Spotify's CSS files or requiring a selected standalone theme.

Material Color Utilities 0.4.0
Copyright Google LLC. Licensed under Apache License 2.0.
Source: https://github.com/material-foundation/material-color-utilities
Included in the compiled expressive-studio.js without changes to the library's source.
Full license: source/assets/expressive-motion/APACHE-2.0.txt

Roboto Flex
Copyright 2017 The Roboto Flex Project Authors.
Licensed under the SIL Open Font License 1.1.
Source: https://github.com/google/fonts/tree/main/ofl/robotoflex
Unmodified variable font, including Cyrillic.
Full license: source/assets/expressive-motion/OFL.txt

Material Symbols Rounded (Google): play_arrow, pause, skip_next,
skip_previous, shuffle, repeat, tune, palette, close.
Licensed under Apache License 2.0.
Source: https://github.com/google/material-design-icons

Material Shapes / AndroidX Graphics Shapes, via material-shapes-ts 0.3.0
Copyright The Android Open Source Project and Ruan Spies.
Apache License 2.0. The TypeScript port is by Ruan Spies, not a Google web SDK.
Source: https://github.com/ruanspies/material-shapes-ts
Original: https://github.com/androidx/androidx/tree/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3
Ready shape geometry is exported at build time into SVG files and CSS morphs;
there is no runtime download or additional geometry library in expressive-studio.js.
Cookie9Sided / Cookie4Sided, Sunny / SoftBurst, Clover4Leaf / Flower are used.

Expressive spring constants from AndroidX ExpressiveMotionTokens.kt, v0_14_0.
Copyright 2024 The Android Open Source Project. Apache License 2.0.
Source: https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt
Default spatial: stiffness 380, damping ratio 0.8.
Fast spatial: stiffness 800, damping ratio 0.6.
Slow spatial: stiffness 200, damping ratio 0.8.
Default effects: stiffness 1600, damping ratio 1.0.
Converted into sampled CSS linear() curves by source/generate-assets.mjs.

Wavy progress uses the sinusoidal geometry and wavelength/second model of
Material's LinearWavyProgressIndicator, adapted to Spotify's native seek fill.
Source: https://developer.android.com/reference/kotlin/androidx/compose/material3/LinearWavyProgressIndicator.composable
